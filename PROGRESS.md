# Redesign progress

**Resume from this file alone.** Branch: `redesign-build` (pushed to `orgin`, the GitHub remote).

- Sources: `MASTER-PROMPT.md` (what done looks like), `BUILD_SPEC.md`, `SPEC-ADDENDUM.md`.
  The addendum wins any conflict.
- Boundaries: never touch the logic of the contact form, `/admin`, or `/start`. Imagery only
  from `cellestial-assets/`. Tile copy verbatim. Silent site. An approach that fails twice is
  abandoned for another route.
- Checkpoint rule: after every completed step, commit, push, and update this file
  (done / verified / exact next step). Never start a long task without a checkpoint first.
- Build order: one scene at a time — Loading, Sky, Roots, Close and chrome. Per scene: build,
  screenshot at 390×844 and 1440×900, compare against its reference assets, fix, checkpoint.

## Exact next step

**Loading scene, step 3 of 4: the phone, and the rules measured in real time.**

Step 2 (matching the reference at 1440×900) is checkpointed: see the table and
`refs/loading/compare/desk-1.jpg`, `desk-2.jpg`. What is still different from the reference
is listed in the table row; none of it blocks step 3.

1. Start the dev server: `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm astro dev --port 4500`.
2. `node tools/loader/compare.mjs --only phone` writes `refs/loading/compare/phone-1.jpg` and
   `phone-2.jpg` (390×844, scale 2, mobile, touch). Look: nothing clipped, the word fits with
   margins, the overload bolt still comes down from the top edge. Fix in
   `src/experience/loader/layout.ts` (framing) or `painter.ts`.
3. `node tools/loader/measure.mjs` and `node tools/loader/measure.mjs --size phone` time the
   real runs and check the rules (full 6.0–8.0 s; short version on reload; skip by tap and by
   key; Tab and bare modifiers do not skip; a picture that fails to load still ends; resize
   mid-run keeps the time; storage blocked). Write the numbers into the table. Checkpoint.
4. Then step 4, the A5 star-drop: `node tools/loader/compare.mjs --only a5` writes
   `a5-desk.jpg` and `a5-phone.jpg` (the hand-off at 0, 0.15, 0.3, 0.5, 0.7, 0.9, 1.0 of its
   length). The star must break into shards cut from its own pixels, the letters bleach and
   sink, the shards home in on `sky.coreCircle()`. The sky is still a placeholder (black,
   core circle at the middle of the screen), so the shards arrive on black: that is expected.

## Where things stand

| Piece | State | How it was verified |
|---|---|---|
| Spec and asset pack in the repo | done | — |
| Derived assets, palette, constellations, locked tile copy, scene contract | done | Tests (tile copy is compared character for character with the addendum; 18 constellation tests). Asset sheets looked at: `refs/asset-qa/`, `refs/constellations/`. |
| UI kit: Quicksand, brass button (5 forms), panel, both dialogs; `/contact` and `/start` restyled | done | Screenshots looked at, both sizes: `refs/foundation/kit/`. Contrast measured (all AA). Protected files: only class and style lines changed. |
| Experience core: scene director, claims store, claim flow, page shell with placeholder scenes | done | Build, 96 tests + worker checks, lint all pass. Walk-through at both sizes looked at: `refs/foundation/walk/` (sky → exit button → roots → build request → star; menu to all four destinations; reduced motion; no JavaScript). |
| **Independent review of the foundation** | **not done** | Three reviewers were started and cut off after six minutes. No findings exist. Do it as part of final verification. |
| Loading (A1–A5) | **A1–A4 match the reference at 1440×900 (with the differences listed here); phone, rules and A5 not checked yet** — `src/experience/loader/`, `src/components/scenes/Loader.astro` | Frozen at 14 times at 1440×900, no console errors, set beside the reference and looked at, six rounds of fixes: `refs/loading/compare/desk-1.jpg`, `desk-2.jpg`. Matches: the C's place and size, the order and tempo the circuits light in (a thin white wire with a blue glow), the cooling before the charge, the overload (thin white-hot bolt from the top edge, the node lost in a white disc, a broad blue wash over the right half, spark dust), the camera pulling back, each letter written at the reference's moment as a glass tube (white skin, brass down the middle, white filament, ring nodes) with blue air round it, the cooling into the A4 picture itself. **Still different:** the first "e" is written from its crossbar, where the reference throws an arc to the top of the letter first (compare 3.67); the letters' glow is a little bluer and tighter than the reference's wide navy haze; the main node during the writing is a blue-white point where the reference shows its rings lit white. Real-time runs, 1440×900: full version 7.78 s from mount to done, short version on reload 3.54 s, tap at 1 s ends at 2.81 s; each ends on the sky with the overlay gone. |
| Sky (B, G1) | **parked, unverified** — `wip/sky/`, about 4,800 lines including the scene entry and a test page | Never looked at by anyone but its builder. No beads (B8), no panels (B10), no exit button wiring yet. |
| Effects (C4 flash, D2 burst, G2 warp) | **parked, unverified** — `wip/fx/`, about 2,600 lines, complete with a test page | Builder's own captures only: `refs/fx-wip/`. |
| Roots (E1–E6) | not started (placeholder shows the five tiles as plain panels) | — |
| Close (F1, F2) | placeholder (the two real buttons, wired to the existing flows) | Walk-through above. |
| Chrome (C1–C3) | placeholder (logo, "studio", three bars, menu with four working teleports) | Walk-through above. |
| Transitions wired (fall, crash, warp, A5 hand-off), B7 meaning reveal | not started | — |
| Final verification: screenshot matrix, protected-systems diff | not started | — |

"Parked" means the code is in `wip/`, outside `src/`, so the site builds and runs without it.
The site on this branch today is the plain placeholder version described in the walk-through.

## The alignment harness

- **What it checks.** The loading screen draws the big C from one picture and ends on the
  wordmark picture, whose first letter is the same C, smaller. If the two are not laid exactly
  on top of each other, the C visibly jumps when one picture becomes the other. The harness
  measures how far the outline of the C picture lands from the outline of the C inside the
  wordmark picture.
- **How to run it.** `node tools/alignment/register.mjs` (under a second). It prints one line
  per way of mapping one picture onto the other, and writes two overlay pictures to
  `refs/alignment/` (red and cyan fringes where they disagree, grey where they agree).
- **What a pass looks like.** On the `similarity` line: `median` under 1 and `p90` under 2
  (pixels, at the wordmark's full size).
- **Result, 2026-11-20: PASS.** `similarity … median 0.490 p90 1.500`. The numbers the loader
  must use are scale 0.49082, shift (22.089, 228.324); `wip/loader/.../geometry.ts` already
  does. Full output and reading: `refs/alignment/REPORT.txt`.
- The other files in `tools/alignment/` are the builder's exploration scripts, kept as they
  were. Their paths point at a folder that no longer exists; they are not needed.

## Per scene: what to capture and compare

- **Loading.** Times 0.0, 0.67, 1.33, 1.58, 2.75, 3.0, 3.33, 3.67, 3.83, 4.25, 4.75, 5.25,
  5.75, 6.2 s against `refs/loading-video/f12/` (and the six sheets `sheet12_*.jpg`); the last
  frame against `cellestial-assets/images/a-loading/A4_wordmark_cellestial.jpg`. Full run must
  take 6–8 s, never under 6; skip by tap/click/key; short version on a same-session return.
- **Sky.** Opening pose and each of the 12 constellations against `refs/constellations/`;
  the central star against `B3_core…` and `B3_ring…`; an empty and a lit star against `B4…`
  and `B5…`. Frame times on a throttled phone profile.
- **Roots.** Each tile open, both sizes; tile text against `SPEC-ADDENDUM.md` lines 24–33,
  character for character; soil and node against `E1…` and `E4…`.
- **Close and chrome.** "Claim your star" big, "Contact me" smaller under it; logo against
  `A1_c-emblem…`; the four menu teleports.

## How the site is put together

- One page (`src/pages/index.astro`, the shell). `<html data-scene>` is `loading`, `sky`,
  `fall`, `roots` or `warp`; `src/experience/director.ts` moves between them.
- Each scene lives in `src/experience/<scene>/` and exports one function, `mount`, typed in
  `src/experience/contracts.ts`. `src/experience/main.ts` calls it. A scene reaches the rest
  only through the `ctx` it is given (`ctx.when('sky')`, `ctx.when('director')`, …). That is
  what lets a real scene replace a placeholder file for file.
- Scene markup: `src/components/scenes/*.astro`, `src/components/chrome/Chrome.astro`.
  UI kit: `src/components/ui/`. Tile copy: `src/content/offers.ts`. Stars: `src/content/constellations.ts`.
- Without JavaScript the page is the logo, the five tiles and two links to `/contact`
  (`html:not([data-scene])`; anything that needs script is marked `data-needs-js`).
- Debug: `?scene=sky|roots|loading`, `?t=3.2` freezes the loader (past 6.2 it runs on into
  the hand-off: `t=6.975` is halfway through A5), `?rm=1` forces reduced
  motion, `?debug` puts the live stage on `window.__cellestial`.
- Screenshots and smoke test: `node scripts/shot.mjs` (read its header).
- Checks: `pnpm build`, `pnpm test`, `pnpm lint`.
- Protected, must end unchanged: `workers/**`, `src/onboard/**`,
  `src/scripts/contact-submit.ts`, `src/scripts/start-flow.ts`, `src/scripts/start-builder.ts`,
  `public/admin/**`, `src/content/home.json`, `src/config.ts`. Check with
  `git diff a31d2ee HEAD -- <those paths>` (must print nothing).

## Calls made where the spec is silent (flag these in the final report)

1. A claimed star lights on the visitor's own device, plus `src/content/stars.json` for stars
   lit for everyone. Lighting for everyone automatically needs server storage, which is plumbing.
2. 146 claimable stars (the real figures have 147; one of Virgo's is Cellestial's own). The
   contact Worker names only stars 1–99 in its email; 100–146 send fine but arrive unnamed.
3. "Jesus is King." is written when Leo is complete, not every round. The sky starts empty.
4. No brass labels beside the Roots nodes (the spec says to ask first).
5. Roots is one tile at a time: click, read, close, and the light leads to the next
   (the owner's Nov 18 notes).
6. The loader ends as the "star-drop": the letters are drowned in the star's light and float down.
7. Brass words use the lit faces of the wordmark's letters (`--color-brass-text`); the median
   brass is too dark to read as type.
8. "$990 slashed → FREE": the price is struck through; the word "slashed" stays in the text
   for screen readers, hidden from sight.
9. The star-data credit (Yale Bright Star Catalog; d3-celestial) still needs a home: planned
   as `/credits.txt`. Not done.

## What is in refs/, tools/, wip/

- `refs/loading-video/` — the reference video as frames (`f12/`, 12 per second, time printed on
  each) and contact sheets. `refs/asset-sheets/` — the pack's pictures at a glance.
- `refs/asset-qa/`, `refs/constellations/`, `refs/foundation/` — evidence for the finished pieces.
- `refs/alignment/` — the harness report and overlays. `refs/fx-wip/` — the effects builder's captures.
- `refs/briefs/` — the full written brief for each scene (inside workflow scripts; read the
  text between the backticks of `WHAT` and `VERIFY`). Roots and Chrome briefs are there too.
- `refs/loading/compare/` — the loading scene beside its reference (written by `tools/loader/compare.mjs`).
- `tools/alignment/` — the harness. `tools/loader/` — `compare.mjs` (comparison sheets) and
  `measure.mjs` (the loader's rules, timed in real time); each explains itself in its header.
  `wip/` — parked scene code (see the table).

## Log

- 2026-11-19 — Spec frozen (`a31d2ee`). Data layer committed (`5f58ae7`).
- 2026-11-20 — UI kit, experience core and page shell committed (`611cb9b`); old homepage removed.
- 2026-11-20 — Ground truth taken. Earlier versions of this file were wrong: they said a
  foundation review was running (it never completed), that Loading and Sky were in progress
  (nothing was running; their code sat uncommitted outside the repo), and that transitions were
  not started (the effects layer was written). Everything is now on `redesign-build` and
  pushed: reference frames and evidence moved from `/tmp` into `refs/`, the unfinished scene
  code parked in `wip/`, the alignment harness run once (pass) and kept in `tools/`.
- 2026-11-20 — Loading, step 1: the parked loader moved into `src/`, its mount and markup
  written, and run for the first time. It plays, skips, shortens on return and hands over.
- 2026-11-20 — Loading, step 2: six rounds of look-and-fix against the reference at 1440×900
  (the neon, the bolt, the wash, the letters as glass tubes, the letter timings).
