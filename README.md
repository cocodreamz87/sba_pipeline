# SBA Pipeline — Coco Club Live

SBA owner-operator prospecting pipeline for Coco Club Live (Coco Moreland, Atlanta). Find overworked SBA borrowers, prove demand with Google reviews, prove friction with a website audit, then surround them: email + 90-second Loom teardown, then a 20-second call or QR postcard 48 hours later.

## Pipeline

```
data.sba.gov FOIA CSVs (7a + 504, quarterly)
  → process-sba.js          filter + dedupe → output/qualified_sba_operators.csv
  → enrich-sba.js           Places API + HTML friction audit → output/enriched_sba_prospects.csv
  → sba_prospects.sql       Supabase table (run once in SQL Editor)
  → sync-sba-supabase.js    batch upsert on dedupe_id → top 15 scored leads printed
  → v_high_priority_sba_queue (score ≥ 65) → Track A/B/C outreach
  → Email + Loom → 48-hr call / QR postcard → 15-min discovery call
  → Scope & Workflow Map → 3-tier pricing → recap email → Tier 2 SOW
```

## Setup

```bash
npm install
```

Place raw quarterly files from `data.sba.gov` in `./data/`:
- `./data/sba_7a.csv`
- `./data/sba_504.csv`

Copy `.env.example` to `.env` and fill in keys when you reach those steps. Never commit `.env`.

## Run

```bash
node process-sba.js   # Step 1 — filter + dedupe
node enrich-sba.js    # Step 2 — enrich (needs GOOGLE_PLACES_API_KEY)
node sync-sba-supabase.js  # Step 4 — sync (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
```

Step 3 is `sba_prospects.sql` — run it in the Supabase SQL Editor before Step 4.

## Filters

- Approval: 6–24 months ago (reference 2026-11-23)
- Loan: $250,000–$2,500,000
- Business age: Existing 2+ years, or Change of Ownership
- States: GA, FL, TX, NC, TN
- NAICS prefixes: 238, 5617, 6211, 6212, 6213, 484, 8111, 5411, 5412
- Excludes HOLDINGS / PROPERTIES / REALTY / REAL ESTATE / INVESTMENTS / MANAGEMENT GROUP / ASSOCIATES LP / TRUST

## Docs

- `docs/sba-owner-operator-playbook-2026-11-23.md` — organized master: system map, inventory, filters, tracks, scoring, runbook, decisions owed
- `docs/sba-owner-operator-channels-2026-11-23.md` — strategy notes: discovery + outreach channels, FOIA waterfall, pipeline notes
- `docs/sba-pricing-tiers-2026-11-23.md` — Tier 1 $3,500 / Tier 2 $7,500 + $650/mo / Tier 3 $14,500+ + $1,250/mo
- `docs/sba-sow-tier2-2026-11-23.md` — Tier 2 Statement of Work template (not legal advice — counsel review before sending)
- `docs/sba-roi-math-2026-11-23.md` — 3-question ROI math for the call
- `docs/sba-client-onboarding-kickoff-2026-11-23.md` — client onboarding & kickoff after SOW + deposit
- `docs/sba-kickoff-call-30min-2026-11-23.md` — 30-min Tier 2 kickoff call agenda
- `docs/sba-inbound-reply-webhook-2026-11-23.md` — inbound reply webhook flow, classification rules, curl test
- `sba-daily-queue-queries.sql` — daily outbound queue SQL (due nudges, uncontacted 60+, combined)
- `sba-n8n-morning-queue-workflow.json` — n8n 8am M–F Slack digest workflow (importable JSON)
- `sba-n8n-inbound-reply-workflow.json` — n8n inbound reply webhook (unsecured, 7 nodes)
- `sba-n8n-inbound-reply-workflow-secured.json` — n8n inbound reply webhook (canonical, 10 nodes, shared-secret gate)
- `sba-webhook-relay-worker.js` — Cloudflare Worker webhook relay (passthrough)
- `sba-webhook-relay-worker-normalized.js` — Cloudflare Worker webhook relay (normalizes JSON/form/Twilio payloads)
- `sba-webhook-relay-wrangler.toml` — Worker config (set real N8N_WEBHOOK_URL before deploy)
- `docs/outreach/sba-change-of-ownership-outreach-2026-11-23.md` — Track A: 2 emails, call opener, voicemail
- `docs/outreach/sba-pre-call-audit-10min-2026-11-23.md` — 10-min pre-call audit
- `docs/outreach/sba-discovery-call-15min-2026-11-23.md` — 15-min discovery call script
- `docs/outreach/sba-post-discovery-recap-email-2026-11-23.md` — post-discovery recap email (send within 2 hrs)
- `docs/outreach/sba-post-kickoff-recap-email-2026-11-23.md` — post-kickoff recap email (send within 1–2 hrs)
- `docs/outreach/sba-discovery-call-notes-template-2026-11-23.md` — post-discovery call notes (3–5 min, before the recap)
- `docs/outreach/sba-follow-up-nudge-3day-2026-11-23.md` — 3-day follow-up nudge, same thread
- `docs/outreach/sba-close-out-email-2026-11-23.md` — close-out email after two follow-ups

## Known gaps (2026-11-23)

- Two lead scores disagree (CSV `lead_priority_score` vs Postgres `computed_lead_score`); Postgres is source of truth after sync.
- Owner-contact enrichment (Apollo / Hunter / etc.) is strategy only — no script yet.
- Tracks B and C have hooks only, no full copy.
- No Loom template, no postcard asset, schema not yet run in Supabase.
- See the playbook §10–§12 for the full list and decisions owed.
