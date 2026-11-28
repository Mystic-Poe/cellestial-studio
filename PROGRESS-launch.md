# Launch sheet progress (Fri 27 Nov 2026)

**Resume from this file alone.** Branch: `launch-sheet` (from `main` at `4cd9557`), pushed to `orgin`.
Source: @gro's Bo2bot message `msg_525ebb5a-950d-472c-8538-d184196402da` (27 Nov, 20:08),
"Build sheet - tonight": three jobs in order, then one report. Launch is Mon 30 Nov.

Guardrails: no Stripe, no DNS, no behaviour change to the contact, /admin or /start Workers.
No new prices, offers or copy beyond the sheet. Uncommitted `.gitignore` and
`workers/onboard/test/dev-server.mjs` edits are the owner's Stripe-sandbox work: never stage them.

## Jobs
- [ ] 1. Survey: `/survey` page (noindex, not in nav) + new Worker `cellestial-survey` on `/api/survey*`
      (Turnstile → Resend, subject "Survey: <name>"). REVIEW_LINK is a placeholder constant.
- [ ] 2. Security audit: inspect cloudflare/security-audit-skill, run it, add security headers
      via `public/_headers` (static site only), deploy, verify with curl.
- [ ] 3. Workflow test: contact TEST, /start TEST (clean up), survey TEST, review button state.
- [ ] Report to @gro (with the owner's yes).

## Exact next step
Build Job 1.
