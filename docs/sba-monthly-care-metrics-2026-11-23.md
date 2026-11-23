# Monthly Care Metrics Log — Tier 2 ($650/mo)

Saved 2026-11-23, pasted by Demetrius.
Track uptime, workflow runs, errors, and tweaks per Tier 2 client — pull numbers in minutes at month-end, spot recurring reliability issues early, ready-made facts for the monthly care recap.

## Core Fields per Monthly Care Record (one row = one client + one month)

| Field Group | Column / Key Name | Type | What It Captures |
| --- | --- | --- | --- |
| Identity | `client_slug` / `care_month` | `text` / `date` | Client identifier and billing month (e.g., `apex_hvac`, `2026-11-01`) |
| Uptime | `site_uptime_pct` | `numeric` | Observed site availability percentage for the month (e.g., `99.98`) |
| Uptime | `downtime_incidents_count` | `integer` | Number of unplanned site/endpoint outages (`0` on clean months) |
| Uptime | `downtime_notes` | `text` | Brief cause/duration if an outage occurred (or `"None"`) |
| Workflow Runs | `wf1_lead_runs` | `integer` | Total executions of Workflow 1 (Speed-to-Lead & Routing) |
| Workflow Runs | `wf2_booking_runs` | `integer` | Total executions of Workflow 2 (Booking & Reminders) |
| Workflow Runs | `wf3_followup_runs` | `integer` | Total executions of Workflow 3 (Review / Follow-Up Loop) |
| Errors | `failed_runs_count` | `integer` | Failed or errored workflow/webhook executions during the month |
| Errors | `dropped_or_retried_count` | `integer` | Events requiring manual replay, credential refresh, or retry |
| Errors | `top_error_summary` | `text` | Short root-cause note (e.g., `"Rate-limit retry on SMS provider"` or `"None"`) |
| Tweaks | `care_tweaks_count` | `integer` | Minor adjustments completed inside the `$650/mo` care plan |
| Tweaks | `care_tweaks_summary` | `text` | Concise summary of copy, link, timing, or routing adjustments shipped |
| Scope Boundary | `change_orders_count` / `change_order_revenue` | `integer` / `numeric` | Approved billable change orders and total add-on revenue that month |

## SQL Schema

Full DDL in `sba-lead-pipeline/sba-care-metrics-schema.sql` (`public.tier2_monthly_care_logs`, generated `total_workflow_runs`, unique on `client_slug, care_month`). **Not run against live Supabase.**

## JSON / Spreadsheet Log Example

```json
{
  "client_slug": "apex_hvac",
  "care_month": "2026-11-01",
  "site_uptime_pct": 99.96,
  "downtime_incidents_count": 0,
  "downtime_notes": "None",
  "wf1_lead_runs": 48,
  "wf2_booking_runs": 36,
  "wf3_followup_runs": 29,
  "total_workflow_runs": 113,
  "failed_runs_count": 1,
  "dropped_or_retried_count": 1,
  "top_error_summary": "1 transient webhook timeout; retried and succeeded cleanly",
  "care_tweaks_count": 2,
  "care_tweaks_summary": "Updated booking reminder lead time from 24h to 18h; clarified service-area copy on /quote",
  "change_orders_count": 0,
  "change_order_revenue": 0.00
}
```

## Maintenance Rules

- **Log at month-end in 5 minutes:** Don't over-engineer complex BI charts — one clean row per client at the end of each month gives you everything needed for your monthly recap and renewal check-ins.
- **Track errors separately from tweaks:** Keeping `failed_runs_count` distinct from `care_tweaks_count` makes it obvious whether a client's month required stability fixes versus proactive refinements.
- **Watch repeat error roots:** If the same `top_error_summary` shows up two months in a row, fix the underlying workflow/webhook guard once rather than manually patching around it each month.
