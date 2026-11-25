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

1. Gabriel enables R2 (Cloudflare → R2 → "Add R2 subscription", $0, card on file).
2. Claude: `wrangler r2 bucket create cellestial-onboard-photos`;
   `wrangler d1 migrations apply cellestial-onboard --remote` (drops the old test rows);
   delete secrets `CF_USER_TOKEN`, `GH_TOKEN`, `INVITE_SALT`; deploy the Worker;
   fast-forward `main` to `done-for-you` and push (site build);
   live checks: admin → Access login, bad code 404, `/start/` 200, `/api/onboard/invites` 404.
3. Offer wording: approved and committed on the branch 2026-11-25 (ships with the merge; spec, last section).

Rollback: the old flow is `main` at `995e132`; the old D1 schema can't come
back without its migration reverted (only test rows existed).
