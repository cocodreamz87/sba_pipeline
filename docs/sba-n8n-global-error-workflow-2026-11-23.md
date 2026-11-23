# n8n Global Error Workflow — Global Error Logger → Supabase

Saved 2026-11-23, pasted by Demetrius.
Catches any failed production workflow execution, normalizes the error payload, logs a clean row into `public.automation_runs`, optionally pings Slack. Plugs into the monthly care rollup and failure triage SQL queries.

## Target Schema

`public.automation_runs` — full DDL in `sba-lead-pipeline/sba-automation-runs-schema.sql` (unique `execution_id`, indexes on `created_at desc` and `(client_slug, created_at desc)`). **Not run against live Supabase.**

## Architecture (3 nodes)

Create one dedicated workflow named **`Global Error Logger -> Supabase`** and assign it under **Settings → Error Workflow** on each client workflow you want monitored.

| Node Order | n8n Node | Purpose |
| --- | --- | --- |
| 1 | Error Trigger | Fires automatically whenever a linked workflow crashes or hits an unhandled node failure. |
| 2 | Code (JavaScript) — Normalize Error Payload | Extracts `workflow_name`, `client_slug` (via naming convention or tag), `failed_node`, `error_message`, `execution_id`, `execution_url`. Code saved as `sba-lead-pipeline/sba-n8n-error-normalize.js`. |
| 3 | Postgres (or HTTP Request to Supabase REST) | Inserts/upserts the normalized failure row into `public.automation_runs` (with an optional parallel Slack node for immediate alerts). |

Naming convention: client workflows named **`apex_hvac | wf1_speed_to_lead`** so the Code node parses `client_slug` and `workflow_name` without lookup tables.

## Node 3: Insert into Supabase

**Option A — Postgres node (Execute Query):**

```sql
insert into public.automation_runs (
  execution_id,
  client_slug,
  workflow_id,
  workflow_name,
  failed_node,
  status,
  error_message,
  execution_url,
  created_at
)
values (
  '{{ $json.execution_id }}',
  '{{ $json.client_slug }}',
  {{ $json.workflow_id ? "'" + $json.workflow_id + "'" : "null" }},
  '{{ $json.workflow_name.replace(/'/g, "''") }}',
  '{{ $json.failed_node.replace(/'/g, "''") }}',
  '{{ $json.status }}',
  '{{ $json.error_message.replace(/'/g, "''") }}',
  {{ $json.execution_url ? "'" + $json.execution_url + "'" : "null" }},
  '{{ $json.created_at }}'::timestamptz
)
on conflict (execution_id) do nothing;
```

Tip: parameterized query parameters `$1, $2, ...` in n8n's Postgres node are even cleaner than string interpolation so quotes in stack traces never break SQL syntax.

**Option B — HTTP Request node (POST to Supabase REST API):**
- URL: `https://<YOUR_PROJECT_REF>.supabase.co/rest/v1/automation_runs?on_conflict=execution_id`
- Headers: `apikey: <SUPABASE_SERVICE_ROLE_KEY>`, `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`, `Content-Type: application/json`, `Prefer: resolution=ignore-duplicates,return=minimal`
- Body: the JSON object emitted by Node 2 directly (`{{ JSON.stringify($json) }}`).

## Operational Guardrails

- **Never assign the error workflow to itself:** Leave **Settings → Error Workflow** blank on `Global Error Logger -> Supabase` to avoid infinite error recursion if Supabase ever experiences brief downtime.
- **Pair with a Slack alert branch:** Branch Node 2 into a lightweight Slack webhook/node posting `[{{ $json.client_slug }}] {{ $json.workflow_name }} failed at {{ $json.failed_node }}: {{ $json.error_message }}` so high-priority client failures surface immediately while the monthly SQL rollup stays automated.
