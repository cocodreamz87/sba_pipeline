-- ============================================================================
-- Monthly Care Metrics — Tier 2 ($650/mo) — Neon PostgreSQL
-- Table: public.tier2_monthly_care_logs
-- One row = one client + one month. Generated total_workflow_runs.
-- ============================================================================

create table if not exists public.tier2_monthly_care_logs (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null,
  care_month date not null, -- first day of month, e.g. '2026-11-01'
  site_uptime_pct numeric(5,2) not null default 100.00,
  downtime_incidents_count integer not null default 0,
  downtime_notes text not null default 'None',
  wf1_lead_runs integer not null default 0,
  wf2_booking_runs integer not null default 0,
  wf3_followup_runs integer not null default 0,
  total_workflow_runs integer generated always as (
    coalesce(wf1_lead_runs, 0) +
    coalesce(wf2_booking_runs, 0) +
    coalesce(wf3_followup_runs, 0)
  ) stored,
  failed_runs_count integer not null default 0,
  dropped_or_retried_count integer not null default 0,
  top_error_summary text not null default 'None',
  care_tweaks_count integer not null default 0,
  care_tweaks_summary text not null default 'Routine health check & monitoring',
  change_orders_count integer not null default 0,
  change_order_revenue numeric(10,2) not null default 0.00,
  airtable_record_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_slug, care_month)
);

-- ============================================================================
-- Deterministic Month-End Rollup Upsert (from public.automation_runs)
-- Aggregates Make scenario executions into tier2_monthly_care_logs
-- ============================================================================
-- Parameters: replace 'coco_club_live' and '2026-11-01'::date per client/month
insert into public.tier2_monthly_care_logs (
  client_slug,
  care_month,
  wf1_lead_runs,
  wf2_booking_runs,
  wf3_followup_runs,
  failed_runs_count,
  top_error_summary,
  updated_at
)
select
  r.client_slug,
  date_trunc('month', r.created_at at time zone 'America/New_York')::date as care_month,
  count(*) filter (where r.workflow_name = 'wf1_lead_routing') as wf1_lead_runs,
  count(*) filter (where r.workflow_name = 'wf2_booking_reminders') as wf2_booking_runs,
  count(*) filter (where r.workflow_name = 'wf3_followup_loop') as wf3_followup_runs,
  count(*) filter (where lower(r.status) in ('error', 'failed', 'timeout', 'rejected')) as failed_runs_count,
  coalesce(
    max(nullif(btrim(r.error_message), '')) filter (
      where lower(r.status) in ('error', 'failed', 'timeout', 'rejected')
    ),
    'None'
  ) as top_error_summary,
  now() as updated_at
from public.automation_runs r
where r.client_slug = 'coco_club_live'
  and date_trunc('month', r.created_at at time zone 'America/New_York')::date = '2026-11-01'::date
group by 1, 2
on conflict (client_slug, care_month) do update
set
  wf1_lead_runs = excluded.wf1_lead_runs,
  wf2_booking_runs = excluded.wf2_booking_runs,
  wf3_followup_runs = excluded.wf3_followup_runs,
  failed_runs_count = excluded.failed_runs_count,
  top_error_summary = excluded.top_error_summary,
  updated_at = now();
