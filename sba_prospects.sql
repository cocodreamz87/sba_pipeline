-- ============================================================================
-- SBA Pipeline — Neon PostgreSQL Master Schema
-- Includes: sba_prospects, sba_outreach_touches, automation_runs,
--           v_sba_prospect_engagement, v_high_priority_sba_queue
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. ENUM TYPES FOR DETERMINISTIC WORKFLOW STATE
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
      'ready',
      'audit_queued',
      'contacted',
      'replied',
      'booked',
      'won',
      'disqualified',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'outreach_channel_type') then
    create type public.outreach_channel_type as enum (
      'email',
      'phone_call',
      'voicemail',
      'sms',
      'postcard',
      'contact_form',
      'inbound_reply'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'touch_direction_type') then
    create type public.touch_direction_type as enum ('outbound', 'inbound');
  end if;

  if not exists (select 1 from pg_type where typname = 'touch_outcome_type') then
    create type public.touch_outcome_type as enum (
      'sent',
      'delivered',
      'opened',
      'voicemail_left',
      'connected',
      'replied_interested',
      'replied_not_now',
      'replied_not_fit',
      'bounced',
      'failed',
      'dropped'
    );
  end if;
end
$$;

-- ============================================================================
-- 2. MAIN TABLE: sba_prospects
-- ============================================================================
create table if not exists public.sba_prospects (
  id uuid primary key default gen_random_uuid(),
  dedupe_id text not null,
  google_place_id text,
  normalized_domain text,
  airtable_record_id text,

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

  -- Owner / Decision-Maker Contact Enrichment
  owner_name text not null default '',
  owner_email text not null default '',
  owner_phone text not null default '',
  linkedin_url text not null default '',

  -- Lead Scoring & Pipeline Routing (aligned with enrich-sba.js)
  score_adjustment integer not null default 0 check (score_adjustment between -25 and 25),
  computed_lead_score integer generated always as (
    least(
      100,
      greatest(
        0,
        (
          case
            when site_status = 'NO_WEBSITE' then 80
            when site_status in ('TIMEOUT', 'FETCH_ERROR') then 70
            else (
              40
              + case when not has_booking_link then 25 else 0 end
              + case when response_time_ms is not null and response_time_ms >= 2500 then 15 else 0 end
              + case when mailto_only_risk then 15 else 0 end
              + case when not has_form_or_intake and not mailto_only_risk then 10 else 0 end
              + case when missing_viewport_meta then 10 else 0 end
            )
          end
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

  constraint uq_sba_prospects_dedupe_id unique (dedupe_id)
);

create unique index if not exists idx_sba_prospects_unique_place_id
  on public.sba_prospects (google_place_id)
  where google_place_id is not null and btrim(google_place_id) <> '';

create unique index if not exists idx_sba_prospects_unique_domain
  on public.sba_prospects (normalized_domain)
  where normalized_domain is not null and btrim(normalized_domain) <> '';

create index if not exists idx_sba_prospects_score_status
  on public.sba_prospects (computed_lead_score desc, outreach_status);

create index if not exists idx_sba_prospects_state_naics
  on public.sba_prospects (borr_state, naics_code);

create index if not exists idx_sba_prospects_acquisition_approval
  on public.sba_prospects (is_acquisition, approval_date desc);

create index if not exists idx_sba_prospects_followup_queue
  on public.sba_prospects (next_followup_at asc)
  where outreach_status in ('enriched', 'ready', 'audit_queued', 'contacted');

-- ============================================================================
-- 3. TRIGGER: NORMALIZE DOMAIN, ASSIGN CAMPAIGN TRACK & UPDATE TIMESTAMP
-- ============================================================================
create or replace function public.fn_sba_prospects_before_write()
returns trigger
language plpgsql
as $$
declare
  cleaned_host text;
begin
  new.updated_at := now();

  if new.website_url is not null and btrim(new.website_url) <> '' then
    cleaned_host := regexp_replace(lower(btrim(new.website_url)), '^https?://', '');
    cleaned_host := split_part(cleaned_host, '/', 1);
    cleaned_host := split_part(cleaned_host, '?', 1);
    cleaned_host := regexp_replace(cleaned_host, '^www\.', '');
    new.normalized_domain := nullif(cleaned_host, '');
  else
    new.normalized_domain := null;
  end if;

  if new.google_place_id is not null and btrim(new.google_place_id) = '' then
    new.google_place_id := null;
  end if;

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
-- 4. OUTREACH TOUCHES TABLE & STATUS SYNC TRIGGER
-- ============================================================================
create table if not exists public.sba_outreach_touches (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.sba_prospects(id) on delete cascade,
  external_event_id text not null,
  channel public.outreach_channel_type not null,
  direction public.touch_direction_type not null,
  sequence_name text not null default 'MANUAL',
  sequence_step integer not null default 1 check (sequence_step >= 1),
  subject_line text not null default '',
  message_summary text not null default '',
  outcome public.touch_outcome_type not null default 'sent',
  reply_sentiment text not null default '',
  reply_excerpt text not null default '',
  next_followup_at timestamptz,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint uq_sba_touches_external_event unique (external_event_id)
);

create index if not exists idx_sba_touches_prospect_occurred
  on public.sba_outreach_touches (prospect_id, occurred_at desc);

create index if not exists idx_sba_touches_sequence_occurred
  on public.sba_outreach_touches (sequence_name, occurred_at desc);

create or replace function public.fn_sba_touches_after_insert()
returns trigger
language plpgsql
as $$
begin
  update public.sba_prospects
  set
    last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at),
    next_followup_at = case
      when new.outcome in ('replied_not_fit', 'bounced') then null
      when new.next_followup_at is not null then new.next_followup_at
      else next_followup_at
    end,
    outreach_status = case
      when new.outcome = 'replied_not_fit' then 'disqualified'::public.outreach_status_type
      when new.direction = 'inbound' then 'replied'::public.outreach_status_type
      when outreach_status in ('new', 'enriched', 'ready', 'audit_queued') then 'contacted'::public.outreach_status_type
      else outreach_status
    end
  where id = new.prospect_id;

  return new;
end;
$$;

drop trigger if exists trg_sba_touches_after_insert on public.sba_outreach_touches;
create trigger trg_sba_touches_after_insert
  after insert on public.sba_outreach_touches
  for each row
  execute function public.fn_sba_touches_after_insert();

-- ============================================================================
-- 5. MAKE SCENARIO EXECUTION LOGS: automation_runs
-- ============================================================================
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  execution_id text unique,
  client_slug text not null default 'default_client',
  workflow_id text,
  workflow_name text not null,
  failed_node text,
  status text not null default 'failed' check (status in ('success', 'ok', 'completed', 'error', 'failed', 'timeout', 'rejected')),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  records_processed integer not null default 0 check (records_processed >= 0),
  error_message text not null default 'Unspecified error',
  execution_url text,
  payload_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_runs_created_at
  on public.automation_runs (created_at desc);

create index if not exists idx_automation_runs_client_month
  on public.automation_runs (client_slug, created_at desc);

create index if not exists idx_automation_runs_workflow_created
  on public.automation_runs (workflow_name, created_at desc);

-- ============================================================================
-- 6. ENGAGEMENT & PRIORITY VIEWS
-- ============================================================================
create or replace view public.v_sba_prospect_engagement as
with touch_stats as (
  select
    t.prospect_id,
    count(*) as total_touches,
    count(*) filter (where t.channel = 'email') as email_count,
    count(*) filter (where t.channel in ('phone_call', 'voicemail')) as call_and_vm_count,
    count(*) filter (where t.direction = 'inbound') as inbound_replies,
    max(t.occurred_at) as latest_touch_at
  from public.sba_outreach_touches t
  group by t.prospect_id
),
latest_touch as (
  select distinct on (t.prospect_id)
    t.prospect_id,
    t.outcome::text as latest_outcome
  from public.sba_outreach_touches t
  order by t.prospect_id, t.occurred_at desc, t.created_at desc
)
select
  p.id as prospect_id,
  p.dedupe_id,
  p.borr_name,
  p.borr_city,
  p.borr_state,
  p.campaign_track,
  p.computed_lead_score,
  p.outreach_status,
  p.owner_email,
  p.owner_phone,
  p.google_phone,
  p.last_contacted_at,
  p.next_followup_at,
  coalesce(ts.total_touches, 0)::integer as total_touches,
  coalesce(ts.email_count, 0)::integer as email_count,
  coalesce(ts.call_and_vm_count, 0)::integer as call_and_vm_count,
  coalesce(ts.inbound_replies, 0)::integer as inbound_replies,
  lt.latest_outcome
from public.sba_prospects p
left join touch_stats ts on ts.prospect_id = p.id
left join latest_touch lt on lt.prospect_id = p.id;

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
where outreach_status in ('new', 'enriched', 'ready', 'audit_queued')
  and computed_lead_score >= 65
order by computed_lead_score desc, is_acquisition desc, gross_approval desc;
