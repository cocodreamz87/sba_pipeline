# Pre-Launch QA Checklist

Saved 2026-11-23, pasted by Demetrius.
Run right before flipping DNS and handing over a Tier 2 (Full Revenue & Ops Engine) build — catch broken forms, webhook payload mismatches, missing SMS/email triggers, mobile layout issues, or DNS/SSL hiccups while it's still easy to fix.

## FLAG — checklist items missing

The paste contained only the title and the launch-day guardrails below — **the item-by-item checklist itself was not included**. Do not invent checklist items. Send the checklist items when you have them and they will be added here.

## Practical Launch-Day Guardrails

- **Point every form & webhook to production before cutover:** One of the easiest launch-day slip-ups is leaving a form or automation pointed at a staging endpoint or test webhook URL — do a final grep/check of environment variables and workflow URLs right before DNS cutover.
- **Never touch MX or SPF/DKIM records accidentally:** When updating A or CNAME records for a website cutover, double-check existing mail records so client email delivery stays untouched.
- **Clean up test records after QA:** Delete or tag test leads/appointments created in the client's CRM, calendar, or database during QA so their live dashboard starts clean on Day 1.
