-- Monthly Care Upsert — public.automation_runs -> public.tier2_monthly_care_logs
-- Saved 2026-11-23, pasted by Demetrius.
--
-- Aggregates runs for the current calendar month (America/New_York month
-- boundary) and upserts on conflict (client_slug, care_month).
-- SAFE: only workflow counts, error counts, top_error_summary, updated_at
-- are refreshed — site_uptime_pct, care_tweaks_*, change_orders_* are left
-- intact. Idempotent: rerun daily or at month-end, no duplicate rows.
--
-- FLAG — BLOCKED: depends on public.automation_runs and
-- public.tier2_monthly_care_logs. Neither table exists in live Supabase yet
-- (schemas saved: sba-automation-runs-schema.sql, sba-care-metrics-schema.sql).
-- Do not run against live Supabase until both are created.
--
-- Workflow mapping (case-insensitive, by workflow_name):
--   wf1: wf1 / workflow_1 / speed_to_lead / lead_routing / like '%lead%'
--   wf2: wf2 / workflow_2 / booking_reminders / appointments / like '%book%' or '%remind%'
--   wf3: wf3 / workflow_3 / review_followup / follow_up / like '%follow%' or '%review%'
-- top_error_summary = most frequent error message that month (ties broken by
-- most recent), 'None' when zero errors.
with monthly_stats as (
  select
    coalesce(nullif(btrim(client_slug), ''), 'default_client') as client_slug,
    (date_trunc('month', now() at time zone 'America/New_York'))::date as care_month,
    count(*) filter (
      where lower(btrim(workflow_name)) in ('wf1', 'workflow_1', 'speed_to_lead', 'lead_routing')
         or lower(btrim(workflow_name)) like '%lead%'
    ) as wf1_lead_runs,
    count(*) filter (
      where lower(btrim(workflow_name)) in ('wf2', 'workflow_2', 'booking_reminders', 'appointments')
         or lower(btrim(workflow_name)) like '%book%'
         or lower(btrim(workflow_name)) like '%remind%'
    ) as wf2_booking_runs,
    count(*) filter (
      where lower(btrim(workflow_name)) in ('wf3', 'workflow_3', 'review_followup', 'follow_up')
         or lower(btrim(workflow_name)) like '%follow%'
         or lower(btrim(workflow_name)) like '%review%'
    ) as wf3_followup_runs,
    count(*) filter (
      where lower(btrim(status)) in ('error', 'failed', 'timeout', 'rejected')
    ) as failed_runs_count,
    count(*) filter (
      where lower(btrim(status)) in ('timeout', 'rejected')
         or lower(coalesce(error_message, '')) like '%retry%'
         or lower(coalesce(error_message, '')) like '%drop%'
    ) as dropped_or_retried_count,
    coalesce(
      (
        select coalesce(nullif(btrim(r2.error_message), ''), 'Unspecified error')
        from public.automation_runs r2
        where coalesce(nullif(btrim(r2.client_slug), ''), 'default_client') = coalesce(nullif(btrim(r1.client_slug), ''), 'default_client')
          and (date_trunc('month', r2.created_at at time zone 'America/New_York'))::date = (date_trunc('month', now() at time zone 'America/New_York'))::date
          and lower(btrim(r2.status)) in ('error', 'failed', 'timeout', 'rejected')
        group by coalesce(nullif(btrim(r2.error_message), ''), 'Unspecified error')
        order by count(*) desc, max(r2.created_at) desc
        limit 1
      ),
      'None'
    ) as top_error_summary
  from public.automation_runs r1
  where r1.created_at >= date_trunc('month', now() at time zone 'America/New_York') at time zone 'America/New_York'
    and r1.created_at < (date_trunc('month', now() at time zone 'America/New_York') + interval '1 month') at time zone 'America/New_York'
  group by 1, 2
)
insert into public.tier2_monthly_care_logs (
  client_slug,
  care_month,
  wf1_lead_runs,
  wf2_booking_runs,
  wf3_followup_runs,
  failed_runs_count,
  dropped_or_retried_count,
  top_error_summary
)
select
  client_slug,
  care_month,
  wf1_lead_runs,
  wf2_booking_runs,
  wf3_followup_runs,
  failed_runs_count,
  dropped_or_retried_count,
  top_error_summary
from monthly_stats
on conflict (client_slug, care_month) do update
set
  wf1_lead_runs = excluded.wf1_lead_runs,
  wf2_booking_runs = excluded.wf2_booking_runs,
  wf3_followup_runs = excluded.wf3_followup_runs,
  failed_runs_count = excluded.failed_runs_count,
  dropped_or_retried_count = excluded.dropped_or_retried_count,
  top_error_summary = excluded.top_error_summary,
  updated_at = now();
