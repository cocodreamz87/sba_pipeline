-- ============================================================================
-- SBA Make Scenario Run & Error Queries (Neon PostgreSQL)
-- Runnable against public.automation_runs and public.sba_outreach_touches.
-- Uses single-pass COUNT(*) FILTER (WHERE ...) and NULLIF(..., 0).
-- ============================================================================

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
-- 2. Make scenario runs & errors by workflow_name — current month (ET)
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
  round(avg(duration_ms)) as avg_duration_ms,
  max(created_at) as last_run_at,
  max(error_message) filter (where lower(status) in ('error', 'failed', 'timeout', 'rejected')) as latest_error_message
from public.automation_runs
where created_at >= date_trunc('month', now() at time zone 'America/New_York') at time zone 'America/New_York'
group by 1
order by error_count desc, total_runs desc;

-- ============================================================================
-- 3. 20 most recent failed Make runs — public.automation_runs
-- ============================================================================
select
  id,
  execution_id,
  client_slug,
  workflow_id,
  coalesce(nullif(btrim(workflow_name), ''), 'unnamed_workflow') as workflow_name,
  coalesce(nullif(btrim(failed_node), ''), 'unknown_module') as failed_node,
  status,
  coalesce(nullif(btrim(error_message), ''), 'No error message recorded') as error_message,
  execution_url,
  created_at at time zone 'America/New_York' as occurred_at_et,
  created_at as occurred_at_utc
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
-- 5. Failed Make runs grouped by workflow & error — last 7 days
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
-- 6. Failed touches grouped by sequence & error — last 7 days
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
