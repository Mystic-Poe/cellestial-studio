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

## Job 2 and 3 state (27 Nov, ~21:45)
- Headers LIVE (`aff569b`), verified with curl on /, /contact, /survey/, /start/, /admin/ (no CSP on /admin by
  design). Live CSP check: zero violations on our pages (only Cloudflare's own Access login page reports one).
- HTTP is NOT redirected to HTTPS (http://cellestialstudio.com/ answers 200). Fix = zone setting "Always Use
  HTTPS". Asked the owner (zone setting, not code).
- /dashboard/ → Cloudflare Access login (302). /admin/ shell is public (200); editing needs GitHub login with
  push rights through the /api/auth broker.
- FINDING, held for the owner's yes: `workers/auth/src/index.ts:48` posts the OAuth result to `event.origin` of
  any opener → a foreign page can take Gabriel's GitHub token. Fix: post to and accept only location.origin.
  Broker is a do-not-touch Worker, so it waits for his word.
- /start has no Turnstile by design (capability links + rate limits); reported, not changed.
- Skill audit: running as one background agent, output ~/security-audit-skill/cellestial-studio/run-1.
- Job 3: Turnstile shows an interactive "Verify you are human" box to automated browsers, and Claude does not
  solve bot checks: the contact TEST and survey TEST submissions are the owner's to click (survey also needs the
  two secrets). /start live: no code and a TEST code both say "This link isn't active", nothing created.
  Full /start flow walked on the local dev server (Stripe off): 16/16. Survey closing state on the live page
  (send faked in the browser, nothing sent): renders right at both sizes, review button disabled (placeholder).

## Exact next step
Wait for: the audit agent's summary; the owner's answers on the broker fix, Always Use HTTPS, the survey secrets, and the two TEST submissions. Then the report to @gro (with his yes).
