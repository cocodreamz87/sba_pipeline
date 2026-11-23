-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
create extension if not exists pgcrypto;

-- ============================================================================
-- 2. ENUM TYPES FOR DETERMINISTIC WORKFLOW STATE
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'sba_program_type') then
    create type public.sba_program_type as enum ('7a', '504', '7a+504');
  end if;

  if not exists (select 1 from pg_type where typname = 'outreach_status_type') then
    create type public.outreach_status_type as enum (
      'new',
      'enriched',
      'audit_queued',
      'contacted',
      'replied',
      'booked',
      'won',
      'disqualified',
      'archived'
    );
  end if;
end
$$;

-- ============================================================================
-- 3. MAIN TABLE: sba_prospects
-- ============================================================================
create table if not exists public.sba_prospects (
  id uuid primary key default gen_random_uuid(),

  -- Deterministic hash generated in process-sba.js from normalized entity + street + zip
  dedupe_id text not null,

  -- Normalized secondary keys to catch cross-source duplicates (Google Place ID or canonical domain)
  google_place_id text,
  normalized_domain text,

  -- SBA Loan & Borrower Metadata
  program public.sba_program_type not null default '7a',
  loan_count integer not null default 1 check (loan_count >= 1),
  borr_name text not null,
  borr_street text not null default '',
  borr_city text not null default '',
  borr_state char(2) not null default '',
  borr_zip varchar(10) not null default '',
  approval_date date,
  gross_approval numeric(14, 2) not null default 0 check (gross_approval >= 0),
  naics_code varchar(10) not null default '',
  naics_description text not null default '',
  business_age text not null default '',
  business_type text not null default '',
  is_acquisition boolean not null default false,
  jobs_supported integer not null default 0 check (jobs_supported >= 0),
  lender_name text not null default '',

  -- Google Places Enrichment Fields
  place_found boolean not null default false,
  google_name text not null default '',
  google_address text not null default '',
  website_url text not null default '',
  google_rating numeric(2, 1) check (google_rating is null or (google_rating >= 0 and google_rating <= 5)),
  google_review_count integer not null default 0 check (google_review_count >= 0),
  google_phone text not null default '',
  places_error text not null default '',

  -- Website & Intake Friction Audit Fields
  site_status text not null default 'PENDING',
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  has_booking_link boolean not null default false,
  booking_provider_detected text not null default '',
  has_form_or_intake boolean not null default false,
  form_count integer not null default 0 check (form_count >= 0),
  mailto_only_risk boolean not null default false,
  missing_viewport_meta boolean not null default false,
  friction_tags text not null default '',
  site_audit_notes text not null default '',

  -- Owner / Decision-Maker Contact Enrichment (Populated downstream)
  owner_name text not null default '',
  owner_email text not null default '',
  owner_phone text not null default '',
  linkedin_url text not null default '',

  -- Lead Scoring & Pipeline Routing
  -- Optional manual/external adjustment (-25 to +25) for enrichment signals like hiring or ad spend
  score_adjustment integer not null default 0 check (score_adjustment between -25 and 25),

  -- Deterministic base + friction score computed directly in Postgres
  computed_lead_score integer generated always as (
    least(
      100,
      greatest(
        0,
        (
          case when site_status = 'NO_WEBSITE' then 45 else 0 end
          + case when site_status in ('TIMEOUT', 'FETCH_ERROR') then 35 else 0 end
          + case when site_status <> 'NO_WEBSITE' and not has_booking_link then 25 else 0 end
          + case when response_time_ms is not null and response_time_ms >= 2500 then 15 else 0 end
          + case when mailto_only_risk then 15 else 0 end
          + case when site_status <> 'NO_WEBSITE' and not has_form_or_intake and not mailto_only_risk then 10 else 0 end
          + case when missing_viewport_meta then 10 else 0 end
          + case when google_review_count >= 50 and not has_booking_link then 10 else 0 end
          + case when is_acquisition then 5 else 0 end
          + case when gross_approval >= 500000 then 5 else 0 end
          + score_adjustment
        )
      )
    )
  ) stored,

  -- Campaign & Outreach State
  campaign_track text not null default 'GENERAL_SBA',
  outreach_status public.outreach_status_type not null default 'new',
  loom_url text not null default '',
  last_contacted_at timestamptz,
  next_followup_at timestamptz,
  notes text not null default '',

  -- Audit Timestamps
  enriched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Primary deduplication constraint on deterministic borrower + address hash
  constraint uq_sba_prospects_dedupe_id unique (dedupe_id)
);

-- ============================================================================
-- 4. PARTIAL UNIQUE INDEXES FOR SECONDARY DEDUPLICATION
-- ============================================================================
-- Prevents duplicate records if the same Google Place ID appears under a slightly different name
create unique index if not exists idx_sba_prospects_unique_place_id
  on public.sba_prospects (google_place_id)
  where google_place_id is not null and btrim(google_place_id) <> '';

-- Prevents duplicate records sharing the exact same normalized root domain
create unique index if not exists idx_sba_prospects_unique_domain
  on public.sba_prospects (normalized_domain)
  where normalized_domain is not null and btrim(normalized_domain) <> '';

-- ============================================================================
-- 5. QUERY & QUEUE INDEXES
-- ============================================================================
create index if not exists idx_sba_prospects_score_status
  on public.sba_prospects (computed_lead_score desc, outreach_status);

create index if not exists idx_sba_prospects_state_naics
  on public.sba_prospects (borr_state, naics_code);

create index if not exists idx_sba_prospects_acquisition_approval
  on public.sba_prospects (is_acquisition, approval_date desc);

create index if not exists idx_sba_prospects_followup_queue
  on public.sba_prospects (next_followup_at asc)
  where outreach_status in ('enriched', 'audit_queued', 'contacted');

-- ============================================================================
-- 6. TRIGGER: NORMALIZE DOMAIN, ASSIGN CAMPAIGN TRACK & UPDATE TIMESTAMP
-- ============================================================================
create or replace function public.fn_sba_prospects_before_write()
returns trigger
language plpgsql
as $$
declare
  cleaned_host text;
begin
  -- Always refresh updated_at
  new.updated_at := now();

  -- Normalize website_url into bare root domain (strips protocol, www., and path)
  if new.website_url is not null and btrim(new.website_url) <> '' then
    cleaned_host := regexp_replace(lower(btrim(new.website_url)), '^https?://', '');
    cleaned_host := split_part(cleaned_host, '/', 1);
    cleaned_host := split_part(cleaned_host, '?', 1);
    cleaned_host := regexp_replace(cleaned_host, '^www\.', '');
    new.normalized_domain := nullif(cleaned_host, '');
  else
    new.normalized_domain := null;
  end if;

  -- Clean empty google_place_id to NULL so partial unique index ignores blanks
  if new.google_place_id is not null and btrim(new.google_place_id) = '' then
    new.google_place_id := null;
  end if;

  -- Deterministic campaign track assignment if still on default
  if new.campaign_track = 'GENERAL_SBA' then
    if new.is_acquisition then
      new.campaign_track := 'ACQUISITION_NEW_OPERATOR';
    elsif new.google_review_count >= 50 and not new.has_booking_link then
      new.campaign_track := 'HIGH_REVIEW_LEAKY_FUNNEL';
    elsif new.program::text like '%504%' then
      new.campaign_track := 'EXPANSION_504_OPS';
    else
      new.campaign_track := 'STANDARD_SBA_INTAKE';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sba_prospects_before_write on public.sba_prospects;
create trigger trg_sba_prospects_before_write
  before insert or update on public.sba_prospects
  for each row
  execute function public.fn_sba_prospects_before_write();

-- ============================================================================
-- 7. ACTIONABLE VIEW FOR DAILY OUTREACH & LOOM PRODUCTION
-- ============================================================================
create or replace view public.v_high_priority_sba_queue as
select
  id,
  dedupe_id,
  borr_name,
  borr_city,
  borr_state,
  naics_code,
  gross_approval,
  approval_date,
  is_acquisition,
  google_rating,
  google_review_count,
  google_phone,
  website_url,
  normalized_domain,
  has_booking_link,
  booking_provider_detected,
  has_form_or_intake,
  response_time_ms,
  friction_tags,
  computed_lead_score,
  campaign_track,
  outreach_status,
  owner_name,
  owner_email,
  loom_url
from public.sba_prospects
where outreach_status in ('new', 'enriched', 'audit_queued')
  and computed_lead_score >= 65
order by computed_lead_score desc, is_acquisition desc, gross_approval desc;

-- ============================================================================
-- 8. ROW-LEVEL SECURITY (RLS) FOR SERVICE / AUTHENTICATED ACCESS
-- ============================================================================
alter table public.sba_prospects enable row level security;

-- Service role bypasses RLS automatically; restrict anon/public by default.
-- Allow authenticated internal team members full access if using Supabase Auth.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'sba_prospects' and policyname = 'Authenticated users full access'
  ) then
    create policy "Authenticated users full access"
      on public.sba_prospects
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;
