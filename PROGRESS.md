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

**Sky scene (B, G1). Part A (the world, the flight, the exit button, the hand-off, the fall)
is done: see "Sky, part A" below the table. PART B, what answers a touch, is under way: B1
(the beads) and B2 (the pulse and the words) are done, see "Sky, part B". Next is step B3:
the empty-star panel (B10).**

The sky's code is in `src/experience/sky/` (entry `index.ts`, three.js in `gl/`), its markup
in `src/components/scenes/Sky.astro`. Its brief: `refs/briefs/cellestial-sky-1-*.js` (the
strings `WHAT`, `BUILD_B` and `VERIFY_B`). Drive it on the real page: `/?scene=sky&debug`, then
`window.__cellestial.sky` is the scene, `.sky.hooks` its internal hooks (`hooks.ts`: read the
comments there, they name the event each part B piece hangs on) and `.sky.debug` has
`setCoord(layer)`, `setClock(seconds)`, `setLevel(n)`, `stats()`.
Two tools, both needing the dev server: `node tools/sky/compare.mjs` rebuilds the comparison
sheets in `refs/sky/compare/` (`--only handoff,fall` for the two part A ones that are not in
the default list); `node tools/sky/measure.mjs` drives the page with real wheel, key, touch
and mouse events and writes what it measured to `refs/sky/measure.txt` (86 checks from part A; part B adds `beads`, 14, and `words`, 24; it exits non-zero if one fails). Run both after any change to the sky.

Part B, in order, a checkpoint after each:

- **B1. The beads (B8). DONE.** `beads.ts` (the route and the drawing) and `answer.ts` (which
  star, the pulse, the words). `window.__cellestial.sky.answer` has `touch(x, y)`, `plan(x, y)`,
  `run()`, `pulsing()`, `clear()` and `beads.screen()`.
- **B2. The pulse and the words (B9). DONE.** In `answer.ts`; the words are
  `<p data-claim-words>` in `Sky.astro`.
- **B3. The empty-star panel (B10).** On `open-empty`: the kit's small panel beside the star,
  five lines from `OFFERS[i].short` and `.lead`, and the small button "Claim your star"
  (`claimFlow.openClaim(slot)`).
- **B4. The lit-star panel.** On `open-lit`: exactly the claim's `ask`, as plain text, and a
  close button; nothing else.
- **B5. The waiting ask and the ignition.** `claims.unplaced()` not null: beads by themselves
  from the middle of the screen after each stop. Walk a real send with `/api/contact` stubbed
  to 200 and to 400.
- **B6. Everything part A was judged on still holds;** then this section points at the Roots
  (`refs/briefs/cellestial-roots.js`; the effects parked in `wip/fx` belong with it).

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
| Sky (B, G1) | **part A done** (the world, the flight, the exit button, the hand-off, the fall: judged against its references and measured). **Part B in progress: B1 (the beads) and B2 (the pulse and the words "claim yours") done;** panels (B10, lit star) and the waiting ask not started. — `src/experience/sky/`, `src/components/scenes/Sky.astro`, `tools/sky/compare.mjs`, `tools/sky/measure.mjs` | See "Sky, part A" and "Sky, part B" below the table: what was run, looked at and measured at each step, and what still differs. Sheets: `refs/sky/compare/`. Numbers: `refs/sky/measure.txt`. |
| Effects (C4 flash, D2 burst, G2 warp) | **parked, unverified** — `wip/fx/`, about 2,600 lines, complete with a test page | Builder's own captures only: `refs/fx-wip/`. |
| Roots (E1–E6) | not started (placeholder shows the five tiles as plain panels) | — |
| Close (F1, F2) | placeholder (the two real buttons, wired to the existing flows) | Walk-through above. |
| Chrome (C1–C3) | placeholder (logo, "studio", three bars, menu with four working teleports) | Walk-through above. |
| Transitions wired (fall, crash, warp, A5 hand-off), B7 meaning reveal | not started | — |
| Final verification: screenshot matrix, protected-systems diff | not started | — |

"Parked" means the code is in `wip/`, outside `src/`, so the site builds and runs without it.
The site on this branch today is the plain placeholder version described in the walk-through.

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
13 px, `--color-brass-text`, with a brass glow that breathes with the star (`--pulse`, set on
every frame; opacity 0.78 to 1). The scene keeps them centred under the star on every frame
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

## What is in refs/, tools/, wip/

- `refs/loading-video/` — the reference video as frames (`f12/`, 12 per second, time printed on
  each) and contact sheets. `refs/asset-sheets/` — the pack's pictures at a glance.
- `refs/asset-qa/`, `refs/constellations/`, `refs/foundation/` — evidence for the finished pieces.
- `refs/alignment/` — the harness report and overlays. `refs/fx-wip/` — the effects builder's captures.
- `refs/briefs/` — the full written brief for each scene (inside workflow scripts; read the
  text between the backticks of `WHAT` and `VERIFY`). Roots and Chrome briefs are there too.
- `refs/loading/compare/` — the loading scene beside its reference (written by
  `tools/loader/compare.mjs`), and `light.txt`, its soft light in numbers.
- `tools/alignment/` — the harness. `tools/loader/` — `compare.mjs` (comparison sheets; `--big`
  for close pairs), `measure.mjs` (the loader's rules, timed in real time) and `light.mjs`
  (the haze and the wash measured against the reference); each explains itself in its header.
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
