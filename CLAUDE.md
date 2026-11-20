# CLAUDE.md — Cellestial Studio (draft for Gabriel to drop at repo root, rename to CLAUDE.md)

## What this repo is
Astro site for Cellestial Studio, deployed as Cloudflare Worker `cellestial-studio`. Visual redesign in progress — spec is BUILD_SPEC.md + SPEC-ADDENDUM.md at repo root. Read both before building anything.

## Commands
Package manager is pnpm (Node >= 22.23.4).
- Install: `pnpm install`
- Dev server: `pnpm dev` (runs `astro dev`; per AGENTS.md start it in background mode: `pnpm dev --background`, manage with `pnpm astro dev stop|status|logs`)
- Build: `pnpm build` (runs `astro build`)
- Preview the build: `pnpm preview`
- Test: `pnpm test`
- Lint: `pnpm lint` · Lint + autofix/format: `pnpm format` (Biome; also runs on staged files at pre-commit via lefthook)

## Do not touch
- Contact form → Turnstile → Resend worker: visual restyle only, no route/handler changes.
- `/admin` → Decap CMS broker (edits home.json): do not change auth or mapping.
- `/start` deep links → onboard worker: flow untouched.
If a task seems to require touching these, stop and flag it.

## Assets
- All redesign assets are in `cellestial-assets/`. Use ONLY files listed in BUILD_SPEC.md §2.
- No AI-generated or stock substitutes. No social icons anywhere.

## Working rules
- One scene/milestone at a time. Verify before moving on.
- Verification = build passes + screenshots at 390×844 and 1440×900 + difference table vs spec.
- Commit each verified scene separately; keep PROGRESS.md updated.
- If the same fix fails twice, stop and rethink instead of stacking a third fix.
- Silent site, reduced-motion respected — see SPEC-ADDENDUM.md.
