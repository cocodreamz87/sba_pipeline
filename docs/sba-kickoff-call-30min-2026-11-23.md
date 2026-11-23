# 30-Minute Project Kickoff Call Agenda — Tier 2

Saved 2026-11-23, pasted by Demetrius.
For a newly signed **Tier 2: Full Revenue & Ops Engine** client. Keeps momentum tight, sets clear operating boundaries from Day 1, walks out with locked access, workflow rules, and target dates so you can move straight into building.

## Time-boxed agenda

| Time | Segment | Purpose & Deliverable |
| --- | --- | --- |
| 0:00–4:00 | Welcome, Wins & Ground Rules | Confirm kickoff deposit/SOW, align on the primary goal, set communication & revision expectations. |
| 4:00–12:00 | Sitemap & Conversion Flow Walk-Through | Lock the up-to-7-page layout, mobile CTA priorities, and inquiry/booking entry points. |
| 12:00–21:00 | 3 Automation Workflows & Edge Cases | Confirm exact triggers, routing rules, SMS/email/CRM targets, and fallback behavior for all 3 workflows. |
| 21:00–26:00 | Access, Assets & Compliance Check | Verify domain/DNS, hosting, CRM/calendar/SMS access, brand files, and SMS/opt-in readiness. |
| 26:00–30:00 | Milestone Dates & Next Action | Lock staging review & launch dates, confirm Milestone 2/3 triggers, assign immediate tasks. |

## Segment-by-segment script & checklist

### 1. Welcome, Wins & Ground Rules (0:00–4:00)

- **Goal:** Shift from "sales mode" to "execution mode" and protect your calendar and feedback loops.
- **Cover:**
  - Thank them for kicking off and confirm the core outcome they want over the next 3–4 weeks (e.g., faster lead response, cleaner booking, fewer manual handoffs).
  - Confirm the **single point of contact** for approvals and set where day-to-day updates live (shared Slack channel, email thread, or SMS).
  - Briefly remind them of how revisions and milestones work: **two consolidated revision rounds** per major stage, feedback grouped within **5 business days**, and staging review before live cutover.

### 2. Sitemap & Conversion Flow Walk-Through (4:00–12:00)

- **Goal:** Agree on the page structure and primary customer actions before designing screens.
- **Confirm:**
  - Which pages make up the **up-to-7-page build** (e.g., Home, Services, About/Trust, Reviews/Proof, Quote/Booking, Contact, Legal/Privacy).
  - The **#1 primary action** for a visitor on mobile and desktop (e.g., book a call/estimate directly vs. submit a structured quote request).
  - Any legacy URLs or existing pages that must redirect cleanly or preserve local search relevance.

### 3. 3 Automation Workflows & Edge Cases (12:00–21:00)

- **Goal:** Nail down deterministic logic for all three Tier 2 automations so there are no surprises during QA.
- **Walk through each workflow:**
  1. **Speed-to-Lead & Qualification Routing:** What fields come in from the form/booking flow? Which leads get instant priority vs. standard routing? Who gets notified (SMS, email, Slack) and what does the prospect receive immediately?
  2. **Booking & Appointment Reminders:** Which calendar(s) are connected, what reminder intervals make sense (e.g., 24 hours and 1 hour prior), and how rescheduling/cancellations should behave?
  3. **Post-Completion Review / Follow-Up Loop:** What event marks a job or appointment "complete," how long after completion should the request go out, and how are unhappy/edge-case responses handled?
- **Edge cases to ask right now:** What happens after hours or on weekends? What if a lead submits incomplete info or is outside the service area?

### 4. Access, Assets & Compliance Check (21:00–26:00)

- **Goal:** Prevent mid-sprint bottlenecks caused by missing logins, raw files, or messaging restrictions.
- **Verify status on:**
  - **Domain & DNS:** Registrar login/delegated access (Cloudflare, GoDaddy, Namecheap, etc.) and where hosting lives today.
  - **Core Tools:** CRM, calendar, email sender, and SMS/phone provider access.
  - **SMS / Messaging Readiness:** Whether outbound SMS uses an approved A2P 10DLC number/campaign and clear opt-in language on forms.
  - **Brand & Proof Assets:** Logo files, brand colors/fonts, real photos, service descriptions, service areas, and top reviews.

### 5. Milestone Dates & Next Action (26:00–30:00)

- **Goal:** End with concrete dates on both calendars and zero ambiguity about who does what next.
- **Lock and read back:**
  - **Client Asset/Access Deadline:** Target date to drop all logins, brand files, and workflow answers (ideally within **3 business days**).
  - **Staging & Workflow Demo Target:** Expected date for staging review and Milestone 2 readiness.
  - **Target Launch Window:** Expected go-live week and handoff walkthrough.
  - **Immediate Next Step:** Send the recap + onboarding checklist link right after the call so they can start checking items off immediately.

## Facilitation tips

- **Time-box aggressively around edge cases:** Owners love talking through hypothetical edge cases — log them cleanly so they get handled deterministically, then keep moving so you hit all five blocks in 30 minutes.
- **Send a crisp recap within 1–2 hours:** Follow the call with a short bulleted summary of agreed pages, the 3 workflow rules, target dates, and any remaining access/asset items needed to start building.
