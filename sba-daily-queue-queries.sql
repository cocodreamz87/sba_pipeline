-- ============================================================================
-- SBA Daily Outbound Queue Queries (Neon PostgreSQL)
-- Runnable against public.v_sba_prospect_engagement and public.sba_prospects.
-- Timezone: due-date filters anchor to end of today in America/New_York.
-- Best contact fallback: owner_phone -> google_phone, owner_email as-is.
-- ============================================================================

-- ============================================================================
-- 1. Today's Due Follow-Up Nudges
-- ============================================================================
select
  e.prospect_id,
  e.dedupe_id,
  e.borr_name,
  p.is_acquisition,
  p.gross_approval,
  e.borr_city,
  e.borr_state,
  e.campaign_track,
  e.computed_lead_score,
  e.outreach_status,
  e.total_touches,
  e.email_count,
  e.call_and_vm_count,
  e.inbound_replies,
  e.latest_outcome,
  e.last_contacted_at,
  e.next_followup_at,
  coalesce(nullif(btrim(e.owner_email), ''), '') as best_email,
  coalesce(nullif(btrim(e.owner_phone), ''), nullif(btrim(e.google_phone), ''), '') as best_phone,
  p.website_url,
  p.friction_tags
from public.v_sba_prospect_engagement e
join public.sba_prospects p on p.id = e.prospect_id
where e.outreach_status not in ('booked', 'won', 'archived', 'disqualified')
  and e.next_followup_at is not null
  and e.next_followup_at <= (date_trunc('day', now() at time zone 'America/New_York') + interval '1 day') at time zone 'America/New_York'
order by
  e.next_followup_at asc,
  e.computed_lead_score desc,
  p.is_acquisition desc;

-- ============================================================================
-- 2. Uncontacted High-Score Leads (total_touches = 0, score >= 60, limit 25)
-- ============================================================================
select
  e.prospect_id,
  e.dedupe_id,
  e.borr_name,
  p.is_acquisition,
  p.gross_approval,
  p.google_review_count,
  e.borr_city,
  e.borr_state,
  e.campaign_track,
  e.computed_lead_score,
  e.outreach_status,
  p.website_url,
  p.site_status,
  p.has_booking_link,
  p.friction_tags,
  coalesce(nullif(btrim(e.owner_email), ''), '') as best_email,
  coalesce(nullif(btrim(e.owner_phone), ''), nullif(btrim(e.google_phone), ''), '') as best_phone
from public.v_sba_prospect_engagement e
join public.sba_prospects p on p.id = e.prospect_id
where e.total_touches = 0
  and e.outreach_status in ('new', 'enriched', 'ready')
  and e.computed_lead_score >= 60
order by
  e.computed_lead_score desc,
  p.is_acquisition desc,
  p.gross_approval desc,
  p.google_review_count desc
limit 25;

-- ============================================================================
-- 3. Combined Daily Outbound Queue (Follow-Ups + New High-Score Leads)
-- ============================================================================
with due_nudges as (
  select
    1 as priority_rank,
    'FOLLOWUP_DUE'::text as queue_bucket,
    e.prospect_id,
    e.borr_name,
    p.is_acquisition,
    e.borr_city,
    e.borr_state,
    e.campaign_track,
    e.computed_lead_score,
    e.outreach_status,
    e.total_touches,
    e.latest_outcome,
    e.next_followup_at,
    coalesce(nullif(btrim(e.owner_email), ''), '') as best_email,
    coalesce(nullif(btrim(e.owner_phone), ''), nullif(btrim(e.google_phone), ''), '') as best_phone,
    p.website_url,
    p.friction_tags
  from public.v_sba_prospect_engagement e
  join public.sba_prospects p on p.id = e.prospect_id
  where e.outreach_status not in ('booked', 'won', 'archived', 'disqualified')
    and e.next_followup_at is not null
    and e.next_followup_at <= (date_trunc('day', now() at time zone 'America/New_York') + interval '1 day') at time zone 'America/New_York'
),
fresh_high_score as (
  select
    2 as priority_rank,
    'NEW_HIGH_SCORE'::text as queue_bucket,
    e.prospect_id,
    e.borr_name,
    p.is_acquisition,
    e.borr_city,
    e.borr_state,
    e.campaign_track,
    e.computed_lead_score,
    e.outreach_status,
    e.total_touches,
    e.latest_outcome,
    e.next_followup_at,
    coalesce(nullif(btrim(e.owner_email), ''), '') as best_email,
    coalesce(nullif(btrim(e.owner_phone), ''), nullif(btrim(e.google_phone), ''), '') as best_phone,
    p.website_url,
    p.friction_tags
  from public.v_sba_prospect_engagement e
  join public.sba_prospects p on p.id = e.prospect_id
  where e.total_touches = 0
    and e.outreach_status in ('new', 'enriched', 'ready')
    and e.computed_lead_score >= 60
  order by
    e.computed_lead_score desc,
    p.is_acquisition desc,
    p.gross_approval desc
  limit 20
)
select *
from (
  select * from due_nudges
  union all
  select * from fresh_high_score
) combined
order by
  priority_rank asc,
  next_followup_at asc nulls last,
  computed_lead_score desc,
  is_acquisition desc;
