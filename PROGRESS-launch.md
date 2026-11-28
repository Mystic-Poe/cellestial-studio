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
- Skill audit DONE (incomplete by the skill's own rules: quick profile, 10/10 agents, 3 of 6 candidates
  validated; source only, so nothing could be "confirmed"). Report: ~/security-audit-skill/cellestial-studio/run-1/REPORT.md
  (+ NEEDS-VALIDATION.md, findings.json; both validators PASS). Needs validation: (1) the broker token leak above;
  (2) /admin loads decap-cms@^3.0.0 from unpkg, unpinned, no SRI, no CSP; (3) contact email subject keeps CR/LF
  from the name. All three sit in do-not-touch Workers/pages: held for the owner. Hardening notes in REPORT.md §6.
- Job 3: Turnstile shows an interactive "Verify you are human" box to automated browsers, and Claude does not
  solve bot checks: the contact TEST and survey TEST submissions are the owner's to click (survey also needs the
  two secrets). /start live: no code and a TEST code both say "This link isn't active", nothing created.
  Full /start flow walked on the local dev server (Stripe off): 16/16. Survey closing state on the live page
  (send faked in the browser, nothing sent): renders right at both sizes, review button disabled (placeholder).

## Fixes approved by the owner and done (27 Nov, ~22:40 MT; commit `476141b`)
The owner said "yes fix 1-3, and turn on always use https".
- Broker: handshake posts only to the site's own origin, answers only its opener on that origin. 4 new tests run
  the page script against a foreign opener (fail on the old code, pass now). Deployed cellestial-auth 6b3ce488;
  live page shows `var origin = "https://cellestialstudio.com"`, no '*'.
- /admin: decap-cms pinned to 3.18.0 (the version already live) with SRI sha384 (from npm's package, byte-identical
  to unpkg) + its own CSP (unsafe-eval needed by Decap; scripts only self + the pinned file; connect self +
  api.github.com). tools/security/admin-csp-check.mjs: login 0 violations, signed-in editor (fake GitHub) 0
  violations, tampered file refused. Live via Workers Builds (success, version f3d3308b); live headers checked.
  Not exercised: opening an entry / media library while really signed in: the owner should open /admin once.
- Contact subject: CR/LF/tab stripped from the name, test added. Deployed cellestial-contact 94a71a1b; live
  /api/contact still 405 on GET, 400 on an empty POST.
- Always Use HTTPS: ON (zone setting via the Cloudflare API, SSL mode was already Full). http:// → 301 https://.
- Full `pnpm test` passes; site CSP check (local) 0 violations on all pages.

## Exact next step
Owner: survey secrets, the two TEST submissions, one look at /admin signed in. Then the report to @gro (with his yes).
