# SBA Owner-Operator Prospecting Channels — Notes

Saved 2026-11-23, pasted by Demetrius.
Source note: LinkedIn is often the *least* active channel for overworked SBA owner-operators (especially trades, local B2B, healthcare, brick-and-mortar services). Many log in once a month, while they check phone, SMS, Google Business Profile, and local networks every hour.

## 1. Discovery Channels (Where to Find Them)

- **Public SBA 7(a) & 504 Loan Databases:** SBA publishes quarterly datasets (via data.sba.gov and FOIA logs) listing borrower names, business addresses, NAICS codes, lender names, and loan amounts. Filter for loans issued **6 to 24 months ago** — owners who recently acquired or expanded and are drowning in post-close operational bottlenecks.
- **Google Maps & Local Pack Audits:** Scrape local businesses in target cities with **4.2+ star ratings and 50+ reviews** (strong demand and cash flow) that still link to a slow, broken, or non-booking website. High review volume + bad web UX = owner manually handling every inbound phone call and quote.
- **Meta & Google Ads Transparency Libraries:** Search active local advertisers spending on Google Search or Facebook/Instagram ads whose ad links point to a generic homepage or slow contact form instead of a conversion-engineered funnel with instant calendar booking.
- **Indeed, ZipRecruiter & Local Job Boards:** Monitor businesses posting for low-leverage administrative roles ("Front Desk Coordinator," "Data Entry Clerk," "Scheduler," "Billing Admin"). That job post is an explicit budget signal: they are already willing to pay $35k–$50k/year to solve a bottleneck automation can handle for a fraction of the cost.

## 2. Outreach Channels (Where to Reach Them)

| Channel | Why It Works for Owner-Operators | Best Tactical Use |
| --- | --- | --- |
| Cold Call + Voicemail Drop | Owners answer their phones — or check voicemails immediately — because every ring could be a customer. | Call **7:30–8:30 AM** or **4:30–5:30 PM**. Reference the exact email/Loom just sent rather than pitching cold on the phone. |
| Website Contact Form / SMS | Many owners route their own website's contact form or Google Business chat straight to their personal cell phone. | Submit a brief, respectful note via their site's intake form (testing their speed-to-lead firsthand) pointing out a broken mobile flow or slow response gap. |
| Direct Mail ("Lumpy" or Postcard) | Zero digital spam filter competition; stands out on an office desk next to vendor invoices. | Mail a clean, oversized postcard or printed 1-page audit snapshot with a **QR code** linking directly to their custom 90-second Loom teardown. |
| Local Chambers, BNI & Trade Groups | SBA owners trust peer recommendations from local bankers, CPAs, commercial realtors, and insurance brokers. | Partner with local **SBA loan officers and commercial insurance agents** — they see overworked owners immediately after closing and look like heroes referring a systems builder. |
| Facebook & Industry Groups | Trade, contractor, med-spa, and franchise owners spend far more time in niche Facebook groups than on LinkedIn. | Answer operational/tech questions in vertical owner groups with mini-teardowns rather than cold DMs. |

## 3. Omnichannel Loop — 3-Point Surround Sound

Run on top 50 SBA accounts each month. Do not rely on email + LinkedIn alone.

1. **Trigger:** Spot a high-review business from the SBA loan log or Google Maps with a leaky website.
2. **Digital Touch:** Send the personalized email + 90-second Loom teardown.
3. **Offline / Direct Interrupt:** Follow up 48 hours later with a 20-second phone call ("Hey `[First Name]`, just emailed you a 90-second video showing how to automate the quote requests on `[Domain.com]` — no pitch, just wanted to make sure it didn't hit spam") or a QR-coded postcard.

## Relation to existing prospecting profile

- Extends the Type O Overwhelmed Operator lens (2026-10-06) to SBA owner-operators in trades, local B2B, healthcare, and brick-and-mortar services.
- LinkedIn deprioritized for this segment; phone/SMS/GBP/local networks are the primary attention channels.
- New scoring signals to add when this is operationalized: SBA loan 6–24 months ago, 4.2+ stars / 50+ reviews + broken booking, active ad spend to a leaky funnel, admin-role job posting ($35k–$50k budget signal).

---

## Phase 1–4: SBA FOIA Enrichment Waterfall (added 2026-11-23 04:03 ET)

SBA releases quarterly FOIA datasets with every approved 7(a) and 504 loan — borrower business names, street addresses, loan amounts, approval dates, NAICS codes, lender names. Raw CSVs have hundreds of thousands of rows, no emails, phones, or websites. Value is filtering for post-close operational friction + automated enrichment.

### Phase 1: Access the Raw SBA Datasets

1. Go to `data.sba.gov`, search **"FOIA - 7(a) (FY2020 - Present)"** and **"FOIA - 504 (FY2020 - Present)"**.
2. Download the most recent quarterly CSVs for both:
   - **7(a):** working capital, business acquisitions (change of ownership), equipment. High concentration of first-time owner-operators buying existing businesses.
   - **504:** fixed-rate loans for major fixed assets — commercial real estate, owner-occupied buildings, heavy machinery. Established operator scaling physical capacity.
3. Combine & normalize into one working database (PostgreSQL, Airtable, or clean master CSV), mapping: `BorrName`, `BorrStreet`, `BorrCity`, `BorrState`, `BorrZip`, `ApprovalDate`, `GrossApproval`, `NaicsCode`, `NaicsDescription`, `BankName`, `BusinessAge`.

### Phase 2: Filter for "Overworked Owner-Operator" Signals

| Filter Field | Recommended Criteria | Strategic Rationale |
| --- | --- | --- |
| `ApprovalDate` | **6 to 24 months ago** | 0–3 months post-close owners are drowning in legal/bank transition. 6–24 months, the dust settles and manual admin pain becomes acute. |
| `GrossApproval` | **$250,000 to $2,500,000** | Filters out micro-loans with no agency budget (<$150k) and institutional enterprises with internal IT (>$3M). |
| `BusinessAge` | `Existing or more than 2 years old` or `Change of Ownership` | **Goldmine:** acquisitions mean a new owner just inherited legacy systems, paper processes, and an outdated website. |
| `NaicsCode` | High-admin service & B2B sectors | Quotes, scheduling, intake: HVAC/Trades (`238220`), Commercial Cleaning (`561720`), Dental/Med (`621210`, `621111`), Logistics (`484110`), Auto Repair (`811111`), Law/Accounting (`541110`, `541211`). |
| `BorrName` Exclusions | Strip `HOLDINGS`, `PROPERTIES`, `LLC` (without DBA), national franchises | Eliminates single-purpose real estate shells and corporate franchises restricted from changing their websites. |

### Phase 3: Automated Enrichment Waterfall

Narrow ~300,000 rows to ~1,000 high-fit local/regional borrowers, then run via Clay, n8n, or a Node.js/Python script hitting APIs.

**Step 1: Domain & Google Business Profile Discovery**
- Input: `BorrName` + `BorrCity` + `BorrState`.
- Action: Query Google Places API (or Serper.dev / Outscraper) to match the exact business entity.
- Extract: official website URL, Google rating & review count (keep 15+ reviews to confirm active customer volume), main business phone.

**Step 2: Website & Conversion Friction Audit (Automated Scoring)**
- Lightweight headless check (Puppeteer/Playwright, PageSpeed Insights API, or BuiltWith) on each domain:
  - **No Website Found:** flag as *Greenfield Web + Intake Build*.
  - **Legacy CMS / Slow Mobile Score:** older WordPress themes, Wix, GoDaddy Website Builder, or mobile performance `< 50`.
  - **Missing Instant Conversion:** check DOM for scheduling links (`calendly.com`, `cal.com`, `acuityscheduling`, `servicetitan`, `hubspot`) or interactive quote calculators. Only a static contact form or `mailto:` = tag **`Manual_Intake_Leak`**.

**Step 3: Owner Identity & Contact Resolution**
- Secretary of State / corporate lookup: cross-reference `BorrName` + `BorrState` via OpenCorporates or state business registries for Registered Agent / Managing Member / President.
- Contact waterfall: pass Owner Name + Company Domain through Apollo, Prospeo, Hunter, or FullEnrich to verify direct work email (`first@domain.com`), LinkedIn profile URL (if active), direct mobile/office line.

### Phase 4: Segment & Route Into Multi-Channel Buckets

1. **Track A — "Change of Ownership" New Operators:** Hook: *"Saw you recently took the reins at `[Company Name]` — most new owners inherit a dated site and manual spreadsheet intake from the previous seller..."*
2. **Track B — High-Review / Leaky Website Operators:** Hook: *"You have 140+ five-star reviews on Google, but mobile visitors on `[Domain.com]` still have to fill out a static form and wait for a callback..."*
3. **Track C — Active Expansion / 504 Loan Borrowers:** Hook: *"With the new facility/expansion in `[City]`, manual scheduling and quote follow-up usually become the biggest bottleneck on your desk..."*

---

## Pipeline script (added 2026-11-23 04:04 ET)

Deterministic Node.js pipeline saved and verified (syntax check + test run, no CSVs yet): `sba-lead-pipeline/process-sba.js` with `package.json` / `README.md` in the same folder. Deps installed. Place `data/sba_7a.csv` and `data/sba_504.csv` in `sba-lead-pipeline/data/`, then `node process-sba.js` → `output/qualified_sba_operators.csv`.

---

## Enrichment script (added 2026-11-23 04:05 ET)

`enrich-sba.js` saved and verified in `sba-lead-pipeline/` (syntax check passed, `dotenv` installed, clean missing-key exit — no key stored). Reads `output/qualified_sba_operators.csv` → Google Places API (New) + HTML friction audit → `output/enriched_sba_prospects.csv`, sorted by `lead_priority_score`. Needs a `GOOGLE_PLACES_API_KEY` in `.env` (see `.env.example`); Places API (New) enabled + billing active. HTML checks catch missing booking embeds, mailto-only intake, missing viewport, slow TTFB ≥2500ms; PageSpeed/Playwright second pass only on top 100.

---

## Supabase schema (added 2026-11-23 04:06 ET)

`sba_prospects.sql` saved in `sba-lead-pipeline/` (271 lines). Table `sba_prospects` with 3-layer dedup (`dedupe_id` unique + partial unique `google_place_id` + `normalized_domain`), Postgres-generated `computed_lead_score` (0–100), trigger auto-assigning campaign track, view `v_high_priority_sba_queue` (score ≥65), RLS on with authenticated full access. Upsert on `dedupe_id` via `@supabase/supabase-js`, omit the generated score column. Not yet run against live Supabase — run it in the Supabase SQL Editor.

---

## Supabase sync script (added 2026-11-23 04:07 ET)

`sync-sba-supabase.js` saved and verified in `sba-lead-pipeline/` (syntax check passed, `@supabase/supabase-js` installed, clean missing-env exit — no keys stored). Reads `output/enriched_sba_prospects.csv`, safe type coercion, batch-upserts (100/batch) on `dedupe_id`, omits generated `computed_lead_score` on write, prints top 15 scored leads. Needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env` (placeholders in `.env.example`); service role key never on the client. If a batch collides on a partial unique index, drop batchSize to 25–50.

---

## Change-of-Ownership outreach copy (added 2026-11-23 04:08 ET)

Track A templates saved: `outreach/sba-change-of-ownership-outreach-2026-11-23.md` — 2-step email sequence (signal + inherited friction, then 2-point teardown offer), 20-sec live call opener + voicemail, execution tips: anchor to continuity not overhaul, first ask is a 90-sec video only, pair call + email within 24–48 hours. Angle: post-acquisition modernization without disrupting cash flow; new owners are wary of AI-guru hype and big retainers right after closing.

---

## 15-min discovery call script (added 2026-11-23 04:11 ET)

Saved: `outreach/sba-discovery-call-15min-2026-11-23.md` — 5-phase timed agenda (frame 0–2, diagnose 2–6, quantify 6–10, blueprint 10–13, decision 13–15), word-for-word script, habits: notes out loud, no tool/API over-engineering, respect the 15-min mark. Next step: 20-min Scope & Workflow Map (page layout, automation flow, fixed/tiered pricing, timeline) or clean disqualify.

---

## 3-tier SBA pricing (added 2026-11-23 04:13 ET)

Saved: `sba-pricing-tiers-2026-11-23.md` — Tier 1 Conversion & Intake Sprint $3,500 one-time (10 business days, 1 pipeline), Tier 2 Full Revenue & Ops Engine $7,500 + $650/mo (core offer, 3–4 weeks, up to 3 pipelines, 3-mo minimum), Tier 3 Custom Operations & Portal Suite $14,500+ + $1,250/mo (6–8 weeks, unlimited workflows, portal). Mechanics: down-sell to Tier 1 never discount, 100% Tier 1 credit toward Tier 2 within 45 days, +$750 per extra workflow. Present in the Scope & Workflow Map session, not call one. Flag: far above the canonical $299/$750 sheet — separate SBA structure, canonical sheet untouched.

---

## Post-discovery recap email (added 2026-11-23 04:14 ET)

Saved: `outreach/sba-post-discovery-recap-email-2026-11-23.md` — send within 2 hours of the discovery call, mirrors their 3 bottlenecks in one line each, presents all 3 tiers with a recommended Tier 1 or 2, closes with reply 1 / 2 / 3 / "call" or a 10-min wrap-up.

---

## Tier 2 SOW template (added 2026-11-23 04:14 ET)

Saved: `sba-sow-tier2-2026-11-23.md` — $7,500 in 3 milestones ($2,250 kickoff / $3,000 staging / $2,250 launch), $650/mo care (3-mo minimum, then month-to-month, 15-day non-renewal notice), 3–4 week timeline, 2 consolidated revision rounds per stage, 5-day feedback / 7-day silent approval, 14-day bug cover, out-of-scope + change orders ($750 per extra workflow, $[XXX]/hr TBD). Not legal advice — counsel review before sending to clients.

---

## 3-question ROI math (added 2026-11-23 04:15 ET)

Saved: `sba-roi-math-2026-11-23.md` — Q1 avg deal value, Q2 close rate, Q3 leads slipping/month; Recovered Revenue = Leads × Close Rate × Avg Value; Payback = $7,500 / monthly recovered revenue (or gross profit). Examples: $1,500×50%×3 leads = $2,250/mo, ~3.3 mo; $3,000×40%×2.5 = $3,000/mo, 2.5 mo; $5,000×30%×3 = $4,500/mo, ~1.7 mo. Use in discovery Phase 3 or the Scope session, before tiers. Tip: 6 hrs/wk manual follow-up at $75/hr = ~$1,950/mo reclaimed capacity.

---

## 10-min pre-call audit (added 2026-11-23 04:16 ET)

Saved: `outreach/sba-pre-call-audit-10min-2026-11-23.md` — turn audit notes into 3 sharp questions (SBA context, website/intake, Google reviews), 3-bullet max rule (what works / where it leaks / the one question that tests the leak first). Note: the item-by-item checklist itself was not in the paste — not invented, add it when sent.

---

## 3-day follow-up nudge (added 2026-11-23 04:19 ET)

Saved: `outreach/sba-follow-up-nudge-3day-2026-11-23.md` — same-thread bump 3 days after the recap, Tier 1 or 2 direction check, momentum + low-pressure pivot (Tier 1 $3,500) variations, closing note after 4–5 more days if still no reply. Not yet pushed to GitHub (pushed set was 20 files, commit a276fa0a).

---

## Post-discovery call notes template (added 2026-11-23 04:20 ET)

Saved: `outreach/sba-discovery-call-notes-template-2026-11-23.md` — 3–5 min template: bottlenecks + verbatim quotes, ROI math inputs (V, C, L, R, payback, admin hrs/wk), tier alignment + objections + agreed next step. Use right after the call, before the recap email; log tier + set the 3-day nudge timer. Not yet pushed to GitHub.

---

## Close-out email (added 2026-11-23 04:21 ET)

Saved: `outreach/sba-close-out-email-2026-11-23.md` — after recap + 3-day nudge + 4–5 more days silence, close the folder cleanly, no guilt, thread stays open to revive. Variations: low-lift down-sell / later timing, high-signal soft exit naming their bottleneck. Mark closed/paused in Supabase/CRM. Not yet pushed to GitHub.

---

## Client onboarding & kickoff checklist (added 2026-11-23 04:23 ET)

Saved: `sba-client-onboarding-kickoff-2026-11-23.md` — runs after SOW signed + deposit clears. Tips: single intake form + shared Drive/Notion/Airtable folder, flag SMS/A2P 10DLC Day 1, credentials via role/delegated permissions or password vault only — never plain email. Item-by-item checklist was not in the paste — not invented. Not yet pushed to GitHub.

---

## 30-min kickoff call agenda (added 2026-11-23 04:24 ET)

Saved: `sba-kickoff-call-30min-2026-11-23.md` — Tier 2 kickoff, 5 timed blocks (welcome 0–4, sitemap 4–12, workflows 12–21, access/compliance 21–26, dates 26–30), lock pages, workflow rules + edge cases, access/assets, staging + launch dates; recap within 1–2 hours. Not yet pushed to GitHub.

---

## Daily queue SQL + post-kickoff recap + n8n workflow (added 2026-11-23 04:27 ET)

Saved 3 files:
- `sba-lead-pipeline/sba-daily-queue-queries.sql` — due follow-up nudges, uncontacted high-score (60+, limit 25), combined queue with FOLLOWUP_DUE / NEW_HIGH_SCORE buckets, ET end-of-day filter, best-email/phone fallback.
- `outreach/sba-post-kickoff-recap-email-2026-11-23.md` — send within 1–2 hrs of kickoff, sitemap + 3 workflows + dates + still-needed list only.
- `sba-lead-pipeline/sba-n8n-morning-queue-workflow.json` — JSON validated, 5 nodes (8am M–F ET trigger, 2 Postgres queries capped 15 each, deterministic digest builder, Slack #sba-outreach), import via Workflow → Import from JSON, attach Postgres + Slack credentials, set instance timezone America/New_York.
FLAG: daily queries + n8n both depend on `v_sba_prospect_engagement`, which does NOT exist in `sba_prospects.sql`, and status `'ready'` is not in the outreach enum. Build engagement tracking first or both fail. None of the 3 pushed to GitHub yet.

---

## Inbound reply webhook + CF Worker relay (added 2026-11-23 04:30 ET)

Saved 6 files:
- `sba-lead-pipeline/sba-n8n-inbound-reply-workflow.json` — unsecured, 7 nodes, JSON validated.
- `sba-lead-pipeline/sba-n8n-inbound-reply-workflow-secured.json` — CANONICAL, 10 nodes, shared-secret gate (X-Webhook-Secret vs $env.SBA_WEBHOOK_SECRET), 401/200, JSON validated.
- `sba-lead-pipeline/sba-webhook-relay-worker.js` — passthrough relay, syntax OK.
- `sba-lead-pipeline/sba-webhook-relay-worker-normalized.js` — parses JSON/form-urlencoded (Twilio)/{data}/{payload}, normalizes to {channel, from_email, from_phone, subject, text, event_id, occurred_at}, syntax OK.
- `sba-lead-pipeline/sba-webhook-relay-wrangler.toml` — set real N8N_WEBHOOK_URL before deploy; secrets via `wrangler secret put N8N_WEBHOOK_SECRET` (+ optional RELAY_INGRESS_TOKEN).
- `sba-inbound-reply-webhook-2026-11-23.md` — flow, classification rules, guardrails, curl 401/200 test.
FLAG: BLOCKED — `sba_outreach_touches` + enums + trigger do NOT exist in `sba_prospects.sql` (checked 2026-11-23). Build touches table + enums + trigger together with the engagement view before importing/activating. None of the 6 pushed to GitHub yet.
