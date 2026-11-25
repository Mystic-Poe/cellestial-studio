# Onboarding dashboard — progress

**Resume from this file alone.** Branch: `onboard-dashboard` (pushed to `orgin`).
Plan and spec live in Gabriel's local vault (not in git):
`claude-vault/plans/2026-11-24-onboarding-dashboard.md`,
`claude-vault/specs/2026-11-24-onboarding-dashboard-design.md`.

Public repo: no client data in any file, test or log.

## Status

- [x] Task 1 — progress rules (`src/onboard/progress.ts`), link codec removed.
  `src/scripts/start-flow.ts` / `start-builder.ts` still import the codec until Tasks 4–5.
- [x] Task 2 — D1 store (`store.ts`), fake D1 over node:sqlite, Access check (`access.ts`)
- [x] Task 3 — Worker routes (`client.ts`, `admin.ts`, `notify.ts`, `validate.ts`); `/ping` removed; 49 Worker tests
- [x] Task 4 — client page on the site theme with step bar, Back, Redo; `tools/onboard/check-start.mjs` passes against `workers/onboard/test/dev-server.mjs`. Old builder deleted.
- [x] Task 5 — dashboard (`/dashboard`, `src/scripts/dashboard*.ts`); `tools/onboard/check-dashboard.mjs` passes
- [ ] Task 6 — ship

## Exact next step

Task 6: create D1, add binding, migrate, deploy Worker, merge to main.
