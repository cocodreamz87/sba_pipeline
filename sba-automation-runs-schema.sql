-- Automation Runs log — public.automation_runs (Neon PostgreSQL)
-- Stores Make scenario execution successes, timeouts, and failures.
-- Unique constraint on execution_id so retries / duplicate error hooks never double-log.
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
