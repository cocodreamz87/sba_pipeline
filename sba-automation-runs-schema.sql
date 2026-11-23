-- Automation Runs log — public.automation_runs
-- Saved 2026-11-23, pasted by Demetrius (part of the n8n Global Error Workflow).
-- Unique constraint on execution_id so retries / duplicate error hooks never
-- double-log the same failed run.
-- NOT run against live Supabase.
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  execution_id text unique,
  client_slug text not null default 'default_client',
  workflow_id text,
  workflow_name text not null,
  failed_node text,
  status text not null default 'failed',
  error_message text not null default 'Unspecified error',
  execution_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_runs_created_at
  on public.automation_runs (created_at desc);

create index if not exists idx_automation_runs_client_month
  on public.automation_runs (client_slug, created_at desc);
