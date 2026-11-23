# SBA Inbound Reply Webhook

Saved 2026-11-23, pasted by Demetrius.
Receives inbound email/SMS replies, matches sender to `public.sba_prospects`, classifies deterministically (zero AI calls), inserts an idempotent row into `public.sba_outreach_touches`.

## Files

| File | What it is |
| --- | --- |
| `sba-n8n-inbound-reply-workflow.json` | Unsecured version — 7 nodes, responseMode onReceived |
| `sba-n8n-inbound-reply-workflow-secured.json` | **Canonical — use this one.** 10 nodes, shared-secret gate (`X-Webhook-Secret` vs `$env.SBA_WEBHOOK_SECRET`), 401 on fail, 200 on accept |
| `sba-webhook-relay-worker.js` | Cloudflare Worker relay — passes raw body through, injects `X-Webhook-Secret` server-side, 8s timeout |
| `sba-webhook-relay-worker-normalized.js` | Cloudflare Worker relay — parses JSON / form-urlencoded (Twilio) / `{data}` / `{payload}` envelopes, normalizes to `{channel, from_email, from_phone, subject, text, event_id, occurred_at}`, then forwards |
| `sba-webhook-relay-wrangler.toml` | Worker config — set `N8N_WEBHOOK_URL` to the real n8n host before deploy |

## Flow (secured)

Webhook POST /webhook/sba-inbound-reply (responseMode: responseNode) → Verify Shared Secret → Normalize & Classify → Match SBA Prospect (alwaysOutputData: true) → Prospect Found? → Insert Inbound Touch (on conflict external_event_id do nothing) → Alert Slack on Reply / Alert Slack on Unmatched → Respond OK (200). Rejected branch → Respond Unauthorized (401).

## Classification rules (deterministic)

- Not-fit (negative): unsubscribe, stop, remove me, not interested, no thanks, wrong person, already have an agency, do not contact → `replied_not_fit`
- Not-now (neutral): not right now, next quarter, next month, too busy, swamped, reach out in, check back, budget tight/later/next year → `replied_not_now`
- Default: `replied_interested` (positive)

## Guardrails

- Keep `alwaysOutputData: true` on Match SBA Prospect so unmatched replies route to the False branch instead of silently dropping.
- Define `SBA_WEBHOOK_SECRET` in n8n env/secrets, never hardcoded in exported JSON.
- Worker secrets: `npx wrangler secret put N8N_WEBHOOK_SECRET` (+ optional `RELAY_INGRESS_TOKEN`).

## Verification (curl)

```bash
# Missing / wrong secret -> expects HTTP 401
curl -i -X POST "https://your-n8n-host/webhook/sba-inbound-reply" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: wrong-token" \
  -d '{"channel":"email","from_email":"owner@example.com","text":"Interested"}'

# Valid secret -> expects HTTP 200
curl -i -X POST "https://your-n8n-host/webhook/sba-inbound-reply" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-actual-secret" \
  -d '{"channel":"email","from_email":"owner@example.com","subject":"Re: Intake","text":"Swamped this week, check back next month"}'
```

## FLAG — BLOCKED: missing database objects

Checked 2026-11-23 against `sba_prospects.sql` (271 lines): **none** of these exist in the schema — `public.sba_outreach_touches`, `outreach_channel_type`, `touch_direction_type`, `touch_outcome_type`, `trg_sba_touches_after_insert` / `fn_sba_touches_after_insert`, or the `replied_*` outcomes. The workflow inserts will fail until the touches table + enums + trigger are built. Same blocker as the engagement view (`v_sba_prospect_engagement`) for the daily queue — build both together.
