# Launch sheet progress (Fri 27 Nov 2026)

**Resume from this file alone.** Branch: `launch-sheet` (from `main` at `4cd9557`), pushed to `orgin`.
Source: @gro's Bo2bot message `msg_525ebb5a-950d-472c-8538-d184196402da` (27 Nov, 20:08),
"Build sheet - tonight": three jobs in order, then one report. Launch is Mon 30 Nov.

Guardrails: no Stripe, no DNS, no behaviour change to the contact, /admin or /start Workers.
No new prices, offers or copy beyond the sheet. Uncommitted `.gitignore` and
`workers/onboard/test/dev-server.mjs` edits are the owner's Stripe-sandbox work: never stage them.

## Jobs
- [x] 1. Survey (`4873479`, live 27 Nov ~21:00): https://cellestialstudio.com/survey/ (noindex, not in the menu).
      Worker `cellestial-survey` deployed on /api/survey*. 17 tests pass. **Blocked on two secrets on the
      new Worker** (Gabriel's to enter): TURNSTILE_SECRET_KEY, RESEND_API_KEY; until then it answers 503
      and the page says nothing was sent. REVIEW_LINK (`src/config.ts`) is empty: the button shows disabled.
      Was: 1. Survey: `/survey` page (noindex, not in nav) + new Worker `cellestial-survey` on `/api/survey*`
      (Turnstile → Resend, subject "Survey: <name>"). REVIEW_LINK is a placeholder constant.
- [~] 2. Security audit. DONE: skill inspected (clean: read-only validators, no network, forbids live
      probing); headers in `public/_headers` (`aff569b`, pushed to main), CSP tested on every page at both
      sizes, local and live-injected, zero violations (`tools/security/csp-check.mjs`).
      NOT YET: the skill's audit run (quick profile, output ~/security-audit-skill/cellestial-studio/run-1);
      live curl verification of headers, HTTP→HTTPS, Turnstile on every form, /admin + broker need auth.
      Was: 2. Security audit: inspect cloudflare/security-audit-skill, run it, add security headers
      via `public/_headers` (static site only), deploy, verify with curl.
- [ ] 3. Workflow test: contact TEST, /start TEST (clean up), survey TEST, review button state.
- [ ] Report to @gro (with the owner's yes).

## Exact next step
Confirm the headers are live (curl), run the live checks, then the audit run (one agent, quick profile).
