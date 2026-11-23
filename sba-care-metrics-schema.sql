-- Monthly Care Metrics — Tier 2 ($650/mo)
-- Saved 2026-11-23, pasted by Demetrius.
-- Table: public.tier2_monthly_care_logs
-- One row = one client + one month. Generated total_workflow_runs.
-- NOT run against live Supabase.
create table if not exists public.tier2_monthly_care_logs (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null,
  care_month date not null, -- store first day of month, e.g. '2026-11-01'
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_slug, care_month)
);
