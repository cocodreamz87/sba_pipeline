# Bug Fix vs. Billable Change Order — Internal Triage Rule

Saved 2026-11-23, pasted by Demetrius.
Internal rule for Tier 2 builds and $650/mo recurring care engagements. Keeps scope boundaries airtight without turning routine care into friction.

## Bug Fix — only if ALL THREE hold

1. **Agreed Spec:** It was explicitly promised in the signed SOW, locked sitemap, or written kickoff/staging recap.
2. **Broken Behavior:** Something is failing, misbehaving, missing, or misfiring relative to that agreed behavior (broken link/form, wrong field mapping, failed webhook/SMS/email trigger, layout/overflow bug, or broken redirect).
3. **Not External/New Input:** It was not caused by an unapproved third-party API/provider change outside our control, client edits to live credentials/DNS/workflows, or new business rules/assets introduced after sign-off.

## Change Order — if ANY apply

- **Net-New Feature or Asset:** Adds a new page beyond the agreed sitemap, a new automation workflow, a new third-party integration, or net-new copy/creative/media assets not previously supplied.
- **Changed Logic or Rules:** Alters qualification/routing logic, scheduling rules, cadence timing, pricing/offer structure, or target audience/service areas after kickoff lock-in.
- **Post-Approval Preference Shift:** Changes visual direction, layout structure, or wording after staging approval/sign-off where the original item already matched the agreed spec.

## Quick Decision Table

| Request Example | Classification | Billing Treatment |
| --- | --- | --- |
| Form submits, but lead doesn't land in CRM or Slack alert fails | **Bug Fix** | Included (no charge) |
| Mobile button overlaps text or calendar timezone shows wrong offset | **Bug Fix** | Included (no charge) |
| Minor typo, link update, or routine copy tweak during active care | **Routine Care** | Included under `$650/mo` care |
| Adding a 4th automation workflow or connecting a new CRM/tool | **Change Order** | Scoped & billed separately before build |
| Changing lead routing rules or adding custom multi-step intake logic | **Change Order** | Scoped & billed separately before build |
| Redesigning approved pages or rebuilding after client edits broke flow | **Change Order** | Scoped & billed separately before build |

## One-Line Response Rule for Client Threads

- **If it's a Bug Fix:** *"Good catch—I'm logging that as a fix and getting it patched."*
- **If it's a Change Order:** *"That's outside the original scope—happy to price that out as a quick add-on before we touch it. Want me to send over the estimate?"*
