# SBA Owner-Operator Playbook — Organized Analysis

Built 2026-11-23 from this chat's notes. Source notes: `sba-owner-operator-channels-2026-11-23.md`. This file is the organized master — the source notes stay as the raw record.

## 1. Thesis in one paragraph

Target **overworked SBA owner-operators** (trades, local B2B, healthcare, brick-and-mortar) who just bought or expanded a business and are drowning in manual intake. LinkedIn is their *least* active channel — they check phone, SMS, Google Business Profile, and local networks hourly. Find them in public SBA loan data, prove demand with Google reviews, prove friction with a website audit, then surround them: email + 90-second Loom teardown, then a 20-second call or QR postcard 48 hours later. Pitch relief, not shame: post-acquisition modernization without disrupting cash flow, no rip-and-replace, no AI-guru hype, no big retainer right after closing.

This extends the existing Type O Overwhelmed Operator lens (2026-10-06) to a specific, data-sourced segment: SBA borrowers.

## 2. System map

```
data.sba.gov FOIA CSVs (7a + 504, quarterly)
  → process-sba.js          filter + dedupe → output/qualified_sba_operators.csv
  → enrich-sba.js           Places API + HTML friction audit → output/enriched_sba_prospects.csv
  → sba_prospects.sql       Supabase table (run once in SQL Editor)
  → sync-sba-supabase.js    batch upsert on dedupe_id → top 15 scored leads printed
  → v_high_priority_sba_queue (score ≥ 65) → Track A/B/C outreach
  → Email + Loom → 48-hr call / QR postcard → booking
```

Top 50 accounts/month, 3-point surround sound.

## 3. Inventory — what exists, what is verified

| Piece | File | Status |
| --- | --- | --- |
| Strategy + channels + waterfall | `prospecting/sba-owner-operator-channels-2026-11-23.md` | Saved, 114 lines |
| Step 1 filter/dedupe script | `prospecting/sba-lead-pipeline/process-sba.js` (346 lines) | Syntax-checked, test-run OK (0 rows — no CSVs yet), deps installed |
| Step 2 enrichment script | `prospecting/sba-lead-pipeline/enrich-sba.js` (382 lines) | Syntax-checked, clean missing-key exit, `dotenv` installed |
| Step 3 Supabase schema | `prospecting/sba-lead-pipeline/sba_prospects.sql` (271 lines) | Saved, **not run against live Supabase**, no local Postgres parser to validate |
| Step 4 Supabase sync | `prospecting/sba-lead-pipeline/sync-sba-supabase.js` (263 lines) | Syntax-checked, clean missing-env exit, `@supabase/supabase-js` installed |
| Pipeline README + package | `prospecting/sba-lead-pipeline/README.md`, `package.json`, `.env.example` | Current through Step 4 |
| Track A outreach copy | `prospecting/outreach/sba-change-of-ownership-outreach-2026-11-23.md` | Saved — 2 emails, call opener, voicemail, tips |
| 15-min discovery call | `prospecting/outreach/sba-discovery-call-15min-2026-11-23.md` | Saved 2026-11-23 — 5-phase timed agenda + word-for-word script, next step is a 20-min Scope & Workflow Map |
| 3-tier SBA pricing | `prospecting/sba-pricing-tiers-2026-11-23.md` | Saved 2026-11-23 — Tier 1 $3,500, Tier 2 $7,500 + $650/mo (core), Tier 3 $14,500+ + $1,250/mo; 45-day 100% Tier 1 credit toward Tier 2; +$750 per extra workflow |
| Post-discovery recap email | `prospecting/outreach/sba-post-discovery-recap-email-2026-11-23.md` | Saved 2026-11-23 — send within 2 hrs, mirrors bottlenecks, 3 tiers, reply 1 / 2 / 3 / "call" |
| 10-min pre-call audit | `prospecting/outreach/sba-pre-call-audit-10min-2026-11-23.md` | Saved 2026-11-23 — question-conversion + 3-bullet rule; item-by-item checklist was not in the paste, not invented |
| 3-day follow-up nudge | `prospecting/outreach/sba-follow-up-nudge-3day-2026-11-23.md` | Saved 2026-11-23 — same-thread bump, momentum + low-pressure pivot variations, closing note after 4–5 more days — pushed 2026-11-23, commit 1e9f786e |
| Post-discovery call notes | `prospecting/outreach/sba-discovery-call-notes-template-2026-11-23.md` | Saved 2026-11-23 — 3–5 min template: bottlenecks + verbatim quotes, ROI inputs, tier alignment + next step — pushed 2026-11-23, commit 1e9f786e |
| Close-out email | `prospecting/outreach/sba-close-out-email-2026-11-23.md` | Saved 2026-11-23 — after recap + nudge + 4–5 days silence, down-sell + high-signal variations, mark closed/paused in Supabase — pushed 2026-11-23, commit 1e9f786e |
| Client onboarding & kickoff | `prospecting/sba-client-onboarding-kickoff-2026-11-23.md` | Saved 2026-11-23 — post-SOW, post-deposit; tips: single intake form + shared folder, flag A2P 10DLC Day 1, credentials via vault/delegated access only; item-by-item checklist was not in the paste, not invented; pushed 2026-11-23, commit 6e14eef4 |
| 30-min kickoff call agenda | `prospecting/sba-kickoff-call-30min-2026-11-23.md` | Saved 2026-11-23 — Tier 2 kickoff, 5 timed blocks, sitemap + 3 workflows + access/compliance + dates locked, recap within 1–2 hrs; pushed 2026-11-23, commit bccd4715 |
| Daily queue SQL | `prospecting/sba-lead-pipeline/sba-daily-queue-queries.sql` | Saved 2026-11-23 — due nudges, uncontacted 60+ (limit 25), combined queue; **BLOCKED: needs v_sba_prospect_engagement view + 'ready' status, neither in schema yet**; pushed 2026-11-23, commit 3c5fdf8f |
| Post-kickoff recap email | `prospecting/outreach/sba-post-kickoff-recap-email-2026-11-23.md` | Saved 2026-11-23 — send within 1–2 hrs of kickoff, sitemap + 3 workflows + dates + still-needed list; pushed 2026-11-23, commit 3c5fdf8f |
| n8n morning queue workflow | `prospecting/sba-lead-pipeline/sba-n8n-morning-queue-workflow.json` | Saved 2026-11-23 — JSON validated, 5 nodes, 8am M–F ET, Postgres → digest → Slack #sba-outreach; **BLOCKED on the same missing engagement view**; pushed 2026-11-23, commit 3c5fdf8f |
| Inbound reply webhook (n8n) | `prospecting/sba-lead-pipeline/sba-n8n-inbound-reply-workflow.json` (unsecured, 7 nodes) + `sba-n8n-inbound-reply-workflow-secured.json` (**canonical, 10 nodes**, shared-secret gate, 401/200) | Saved 2026-11-23 — JSON validated both; deterministic keyword classify, match by email/phone, idempotent insert; **BLOCKED: sba_outreach_touches + enums + trigger don't exist in schema yet**; pushed 2026-11-23, commit de09e6fe |
| CF Worker webhook relay | `prospecting/sba-lead-pipeline/sba-webhook-relay-worker.js` (passthrough) + `sba-webhook-relay-worker-normalized.js` (parses JSON/form/Twilio, normalizes payload) + `sba-webhook-relay-wrangler.toml` | Saved 2026-11-23 — both JS syntax-checked OK; injects X-Webhook-Secret server-side, 8s timeout; set real N8N_WEBHOOK_URL before deploy; pushed 2026-11-23, commit de09e6fe |
| Inbound reply webhook doc | `prospecting/sba-inbound-reply-webhook-2026-11-23.md` | Saved 2026-11-23 — flow, classification rules, guardrails, curl 401/200 test; pushed 2026-11-23, commit de09e6fe |
| Staging build & demo email | `prospecting/outreach/sba-staging-build-demo-email-2026-11-23.md` | Saved 2026-11-23 — Tier 2 staging + 5–7 min walkthrough, review focus (pages/mobile + 3 workflows), one consolidated list by 5 business days, Milestone 2 $3,000 then launch/DNS; pushed 2026-11-23, commit 548510cf |
| Pre-launch QA checklist | `prospecting/sba-pre-launch-qa-checklist-2026-11-23.md` | Saved 2026-11-23 — **item list MISSING from paste (only guardrails saved)**; guardrails: prod endpoints, don't touch MX/SPF/DKIM, clean test records; pushed 2026-11-23, commit aba4f875 |
| Launch & handoff email | `prospecting/outreach/sba-launch-handoff-email-2026-11-23.md` | Saved 2026-11-23 — go-live recap, 3 workflows, $650/mo care, 14-day check-in, support boundaries; pushed 2026-11-23, commit aba4f875 |
| Bug vs. change order rule | `prospecting/sba-bug-vs-change-order-2026-11-23.md` | Saved 2026-11-23 — internal triage: bug fix needs all 3 conditions, change order if any of 3 apply, decision table, one-line responses; pushed 2026-11-23, commit aba4f875 |
| Out-of-scope message | `prospecting/outreach/sba-out-of-scope-change-order-2026-11-23.md` | Saved 2026-11-23 — email + Slack versions, quote-before-build gate; pushed 2026-11-23, commit aba4f875 |
| 14-day post-launch check-in | `prospecting/outreach/sba-14day-post-launch-checkin-2026-11-23.md` | Saved 2026-11-23 — email + Slack versions, lead/booking flow + edge cases, steady $650/mo care; pasted twice, saved once; pushed 2026-11-23, commit aba4f875 |
| Change-order quote | `prospecting/outreach/sba-change-order-quote-2026-11-23.md` | Saved 2026-11-23 — fixed price, deliverables, turnaround, out-of-scope line, reply "Approved" gate (email + Slack); NOT yet pushed to GitHub |
| Monthly care metrics log | `prospecting/sba-monthly-care-metrics-2026-11-23.md` + `prospecting/sba-lead-pipeline/sba-care-metrics-schema.sql` | Saved 2026-11-23 — one row per client/month, uptime + wf1/2/3 runs + errors + tweaks + change orders; JSON example validated (113 = 48+36+29); schema NOT run against live Supabase; NOT yet pushed to GitHub |
| Run & error queries | `prospecting/sba-lead-pipeline/sba-run-error-queries.sql` | Saved 2026-11-23 — 6 queries: runs/errors by sequence + by workflow, recent 20 failed, grouped 7-day failures; **BLOCKED: touches table + automation_runs table don't exist yet**; NOT yet pushed to GitHub |
| Tier 2 SOW template | `prospecting/sba-sow-tier2-2026-11-23.md` | Saved 2026-11-23 — $7,500 in 3 milestones ($2,250 / $3,000 / $2,250), $650/mo care, 3–4 weeks, 2 revision rounds, 14-day bug cover; NOT legal advice, counsel review before sending |
| 3-question ROI math | `prospecting/sba-roi-math-2026-11-23.md` | Saved 2026-11-23 — owner-supplied V × C × R, 2–3 recovered leads/mo covers $7,500 in ~1.7–3.3 months; use gross profit for sharp SBA owners, 6 hrs/wk @ $75/hr = ~$1,950/mo reclaimed |

No SBA CSVs downloaded yet (`data/` empty). No API keys stored (`.env` does not exist; only `.env.example`). No leads in Supabase yet. No outreach sent.

## 4. The filters, consolidated

| Filter | Rule |
| --- | --- |
| Approval date | 6–24 months ago (reference 2026-11-23) |
| Loan size | $250,000–$2,500,000 |
| Business age | Existing 2+ years, or Change of Ownership (acquisition = goldmine) |
| States (script only) | GA, FL, TX, NC, TN |
| NAICS (script prefixes) | 238 trades, 5617 cleaning/landscaping, 6211 physicians, 6212 dentists, 6213 other health, 484 trucking, 8111 auto repair, 5411 legal, 5412 accounting |
| Exclusions | HOLDINGS, PROPERTIES, REALTY, REAL ESTATE, INVESTMENTS, MANAGEMENT GROUP, ASSOCIATES LP, TRUST; franchises / real-estate shells |
| Demand proof | 4.2+ stars and 50+ reviews (discovery); 15+ reviews minimum in enrichment |

## 5. Discovery channels

1. **SBA 7(a) & 504 FOIA datasets** — `data.sba.gov`, "FOIA - 7(a) (FY2020 - Present)" / "FOIA - 504 (FY2020 - Present)". 7(a) = working capital / acquisitions / equipment, first-time buyers. 504 = real estate / heavy machinery, established operators scaling.
2. **Google Maps / Local Pack audit** — 4.2+ stars, 50+ reviews + slow/broken/non-booking site = owner handling every call/quote manually.
3. **Meta & Google Ads Transparency** — active local ad spend pointing to a generic homepage / slow form instead of a booking funnel.
4. **Job boards (Indeed, ZipRecruiter)** — postings for Front Desk Coordinator, Data Entry, Scheduler, Billing Admin = $35k–$50k/yr budget signal for a bottleneck automation can solve cheaper.

## 6. Outreach channels

| Channel | Use |
| --- | --- |
| Cold call + voicemail drop | 7:30–8:30 AM or 4:30–5:30 PM; reference the email/Loom already sent, never pitch cold |
| Website contact form / SMS | Brief note via their intake form (tests their speed-to-lead), pointing at a broken mobile flow |
| Direct mail / QR postcard | Oversized postcard or 1-page audit snapshot, QR to the 90-sec Loom teardown |
| Chambers, BNI, trade groups | Partner with SBA loan officers + commercial insurance agents — they meet owners right after closing |
| Facebook & industry groups | Answer ops/tech questions in vertical owner groups with mini-teardowns, not cold DMs |

## 7. Campaign tracks (auto-assigned by the Supabase trigger)

| Track | Trigger | Hook |
| --- | --- | --- |
| **A — ACQUISITION_NEW_OPERATOR** | `is_acquisition = TRUE` | "Saw you recently took the reins at `[Company]` — most new owners inherit a dated site and manual spreadsheet intake…" — full copy saved (see §9) |
| **B — HIGH_REVIEW_LEAKY_FUNNEL** | 50+ reviews + no booking link | "You have 140+ five-star reviews, but mobile visitors still fill out a static form and wait for a callback…" — hook only, no full copy yet |
| **C — EXPANSION_504_OPS** | program includes 504 | "With the new facility/expansion in `[City]`, manual scheduling and quote follow-up become the biggest bottleneck…" — hook only, no full copy yet |
| STANDARD_SBA_INTAKE | everything else | No hook defined |

## 8. Scoring — two scores, and they do not match

This is the main inconsistency in the system. There are two lead scores, computed differently:

- **`enrich-sba.js` `lead_priority_score` (CSV, pre-sync):** base 40; no booking +25, slow ≥2500ms +15, mailto-only +15, no form +10, missing viewport +10; NO_WEBSITE fixed 85; TIMEOUT/UNREACHABLE fixed 75; +10 if 50+ reviews and no booking; +5 if acquisition. Capped 100.
- **Postgres `computed_lead_score` (DB, source of truth after sync):** NO_WEBSITE 45, TIMEOUT/FETCH_ERROR 35, no booking 25, slow 15, mailto-only 15, no form 10, missing viewport 10, 50+ reviews + no booking 10, acquisition 5, loan ≥$500k 5, plus manual `score_adjustment` −25…+25. Clamped 0–100. No base 40.

Consequence: the same lead scores higher in the enriched CSV than in Supabase (e.g. a no-website lead: 85 in CSV, 45 + 5 acquisition + 5 loan = 55 max in DB, before adjustment). The DB queue threshold is ≥65 in `v_high_priority_sba_queue`, so CSV-ranked leads can fall out of the DB queue. **Treat the Postgres score as the real score; use the CSV score only to order enrichment spend.** Decide once whether to align them — either raise the DB no-website weight or lower the CSV one — before the first real batch, or the queue will look empty after sync.

## 9. Track A outreach — the only complete copy

Saved in `prospecting/outreach/sba-change-of-ownership-outreach-2026-11-23.md`:

- **Email 1:** subject `[Company] after the transition / web + intake` — congrats on taking over, steady demand but slow form/inbox + manual keying into scheduling/quoting/CRM, offer a 90-sec video with two easy wins on `[Domain.com]`.
- **Email 2:** subject `Re: [Company] after the transition / web + intake` — two specific gaps (mobile form with no instant booking/confirmation; manual email/phone follow-up), offer to record the Loom.
- **Call opener (~20s):** reference the email, ask if they've looked at how inquiries come in, or just send the video.
- **Voicemail (~20s):** congrats, note sent, video coming, no rush.
- **Tips:** anchor to continuity not overhaul; first ask is only the 90-sec video, never a 45-min call; pair call + email within 24–48 hours.

## 10. Inconsistencies and gaps found

1. **Scoring drift** — §8. Two different scores; DB queue (≥65) will rank differently from the CSV. Align before first batch.
2. **Review threshold varies** — 50+ reviews in discovery and in the DB track, 15+ minimum in enrichment Step 1, 140+ in the Track B example hook. 15+ is the floor; 50+ is the priority line. Keep both, label them.
3. **New businesses in the script** — Phase 2 says Existing 2+ years or Change of Ownership only; `process-sba.js` also allows `NEW BUSINESS OR 2 YEARS OR LESS` (marked optional in the code). Remove that line if acquisitions/existing is the strict rule.
4. **Franchise / LLC-without-DBA exclusion not implemented** — Phase 2 says strip national franchises and bare LLCs; the script's exclusion list has no franchise check and no DBA logic. Add it, or drop the claim.
5. **Owner contact enrichment has no script** — Phase 3 Step 3 (Secretary of State / OpenCorporates → Apollo / Prospeo / Hunter / FullEnrich for owner name, direct email, mobile) is strategy only. No code, no provider chosen, no API key. Without it, outreach has a business name and a phone but no owner name/email for the Track A templates.
6. **Tracks B and C have hooks, no copy** — no emails, no call scripts, unlike Track A.
7. **No Loom production step** — the whole loop depends on a 90-sec teardown per lead, but there is no template, recording checklist, or who-records-it decision.
8. **No direct-mail asset** — postcard / 1-page audit snapshot is strategy only; no design, no print/mail vendor, no cost.
9. **No Supabase project confirmed** — schema not run, URL/key not in `.env`, no project ref on record. The existing Supabase RLS exposure goal (`supabase-orange-grass`) is separate and unresolved — do not confuse the two projects.
10. **States are script-only** — GA/FL/TX/NC/TN appears only in `process-sba.js` CONFIG, not in the strategy notes. Atlanta/GA is the stated primary; the other four are an expansion choice that was never explicitly decided.
11. **Engagement view missing** — daily queue SQL + n8n workflow depend on `v_sba_prospect_engagement` (total_touches, email/call counts, inbound_replies, latest_outcome) and an outreach status `'ready'`; neither exists in `sba_prospects.sql`. Build the engagement tracking (table/view + touch logging) before running either, or both fail.
12. **Touches table missing** — inbound reply webhook depends on `sba_outreach_touches` + `outreach_channel_type` / `touch_direction_type` / `touch_outcome_type` enums + `trg_sba_touches_after_insert` trigger; none exist in `sba_prospects.sql` (checked 2026-11-23). Build the touches table + enums + trigger together with the engagement view.
13. **automation_runs table missing** — run/error queries also need `public.automation_runs` (workflow_name, status, error_message, created_at); it exists nowhere yet. Build it alongside the touches table if workflow execution logging is wanted.

## 11. Runbook — in order

1. Download latest quarterly 7(a) + 504 CSVs from `data.sba.gov` → `sba-lead-pipeline/data/sba_7a.csv`, `sba_504.csv`.
2. Decide the open items in §10 (score alignment, new-business line, franchise filter, states) and edit `process-sba.js` CONFIG if needed.
3. `node process-sba.js` → `output/qualified_sba_operators.csv`.
4. Put `GOOGLE_PLACES_API_KEY` in `.env` (Places API (New) enabled, billing active) → `node enrich-sba.js` → `output/enriched_sba_prospects.csv`.
5. Run `sba_prospects.sql` in the Supabase SQL Editor.
6. Put `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env` → `node sync-sba-supabase.js` → top 15 printed.
7. Work `v_high_priority_sba_queue` (score ≥65), top 50/month: Track A copy is ready; B/C need copy first.
8. Enrich owner contacts (Step 3 — unbuilt), record Looms, send Email 1, call/voicemail in 24–48 hrs, or QR postcard at 48 hrs.
9. Booked replies go to the 15-min discovery call (timed agenda + script saved), then to a 20-min Scope & Workflow Map — present the 3-tier pricing there (Tier 2 anchor, Tier 1 down-sell with 45-day credit, Tier 3 anchor), or a clean disqualify.
10. Fill out the post-discovery call notes in 3–5 minutes (verbatim quotes first, lock the ROI math), then send the recap email within 2 hours — bottlenecks mirrored back, 3 tiers, reply 1 / 2 / 3 / "call".
11. No reply in 3 days: send the 3-day follow-up nudge in the same thread (momentum or low-pressure pivot version). Still no reply after 4–5 more days: send the close-out email (down-sell or high-signal variation), mark the lead closed/paused in Supabase, stop chasing — thread stays open for them to revive.
12. On a yes, send the Tier 2 SOW (after counsel review) — $2,250 deposit to reserve the slot, then $3,000 at staging, $2,250 at launch, $650/mo care from launch.
13. After SOW signed + deposit clears: run client onboarding & kickoff — single intake form + shared folder, flag A2P 10DLC Day 1, credentials via vault/delegated access only, never plain email.
14. Hold the 30-min kickoff call — ground rules, sitemap, 3 workflows + edge cases, access/compliance, lock staging + launch dates; send recap + onboarding checklist link within 1–2 hours.
15. Send the post-kickoff recap email within 1–2 hours — agreed sitemap, 3 workflows, target dates, still-needed list only.
16. Daily ops (once Supabase is live): 8am ET n8n Slack digest from the daily queue queries — due follow-ups first, uncontacted 60+ second. BLOCKED until v_sba_prospect_engagement is built.
17. Pre-launch: run the QA checklist, point every form/webhook to production, don't touch MX/SPF/DKIM, clean test records, then flip DNS.
18. Launch: send the launch & handoff email (live URL, 3 workflows, $650/mo care, 14-day check-in date, support boundaries).
19. Post-launch: triage requests with the bug-vs-change-order rule; out-of-scope asks get the change-order message + quote before any build; send the 14-day check-in.

## 12. Decisions owed

- Align the two scores, or accept Postgres as truth and CSV as enrichment ordering only?
- Remove `NEW BUSINESS OR 2 YEARS OR LESS` from the script?
- Add a franchise / bare-LLC filter, or drop that exclusion?
- Confirm states: GA only, or GA + FL/TX/NC/TN?
- Owner-contact provider: Apollo, Prospeo, Hunter, FullEnrich, or manual SOS lookup?
- Write Track B and C copy in Track A format?
- Who records the 90-sec Looms, and from what teardown template?
- Pricing: does the SBA 3-tier structure ($3,500 / $7,500+$650 / $14,500+$1,250) replace or sit alongside the canonical Coco Club Live sheet ($299 / $750 / $250 / $950)? Do not overwrite the canonical sheet until he says so.
