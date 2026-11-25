# Onboarding — progress

**Resume from this file alone.** Current work: done-for-you onboarding, branch
`done-for-you` (pushed to `orgin`). Spec and plan are in the local vault (not
in git): `claude-vault/specs/2026-11-24-done-for-you-onboarding-design.md`,
`claude-vault/plans/2026-11-24-done-for-you-onboarding.md`.

Public repo: no client data in any file, test or log.

## Why

Nov 24 live test of the client-owned-accounts flow failed (GitHub Google
sign-up looped on iPhone; Cloudflare wanted email confirmation first).
Gabriel: "we need a true done for you approach." The studio now hosts every
site; the client only answers an intake and reviews.

## Status

- [x] Task 1 — shared intake rules `src/onboard/intake.ts` (+ tests)
- [x] Task 2 — migration `0002_done_for_you.sql` (clients, photos, reviews), store
- [x] Task 3 — `files.ts`: upload checks, R2 keys, streamed zip
- [x] Task 4 — client routes + emails (`client.ts`, `notify.ts`)
- [x] Task 5 — admin routes, router, `wrangler.jsonc` (R2 `PHOTOS`, `RATE_CLIENT`), README
- [x] Task 6 — client page (`start-flow.ts`, `intake-form.ts`, `photo-prep.ts`); `check-start.mjs` passes (15)
- [x] Task 7 — dashboard (`dashboard.ts`, `dashboard-api.ts`); `check-dashboard.mjs` passes (16)
- [ ] Task 8 — ship (below)

Tests: `pnpm test` all green (Worker: client 19, store 9, files 7, access 10, admin 17).

## Exact next step

**Shipped 2026-11-25.** R2 activated ($0, card 8546, at Gabriel's word); bucket
`cellestial-onboard-photos` created; D1 migration 0002 applied (old test rows
gone); Worker deployed (version 1e3516e3); secrets CF_USER_TOKEN, GH_TOKEN,
INVITE_SALT deleted (RESEND_API_KEY remains); `main` fast-forwarded to d8cbd45,
site build live (version 82f6ed00). Live checks: /dashboard/ and admin API 302
to Access login; bad code 404; /api/onboard/invites 404; /start/ 200 serving
the new intake bundle. Offer wording shipped.

Next: Gabriel creates a real client from /dashboard and runs it on a phone;
confirm the "[TEST]"/live notification emails arrive.

Rollback: the old flow is `main` at `995e132`; the old D1 schema can't come
back without its migration reverted (only test rows existed).
