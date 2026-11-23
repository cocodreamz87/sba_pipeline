-- SBA Workflow Run & Error Queries
-- Saved 2026-11-23, pasted by Demetrius.
--
-- FLAG — BLOCKED: queries 1, 3, 5 depend on public.sba_outreach_touches,
-- which does NOT exist in sba_prospects.sql. Queries 2, 4, 6 depend on
-- public.automation_runs, a dedicated execution-log table that does not
-- exist anywhere yet — build it (workflow_name, status, error_message,
-- created_at) before running those. Do not run against live Supabase until then.
--
-- Tips: use count(*) filter (where ...) so totals and errors come from one
-- aggregation pass; nullif(count(*), 0) avoids divide-by-zero; keep
-- status/outcome strings normalized (success, failed, replied_interested,
-- replied_not_now, replied_not_fit) so counts stay deterministic.

-- ============================================================================
-- 1. Runs & errors by sequence_name — public.sba_outreach_touches, last 30 days
-- ============================================================================
select
  coalesce(nullif(btrim(sequence_name), ''), 'unassigned_sequence') as workflow_or_sequence,
  count(*) as total_runs,
  count(*) filter (where direction = 'outbound') as outbound_touches,
  count(*) filter (where direction = 'inbound') as inbound_replies,
  count(*) filter (
    where outcome::text ilike '%fail%'
       or outcome::text ilike '%error%'
       or outcome::text ilike '%bounce%'
       or outcome::text ilike '%drop%'
  ) as error_count,
  round(
    100.0 * count(*) filter (
      where outcome::text ilike '%fail%'
         or outcome::text ilike '%error%'
         or outcome::text ilike '%bounce%'
         or outcome::text ilike '%drop%'
    ) / nullif(count(*), 0),
    2
  ) as error_rate_pct,
  max(occurred_at) as last_run_at
from public.sba_outreach_touches
where occurred_at >= now() - interval '30 days'
group by 1
order by error_count desc, total_runs desc;

-- ============================================================================
-- 2. Runs & errors by workflow_name — public.automation_runs, current month (ET)
-- ============================================================================
select
  coalesce(nullif(btrim(workflow_name), ''), 'unnamed_workflow') as workflow_name,
  count(*) as total_runs,
  count(*) filter (where lower(status) in ('success', 'ok', 'completed')) as success_runs,
  count(*) filter (where lower(status) in ('error', 'failed', 'timeout', 'rejected')) as error_count,
  round(
    100.0 * count(*) filter (where lower(status) in ('error', 'failed', 'timeout', 'rejected'))
    / nullif(count(*), 0),
    2
  ) as error_rate_pct,
  max(created_at) as last_run_at,
  max(error_message) filter (where lower(status) in ('error', 'failed', 'timeout', 'rejected')) as latest_error_message
from public.automation_runs
where created_at >= date_trunc('month', now() at time zone 'America/New_York') at time zone 'America/New_York'
group by 1
order by error_count desc, total_runs desc;

-- ============================================================================
-- 3. 20 most recent failed runs — public.automation_runs
-- ============================================================================
select
  id,
  created_at at time zone 'America/New_York' as occurred_at_et,
  created_at as occurred_at_utc,
  coalesce(nullif(btrim(workflow_name), ''), 'unnamed_workflow') as workflow_name,
  status,
  coalesce(nullif(btrim(error_message), ''), 'No error message recorded') as error_message
from public.automation_runs
where lower(btrim(status)) in ('error', 'failed', 'timeout', 'rejected')
order by created_at desc
limit 20;

-- ============================================================================
-- 4. 20 most recent failed touches — public.sba_outreach_touches
-- ============================================================================
select
  t.id as touch_id,
  t.occurred_at at time zone 'America/New_York' as occurred_at_et,
  t.occurred_at as occurred_at_utc,
  coalesce(nullif(btrim(t.sequence_name), ''), 'unassigned_sequence') as workflow_name,
  t.channel,
  t.direction,
  t.outcome,
  coalesce(
    nullif(btrim(t.reply_excerpt), ''),
    nullif(btrim(t.message_summary), ''),
    'No error detail recorded'
  ) as error_message,
  p.borr_name
from public.sba_outreach_touches t
left join public.sba_prospects p on p.id = t.prospect_id
where t.outcome::text ilike '%fail%'
   or t.outcome::text ilike '%error%'
   or t.outcome::text ilike '%bounce%'
   or t.outcome::text ilike '%drop%'
order by t.occurred_at desc
limit 20;

-- ============================================================================
-- 5. Failed runs grouped by workflow & error — public.automation_runs, last 7 days
-- ============================================================================
select
  coalesce(nullif(btrim(workflow_name), ''), 'unnamed_workflow') as workflow_name,
  coalesce(nullif(btrim(error_message), ''), 'No error message recorded') as error_message,
  count(*) as failure_count,
  min(created_at) at time zone 'America/New_York' as first_seen_et,
  max(created_at) at time zone 'America/New_York' as last_seen_et
from public.automation_runs
where created_at >= now() - interval '7 days'
  and lower(btrim(status)) in ('error', 'failed', 'timeout', 'rejected')
group by 1, 2
order by failure_count desc, last_seen_et desc;

-- ============================================================================
-- 6. Failed touches grouped by sequence & error — public.sba_outreach_touches, last 7 days
-- ============================================================================
select
  coalesce(nullif(btrim(sequence_name), ''), 'unassigned_sequence') as workflow_name,
  coalesce(
    nullif(btrim(reply_excerpt), ''),
    nullif(btrim(message_summary), ''),
    outcome::text
  ) as error_message,
  count(*) as failure_count,
  min(occurred_at) at time zone 'America/New_York' as first_seen_et,
  max(occurred_at) at time zone 'America/New_York' as last_seen_et
from public.sba_outreach_touches
where occurred_at >= now() - interval '7 days'
  and (
    outcome::text ilike '%fail%'
    or outcome::text ilike '%error%'
    or outcome::text ilike '%bounce%'
    or outcome::text ilike '%drop%'
  )
group by 1, 2
order by failure_count desc, last_seen_et desc;

-- Guardrails: show both ET and UTC to correlate with n8n logs, Slack alerts,
-- and cron schedules (08:00 AM ET). failure_count >= 2 over 7 days = candidate
-- for a permanent workflow guard (retry backoff, payload validation, token fix).
-- Tight first/last window = transient outage/rate limit; errors spanning days =
-- broken credential, webhook URL, or schema mismatch.
