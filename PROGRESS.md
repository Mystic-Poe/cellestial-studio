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

**The fall, the crash and the warp back are built and measured (the "Transitions" rows in the
table). Next: walk the menu teleports with the real flash, then the chrome, B7, the credit.**

In this order, each ending with `pnpm build`, `pnpm test`, `pnpm lint`, a commit, a push and
this file updated:

1. **The teleport** (C4): `go()` already plays `fx.teleportFlash(swap, dir)`; walk the menu to all
   four destinations from the sky and from the Roots at both sizes and look at each landing
   (`strip.mjs --only teleport`, `measure.mjs --only teleport`).
2. **The chrome** (C1 to C3): the real logo with "studio", the three brass bars, the menu panel.
   Brief: `refs/briefs/cellestial-chrome.js`. Today it is a working placeholder. The tools
   find the menu by `#chrome button[popovertarget]` and `#chrome [data-dest="sky|build|claim|contact"]`:
   keep those.
3. **B7**: the meaning of a constellation written in lightning over it once every one of its
   stars is lit, and "Jesus is King." after Leo; the lightning is `src/experience/loader/lightning.ts`.
4. **`/credits.txt`**: the star-data credit (Yale Bright Star Catalog; d3-celestial, BSD 3-Clause).
5. **Tidy**: delete `src/pages/dev/` and `src/experience/fx/dev/` (the effects layer's test page
   and its driver, kept only while the transitions are being built; their last commit is to be
   named in the header of `tools/fx/compare.mjs`) and the empty `wip/`.

Then final verification: every scene screenshotted at both sizes against its reference, the
protected-systems diff (`git diff a31d2ee HEAD -- <protected paths>` prints nothing), a
TypeScript type-check (none has ever been run: the repo has no checker; use
`pnpm dlx typescript` on `src/experience` and `src/content`), the independent review of the
foundation that never ran, and a real-time look at the whole visit.

Dev server: `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm astro dev --port 4500`.

## Where things stand

| Piece | State | How it was verified |
|---|---|---|
| Spec and asset pack in the repo | done | — |
| Derived assets, palette, constellations, locked tile copy, scene contract | done | Tests (tile copy is compared character for character with the addendum; 18 constellation tests). Asset sheets looked at: `refs/asset-qa/`, `refs/constellations/`. |
| UI kit: Quicksand, brass button (5 forms), panel, both dialogs; `/contact` and `/start` restyled | done | Screenshots looked at, both sizes: `refs/foundation/kit/`. Contrast measured (all AA). Protected files: only class and style lines changed. |
| Experience core: scene director, claims store, claim flow, page shell with placeholder scenes | done | Build, 96 tests + worker checks, lint all pass. Walk-through at both sizes looked at: `refs/foundation/walk/` (sky → exit button → roots → build request → star; menu to all four destinations; reduced motion; no JavaScript). |
| **Independent review of the foundation** | **not done** | Three reviewers were started and cut off after six minutes. No findings exist. Do it as part of final verification. |
| Loading (A1–A5) | **done against the reference, polish pass included, except what is listed here; A5 now seen over the real sky (see "Sky, part A", step 4)** — `src/experience/loader/`, `src/components/scenes/Loader.astro`, asset module `scripts/assets/loader.mjs` (run by `node scripts/build-assets.mjs modules`; it writes `geometry.ts` and the matte, and run again it reproduces both) | Frozen at 14 times at 1440×900, no console errors, set beside the reference and looked at: `refs/loading/compare/desk-1.jpg`, `desk-2.jpg` (six rounds of fixes, then the polish pass of four items, each looked at close up: see the section below the table). Matches: the C's place and size; the order and tempo the circuits light in (a thin white wire with a blue glow); the cooling before the charge; the overload (a thin white-hot bolt from the top edge, the node lost in white with its rings showing through, a blue wash filling the bolt's half of the frame, spark dust); the camera pulling back; the first "e" thrown from the node by one tall arc and written in the reference's order; each letter written at the reference's moment as one thin white tube on its brass, with white ring nodes, in a wide navy haze; the node's rings lit white while the word is written; the cooling into the A4 picture itself. The two soft fields (the haze behind the letters, the overload's wash) were also measured, reference against build: `refs/loading/compare/light.txt`, written by `node tools/loader/light.mjs`. **Still different:** the lit circuits (1.33) are whiter, with less blue around them; the first arc (3.67) is less wild and the first piece of the "e" bolder; the overload's white has a more definite edge than the reference's bloom, and its sparks are coarser and fewer; close to the letter being written the haze is a little weaker (3.83) and the letters' edges cooler; once a letter is written the reference lets lightning play over it for longer, and it strikes the star (5.25) where the build only lights it; the node's lens keeps a darker blue ring round its white heart. **Phone (390×844, scale 2, touch):** the same 14 times looked at, `refs/loading/compare/phone-1.jpg`, `phone-2.jpg`: nothing clipped, the C is 62% of the width, the word fits at 87% with margins, the bolt comes down from the top edge. **Rules, measured in real time with `node tools/loader/measure.mjs` (mount to done) after the polish pass, desktop / phone:** full version 7.74 s / 7.73 s (must be 6.0–8.0); short version on a same-session reload 3.49 s / 3.47 s; tap at 1 s ends at 2.76 s / 2.76 s, the "a" key at 1 s 2.74 s / 2.75 s; Tab, Shift, Control, Alt, Meta, CapsLock at 1 s do not skip (7.75 s / 7.73 s); resize twice mid-run keeps the time (7.74 s / 7.75 s). Desktop only: each of the four pictures answering 404 in turn, the loader ends at once (0.01 s) and the sky is shown; sessionStorage blocked plays the full version (7.71 s); the sky's script failing to load, the loader fades out by itself at 6.62 s and the page opens on the Roots; the sky 30 s late, the wordmark holds 6 s and the loader goes at 12.65 s. Frame times 16.8–17.1 ms average at both sizes; phone with the CPU slowed 4×: 26.9 ms average, 50 ms at the 95th percentile, run 7.92 s. **A5 (the star-drop), both sizes, looked at:** `refs/loading/compare/a5-desk.jpg`, `a5-phone.jpg` (0, 0.15, 0.3, 0.5, 0.7, 0.9, 1.0 of its 1.5 s) and full-size crops: the star flashes and breaks into shards (eight or nine) cut from its own pixels, which tumble, catch the light, sweep out and home in on `sky.coreCircle()`, gone by 0.7; a blue-white light swells from the core and the letters bleach, nearest the star first, and sink, gone by 0.6. Over the placeholder sky this ends on black, and the light is centred on the middle of the screen, not on the star: to be looked at again with the real sky. **Short version** looked at again after the polish pass, both sizes: `refs/loading/compare/short.jpg` (the lit C in place, one bolt from the node writes the nine letters in about a second, cools, holds). **Also checked:** the same second always draws the same picture (two pages, and after seeking away and back: identical screenshots); after `done` the overlay is `display: none`, the canvas is 0×0 and the scene is the sky; with reduced motion the loader never shows; without script the cover is not on the page; the server-rendered C sits where the canvas draws it to 0.01 px at 1440×900, 390×844 and 844×390. **Not done:** frame times on a real phone (only headless Chromium with the CPU slowed); landscape phone, tablet and ultrawide framing were not looked at as pictures. |
| Sky (B, G1) | **done, parts A and B, except what is listed in its two sections.** Part A: the void, the honeycomb, Cellestial's star, the twelve figures, the endless flight, the round and the exit button (B11), reduced motion, the governor, the hand-off from the loader, the fall. Part B: the beads (B8), the pulse and the words "claim yours" (B9), the empty-star panel (B10), the lit-star panel, a real send lighting the star, the waiting ask. **Not built:** B7 (the meaning written over a completed constellation); the full fall transition (it belongs to the Roots). — `src/experience/sky/`, `src/components/scenes/Sky.astro`, `tools/sky/` | Every sheet in `refs/sky/compare/` rebuilt by `node tools/sky/compare.mjs` on the real GPU at 1440×900 and 390×844 and looked at. `node tools/sky/measure.mjs`: 201 checks with real wheel, key, touch and mouse events, all passing, written to `refs/sky/measure.txt`. A real send walked through `scripts/shot.mjs` with `/api/contact` stubbed (`tools/sky/claim-200.steps.json`, `claim-400.steps.json`). **Not done:** frame times on a real phone (headless Chromium only, the real GPU and software with the CPU slowed 4×); landscape phone and tablet not looked at as pictures; no independent review. |
| Effects (C4 flash, D2 burst, G2 warp) | **in place and looked at; nothing in it was changed.** `src/experience/fx/` (the pictures in `flash.ts`, `impact.ts`, `warp.ts`; the timekeeping in `layer.ts`), `src/components/scenes/Fx.astro`. It imports only `contracts.ts` and `tokens.ts`. Its test page `/dev/fx` (`src/pages/dev/fx.astro`, `src/experience/fx/dev/harness.ts`) is still in the tree and is deleted in the tidy step. | `node tools/fx/compare.mjs` writes every sheet and `measure.txt` into `refs/fx/compare/`; all were looked at, both sizes. **The flash** frozen at nine moments for each direction over a pale page of dark figures (`flash-<dir>-desk.jpg`, `-phone.jpg`): right-angle and 45° traces ending in ring nodes grow the way of travel, a hub like the emblem's node at the centre, the centre blooms blue-white at the peak, and from t 0.3 to 0.7 nothing of the page shows. Close up beside the lit emblem (`flash-peak.jpg`): the same kind of line (a white core in a blue glow, round ring nodes); **different:** at the peak the traces are whiter and thicker than A1's thin saturated blue, and the bloom lifts the black around the centre to blue-grey. **Real time, desktop / phone:** the flash lasts 423–432 / 421–435 ms without swap time (must be 300–500); `swap()` runs at 204–217 ms and the lowest alpha anywhere on the canvas at that moment is 255 (fully opaque), every run; with a 400 ms swap 823 / 821 ms; with a 2 s swap 1450 / 1433 ms (the hold is capped at 1 s); a swap that throws: 433 ms, the promise rejects with the error and the canvas is put away; two flashes asked for at once play one after the other (814 / 830 ms). **The impact** at six moments at three places along a ground line (`impact-desk.jpg`, `-phone.jpg`): a white flash on the line, jagged rays thrown down and sideways into the ground, a shock of light running both ways along the line, sparks that arc and fall back; gone by the end (760 ms). **The warp** at eight moments over soil and over the pale page (`warp-desk.jpg`, `-phone.jpg`): streaks from a vanishing point high in the frame, few then many and long, a blue-white flare; in real time fully opaque from 747 to 992 ms of 1200 and 1092 to 1456 ms of 1800 (the swap, at 0.7, is at 840 and 1260). **Reduced motion** (`rm.jpg`): plain fades through black, no impact. **At rest:** 0 animation frames asked for in 2 s, before any effect and after all three; the canvas is `display: none` and clear. **Frame times** (headless Chromium, software): 16.6–17.2 ms average; with the CPU slowed 4× the flash averages 36 / 44 ms with one 117 ms frame at its start (laying out the traces), the impact 23 / 18 ms, the warp 24 / 19 ms (worst 83 / 50 ms). **Not done:** not seen on a real phone; no independent review. |
| Roots (E1–E6) | **built (steps 1 to 4 by its builder; the last look by the orchestrator); what differs from the spec is listed at the end of its section.** The soil (a tile of E1 with no mirror in it) with an uneven top edge, E6, five nodes as real buttons in a descending line, five tiles from the locked copy opened one at a time, the mycelium grown by code from where the nodes are, the guided light, the growth from an impact, the whole contract. The arrival and the return themselves (the fall, the crash, the warp) are the director's: see the "Transitions" rows. — `src/experience/roots/` (`index.ts`, `net.ts`, `edge.ts`), `src/components/scenes/Roots.astro`, `scripts/assets/roots.mjs`, `tools/roots/` | `node tools/roots/measure.mjs`: 245 checks with real clicks, taps and keys at 1440×900, 390×844 and 320×568, all passing, written to `refs/roots/measure.txt`. `node tools/roots/words.mjs`: all five tiles equal the addendum character for character, three ways (`refs/roots/words.txt`). `node tools/roots/compare.mjs`: every sheet in `refs/roots/compare/` rebuilt and looked at. Numbers in the section below. **Not done:** frame times on a real phone (headless Chromium only, the real GPU and software, CPU slowed 4×); landscape phone and tablet not looked at as pictures; no independent review. |
| Close (F1, F2) | **built**: exactly the two links the brief gives, F1 "Claim your star" (259×68 px, 21 px type) and F2 "Contact me" (137×44 px, 15 px type) 24 px under it, both centred, nothing else. — `src/components/scenes/Close.astro` | Same run: F1 opens the build request, F2 the message box; the menu lands on them; without script both are links to `/contact`. Looked at in the step 1 sheets. |
| Chrome (C1–C3) | placeholder (logo, "studio", three bars, menu with four working teleports) | Walk-through above. |
| Transitions: the fall and the crash (D1, D2) | **built.** `fall()` in `src/experience/director.ts`; two rules in the shell's stylesheet (`src/pages/index.astro`): the sky's buttons go while the stars fall and during the warp, and E6 is not there until the visitor has arrived. Nothing in the sky, the Roots or the effects layer was changed. **What happens:** B11 is pressed; the scene becomes `fall`; every star drops, all alike, with a trail (`sky.fall`); the document is scrolled by script so the soil rises into the bottom of the frame (to 32% of the screen in 0.9 s); the stars pass behind the soil's edge (the sky is a fixed canvas under the ground); the first one to reach it fires `fx.impact(x, y)` and `roots.growFrom(x)`; the burst's canvas is carried with the ground it struck; the view then follows the trunk's light down (1.2 s) until the top of the ground is the top of the screen; the scene becomes `roots` with the spacer collapsed and scrollTop corrected in the same frame; the sky is switched off and restored unseen; focus moves to the ground. The growth is left running (the network is not snapped whole). | Looked at as strips of sixteen frames, real clicks, real time, real GPU, both sizes: `refs/transitions/compare/fall-desk.jpg`, `fall-phone.jpg` (`node tools/transitions/strip.mjs --only fall`): one continuous event, no cut; the burst sits on the ground line and throws light down and sideways, then the trunk and node 1 light as the view goes down. `node tools/transitions/measure.mjs --only fall` (30 checks, all passing, in `refs/transitions/measure.txt`), desktop / phone: the ground is at the top 2168 / 2140 ms after the press; the star struck on screen at 464 / 495 ms (y 784 of 900 / 708 of 844); one impact, one growth; the ground never moved back down and moved 0.00 px in the frame the spacer collapsed; a second press at 300 ms, the menu at 500 ms and E6 at 700 ms did nothing; ends with scene `roots`, scrollY 0, focus on `#roots`, the sky's stars back. A reload 700 ms in opens on the sky again; back (to `/contact`) and forward 700 ms in leaves the page whole on the sky. Reduced motion: a fade straight to the Roots in about 0.6 s, no `fall` scene, no impact, the network whole. **Frame times during it:** real GPU 18.5 ms average, 33 ms at the 95th percentile, worst 50 ms (desktop); 16.8 ms average, worst 33 ms (phone size). In software with the CPU slowed 4×: 143 / 183 ms average, worst 400 / 417 ms, and the fall then takes 4.1 / 4.3 s instead of 2.2: it slows, it does not skip. **Different from the owner's words:** one star strikes and bursts (the contract's one impact); the others sink behind the soil's edge without a burst of their own. The trails are short. **Not done:** not seen on a real phone. |
| Transitions: the warp back (G2) | **built.** `warp()` in `src/experience/director.ts`; `ascend()` (E6) and `showStar()` from the Roots both use it. **What happens:** the scene becomes `warp` (the spacer returns, scrollTop corrected in the same frame, nothing moves); one frame of the sky's opening pose is drawn behind the ground; `fx.warp(1500)` plays while the ground drops away, faster and faster, from wherever the page was scrolled; in the first frame at or after 0.66 of the warp (the cover is whole from 0.64 to 0.76 and is centred on `WARP_COVER`, 0.7) the page becomes the sky by `arriveInSky()`: stars back, opening pose, B11 still there; the streaks thin and clear; focus moves to the sky. The swap is made in a frame callback on wall-clock time, with a timer 250 ms later for a tab with no frames. | Strips of sixteen frames, real clicks, real GPU, both sizes, from the top of the ground and from 1800 px down it, all looked at: `refs/transitions/compare/warp-desk.jpg`, `warp-phone.jpg`, `warp-deep-desk.jpg`, `warp-deep-phone.jpg`: the ground falls away under growing streaks from a point high in the frame, a blue-white flare covers everything, and it clears on the sky. `node tools/transitions/measure.mjs --only warp` (34 checks, all passing): 1509–1532 ms from the press to focus on the sky; the page became the sky at 998–1007 ms and the effects canvas was fully opaque in that frame (lowest alpha 255), also in software with the CPU slowed 4× (swap at 1033–1097 ms, still under the cover); a second press at 300 ms, the menu at 500 ms and B11 at 1200 ms did nothing; ends on scene `sky`, scrollY 0, Virgo's stars back, B11 visible, focus on `#sky-ui`, the effects canvas put away. Reduced motion: a fade to the still sky in about 0.53 s with B11 there. **Frame times:** real GPU 16.7 ms every frame at both sizes; software with the CPU slowed 4×: 42–47 ms average, worst 233 ms. **Not done:** `showStar()` after a real send from the Roots was not walked again with the warp in (it calls the same `warp()`); not seen on a real phone. |
| Transitions: the teleport (C4) | the real flash plays; landings not walked yet | — |
| B7 meaning reveal | not started | — |
| Final verification: screenshot matrix, protected-systems diff | not started | — |

"Parked" means the code is in `wip/`, outside `src/`, so the site builds and runs without it.
The site on this branch today is the plain placeholder version described in the walk-through.

## Roots: what was done, looked at and measured

**Step 1, it runs (20 Nov).** The placeholders are replaced by the real structure, on the real
page, no console errors at 1440×900 and 390×844.
- **How it is made.** `Roots.astro` writes the whole scene as a page: the soil (a strip cut
  to an uneven edge by a mask, then the mirror-tiled picture below it), E6, five stops (a
  node picture with its bulb as a button, and its tile, complete, from
  `src/content/offers.ts`), then `Close.astro`. As written, every tile is open under its
  node: that is the page without script. The scene's script (`index.ts`) marks `#roots`
  `data-live` when it mounts, and only then is a tile closed until its node is pressed; if
  the script never arrives the page stays as written. `net.ts` draws the light into canvases
  cut into bands of 800 px; `edge.ts` is the surface's profile, used for the mask and by
  `surfaceY()`.
- **The contract, called from the page** (`--only contract`, both sizes, all passing):
  `anchorY('top')` 0; `surfaceY()` 13 px under the top of `#roots` and following the scroll;
  `anchorY('first-node')` puts node 1 whole on screen; `anchorY('close')` 3304 (desktop) and
  3125 (phone) with F1 and F2 on screen; `focusClose` focuses F1 or F2 without scrolling;
  `showGrown()` draws the network and lights five nodes; `setActive(false)` leaves the ground
  bare (so the next arrival grows it again; what was read stays read); `growFrom(x)` resolves
  when the light has passed node 1 and goes on to the whole network.
- **The nodes.** Five real buttons named "Site", "Site + Systems", "Site + App",
  "Add-ons — AI + automation", "Care" (hidden text; no label is seen). Bulb to bulb 756 px on
  the 900 px screen and 709 px on the 844 px one; the bulb is 123 px across on the desktop,
  92 px on the phone.
- **The tiles** (`--only tiles`, real clicks at 1440×900, real taps at 390×844 and 320×568,
  all passing): a press opens that tile and closes any other; focus goes into the tile; the
  close button, Escape and a press outside close it and focus returns to its node; pressing
  its own node closes it. Every tile is whole on the screen and clear of the logo: on the
  desktop beside its node on the side with more room (544 px wide, 264 to 465 px tall); on
  the phone under the bulb (366 px wide, 284 to 530 px tall); at 320×568 it is 296 px wide
  and at most 464 px tall, scrolling inside itself.
- **Chrome and Close** (`--only chrome`): the menu's "What we build" lands on the top of the
  ground, "Claim your star" on F1 (focused), "Contact me" on the Close with the message box
  open; F1 and F2 open the two dialogs; E6 returns to the sky.
- **Without script** (`--only nojs`, script off, and with only the scene's script blocked,
  both sizes): five tiles shown in order one under another, none overlapping, inside the
  screen's width, the nodes as pictures, two links to `/contact`.
- **Faults found and fixed on the way:** the node's glow was a blended layer with an
  animated opacity, which lost its blending and showed as a dark box (it is now the same
  picture, brightened, with no blend mode); the trunk ran behind E6 (it now leaves the
  surface beside the button, on the side node 1 is on).
- **Seen and not yet fixed:** on a desktop the soil's mirror line shows as a symmetric
  pattern; the mycelium is one plain line.

**Step 2, the words (20 Nov).** `node tools/roots/words.mjs`, output in `refs/roots/words.txt`:
ALL PASS. It reads `SPEC-ADDENDUM.md` lines 24, 26, 28, 30 and 33 itself (takes off the `**`
marks and the "N. Title:" lead-in) and opens the real page three ways: 1440×900 and 390×844
with script, each tile opened by a real click or tap on its node, and 390×844 with script
off.
- **For each of the five tiles, each way:** the body's `textContent` (whitespace collapsed,
  trimmed) equals `offerText(OFFERS[i])` and equals the addendum's paragraph (313, 314, 277,
  143 and 461 characters); what the eye can read equals `visibleText(OFFERS[i])` (297
  characters for Site, the others unchanged); the heading equals `OFFERS[i].title` and the
  addendum's title.
- **Brass:** the words in brass (#ae8a68) are exactly the addendum's bold spans: for Site
  "$990 slashed → FREE", "$69/mo slashed → $39/mo", "You own it. Forever."; and so on for
  the others (the output lists them side by side).
- **The prices:** "$990" and "$69/mo" are struck through and nothing else is; the eye reads
  "$990 → FREE" and "$69/mo → $39/mo"; the word "slashed" is in the text twice and cannot be
  seen (a 1 px clipped box).
- **Body text** is 16 px on the phones and 17 px at 1440×900.
- **Every string a visitor can see in the scene** (closed, with each tile open, and without
  script): 41 different strings, each one an offer's title, a piece of an offer's text, or
  "Claim your star" / "Contact me". Nothing else. Heard and not seen: the ground's name
  "What we build", "Return to the sky", "Close", each node's title, and "slashed".
- **Looked at:** `refs/roots/compare/tiles-desk.jpg` and `tiles-phone.jpg` (every tile open,
  the whole screen: on the desktop beside its node, 592 px wide; on the phone under the bulb,
  366 px wide; never under the logo), and `tile-close.jpg` (Site and Care pixel for pixel at
  both sizes: white lines, the key words in brass, the old prices struck).
- **Changed for it:** on a screen 1024 px wide or more the tile is wider (37rem), its type
  17 px and its padding larger; the hidden word "slashed" carries the brass class like its
  neighbours, so the brass run is whole.

**Step 3a, the mycelium itself (20 Nov).** `src/experience/roots/net.ts` is the whole of it.
- **How it is grown.** From the measured positions of the nodes and a seeded generator (the
  same network every visit and after a resize): a runner of fine roots just under the
  surface, the whole width; a trunk that leaves it beside E6 and wanders, as one smooth cord
  with two fine strands winding round it, into the top thread of node 1, out along its lower
  thread, and so on through the five nodes to the top of "Claim your star"; branches leaving
  the trunk at uneven distances and angles, bending, thinning to a hair (0.35 px) and forking
  up to three times; a small glowing joint at every fork; here and there a tip fused to a
  neighbouring thread, so it is a net and not a tree. At 1440×900: 1,950 threads, 32,156
  points, 1,922 joints, in six bands of 800 px. At 390×844: 626 threads, 9,170 points.
- **How it is drawn, in the soil and not on it.** Each line three times: the soil picture
  itself, each channel multiplied up (color-dodge) and let through a soft mask, so the grains
  round a thread are lit and stay grains; a faint blue bloom; and the thread, blue with a
  white heart where it is thick. Brightness rises and falls along a line. Drawn once into
  transparent canvases over the soil: no blend modes on the page, nothing redrawn on scroll.
- **Looked at:** `refs/roots/compare/descent-desk-1.jpg`, `-2`, `-3` and `descent-phone.jpg`
  (the whole descent in screen-sized pieces, `node tools/roots/compare.mjs --only descent`),
  and close crops at device pixels. Four rounds: the first read as forked lightning (white,
  jagged, branches running parallel to the trunk); fixed by smoothing the trunk and the
  branches' wander, wider angles and less pull downwards, bluer and finer branches, a white
  heart only in thick threads, a narrower halo, closer branches and longer reach on a phone,
  a long branch on each side at least every 250 px so neither side stays bare, and the
  cross-links. The trunk runs into each sprite's threads: the picture's top and bottom edges
  are faded (a mask) so its frame is never seen.
- **The growth, as written** (looked at frame by frame in the next part): `growFrom(x)`
  strikes the runner at x; light runs sideways along it at 3.2 px/ms and down the trunk at
  1.45 px/ms, branches unfurling behind at 0.85; each newly lit stretch is hot (whiter,
  wider) for about half a second. Node 1 lights 233 ms after an impact at 30% of the width
  at 1440×900 (210 ms on the phone), the others at about 0.8, 1.35, 1.9 and 2.45 s, all grown
  by 4.1 s. The promise resolves 140 ms after node 1. While it plays only the bands on
  screen are redrawn, and of them only what is still hot. Frame times on the real GPU:
  390×844 every frame 17 ms; 1440×900 17 ms except about twenty frames of 33 ms while the
  densest fan is hot. In software (headless Chromium without a GPU) it runs at about 14
  frames a second, slowed and not skipped.
- **Seen and not yet fixed:** the soil's mirror line (above). A horizontal twig in the soil
  picture shows twice, mirrored, where the trunk's light falls on it: it is the picture, not
  a fault of the drawing.

**Step 3b, the soil, the nodes, the guided light, the growth (20 Nov).**
- **The soil's mirror line: fixed.** The foundation's soil tiles are the picture stacked on
  its own vertical flip; lit by the mycelium the mirror showed as a symmetric figure on a
  desktop. `scripts/assets/roots.mjs` (`node scripts/build-assets.mjs modules`) derives a
  second pair from the same two pack pictures with no axis in it: more rows of the picture,
  its rows levelled so top can follow bottom, then the picture and the same picture flipped
  left to right, each dissolved into the next over 150 rows keeping the grain's contrast.
  `soil-landscape-woven` 1920×1932 (117 kB AVIF, 202 kB WebP), `soil-portrait-woven`
  1080×2736 (95 kB, 172 kB). Nothing generated: cropped, levelled, flipped, dissolved. The
  stylesheet and `net.ts` both use them; the old tiles and the manifest are untouched.
  Looked at in the descent sheets: no symmetric figure, no band where the tile repeats.
- **The nodes** (`node.jpg`: beside `E4_node.jpg`, at both sizes): the pack picture, a little
  dimmed at rest, with the same picture brightened lying over it. Idle and unread it
  breathes, 2.6 s in and 2.6 s out (the bright one comes and goes; a halo of blue light
  swells and sinks on the soil); under the pointer or the keyboard it is at its brightest
  with the halo at its widest; once read it is steadily lit. Measured on the bulb of node 1
  (mean of all channels): 77 at the bottom of the breath, 135 at the top, 143 for the pack
  picture itself. The sheet freezes the breath at 0, 0.9, 1.7 and 2.6 s through the Web
  Animations API (a first attempt with `animation-delay` froze every cell at the same moment).
- **The guided light** (`pulse-desk.jpg`, `pulse-phone.jpg`, `pulse-close.jpg`): a white-hot
  head with a 230 px tail that fades behind it, on its own small canvas moved along the
  trunk's own points, 0.4 px/ms, easing out of a node and into the next; then it rests 1.5 s
  and runs again. To make it read, the resting trunk was made bluer and dimmer and the light
  larger. When it arrives its target answers (the node brightens for 0.9 s; at the end the
  blue line of "Claim your star"). `node tools/roots/measure.mjs --only light`, both sizes,
  all passing: with nothing read it runs from the surface to node 1; while a tile is open
  it is still (0 animation frames in 1.5 s); closing tile 1 with Escape it is seen 43 ms
  later (1 ms on the phone) leaving node 1, reaches node 2 at about 1.7 s, rests, and sets
  off again 3.2 s after the first run; it never scrolls the page and never opens a tile;
  node 3 can be opened before node 2 and the light then leads to node 4 (when nothing
  below is unread it leads back up to the nearest unread node); with its stretch off screen
  no animation frame is asked for; with all five read it runs from node 5 to F1.
- **The growth** (`grow-desk.jpg`, `grow-phone.jpg`: impacts at 15%, 50% and 85% of the
  width frozen at four or five moments; `grow-close.jpg`: the first 420 ms at full size):
  at the point of the blow a few roots of pure light are driven down and fade; the runner
  lights sideways from it; the trunk lights hot and thick down to node 1, which flares as
  the light reaches it, and on; branches unfurl hot behind. After the growth the guided
  light waits 0.9 s before it begins to lead.
- **Calls made here:** the growth's sideways light and the trunk are the seeded network, so
  wherever the star falls the same network appears; only the few roots at the point of the
  blow are particular to it, and they fade. The halo, the bloom and the joints are light
  drawn by code; no generated picture stands in for anything.

**Step 4, phones, keys, stillness, weight (20 Nov).** `node tools/roots/measure.mjs` in full:
245 checks, all passing; the whole output is `refs/roots/measure.txt`.
- **Phones** (`--only phones`, 390×844 and 320×568): no sideways scroll anywhere down the
  page; tap targets E6 56×48, each bulb 92×92, F1 259×68, F2 137×44, a tile's close button
  44×44; body text 16 px, headings 22 px; the longest tile (Care) is 530 px tall on the
  844 px screen, and 464 px on the 568 px one, where its 615 px of text scroll inside it.
  Every tile, at all three sizes, opens whole on the screen, clear of the logo, with nothing
  lying over it (`--only tiles`).
- **A fault found here and fixed:** on a short screen an open tile reaches down past its
  own stop, and the next node's bulb (and, for Care, both closing buttons) was painted over
  it. The stop whose tile is open now stands above the rest until the tile has faded out;
  the tiles check now asks at fifteen points of every open tile that nothing lies over it.
- **Keyboard** (`--only keys`, 1440×900): Tab reaches, in the ground, exactly E6, the five
  nodes in order, F1, F2; each shows a 2 px focus ring (blue-white round a bulb, blue
  elsewhere) and is on screen. Enter and Space open a tile and focus goes into it; Tab
  reaches its close button; Tab again goes on to the next node (focus is not trapped);
  Escape, or Enter on the close button, closes it and focus returns to its node.
- **What a screen reader is given:** the ground is `main "What we build"` holding
  `button "Return to the sky"`, five buttons named by their offers, `link "Claim your star"`,
  `link "Contact me"`. Node 1 open is `button "Site" [expanded]` and `dialog "Site"` with
  `heading "Site" [level=2]`, `button "Close"` and the six paragraphs (the prices read
  "$990 slashed → FREE"). The tree is printed in `measure.txt`.
- **Reduced motion** (`--only still`, `/?scene=roots&rm=1` with the device setting emulated,
  both sizes; sheet `still.jpg`): the network is whole at once; `growFrom()` resolves with
  everything grown and asks for 0 animation frames (75 ms to draw what is on screen at
  1440×900, 28 ms at 390×844); no travelling light; no animation running; the next unread
  node is marked by a steady stronger glow (its bright layer at 0.85 and halo at 1, the
  others 0.08 and 0.25); a tile opens with opacity 1 and no transform at once; at rest 0
  animation frames in 3 s.
- **Without script** (`--only nojs`; sheets `nojs-desk.jpg`, `nojs-phone.jpg`): with script
  off, and with only the scene's script blocked, at both sizes: the soil, five tiles open
  in order one under another, nothing overlapping, nothing wider than the screen, the nodes
  as pictures, no close buttons and no return button, both links to `/contact`.
- **Weight** (`--only frames`, 390×844, pixel ratio 2, CPU slowed 4× through the DevTools
  Protocol, the whole page scrolled by a touch gesture at 1400 px/s, down and back up):
  on the real GPU 147 and 289 frames, average 16.67 ms, 95th percentile 16.7 and 16.8 ms,
  worst 16.8 ms, none over 33 ms; in software 143 and 281 frames, average 17.25 and
  17.26 ms, 95th percentile 16.8 ms, worst 33.4 ms, 4 frames over 33 ms, none over 50 ms.
  Animation frames asked for: 0 in 2 s with a tile open; 0 in 1.5 s with the guided light's
  stretch off screen; about 95 in 3 s while the guided light runs and rests (it travels for
  about half of that). The scene's script is one chunk of 23.7 kB before compression; the
  bands of canvas hold about 25 MB of pixels on a phone at pixel ratio 2 (five bands of
  780×1600) and 27 MB at 1440×900 (six of 1440×800).

**Roots and Close: every remaining difference from the spec and the owner's words.**
1. (Closed later the same day.) The arrival and the return were not built when this section
   was written; they now are, in the director: see the "Transitions" rows of the table.
2. The growth lights the one seeded network: wherever the star falls, light runs sideways
   along the runner to the trunk and down it. Only a few roots of light at the point of the
   blow are particular to that point, and they fade in about half a second.
3. The guided light runs once every three seconds or so (about 1.5 s of travel, 1.5 s of
   rest), not continuously. While a tile is open it is still. After the last node it leads
   to "Claim your star"; when the visitor has read out of order and nothing below is
   unread, it leads back up to the nearest unread node.
4. A node counts as read when its tile has been opened (not when it is closed); what was
   read is remembered for the visit only, not across a reload.
5. The soil is not the foundation's mirror-tiled tile but a second derivation of the same
   two pack pictures (`scripts/assets/roots.mjs`), because the mirror line showed as a
   symmetric figure once lit. The asset manifest (`src/experience/assets.ts`) does not list
   it; the stylesheet and `net.ts` name the files themselves.
6. The node picture stands a little dimmed at rest (72% brightness) so that it can breathe
   up to the pack picture's own level; at the top of its breath and once read it is about
   the picture as supplied.
7. On a 1440 px screen the outermost fifth on each side stays bare soil for much of the
   descent: branches reach at most 47% of the width from the trunk. The first stretch (the
   surface to node 1) is short and carries few branches.
8. On a desktop the growth drops to about 30 frames a second for some twenty frames while
   the densest fan of branches is hot (real GPU); in a browser without a GPU the growth runs
   at about 14 frames a second, slowed and not skipped.
9. The tile is the kit's large panel, 37rem wide with 17 px type on a screen 1024 px wide or
   more (the kit's own is 34rem and 16 px), and its close button sits in the kit's sticky
   head beside the title.
10. No visible label stands beside a node (the spec says to ask first); the bulbs are told
    apart only by their order and by opening them.
11. E6 is centred at the top of the ground, and the trunk leaves the surface beside it, on
    the side the first node is on, not through it.
12. Not looked at: a landscape phone, a tablet, a real phone's GPU. No independent review.

## Sky, part A: what was done, looked at and measured

**Step 1, it runs (20 Nov).** On the real page at 390×844 and 1440×900, real GPU, no console
errors (`node scripts/shot.mjs --gpu`): `/?scene=sky` draws Virgo, the honeycomb and
Cellestial's star with its three rings; `/` plays the loader and ends on the sky with the
exit button hidden; `/?rm=1` is the still sky with the exit button present; with the round
remembered the exit button is there, pressing it lands on the Roots, the return button
brings the sky back and a wheel turn flies it. Two faults found on the first run and fixed:
the ring shader used a word that is reserved in WebGL 2 (`flat`), and the rings' quads were
culled as back faces. three.js is in its own chunk (`sky.*.js`, 577 kB); the page's first
chunk is 77 kB and does not contain it.

**Step 2, it looks right (20 Nov).** Sheets in `refs/sky/compare/`, written by
`node tools/sky/compare.mjs` on the real GPU (NVIDIA RTX 3060 Ti through ANGLE) at both
sizes, each looked at:
- `open.jpg`: the opening pose. Virgo whole, Cellestial's star in the middle of the screen
  and the brightest thing on it, the honeycomb faint behind. The ground is pure black: at
  1440×900 the median pixel is #000 and 77% of all pixels are exactly #000.
- `stations-desk-1.jpg`, `stations-desk-2.jpg`, `stations-phone.jpg`: each of the twelve
  stations beside its figure from `refs/constellations/constellations.jpg`. All twelve are
  the real figure, whole, at both sizes. Measured by the same run (every star's disc, and
  Cellestial's star out to its outer ring): the least clear room at the top is 100 px on
  the desktop and 98 px on the phone (needed: 96), at the bottom 124 px and 122 px
  (needed: 120), at the sides 69 px (Leo, desktop) and 22 px (phone). The run fails if a
  figure leaves the safe area.
- `b3.jpg`: Cellestial's star close up at 0, 4 and 9 s beside the two B3 pictures. Three
  bands of the same cracked brass with blue-white light in the cracks; the near half of each
  band passes over the core and the far half behind it, with a soft hand-over where the band
  turns away, so nothing pops as they turn.
- `stars.jpg`: an empty and a lit star as they appear (radius 16 px and 20 px on the desktop,
  9 px and 11 px on the phone) and enlarged, beside B4 and B5. The empty one is a dark sphere
  with a thin blue rim; the lit one a glowing blue sphere with bright traces: different at a
  glance.
- `between.jpg`: layers 0.5 and 3.5. The next figure ahead is seen as a small figure of blue
  points with its lines; the honeycomb recedes plane behind plane.

What was changed to get there: the honeycomb now has two more planes between every two
layers (`LATTICE.between`), so it is seen to recede, and is drawn fainter and thinner; a
star too far away to show its sphere is a small steel-blue point (`LOOK.farGain`) and far
figure lines keep more of their light (`LOOK.lineThin`), so the constellations ahead can be
seen waiting; B4's picture is lifted (`LOOK.body`) and its rim made thinner so it reads as a
sphere and not as a ring; the halo round the core is a little wider.

**Step 3, it flies right (20 Nov).** Driven for real by `node tools/sky/measure.mjs`; the
full output is `refs/sky/measure.txt`, 86 checks, all passing. The numbers:
- **Speed.** With the wheel turned without stopping, world units a second (a layer is 6):
  1.5 at 0.3 s, 3.5 at 1 s, 6.5 at 2 s, 7.9 at 3 s, then 8.00 and no more (the ceiling). On
  the phone, swipes of a fifth of a second with a third of a second between them: 1.9 after
  the first, then 3.5, 5.4, 7.1, 7.9, 8.0, 8.0.
- **Stopping.** When the input stops it glides and stands exactly on a station 2.5 to 3.3 s
  later. A click or tap on empty sky stops it dead: speed 0 on the press, and 1.2 s later it
  is still where it was, between two stations.
- **Keys.** ArrowDown, PageDown and Space fly forward, ArrowUp and PageUp back, each to rest
  on a station; Home returns to the nearest Virgo with Cellestial's star at the middle of
  the screen.
- **Endless.** Thirty-one layers forward in 23.5 s of holding the key, sixteen back in 12.2 s;
  every station passed in order, the figures repeating every twelve; afterwards every star
  is where it is in the first round to 4e-12 px.
- **The round.** `roundComplete()` stays false over five layers out and back (7 figures) and
  turns true on arriving at the twelfth figure; the exit button appears then (its words are
  exactly "See what holds up the sky", centred, 32 px above the bottom edge), stays while
  flying on, is there from the start after a reload in the same session, and leads to the Roots.
- **Guards.** With a dialog open (`:modal`), with focus in a form field, with focus on the
  menu button, and on the Roots, wheel and keys do not move the sky (on the Roots they scroll
  the page). With none of those the same wheel flies.
- **Reduced motion** (`/?rm=1`, both sizes): 0 `requestAnimationFrame` calls in 3 s at rest;
  the exit button present with no round flown; no flight; a star is still picked by a click
  or a tap.
- **Frame times, real GPU** (4.6 layers forward, 1.6 back, about 730 frames): 1440×900
  average 16.67 ms, 95th percentile 16.8 ms, worst 16.8 ms; 390×844 at pixel ratio 2 the
  same (16.67 / 16.7 / 16.8). The governor stayed at level 0.
- **The governor** (390×844, software rendering, CPU slowed 4×, 24 s of flying): 52 to 56 ms
  a frame over the first two seconds, in which it steps down by itself from level 0 to 3 of
  4 (pixel ratio 2 to 1, then fewer honeycomb planes); from then on 17.5 to 19 ms a frame,
  worst 33 ms. In one of two runs it tried a level up at 12 s, found it too slow and stepped
  back down (a 36 ms average for those two seconds), then waits twice as long before trying again.
- **Picking.** Every star of the figure in front has a real `<button>` over it (checked at
  four stations: 12 of 12, 14 of 14, 5 of 5, 22 of 22), named "Empty star in Virgo" or
  "Claimed star in Virgo", never under 44 px. Its centre is within 0.11 px of the star's at
  rest and within 0.07 px in flight (every frame for 3 s). An empty star calls
  `claims.pick(slot)` and nothing is claimed; with an ask waiting it calls
  `claims.place(slot)` and the star ignites; a lit star calls `focusStar(slot)`, which brings
  it to a radius of 108 px (62 px on the phone) at the middle of the safe area, and Escape
  lets it go.

Faults found by driving it, and fixed: the star buttons were never put in place until the
camera first moved, so at the opening pose and under reduced motion no star could be picked
(a comparison with NaN); on a phone each new swipe stopped the flight before speeding it up,
so speed could never build (a finger's press now waits 90 ms to see whether it is a swipe, a
swipe counts as continued scrolling for half a second, and built-up speed is forgotten over
3 s instead of 1.6); the wheel flew the sky while a form field had focus.

**Step 4, the hand-off and the fall (20 Nov).** Nothing had to be changed in the sky or in
the loader.
- **The hand-off over the real sky.** `node tools/loader/compare.mjs --only a5` rebuilt
  `refs/loading/compare/a5-desk.jpg` and `a5-phone.jpg`, both looked at: at 0 the wordmark
  stands with its little star; by 0.15 the star has flashed and the sky's core is the light
  in its place; the core travels and grows towards the middle while the letters bleach and
  sink (the loader's light is now centred on the core, which it was not over the placeholder);
  by 0.7 the core is at the middle with its rings gathered, and Virgo and the honeycomb are up
  out of the black; 1.0 is the opening pose.
- **The sky's side alone**, `node tools/sky/compare.mjs --only handoff`
  (`refs/sky/compare/handoff.jpg`, `handoff-phone.jpg`): primed at the star's circle, the core
  is exactly there and that size (1440×900: 1108, 318, r 6.00; phone: 300, 398, r 2.40), then
  at 0.3, 0.5, 0.7, 0.85 and 1 it is at x 1028, 878, 757, 724, 720 with radius 9.2, 14.4,
  21.8, 26.5, 27.6 (phone: x 278, 238, 205, 196, 195; r 3.5, 5.2, 7.4, 8.8, 9.0). The picture
  at `introProgress(1)` and the picture after `reset()` at the same clock differ in **0
  pixels** at both sizes: there is no jump when the director takes over.
- **The fall as the contract promises it**, `node tools/sky/compare.mjs --only fall`
  (`refs/sky/compare/fall.jpg`, `fall-phone.jpg`), against a ground line that rises from the
  bottom edge to 55% of the height in 1.2 s: every star, lit or empty, drops straight down
  with a trail, each starting within 0.28 s of the first; the honeycomb, the figure's lines
  and Cellestial's star fade out; `onImpact` fired once (1440×900: x 644, 0.42 s in; phone:
  x 170 of 390, 0.48 s in); the promise resolved at 1.46 s and 1.32 s with the sky empty;
  after `restore()` all 12 of Virgo's stars are where they were (to 0.01 px) and the
  honeycomb and Cellestial's star are back. The full transition (the soil rising over the
  canvas, the burst) is not built: it belongs to the Roots.

**Hooks for part B** (in `src/experience/sky/hooks.ts`, reached with `hooksOf(scene)` from
`index.ts`): events `open-empty` `{ slot, circle }` (an empty star was picked and no ask was
waiting: open the preview panel B10 here), `open-lit` `{ slot, circle, ignited }` (the
camera has come to rest on a lit star: open the lit-star panel here), `dismiss` `{ reason }`
(close whatever is open: the visitor flew on, or the scene was paused, reset or began to
fall), `tap-empty` `{ x, y, wasMoving }` (start the beads B8 here), `star-pick`, `station`,
`round-complete`, `ignite`, `focus`, `frame`; and `starCircle(slot)`, `nearestEmptyStar(x, y)`,
`setStarGlow(slot, level)` (the B9 pulse), `lattice.nearestVertex(x, y)`,
`lattice.nearestVertexToStar(slot)`, `lattice.path(from, to)`, `lattice.pulseEdge(layer, edge)`,
`lattice.vertexScreen(layer, vertex)`, `claims`, `ui`, `keepAwake()`, `requestFrame()`.

**Still different from the assets (after step 2):** B4's brass traces cannot be seen at the
size a star has at its station (16 px radius: the sphere is 32 px across and the traces are
finer than a pixel); they show only in the close-up of `focusStar`. The rings turn in the
plane of the screen and breathe in tilt; they do not tumble in three dimensions. B5's soft
outer glow is tighter than in the picture. The honeycomb's planes face the camera: it
recedes plane behind plane and along its struts, not as a floor seen at an angle.

## Sky, part B: what answers a touch

**B1, the beads of light (B8) (20 Nov).** A tap or click on empty sky stops the flight dead (as
before) and sends beads from where the finger is. How it is made: `answer.ts` takes the hook
`tap-empty`, chooses the empty star nearest the touch in the layer in front (only stars that
are on screen with room for the words under them; if that layer has none, the next layer),
and `beads.ts` plans the route: a hop from the touch onto the nearest vertex of the honeycomb,
then a shortest walk along its edges (`lattice.path`, a breadth-first search) to the vertex
nearest the star, then one last hop into the star. Ten round beads of the sampled blue, drawn
additively as points into the sky's own three.js scene, the head white-hot at its heart, each
bead behind it fainter and smaller; about 17 px apart on screen; each edge is lit as the head
comes onto it (`lattice.pulseEdge`, which now takes the time the light begins); a soft spark
under the finger. A new tap replaces the run. Nothing is picked or claimed by it.
- **Looked at**, `node tools/sky/compare.mjs --only beads`: `refs/sky/compare/beads-desk.jpg`
  and `beads-phone.jpg`. Four rows each (Virgo, Sagittarius, Aries, and Virgo with all twelve
  stars lit), five moments from the touch until after the arrival, cropped to the route, and a
  sixth cell with the planned route drawn in green over the same frame: the beads sit on the
  green line and the green line runs along the honeycomb's lit edges. The same run prints how
  far every bead in every frame is from the route: 0.00 px.
- **With every star of the layer in front lit** the beads go on to the next layer: along the
  plane to a vertex that carries a strut, down the strut (shrinking with distance), then to
  the nearest empty star of Libra, which pulses with the words under it (fourth row).
- **Measured**, `node tools/sky/measure.mjs --only beads`, real clicks at 1440×900 and real
  taps at 390×844, 14 checks, all passing: at three stations the route is on the graph (every
  step is the edge it says it is), is as short as a breadth-first count made by the test
  itself, starts at the vertex nearest the finger and ends at the vertex nearest the nearest
  empty star, and that star then pulses (desktop: 2, 3 and 3 edges, arriving in 0.69, 0.78 and
  0.87 s; phone: 6, 1 and 1 edges in 1.25, 0.50 and 0.50 s); nothing is claimed or picked;
  flying on ends the pulse; a second tap 0.12 s later replaces the run; a tap on a star sends
  no beads; a tap at speed 7.7 (phone 7.1) stops the flight at 0 on the press and the beads
  set off from the finger; all twelve of Virgo lit, the beads cross by a strut to slot-70.
- **Differences from the spec, plainly.** The honeycomb's cells are large on a desktop (an
  edge is about 140 px at a station), so a run there is one to four edges long: it is over in
  0.5 to 0.9 s. The lit edges take the blue of the beads, not a brighter brass. Where the
  nearest empty star stands too close to the bottom edge for the words to fit under it, the
  next nearest is taken.

**B2, the pulse and the words (B9) (20 Nov).** When the head of the beads reaches the star,
the star's rim flares and then breathes once every two seconds (its extra light swings
between 0.3 and 1 through `setStarGlow`: the rim brightens and the star swells by up to 8%),
and under it stand the words, exactly "claim yours": live text in `#sky-ui`, Quicksand 600,
13 px, `--color-brass-text`. The words themselves stay whole, so they can always be read; a
second layer of brass light over them breathes with the star (`--pulse`, set on every frame;
only that layer's opacity changes). The scene keeps them centred under the star on every frame
(beside a screen edge they move in only as far as keeps them whole). A click on the words is
a click on the star. They end when the visitor flies on, taps elsewhere (the beads then go to
the star nearest that tap), picks a star, or the star is lit.
- **Looked at**, `node tools/sky/compare.mjs --only pulse`: `refs/sky/compare/pulse.jpg`, the
  star close up at +0, 0.5, 1, 1.5 and 2 s of its pulse at both sizes, and the same star
  marked in the still sky. The words read clearly on the phone.
- **Measured**, `node tools/sky/measure.mjs --only words`, 24 checks, all passing, both sizes:
  the words' text, typeface and colour (#ae8a68); centred 0.01 px off the star's centre and
  8 px under its disc, whole on the screen; 2.00 s from peak to peak; a tap elsewhere moves
  the pulse; flying away, picking the star and the star being lit end it; a click on the
  words picks the star and claims nothing.
- **Reduced motion** (`/?rm=1`): a tap sends no beads; the nearest empty star is marked at
  once with a steady light (0.8) and the words, and nothing moves afterwards (0
  `requestAnimationFrame` calls in 2.5 s).

**B3, the empty-star panel (B10) (20 Nov).** A click, tap or Enter on an empty star picks it
(`claims.pick(slot)`, nothing is claimed) and opens the kit's small panel beside it: five
lines, each an offer's short name in brass and its lead in white, written into `Sky.astro`
at build time from `OFFERS[i].short` and `OFFERS[i].lead`, and under them the kit's small
button "Claim your star", which closes the panel and calls `claimFlow.openClaim(slot)`. No
prices, no other words. It is a `role="dialog"` named by its button; focus goes into it and,
when it closes, back to the star's button. It closes on Escape, on its close button (named
"Close"), on a press anywhere outside it (that press sends no beads; a press on its own star
closes it and does not reopen it), and when the visitor flies on. `panels.ts` puts it to the
right of the star, else to the left, else under it, else over it, 12 px from the star's disc,
at least 12 px inside the screen, and never over the logo and menu (top-left 118×88).
- **Looked at**, `node tools/sky/compare.mjs --only panel`: `refs/sky/compare/panel.jpg`,
  opened by a real click or tap on the leftmost and the lowest star of Virgo and the
  rightmost of Scorpius at both sizes, the whole screen, and the panel pixel for pixel.
- **Measured**, `node tools/sky/measure.mjs --only panel`, 28 checks, all passing: the words
  compared with `src/content/offers.ts` line for line; brass names (#ae8a68), white leads, no
  digit or "$"; focus in and back; Escape, the close button, a press outside, flying on;
  Enter on the star and Tab to its two buttons; the button opens `#claim-dialog` with the
  hidden star field set to the slot and nothing claimed; closing the request unsent claims
  nothing. Opened beside every one of the 146 stars at its station (through `hooks.pick`), at
  1440×900 and 390×844 it is 336×338 px, whole on the screen with at least 12 px to spare,
  never over the logo, never over its star.
- **Where it falls short.** On a shorter screen the panel is set tighter (336×298 px, under
  760 px of height) but there is not always room beside the star: at 390×664 (a phone with
  its browser's bars showing) it lies partly over its star for 19 of the 146 stars, at
  360×640 for 41. It is still whole on the screen and clear of the logo there.

**B4, the lit-star panel (20 Nov).** A click on a lit star flies in on it (`focusStar`, about
1.2 s; the star's disc is then 108 px in radius on the desktop and 62 px on the phone) and,
when the camera has come to rest, a small panel opens beside it with exactly what was asked:
the `ask` of that claim from the claims store, set as `textContent` (never as markup), with
its own line breaks kept, and nothing else: no title, no name, no date, no label. Only a
close button, named "Close"; the panel takes its accessible name from the ask itself. A long
ask scrolls inside the panel (a window of 240 px; its last line fades while there is more
below, and the keyboard can reach it). Closing it (the button, Escape, a press outside) or
flying on lets the camera go back to the flight path. A star with no ask opens no panel.
- **Looked at**, `node tools/sky/compare.mjs --only lit`: `refs/sky/compare/lit.jpg`, claims
  seeded through localStorage key `cellestial:claims`: an ask of 62 characters, one of 709
  with line breaks and a list, and one written as markup (`<b>`, `<img onerror>`), both
  sizes, and the long one pixel for pixel.
- **Measured**, `node tools/sky/measure.mjs --only lit`, 20 checks, all passing: the panel's
  whole text is the ask and its only other child is the close button; an 809-character ask
  is 674 px of text in a 240 px window and scrolls; the markup ask shows as its text, makes
  no element and runs nothing; the close button, Escape and a press outside each close it and
  the camera is back on the flight path (0 away) 1.3 s later; flying on closes it; the three
  seeded stars are still the only lit ones.

**B5, the waiting ask and the ignition (20 Nov).** Both walked for real on the page, with
`/api/contact` answered by the test.
- **A send with a star chosen.** Through the harness's route step:
  `node scripts/shot.mjs --gpu --url "http://localhost:4500/?scene=sky&debug" --out <dir> --steps tools/sky/claim-200.steps.json`
  (and `claim-400.steps.json`); every `expect` in them held at both sizes, and the shots are
  laid out in `refs/sky/compare/claim-walk.jpg`: the panel on an empty star, "Claim your
  star", the request filled, "Sent.", the camera at the star, the claim playing, the star lit
  with its panel showing what was asked, still lit after a reload; and with a 400: the form
  says "That did not send.", nothing is lit.
- **Measured strictly**, `node tools/sky/measure.mjs --only claim`, 26 checks, all passing,
  both sizes, the 200 held back 0.9 s by the test: while the request is on its way nothing
  is lit and nothing is stored; what is posted is name, email, message and `star=slot-34`,
  nothing added; the star ignites 2.57 s after the 200 (the "Sent." beat of 1.4 s, then the
  flight in) and not before; its panel then shows exactly the ask; localStorage holds
  `[{slot, ask}]` and nothing else; after a reload it is lit and its button reads "Claimed
  star in Virgo". Answered 400: nothing lit, nothing waiting, nothing stored, also after a reload.
- **A send with no star chosen** (from the "Claim your star" button on the Roots, same run):
  nothing is lit and `claims.unplaced()` is the ask; the director returns to the sky and
  0.9 s later the beads go by themselves from the middle of the screen to the nearest empty
  star, which pulses with the words; after flying on a layer they go again 0.35 s after the
  flight has come to rest; the next empty star clicked takes the ask at once
  (`claims.place`) and ignites, with no panel and no second send.
- **The ignition looked at**, `node tools/sky/compare.mjs --only ignite`:
  `refs/sky/compare/ignite.jpg`, seven moments at both sizes, the camera closed in on the
  star 1.16 s after `focusStar`: the empty sphere with its brass traces; the charge running
  down the traces, white at its head (+0.2, +0.45 s); the whole sphere lit and flashing
  (+0.7 s); settled to the steady blue of B5 (+1.4 s); then its panel.
- **A fault found on the way and fixed** (`flight.ts`): a flight key let go before a single
  frame had passed (a scripted key press; a very quick real one) closed whatever was open
  but flew nowhere. It now counts as one sample of input, like a wheel tick.

**B6, the last pass (20 Nov).** `node tools/sky/measure.mjs` in full: 201 checks, all passing
(part A's 86 unchanged in what they ask; part B: `beads` 14, `words` 24, `panel` 28, `lit` 20,
`claim` 26, `beadframes` 3). `node tools/sky/compare.mjs`: every sheet rebuilt; `open.jpg` and
`stations-desk-1.jpg` looked at again: the opening pose and the figures are as they were, and
nothing of part B shows in a sky nobody has touched. The safe areas, the hand-off (0 pixels
between `introProgress(1)` and `reset()`) and the fall (one impact, resolves, `restore()`)
print the same numbers as in part A.
- **Frame times during ten bead runs in a row** (a touch every 0.9 s at ten places), real
  GPU: 1440×900, 541 frames, average 16.67 ms, 95th percentile 16.7 ms, worst 16.8 ms;
  390×844 at pixel ratio 2, 549 frames, the same (16.67 / 16.7 / 16.8). No frame over 33 ms,
  the governor at level 0.
- **In software with the CPU slowed 4×** (390×844; the governor settled at level 3 of 4,
  pixel ratio 1, and was held there so that only the beads differ): at rest 16.83 ms a frame
  on average; during the ten runs 17.19 ms, 95th percentile 16.8 ms, worst 33.4 ms, 2 frames
  of 577 over 33 ms. (Left free, the governor tries a level up about every ten to twenty
  seconds in software, which costs a second of 100 ms frames: that is part A's behaviour,
  and it is what an earlier, unheld run of this measurement showed.)
- Two things changed for this: the beads' points are always in the scene (dark when nothing
  runs), so their shader is compiled with the rest and the first touch does not wait for it;
  the words' pulse changes only the opacity of a layer of light over them, never the text.
- Nothing is under `src/pages/dev` or `wip/sky`.

**Part B: every remaining difference from the spec and the owner's words.**
1. The lit edges take the blue of the beads; the spec says the beads brighten "the brass
   edges they pass" and does not say in what colour.
2. On a desktop the honeycomb's cells are large (an edge is about 140 px at a station), so a
   run of beads is one to four edges long and lasts 0.5 to 0.9 s.
3. The route starts with a hop from the finger onto the nearest vertex and ends with a hop
   from the nearest vertex into the star; only those two hops leave the honeycomb's edges.
4. A star too near the bottom edge for the words to stand under it, or under the logo, is
   not offered by the beads; the next nearest is. Beside a side edge the words move in just
   far enough to stay whole (they are then not centred under the star).
5. With every star of the layer in front lit, the beads go on along a strut to the nearest
   empty star of the next layer. With none there either, a tap does nothing.
6. A press that closes a panel or lets a close-up go is not answered with beads as well.
7. The empty-star panel is 336 px wide (the kit's small panel is 304): the five leads then
   wrap to two lines each. On screens under about 760 px of height there is not always room
   beside the star: at 390×664 the panel lies partly over its star for 19 of 146 stars, at
   360×640 for 41 (it is always whole on the screen and clear of the logo).
8. The lit-star panel is `role="dialog"` named by the ask itself, and the empty-star panel by
   its button: no words were added for an accessible name beyond "Close".
9. The words "claim yours" are 13 px; the spec says "tiny".
10. B7 (the constellation's meaning written in light when all its stars are claimed) is not
    built. Nothing in part B's brief asked for it; it needs the loader's lightning writer.
11. Not looked at: a landscape phone, a tablet, a real phone's GPU.

## Loading: the polish pass the orchestrator asked for (done, 20 Nov)

After its review the orchestrator accepted the Loading scene and asked for one polish pass on
the differences still listed, because the owner's bar is "it must feel like the reference
video, not an approximation of it": four items, in order, each checkpointed, none to take more
than two tries. All four were reached.

- **P1. The first "e" (3.67 s): done.** The arc is thrown from the main node up to the left of
  the letter, the tube shoots up from there and over the top, then runs down the left side
  and round the bottom to the ring, and the bar comes last, as the reference does it (the
  order is read off its frames and lives in `scripts/assets/loader.mjs`, `E_ORDER`; both e's
  are written this way). The lightning runs along the outside of the tube and lets go last.
  Looked at close up beside the reference at 3.58, 3.67, 3.75 and 3.83. Still different: the
  reference's arc is brighter and wanders a little more.
- **P2. The letters while they are being written (3.83 to 5.25 s): done.** A lit letter is now
  what the reference shows: one thin white tube down the middle of the letter with a close
  bloom, the brass round it in shadow and tinted blue, a faint warm edge, white ring nodes.
  The tight saturated glow is gone; behind the word lies a wide navy haze sized by the
  screen, a little deeper round the newest letter. The haze was set by measuring the
  reference's colour at eight places in the frame at 4.25, 4.75 and 5.25 s and the build's at
  the same places (they agree to about a third), then looked at close up at 3.83, 4.25, 4.75
  and 5.25. Still different: the reference's haze is a little brighter close to the letter
  being written, and its letters' edges a little warmer.
- **P3. The main node during the writing: done.** From the moment it is struck until the word
  cools, the rings and tracks cut in the node's face are lit white (they are the circuit
  lines measured on the lit C, so they sit exactly on the picture's own), its face is washed
  with light, its heart is white and its rim catches a little. Looked at beside the
  reference as close crops of the node at 3.83, 4.25, 4.75 and 5.25. Still different: the
  build's lens keeps a darker blue ring round its white heart.
- **P4. The overload (3.0 to 3.33 s): done.** The wash now fills the half of the frame the bolt
  is in as the reference's does: its blue was measured at 21 places in the frame at 3.0 and
  3.33 s in reference and build, and they now agree closely (for example at mid-height, a
  third of the way from the bolt to the right edge: 84 and 84; at the right edge: 41 and 38;
  along the bottom: 109 and 118). The white at the node is no longer a lid: it lies over the
  lens and the side the struts come in on and draws in as it fades, so the rings on the far
  side of the face show from the first frame (close crops of the node at 3.0, 3.08, 3.17,
  3.25 and 3.33 beside the reference). The last sparks are gone by 3.5 s, as in the reference.
  Still different: the reference's white is a softer bloom with a less definite edge, and its
  sparks are finer and denser.
- **Last:** every sheet was rebuilt from the final code and the desk, phone and short-version
  sheets looked at again; the A5 sheets came out byte for byte as before. Every rule was timed
  again (the numbers in the table are from that run), and the same second still draws the
  same picture in any order (six frames, three pages, three orders: identical files).

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
   The loader itself draws that light (a soft blue-white swell at the sky's core for the first
   half of A5); the star's core and rings are the sky's.
7. Brass words use the lit faces of the wordmark's letters (`--color-brass-text`); the median
   brass is too dark to read as type.
8. "$990 slashed → FREE": the price is struck through; the word "slashed" stays in the text
   for screen readers, hidden from sight.
9. The star-data credit (Yale Bright Star Catalog; d3-celestial) still needs a home: planned
   as `/credits.txt`. Not done.

10. Sky, part B: eleven smaller calls, listed at the end of "Sky, part B" (the colour of the lit
    edges, what a tap does when every star in front is lit, the panel's width, and so on).

## What is in refs/, tools/, wip/

- `refs/loading-video/` — the reference video as frames (`f12/`, 12 per second, time printed on
  each) and contact sheets. `refs/asset-sheets/` — the pack's pictures at a glance.
- `refs/asset-qa/`, `refs/constellations/`, `refs/foundation/` — evidence for the finished pieces.
- `refs/alignment/` — the harness report and overlays. `refs/fx-wip/` — the effects builder's own
  captures; `refs/fx/compare/` — the effects layer's sheets and `measure.txt` (written by
  `tools/fx/compare.mjs`, which needs the test page `/dev/fx`: read its header).
- `refs/briefs/` — the full written brief for each scene (inside workflow scripts; read the
  text between the backticks of `WHAT` and `VERIFY`). Roots and Chrome briefs are there too.
- `refs/loading/compare/` — the loading scene beside its reference (written by
  `tools/loader/compare.mjs`), and `light.txt`, its soft light in numbers.
- `refs/sky/compare/` — the sky's sheets (written by `tools/sky/compare.mjs`); `refs/sky/measure.txt`
  — its rules in numbers (written by `tools/sky/measure.mjs`). `tools/sky/claim-200.steps.json`
  and `claim-400.steps.json` are steps for `scripts/shot.mjs`: a real build request sent from
  the empty-star panel with `/api/contact` stubbed.
- `tools/alignment/` — the harness. `tools/loader/` — `compare.mjs` (comparison sheets; `--big`
  for close pairs), `measure.mjs` (the loader's rules, timed in real time) and `light.mjs`
  (the haze and the wash measured against the reference); each explains itself in its header.
  `wip/` — empty now; nothing is parked.

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
- 2026-11-20 — Loading, step 3: the phone sheets looked at (halo grain now follows the screen
  size; the wash lost its bright seam) and every rule timed in real time at both sizes.
- 2026-11-20 — Loading, step 4: A5 looked at over the placeholder sky and made to read (shards
  grow to a readable size and are lit; a light swells and drowns the word); the short version
  looked at. Loading is done except for A5 over the real sky.
- 2026-11-20 — The orchestrator reviewed the Loading sheets and report: accepted, with one
  polish pass asked for (four items, under "Exact next step"). For about nine minutes before
  that, two runs of the loading-scene builder were working in this checkout at once (the
  orchestrator's first review message started a second run instead of reaching the first).
  Nothing was lost: the second run changed no code until the first had finished and handed
  back; commit `4b39eed` was its note.
- 2026-11-20 — Loading, the polish pass: the first "e" thrown from the node and written in the
  reference's order; lit letters as thin white tubes in a wide navy haze; the node's rings lit
  white during the writing; the overload's wash evened out and its white opened so the rings
  show. Four checkpoints, then the sheets rebuilt and looked at and the rules timed again.
- 2026-11-20 — Sky, part A, step 1: the parked sky moved into `src/`, the exit button (B11) wired
  to it, and run for the first time on the real page at both sizes.
- 2026-11-20 — Sky, part A, step 2: judged against the constellation sheet and B3, B4, B5 at
  both sizes; honeycomb given depth, far figures made visible, the empty star made a sphere.
- 2026-11-20 — Sky, part A, step 3: the flight driven for real and measured (86 checks);
  three faults found and fixed (star buttons not placed at rest, swipes that could not build
  speed, the wheel flying under a focused form field); the hooks for part B named.
- 2026-11-20 — Sky, part A, step 4: the hand-off looked at over the real sky (a5 sheets rebuilt)
  and measured alone (0 pixels between `introProgress(1)` and `reset()`); the fall run against
  a rising ground line (one impact, resolves, `restore()` puts everything back). Part A done.
- 2026-11-20 — Sky, part B, step B1: the beads of light. A tap sends ten round blue beads along
  a shortest walk over the honeycomb to the nearest empty star; proved on the graph and by
  overlay; the pulse and the words exist in a first form.
- 2026-11-20 — Sky, part B, step B2: the pulse and the words "claim yours", looked at close up
  at five phases and measured (24 checks), reduced motion included.
- 2026-11-20 — Sky, part B, step B3: the empty-star panel, its words taken from the locked offer
  copy, placed beside every star and measured (28 checks). The lit-star panel is written but not run.
- 2026-11-20 — Sky, part B, step B4: the lit-star panel: fly in, exactly the ask as plain text,
  nothing else; long asks scroll inside; closing lets the camera go (20 checks).
- 2026-11-20 — Sky, part B, step B5: a real send walked with `/api/contact` stubbed (200: the star
  ignites only after the answer and stays lit after a reload; 400: nothing lit); a send with no
  star leaves the ask waiting, the beads then go by themselves, the next star clicked takes it.
- 2026-11-20 — Sky, part B, step B6: all 201 checks pass, every sheet rebuilt and the opening
  pose and stations looked at again; frame times during ten bead runs measured on the real GPU
  and in software with the CPU slowed 4×. The Sky is done; next is the Roots.
- 2026-11-20 — Roots, step 1: the placeholders replaced by the real structure (soil edge, E6, five
  nodes as buttons, five server-rendered tiles opened one at a time, the Close, the whole contract);
  driven with real clicks and taps at three sizes; the page without script checked.
- 2026-11-20 — Roots, step 2: the words checked in the browser against the addendum, three ways, all
  five tiles character for character; every visible string in the scene traced to its source;
  every tile looked at open at both sizes.
- 2026-11-20 — Roots, step 3a: the mycelium grown by code from the nodes' measured positions (runner,
  corded trunk, branches to hair-fine tips, joints, cross-links), drawn as lit soil, bloom and thread;
  four rounds of look-and-fix; growFrom written as a real growth and timed.
- 2026-11-20 — Roots, step 3b: a soil tile with no mirror in it derived from the pack; the nodes' breathing,
  hover and read states judged beside E4; the guided light made to read and measured (sets off 43 ms
  after a tile closes, never scrolls, never opens); the growth looked at frame by frame at three x.
- 2026-11-20 — Roots, step 4: phones, keyboard, reduced motion, the page without script and frame times
  measured (245 checks); a stacking fault found by the 320 px sheet and fixed (the next node and the
  closing buttons were painted over an open tile).
- 2026-11-20 — The arrival and the return, step 1: the effects layer moved from `wip/fx/` into
  `src/experience/fx/` and onto the real page; every effect captured at both sizes and looked at,
  the flash's length, its cover at the swap, the warp's cover and the cost at rest measured.
  Nothing in the layer needed changing.
- 2026-11-20 — The arrival and the return, step 2: the fall and the crash. `descend()` is now the
  stars falling, the soil rising to meet them, one impact, the growth, and the view following
  it down; looked at as strips at both sizes and measured (30 checks). The warp is written too.
- 2026-11-20 — The arrival and the return, step 3: the warp back. E6 launches the visitor up: the
  ground drops away under the warp and the page becomes the sky under its cover; looked at as
  strips at both sizes from two depths and measured (34 checks). A fault found by the slowed
  run and fixed: the swap was on a timer and could land after the cover had begun to clear.
