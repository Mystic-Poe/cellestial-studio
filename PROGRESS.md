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

**24 NOV, THE OWNER'S TWO MORE (item 6): the star's panel keeps clear of the exit button, and
the first light (after the loader, Cellestial's star pulses three times and its beads light the
first page's stars). Both built, tested, published. Then, on his word, the first light writes
"claim yours" by each star it reaches, one after another (item 6, "The first light's words"):
built, tested, published. NOTHING IS RUNNING.**

**WHERE IT STANDS (23 Nov, 16:00): the redesign is LIVE, and so are the owner's changes of the
same afternoon (item 5: stars 100 to 146 in his email, the shared sky, the beads that never
start over, clean spacing, the meanings in the addendum). `main` is at `d7c3062` or later and
equals `redesign-build`; the branch `owner-changes` is merged. The fifth look is done: no
blocker, nothing major, three minors about where "claim yours" stands in the tightest knots
(item 1d). NOTHING IS RUNNING. What is left is the owner's: one real message through the live
form (which is also the first real test of the shared sky end to end), the logo and menu
during the loader (item 2, code 5), and whether he wants the three minors worked on.**

The comparison page (every scene beside what it has to match, the checks, what waits on the
owner): https://claude.ai/artifact/W2h3HCSaKFpxWvYs25PXgq (private to the owner), and the same
page in the repo, `refs/comparisons.html` (made by `tools/proof-page.mjs <out dir> --status
<status.json>`; copy its `local.html` there).

**PUBLISHED (23 Nov, 14:14), on the owner's word: `main` was fast-forwarded from `052f82a` to
`c66bb73` and pushed, and cellestialstudio.com has served the redesign since 14:15 (item 3:
what was checked on the live site, and how to roll back). The fourth look is done (23 Nov,
`f7d5ea4`): no blocker, nothing major, every scene done at the owner's two sizes; two minors.
Round 4, ONE bounded fix for the first of them, is done by its fixer (23 Nov, `4ec982f`; item
1d: "claim yours" kept off the neighbouring stars). RUNNING: the one narrow look at that one
thing (item 1d, second box; cut off once by the usage limit and launched again at 14:14: if no
inspector is at work, launch `refs/briefs/fifth-look.js` again, it goes on from its own
report). THEN: the final report with the comparison page, `main` fast-forwarded once more to
carry the last of the record, and the owner's decisions (item 2).** The third look (22 Nov; `refs/verification/third-look.txt`; its
evidence and scripts under `refs/verification/third-look/`) ruled that at the owner's two
sizes, 390×844 and 1440×900, every scene is done, with no blocker and nothing major; outside
them it found one major (a phone held on its side) and six minors. Round 3 put those right,
and its close-out shows the owner's two sizes to be what the third look ruled done: the one
thing that differs there is the two thinned stars of Taurus on the desktop ("Final
verification", part "Round 3"). `git status` is clean but for the untracked `claude-vault/`
(local notes, never part of this build), and the branch is pushed.

0. **Round 2: done, all five boxes ticked (22 Nov).** Five fixers, ONE AFTER ANOTHER, one
   piece each. Each records what it did in `refs/verification/fixes.txt` under "ROUND 2" and
   ticks its line here in its last commit. The briefs are `refs/briefs/fix-round-2.js`: one
   workflow, the pieces in order (`args: { only: [3, 4, 5] }` runs only those pieces: use it
   to go on after a cut-off, leaving out the pieces already ticked; a piece cut off half-way
   is run again, and its brief tells the fixer to go on from what `fixes.txt` records). The
   second look's own scripts, ready to run again, are in `refs/verification/round-2/tools/`
   (they write under `refs/verification/round-2/`, never into the second look's folder).
   `tools/run-all.sh` runs every suite and sheet tool with a log each.
   - [x] 1. **The fall** (major) `b032db7`. No burst is ever taken off the screen before its
     end (the list is `src/experience/fx/impacts.ts`, tested in node; `IMPACTS_MAX` is gone);
     the far figures' stars land as small glints; strikes that land close together share
     their soft light and do not clip to a white mass; 60 frames a second on the desktop
     (16.7 ms at each of three figures in a browser's first fall, none over 17; the largest
     cost was the Roots' growth, 2,500 to 9,800 strokes a frame, now 1,000 to 1,500). The
     bursts and the growth are drawn once unseen at the loader's still moment, so the first
     crash does not wait for the browser to build its drawing programs. Desktop trails are
     now in proportion to the star. Record: `refs/verification/fixes.txt`, "ROUND 2", piece
     1; runs in `refs/verification/round-2/fall/` (`before/` is the build as it stood).
   - [x] 2. **Three clocks** `64a40dc`. The blink (major): the quintic ease comes to a hair
     over 1 just under its end, and the star's place was then a negative number to the power
     1.3, not a number, for that frame (seen in the page: x was NaN in 6 of 6 dark frames).
     The eases are capped where they are made and the pose is its own tested file
     (`src/experience/sky/intro.ts`): no frame without the star in 20 of 20 first visits at
     each size, 12 of 12 with the CPU slowed 4x, 12 of 12 returns, 10 of 10 recorded. The same
     kind of fault was found and cured in the loader's lightning (the root of a sine a hair
     under zero). The flash (minor): a swap that blocks was taken off the flash's clock twice,
     so the flash stood before its peak when the ground came up and rose to it again; its
     clock is `src/experience/fx/flash-time.ts`, tested; level through the peak in all sixteen
     teleports (90 to 97%), and with the CPU slowed 4x (it dipped in 9 of 9 before). The
     loader on a slow line (minor): the cause was not the one expected (the wait before the
     script WAS counted): the loader's other three pictures were asked for only when the
     script had arrived. The markup asks for them now, and the loader's clock is the
     visitor's, from the first paint (`src/experience/loader/clock.ts`, tested): 7.5 s on slow
     4G where it was 8.0 to 8.2, a fast line unchanged. `tools/loader/measure.mjs` judges the
     owner's 6 to 8 s on the visitor's clock now and prints both. Record:
     `refs/verification/fixes.txt`, "ROUND 2", piece 2; runs in
     `refs/verification/round-2/a5/`, `flash/`, `loader/`, `logs-piece-2/`.
   - [x] 3. **The phone's sky** (major) `3cc6ce1`. On a portrait phone the six wide figures
     (Virgo, Capricornus, Aquarius, Pisces, Aries, Leo) are turned a quarter counter-clockwise so
     they stand tall (56 to 73% of the screen's height at 390x844, where they were 20 to 27%);
     this REVERSES the earlier ruling "north stays up", which is what crowded Cellestial's
     star. The layout chooses which way each figure stands and `layout.plans` is the one place
     a star's place comes from (`src/experience/sky/layout.ts`, tested in node:
     `src/experience/sky-layout.test.ts`); the world refills its buffers from it at a resize.
     Cellestial's star is its world size there (97 px at 390 wide, 88 at 360), its rings 3.9 px
     (2.3) short of the nearest star's disc, nothing drawn over them. Knots are drawn smaller
     (no two stars more than 31% into each other; Taurus's closest pair needed more than the
     brief's rule gives: 0.72 of their distance). B7 on the phone stands by its figure, all
     twelve, a long line in two rows. 292 of 292 taps at each of 390x844 and 360x740; a phone
     turned on its side and back; reduced motion; the hand-off; the fall. The desktop differs by
     0 pixels in eight captures. Every suite passes with no check changed. ONE SWITCH:
     `PORTRAIT.turn` in `src/experience/sky/config.ts`. Left: on phones shorter than the two
     judged the star is clear but smaller (77 px at 375x667, 54 at 320x568). Record:
     `refs/verification/fixes.txt`, "ROUND 2", piece 3; runs in
     `refs/verification/round-2/phone-sky/`, `b7/`, `logs-piece-3/`; the scripts
     `round-2/tools/phone-sky.mjs` (`--size phone|small`), `phone-turn.mjs`, `desk-same.mjs`.
   - [x] 4. **Four minors** `8280bdf`. All four done, each reproduced first and shown beside what
     it was. B7 on the desktop: the search now counts the points of the four figures further on
     (a point bars a place within 24 px of the words but is not counted as air, and gives way
     before the type would be made smaller): 0 points on the words at all twelve where there
     were 31 (Pisces 24, Aries 6, Cancer 1), all twelve still 54 px; the phone's placement is
     the same figure for figure. The tab icon: the 16 and 32 px pictures are the pack's fully
     lit emblem, cropped to the C, lifted until its brass stands at L 200 (brightest L 118 ->
     230 at 16 px; brass-toned pixels 9% -> 38%). The empty star: its traces are no longer
     thickened one by one (bundles closed up into bands) but filtered to what a star of 36 to
     58 px can show; on the 47 px desktop star the brass along a row came in runs 3.08 px long,
     now 2.00; a test fails on the old picture (`src/experience/sky-station-picture.test.ts`).
     The logo: its lit lines widened by 1 px, not 2 (it was bluer than the pack's lit emblem at
     that size: red over blue 18.4 -> 23.6; A1 lit 28.2); 48 of 48. Every suite passes, no
     check changed. Left: the sky's other sheets still show the old star and logo (piece 5
     rebuilds them); `favicon.png` (180 px) follows the logo's emblem; the star's picture is
     derived from B4, which the owner should be told. Record: `refs/verification/fixes.txt`,
     "ROUND 2", piece 4; runs in `refs/verification/round-2/owner-list/`, `stars/`, `logo/`,
     `b7/`, `logs-piece-4/`; the scripts `round-2/tools/star-side.mjs`, `logo-side.mjs` (before
     and after in one run of one build) and `b7.mjs` (far points counted, a desktop verdict).
   - [x] 5. **Close-out** `5e81b31`. No file of the site changed. Build, test (138 of 138), lint and
     typecheck pass. `tools/run-all.sh`: thirteen tools, thirteen `exit 0`, the counts what they
     were before the round (loader 13 of 13 at each size, sky 201, meaning 38 and 24, roots 197
     and 245, transitions 148, chrome 48). ONE CHECK CHANGED, in the tool only: in the first run
     the warp's cover read alpha 247, not 255, in the frame the page became the sky (software,
     CPU slowed 4x; 147 of 148). The cover is whole in that frame; the effects layer's 120 ms
     beat then draws it lifting, as designed, and the check's posted message ran after that
     timer and read the later picture. Read by a task that runs before timers it is 255 in 40
     of 40 runs where the old reading gave 208 to 234 in 5 of the same 40
     (`round-2/tools/warp-cover.mjs`, `round-2/warp/`). The second look's scripts on the
     production build: every number in "Final verification", part "Round 2". Every scene's
     sheets rebuilt (ten looked at); the flash's own sheets and `refs/fx/compare/measure.txt`
     rebuilt (piece 2 had changed the flash's clock). The protected-systems diff: 0 bytes.
     Record: `refs/verification/fixes.txt`, "ROUND 2", piece 5; logs in
     `refs/verification/round-2/logs/` (the suites) and `logs-piece-5/` (the production runs).
   Left as they are, by the orchestrator's ruling: the loader's first arc being tamer than
   the reference's (finding 14: polish; the loader is the strongest scene and is not reopened
   for it); the node's cyan beside the trunk's blue (finding 18: both from the pack; the
   owner's); a sparse figure giving a sparse fall (the sky as it is; no star is invented).
1. **The third look: done (22 Nov), `8724ef5`.** One inspector who built none of it, on the
   production build, in two runs (the first was cut off by the usage limit after part 1). Its
   verdict: Loading, the Sky (the desktop and the upright phone), the fall, the Roots, the
   Close, the chrome, the warp, reduced motion and the no-script page are done by the owner's
   definition at 390x844 and 1440x900; all three majors of the second look and the eight
   minors round 2 took on are resolved; every suite passes; the protected-systems diff prints
   nothing. What it found standing: ONE MAJOR outside the owner's sizes (on a phone held on
   its side the stars run under the exit button, and one of them cannot be taken) and six
   minors (Leo's meaning written across a star on a short phone, 375x667; a skip pressed
   before the loader's script has arrived is lost on a slow line; the unlit C seen arriving
   in halves on a slow line; "claim yours" 5 px from the meaning at Aries and Taurus on the
   desktop; one knot of two stars on the desktop; a note about console warnings on the debug
   hooks). The report: `refs/verification/third-look.txt` (the closing list is at its end).
   The brief: `refs/briefs/third-look.js`.
1b. **Round 3: done, all four boxes ticked (22 and 23 Nov).** Four fixers, ONE AFTER
   ANOTHER, one piece each, as in round 2. Each records what it did in
   `refs/verification/fixes.txt` under "ROUND 3" and ticks its line here in its last commit.
   The briefs are `refs/briefs/fix-round-3.js`: one workflow, the pieces in order (`args: {
   only: [2, 3, 4] }` runs only those pieces: use it to go on after a cut-off, leaving out
   the pieces already ticked; a piece cut off half-way is run again, and its brief tells the
   fixer to go on from what `fixes.txt` records). The third look's own scripts, ready to run
   again, are in `refs/verification/round-3/tools/` (they write under
   `refs/verification/round-3/`). The site as it stood before this round is commit `8724ef5`:
   the owner's two sizes must come out of the round as they went in, but for the two thinned
   stars of Taurus on the desktop and whatever "claim yours" needs. To know when measuring:
   `tools/loader/measure.mjs` on the production build takes `--only
   full,short,skip,key,quiet-keys,broken,resize,no-storage` (its other two cases can only be
   made on the dev server).
   - [x] 1. **The sky on a phone on its side** (major) `ddac183`. The cause was two facts in
     `src/experience/sky/layout.ts`: the room under the figures was a fifth of the screen's
     height (78 px at 390 high) while the exit button's top is 84 px up on every screen; and a
     figure held at its furthest stand, too tall for that screen, was centred and hung into
     the button. The room is now never less than the button and 12 px (`B11` in
     `sky/config.ts`; `layout.safe.bottom` is 96 under 480 px of height, what it was above),
     and a held figure stands its foot 12 px above the button. No star nearer than 12 px to
     the button at 844x390, 932x430, 667x375, 740x360 (they were 3 to 11 px into it), shown or
     not; 146 of 146 stars take their touch at each of the four. The knots' rule and the
     rings' 2 px of clear space hold on every screen: at 1440x900 Taurus's closest pair
     (slot-77, slot-64; 46% into each other, now 16%) and nothing else. The upright phones: 0
     pixels differ in 24 captures at each of 390x844, 360x740, 375x667; the desktop differs
     only inside the box of that pair. `pnpm test` is 148 of 148 now. **Left, for the fourth
     look or the owner:** on a phone on its side Taurus's closest pair stands 6 to 7 px apart
     and at the rule's floor of 6 px is still 41 to 49% into each other (two small spheres, a
     close double; under a third would need 5 px); Cellestial's star there is its world size,
     67 to 80 px, not the upright phone's 84. Record: `refs/verification/fixes.txt`, "ROUND
     3", piece 1 (it ends with what piece 2 needs to know); evidence in
     `refs/verification/round-3/` (`before/` is the build as it stood); new scripts there:
     `sky-same.mjs` (a size before and after, pixel for pixel, twelve stations),
     `side-scenes.mjs`, `side-knots.mjs`. Not brought up to date here, for the close-out: the
     older parts of this file that describe the knots as the upright phone's only.
   - [x] 2. **Where the meanings stand** `44a3032` (the code: `a0ed6a6`, `d165f03`,
     `d361ce6`; done in two runs, the first cut off by the usage limit with its code in). B7
     with every star lit, `src/experience/sky/meaning.ts`. A phone on its side: the search by
     the figure was chosen by the screen's width alone, and between 720 and 1024 px there was
     none; a screen under 450 px high now has its own placing (the phone's type and scoring,
     the far figures' points counted as stars, the words free to stand beside the figure):
     48 of 48 touch nothing at 844x390, 667x375, 740x360, 932x430, no far point on any words,
     45 px or more above the exit button, 24 px type but Leo's (18 and 21 px at the two
     narrowest). A short phone: Leo left one and two rows no place with 10 px of air, and the
     band that followed is one size in one row; the search now tries three rows at every size,
     then the roomiest place that touches nothing, and the band itself tries smaller type and
     more rows: 36 of 36 at 375x667, 360x640, 320x568, nothing under 18 px. "claim yours": the
     label gives way, not the meaning (`sky/claim-label.ts`, new, tested: under its star unless
     a meaning is within 40 px of that place, then above, right or left of it, inside the
     screen, off the chrome and every other star): none within 40 px of a meaning in a grid of
     taps at all twelve stations at ten sizes (Aries and Taurus on the desktop: 59 to 69 px,
     the letters 67 and 68 px apart; they were 5 and 6). A fourth fault, found on the way and
     put right: on a phone on its side the NEXT figure's words, once written, stood at half
     strength against the station's own (Libra's 1 px from Virgo's); under 450 px of height
     words are first seen at 0.58 of their station size (`seenAt`, tested). **The owner's two
     sizes:** all twelve at 1440x900, 390x844 and 360x740 are the third look's lines, box for
     box; 0 pixels differ in 36 captures at 1440x900 and 0 in 36 at 390x844, every meaning
     shown. One thing differs at 390x844 and is what 2c asks: with Pisces complete, six taps in
     the upper left now light the star 16 px from the one they lit, whose label was 39 px from
     "His people". `pnpm test` is 156 of 156 now; `tools/sky/meaning.mjs` 38, `meaning-all.mjs`
     24, `measure.mjs` 201; the sheets in `refs/sky/compare/` were not rebuilt (no place at the
     two sizes moved). **Left, for the fourth look or the owner:** at 360x740 Taurus's words
     further on stand faint (0.19) 31 px from "the Lamb" when both figures are complete (as
     before; the upright phone's rule would have to change); at 320x568 Leo's three rows begin
     8 px under the top of the screen; at 932x430 one "claim yours" lies across one of Libra's
     lines. Record: `refs/verification/fixes.txt`, "ROUND 3", piece 2; evidence in
     `refs/verification/round-3/b7/` (`before-2/b7/` is the build as piece 1 left it); new
     scripts in `refs/verification/round-3/tools/`: `f8-all.mjs` (taps everywhere),
     `rm-words.mjs` (reduced motion, and the words of figures further on), `far-words.mjs` (a
     real flight on a phone on its side).
   - [x] 3. **The loader on a slow line** `7474c86` (the code: `dfa8989`). Three causes, all
     in the second or two before the loader's script is there. Nothing listened for a skip
     until that script had mounted; the browser painted the unlit C as its rows arrived, and
     its file came down the line after two of round 2's three preloads; and the browser's
     first paint, which the clock started from, was the C's first black rows. Now the markup's
     own inline script (`src/components/scenes/Loader.astro`, run as written by
     `src/experience/loader-markup.test.ts`) keeps the unlit C unseen until its file is whole
     and decoded, asks for the other three pictures when it is in, and writes down every
     pointerdown and keydown until the loader takes them (or DOMContentLoaded, whatever
     happened); the loader judges them by THE ONE RULE (`src/experience/loader/skip.ts`) and
     skips at its mount; the clock starts when the C is first SEEN (`firstSeen()` in
     `loader/clock.ts`: the later of the browser's first paint and the frame the page showed
     it in); and the sky's script is asked for when the loader has its pictures
     (`LoaderScene.loaded`, `main.ts`: without that the loader began 0.7 s later than round 2
     had it). On slow 4G: a tap or a key 1.0 s after navigation, before the loader is live,
     brings the sky at 5.93 to 5.95 s (phone) and 6.04 to 6.05 s (desktop), as a skip at the
     mount does, 4 of 4 each (it was lost, 4 of 4); the C's file complete at 1757 ms (2272)
     and before the other three; first seen and whole in the same recorded frame (it was half
     a second half-drawn); first seen to the sky 7.09 to 7.43 s in 40 first visits in four
     conditions at both sizes; no frame without the C once shown, 12 of 12; no frame without
     the star after an early skip, 4 of 4 at each size. **To be told: navigation to the sky on
     slow 4G is now 9.1 s; it was 8.3 s.** It is the clock: a late run ends 7.5 s after its
     clock started, and the clock no longer starts on a black screen (the place to change it,
     if the owner wants 8.3 s back, is `LATE` and the plan in `loader/timeline.ts`). On a fast
     line nothing changed: the loader's four sheets byte for byte, 13 of 13 at each size on
     the dev server, 11 of 11 six times on the production build, the sky 0 pixels in 24
     captures at each of the two sizes, the page without script 0 pixels. ONE CHECK CHANGED ON
     PURPOSE: `tools/loader/measure.mjs` judges the 6 to 8 s from the first sight of the
     picture, as the loader now does, and prints the old number beside it (the same to the
     hundredth in every run). The debug hooks' three console warnings are gone (the line is by
     the debug hooks, under "How the site is put together"). `pnpm test` is 174 of 174 now. Record:
     `refs/verification/fixes.txt`, "ROUND 3", piece 3; evidence in
     `refs/verification/round-3/piece-3/` (`before/` is the build as piece 2 left it, `logs/`
     every run); new scripts in `refs/verification/round-3/tools/`: `early-skip.mjs`,
     `loader-waterfall.mjs`, `loader-first3.mjs`, `loader-canvas.mjs`, `nojs-same.mjs`,
     `static.mjs`; `clock-all.mjs` counts from the first sight.
   - [x] 4. **Close-out** `bccef76`. No file of the site changed and no check. Build, test (174 of 174),
     lint and typecheck pass. `tools/run-all.sh`: thirteen tools, thirteen `exit 0`, the counts
     what they were before the round (loader 13 of 13 at each size, sky 201, meaning 38 and 24,
     roots 197 and 245, transitions 148, chrome 48). The third look's scripts on the production
     build, twenty-three runs: every number in "Final verification", part "Round 3" (two of
     them exit 1 by design: `phone-sky.mjs` prints the upright phone's rules as FAIL on a
     phone on its side and on a short phone). **The owner's two sizes are what they were:** the
     scripts' own output there is the third look's, line for line (`phone-sky.txt` at 390×844
     but for one number of the turning rings; `all-taps-desk.txt` whole; the 24 verdict lines
     of `b7.txt`), and the sky's and the loader's sheets as rebuilt, set beside those committed
     before the round with a control (`round-3/tools/sheets-same.mjs`), differ only where two
     rebuilds of the same code differ, but for three desktop sheets in which the two thinned
     stars of Taurus are to be seen (181, 193 and 199 pixels). Thirteen sheets looked at. The
     protected-systems diff: 0 bytes. Record: `refs/verification/fixes.txt`, "ROUND 3", piece
     4; logs in `refs/verification/round-3/logs/` (the suites) and `round-3/piece-4/` (the
     production runs with their pictures, and `sheets/`: the comparison).
   What round 3 left, each stated in its piece above and gathered at the end of piece 4's
   record: on a phone on its side Taurus's closest pair is a close double (41 to 49% into each
   other at the rule's floor) and Cellestial's star is 67 to 80 px; at 375×667 the star is 77
   px; three small things of B7 off the owner's sizes (360×740, 320×568, 932×430); on slow 4G
   the sky comes 9.1 s after navigation where it came at 8.3 s.
1c. **The fourth, narrow look: done (23 Nov), `f7d5ea4`.** One inspector who built none of it,
   on the production build, at what round 3 changed and at the owner's two sizes. Its report
   is `refs/verification/fourth-look.txt` (the closing list and the verdict are at its end);
   its evidence and its own scripts are under `refs/verification/fourth-look/`; the brief was
   `refs/briefs/fourth-look.js`. (It was cut off twice, by a server error and by the usage
   limit, and took up again from its own report each time.) **Its ruling: no blocker and
   nothing major, at 390×844, at 1440×900 or anywhere it looked. All seven things the third
   look left are resolved, and the owner's two sizes are what the third look ruled done** (the
   numbers are under "Final verification", part "The fourth look"). Two minors stand:
   1. "claim yours" (B9) is often written across a neighbouring star, on the phone at Virgo
      into the rings of Cellestial's star, and four labels begin at the screen's left edge.
      Older than every round of fixes, the same on the build the third look judged, never
      measured before. Both of the owner's sizes, on every visitor's path. ROUND 4 PUTS IT
      RIGHT (item 1d).
   2. On a phone held on its side only, two stars of Taurus (slot-77 and slot-64) stand 35 to
      49% into each other, both at the least size a star is drawn, both taking their own
      touch. LEFT, for the owner to be told: the build's rule has been to draw a crowded star
      smaller and never to move one out of its real place; the inspector's fix would move
      each 1 to 1.5 px (`src/experience/sky/layout.ts`, and the exception written into
      `sky-layout.test.ts`).
1d. **Round 4: ONE bounded fix, THE FIX DONE (23 Nov); the narrow look is next.** One fixer, one thing: "claim
   yours" keeps off every other star's disc and off Cellestial's star, and its letters stay 16
   px inside the screen; under its star wherever that place is free (the spec's B9 says
   "underneath"), beside it only where it is not. Nothing else moves. The brief is
   `refs/briefs/fix-round-4.js`; the fourth look's scripts, copied for running again, are
   `refs/verification/round-4/tools/` (they write under `refs/verification/round-4/`); the
   record goes in `refs/verification/fixes.txt` under "ROUND 4". The build as it stood is
   commit `f7d5ea4` (a built copy is kept outside the repo for the before pictures; the brief
   says how to make it again). If the fixer is cut off, launch the same brief again: it reads
   its own record and goes on from where it stopped.
   - [x] The fix: "claim yours" off the stars at both of the owner's sizes, nothing else moved
     `4ec982f` (the rule itself: `397c7d3`). Across another star of its figure, by the fourth
     look's own script: 25 to 0 at 1440×900, 38 to 2 at 390×844 (9 of all 146 stars there,
     in knots where no tight place is free; named, with what else is left, at the end of
     `fixes.txt`, "ROUND 4"). Cellestial's star never crossed; letters 16 px inside; the same
     star offered everywhere but three stars behind Cellestial's star with Virgo complete on
     the desktop; the standing sky the same to the pixel at both sizes.
   - [x] One narrow look at that one thing by an inspector who did not build it (`f2042af`,
     23 Nov; report `refs/verification/fifth-look.txt`; cut off once by the usage limit).
     **Its ruling: no blocker, nothing major; nothing else moved (the standing sky the same to
     the pixel, 146 of 146 taps, thirteen suites exit 0); "claim yours" right at 1440×900 and
     for about nine stars in ten at 390×844. Three minors:** (1) on the phone a dozen labels
     in the knots of Sagittarius, Pisces and Taurus, and one at Virgo, are wedged or read as
     a neighbour's, one still across a star (Pisces slot-141); (2) with a whole figure claimed
     in the visitor's own browser the words can read as a lit star's; (3) in the Home key's
     glide the words jump for one to three frames before they are hidden. Its fixes are in
     the report. NOT DONE: the clean-spacing rule (item 5) has since made the knots' stars
     smaller and apart, which changes what (1) looks like; none of the three has been looked
     at again on that build. The brief was
     `refs/briefs/fifth-look.js` (it changes no file of the site; its own copy of the fourth
     look's scripts is `refs/verification/fifth-look/tools/`; it writes
     `refs/verification/fifth-look.txt`). The orchestrator launches it when the first box is
     ticked, and ticks this one when it has ruled. A blocker or a major in its list is put
     right before the build is called finished; otherwise the final report to the owner.
2. **Six things only the owner can decide** (the first five are the first inspector's
   findings, by number, in `refs/verification/business-and-code.txt`; the sixth came out of
   the close-out):
   - **code 3.** The Worker names only stars 1 to 99 in his email (`/^slot-[1-9]\d?$/`); the sky
     numbers them to 146. A claim of stars 100 to 146 lights the star for the visitor and reaches
     him with no "Claimed: open star N" line. The fix is one character class in the protected
     Worker (`\d?` to `\d{0,2}`), with its test.
   - **code 4.** A claim is lit only in the claimer's own browser (localStorage). Every other
     visitor sees an empty sky until the owner adds the star to `src/content/stars.json` and
     deploys. Either adopt that routine or sanction a small shared store.
   - **code 5.** The logo and the menu are hidden while the loader plays. His line is "present
     throughout". Kept as built; his to rule on.
   - **code 8.** `/admin` now edits only the page title and description; the other seven
     sections in `public/admin/config.yml` change nothing. `public/admin` is protected.
   - **code 13.** The twelve meanings B7 writes are word for word his 18 Nov sheet, which is not
     in the repo's spec files. If he wants the locked copy in one place, they go in
     `SPEC-ADDENDUM.md`.
   - **Turnstile.** If Cloudflare's Turnstile script does not arrive, the form shows no spam
     check and a send fails with the Worker's own sentence; a load that never ends is not
     tried again. Seen in two test openings out of roughly two hundred, from this machine's
     network; the site that is live today behaves the same. A retry would be a change to the
     form's logic, so it is his to ask for (`refs/verification/fixes.txt`, "The Turnstile
     miss").
   Also his, if wanted: look 18 (the node's cyan beside the trunk's blue: both from the pack).
   Also for him to know (calls made in round 2): on a phone six constellations are turned a
   quarter-turn (the pattern is the real one, as the figure stands when it rises;
   `src/experience/sky/config.ts` has the switch); an empty star at its station is drawn from
   a picture DERIVED from the pack's B4 (its own traces filtered to what a star of 36 to 58 px
   can show and recoloured in the wordmark's brass, `public/cellestial/sky/b4-station.webp`),
   not B4 pixel for pixel; and the tab icon at 16 and 32 px is the pack's lit emblem cropped to
   the C and lifted so its brass shows at that size.
   Also for him to know (calls made in round 3; decisions 23 to 26 in the list of calls): on a
   phone held on its side, which the spec does not mention, the figures keep the exit
   button's own room and stand above it, upright, and the meanings stand beside them at 24 px;
   two stars that would stand more than a third into each other are drawn smaller on every
   screen now, which at 1440×900 thins the two stars at the western end of Taurus and nothing
   else; "claim yours" moves to another side of its star when a meaning's words are within 40
   px; and the loader's 6 to 8 s is counted from the moment the C is first SEEN, so that on
   slow 4G the sky comes 9.1 s after navigation where it came at 8.3 s (7.3 s of loader after
   1.8 s of black; `LATE` and the plan in `src/experience/loader/timeline.ts` are where to
   change it if he would sooner have 8.3 s).
3. **Publishing: DONE on the owner's word (23 Nov, 14:14).** He wrote: "Push everything that's
   done to the main repo so it build on the true website." `main` was fast-forwarded from
   `052f82a` to `c66bb73` (163 commits, no merge commit) and pushed; Workers Builds deployed it,
   and the live site served the new build 69 s later. The record is `refs/verification/live/`
   (its `README.txt` first).
   - **Before the push**, on `c66bb73`: `pnpm build`, `pnpm test` (185 of 185; the Workers' 15,
     16, 14), `pnpm lint`, `pnpm typecheck` pass; the protected-systems diff prints nothing. A
     clean clone of the branch, installed with `--frozen-lockfile` and built, gives the
     checkout's 39 files but for the stylesheet: the checkout's has 14 rules more, which
     Tailwind had picked out of the untracked local notes (`claude-vault/`). None of those four
     classes is used anywhere in the site, so nothing looks different; the live stylesheet is
     the clean clone's (33,732 bytes).
   - **On the live site, nothing sent:** `/`, `/contact/`, `/start/`, `/start/new/` and
     `/admin/` answer 200 (without the slash the first three are redirected to it, as on the
     old site); all five pages are the clean build's to the byte but for the spam-check key,
     which is the real one; the other 34 files are the clean build's byte for byte. The
     contact Worker answers on its route (GET 405; a POST with no spam-check token 400 "Please
     complete the spam check and try again.": it is configured, and nothing was sent); the
     sign-in broker redirects to GitHub; the onboarding Worker answers. A visitor's pass in a
     browser at 1440×900 and 390×844: the loader, the sky 7.6 and 7.4 s after navigation,
     "claim yours", the star's panel, the request form (posts to `/api/contact`: name, email,
     message, star, cf-turnstile-response; the real Turnstile widget in it), the menu's four
     destinations, the teleport to the Roots, `/contact/` with the real spam check,
     `/start/new/` making a link and the link opening on "Step 1 of 4". No console message
     from the site itself.
   - **NOT done, and only the owner can:** one real message through the live form (it needs a
     person past the spam check, and it lands in his inbox).
   - **To roll back:** Cloudflare dashboard, Workers & Pages, `cellestial-studio`,
     Deployments: roll back to the deployment before 23 Nov 14:14. The old site is commit
     `052f82a`.
   - **After this,** whatever more is committed on `redesign-build` (the fifth look's report,
     the final record) goes to `main` by another fast-forward; a fix to the site is built,
     tested and published the same way.
5. **The owner's changes of 23 Nov** (his words are in `SPEC-ADDENDUM.md`, "Decisions of 23 Nov
   2026"). Of the six things only he could decide (item 2): code 3 YES (done); code 4 "Build it
   so it's shared" (done, the text of a star shown to others only after he approves it: his
   choice of three); the Turnstile retry "Leave it"; `/admin` stays as it is, copy is changed
   in the code; code 13 YES, the meanings are in the addendum (they appear only once a figure is
   filled, as built); code 5 (the logo and menu during the loader) not answered: as built.
   - **Stars 100 to 146 in his email.** `workers/contact/src/index.ts`: the pattern is 1 to 146.
     Tests first. Deployed with wrangler on 23 Nov (the Worker answers as before).
   - **The shared sky.** The Worker (`workers/contact`), with a KV namespace bound as `STARS`
     (id in its `wrangler.jsonc`): a SENT request lights its star in the store, one record a
     star (`star:slot-N`; the first claim stands); a request sent with no star is kept 30 days
     under the hash of a key the form sends (`claim-key`, a hidden field `claim-flow.ts` adds),
     and takes the star its sender then chooses (`POST /api/contact/place`); the public list is
     `GET /api/contact/stars.json` (`ask` is null until approved); his email carries a signed
     link (`/api/contact/star?...`, signed with a key made from the Resend key, so no new
     secret) to a page with three buttons: show the text to everyone, hide it again, take the
     star back. Looking at the page changes nothing (mail scanners follow links). Without the
     binding the Worker is what it was. 27 checks (`workers/contact/test`). The page:
     `src/experience/claims.ts` has a third source (registry, then this device, then the shared
     sky), `src/experience/shared-sky.ts` fetches the list and reports a placement;
     `public/api/contact/stars.json` is an empty list for servers with no Worker. A star lit by
     another visitor whose text is not approved is simply lit: its panel does not open.
     An automated security review of the first version found two faults (all stars in one
     record, so two writes could undo each other; a waiting request could be raced to light
     two stars): both put right before the store was ever bound. What is left, and is KV's
     nature: two requests for the SAME star in the same instant can both be told it is free;
     both messages reach him, the later text stands.
   - **The beads never start over.** `sky/beads.ts` runs up to six runs at once
     (`BEADS.runs`), each with its own beads and arrival; `sky/answer.ts`: the words go to the
     star of the last tap, and a tap for the star they are already at leaves them there.
     `src/experience/sky-beads.test.ts` (failing first); tried in the page: three taps, three
     runs, each finishing its course.
   - **Clean spacing.** `KNOT` in `sky/config.ts` is now `{ gap: 4, leastPx: 6, movePx: 8 }`
     and the rule is in `sky/layout.ts`: at its station every pair of stars of a figure keeps
     4 px between their discs, on every screen. Crowded stars are drawn smaller first (never
     under 6 px in radius); only where that is not enough are two moved apart, each by the
     same, along the line between them. At 390×844: 36 of 146 drawn smaller, two moved
     (Taurus's closest pair, 3.3 px each); at 1440×900: 10 smaller, none moved. This REPLACES
     the knots' rule (a third of an overlap was allowed) and call 24, and it settles the fourth
     look's second minor (Taurus on a phone on its side: 7 stars of Taurus moved up to 4.5 px
     there). A figure with a moved star has a plan of its own in the layout, so everything
     reads the place a star is drawn at. One screen keeps less than 4 px: 568×320, where
     Sagittarius keeps 3. Layout tests rewritten for the rule; the sky's suite 201 of 201.
   - **The meanings** are in `SPEC-ADDENDUM.md`, locked.
   - **A lit star with nothing to read** (another visitor's, not yet approved): a tap on it
     flies nowhere (`sky/index.ts`, `onPick`).
   - **PUBLISHED, 23 Nov 15:50:** `main` fast-forwarded from `c66bb73` to `d7c3062`; the live
     homepage was the new build 152 s later (Workers Builds: success). The contact Worker was
     deployed by hand with wrangler three times that afternoon (the pattern; the shared sky;
     the binding): its current version answers as before on `/api/contact` and the new routes
     answer (`stars.json` 200, `place` 404 for a key that sent nothing, the owner's page 403
     unsigned). Before: on the branch, `pnpm test` 198 (the Workers' 27, 16, 14), build, lint,
     type-check; the suites on the dev server: sky 201, meanings 38 and 24, roots words 197,
     roots 245, transitions 148, chrome 48; the sky's sheets rebuilt. After, on the live site
     (`refs/verification/live/live-check-owner-changes.txt`): every page the tested build's
     but for the spam-check key; a test star put into the store by hand was listed and lit on
     the live page with nothing to read, then taken out; three quick taps, three runs of
     beads; no console message. The protected-systems diff is NO LONGER EMPTY, by his yes:
     `workers/contact` (source, tests, config) and nothing else.
     NOT DONE: a real claim on the live site (it needs a person past the spam check), so the
     email's approve link has been exercised in the Worker's tests only. Roll back the page:
     the Cloudflare deployment before 15:50; the Worker: `wrangler rollback --config
     workers/contact/wrangler.jsonc`.
6. **The owner's changes of 24 Nov.** (A friend's claim had not lit: he had used "Contact me",
   which claims nothing; a claim made from the sky then lit for everyone, as built.)
   - **The panel and the exit button.** "See what holds up the sky" stood over the panel of
     stars low on the screen, and over its "Claim your star": 78 of 438 panel openings at
     1440×900, 390×844 and 375×667. The placing is `sky/panel-place.ts` (tested): the panel
     keeps above the button while it is shown; where nothing is clear of it, the least cover,
     and the panel is drawn over the button. 0 of 438 (`refs/verification/owner-24nov/`).
   - **The first light.** The first time the loader hands the sky over in a visit (a
     sessionStorage flag; never on a same-session return, never with reduced motion, never
     from `?scene=sky`): 0.6 s after, Cellestial's core pulses three times, 1.3 s apart (a
     `uPulse` in its shader, the core swelling 10%); each pulse sends beads to a third of the
     empty stars of the figure in front, nearest first; each star they reach does the "claim
     yours" pulse (no words) for two breaths and settles. A tap, a star picked or a flight
     stops the waves still to come. `FIRST_LIGHT` in `sky/answer.ts`; `BEADS.runs` is 12.
     Frame times 16.6 ms with and without it, also with the CPU slowed 4×. All thirteen
     suites exit 0 with their counts; the loader's hand-off sheet is what it was.
   - **The first light's words.** The owner: "I want the claim yours to appear. Just space
     out the timing so it's not all at once and is a cool flashy sequence." Each star the
     beads reach gets "claim yours" in its turn, in the order the beads arrive and never two
     within 0.35 s (`FIRST_LIGHT.words`, `firstLightWordTimes`, tested): struck white-hot,
     cooling into the brass and gone over 1.15 s, the star flaring with them. They stand by
     the visitor's words' own rule (`placeLabel`), and 8 px from other words showing
     (`LabelScene.words`, `LABEL.apart`, tested); words with no room wait up to 1.2 s, then
     the star only glows. A tap on the sky or a star picked puts them out over 0.25 s and
     the beads still on their way write no more; leaving the sky removes them; a tap on the
     words opens that star's panel. Measured: all 12 of Virgo's empty stars get their
     words, one every 0.35 to 0.4 s, 4 at most showing at once, never touching (closest
     14 px on the phone), frames 16.7 ms at x1 and x4. 207 tests; all thirteen suites exit
     0 with their counts (`refs/verification/owner-24nov-words/`, with its probes and
     sheets).
4. **What only a person with the device can do** (unchanged): a real phone (every frame time
   here is headless Chromium on a desktop GPU, or with the CPU slowed 4×), a screen reader, a
   browser without popovers, a phone held on its side in the hand (round 3 measured and put
   right four such screens in headless Chromium), tablet and ultrawide.

Dev server: `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm astro dev --port 4500`.

## Final verification (21 Nov 2026)

Two independent inspectors examined the finished site; a fixer then worked through both reports.
- **The reports:** `refs/verification/business-and-code.txt` (the business and the code; its
  evidence and scripts under `refs/verification/business-and-code/`) and
  `refs/verification/look.txt` (the look; its sheets, the screenshot matrix, under
  `refs/verification/matrix/`, as the site was BEFORE the fixes; its scripts under
  `refs/verification/look-tools/`).
- **The fixes:** `refs/verification/fixes.txt`: every finding, what was done or why not, and
  how it was checked again. Fixed: look 1 to 17 and 19 (look 12 by CSS alone and not proved,
  as it says), code 1, 2, 6, 7, 9, 10, 11, 12. Left for the owner: code 3, 4, 5, 8, 13, look 18.
- **The sheets as the site is now** are in each scene's own folder, rebuilt on 21 Nov after the
  last change: `refs/loading/compare/`, `refs/sky/compare/` (with `b7-all-desk.jpg`,
  `b7-all-phone.jpg`: B7 at all twelve figures), `refs/roots/compare/`,
  `refs/transitions/compare/`, `refs/chrome/compare/`, and `refs/fx/compare/` (the effects on
  their own test page, rebuilt that afternoon from the same commit: fixes.txt, "The effects'
  own sheets"; and `flash-real-page.jpg`, the flash on the real page).
  Looked at after the last change: by the fixer `sky/compare/open.jpg`, `handoff.jpg`, `beads-phone.jpg`, `meaning-settled.jpg`, `loading/compare/a5-desk.jpg`, `transitions/compare/teleport-desk.jpg`, `chrome/compare/closed.jpg`, `roots/compare/descent-desk-1.jpg`; by the orchestrator `sky/compare/open.jpg`, `stations-phone.jpg`, `meaning-settled.jpg`, `b7-all-desk.jpg`, `b7-all-phone.jpg`, `transitions/compare/teleport-desk.jpg`, `fx/compare/flash-peak.jpg`, `flash-down-desk.jpg`, `warp-desk.jpg`. The other rebuilt sheets were looked at when their fix was made (fixes.txt says which), not again after the last rebuild.
- **Where the runs' output is:** `refs/verification/after-fixes/logs/` (every suite and sheet
  tool of the last full run, 21 Nov 10:44 to 11:11; `status.txt` lists them, all exit 0) and
  `refs/verification/after-fixes/inspector-scripts/` (the first inspector's nine scripts run
  again on the production build).
- **The fixer was cut off** by the account's usage limit at 11:42 on 21 Nov, after its last
  commit to the site (`c211d9e`) and its last full run, before it had committed that run's
  sheets or written this section. The orchestrator committed the sheets as the run left them,
  read the logs, ran build, lint, type-check and tests again, and wrote these numbers from the
  logs (fixes.txt, "The close-out"). Nothing in the site was changed after `c211d9e`.
- **The protected systems.** `git diff a31d2ee HEAD -- workers src/onboard
  src/scripts/contact-submit.ts src/scripts/start-flow.ts src/scripts/start-builder.ts
  public/admin src/content/home.json src/config.ts` prints nothing (0 bytes, run at
  c211d9e). The diff of `src/components/ContactForm.astro` is one hunk, inside its
  `<style>` block; of `src/pages/contact.astro` and `src/pages/start/new.astro`, five lines,
  each a `class` value. No markup, attribute, script or handler of the form changed.
- **Every suite, run again after the last change** (dev server, real GPU unless said):

  | Suite | Result |
  |---|---|
  | `pnpm build`, `pnpm lint`, `pnpm typecheck` | pass (4 pages; 92 files; no type error) |
  | `pnpm test` | 96 of 96, and the three Workers' own checks 15, 16, 14 |
  | `tools/loader/measure.mjs --gpu` (1440×900) | 13 of 13 runs OK: full 7.53 s, short 3.55 s, skipped at 1 s 2.84 / 2.85 s, Tab and modifiers 7.16 s, two resizes 7.14 s, storage blocked 7.09 s, no sky 6.08 s (ends on the Roots), sky 30 s late 11.97 s |
  | `tools/loader/measure.mjs --gpu --throttle 4 --size phone` | 13 of 13 OK: full 7.62 s, short 3.68 s, skipped at 1 s 3.12 / 3.10 s, Tab and modifiers 7.33 s, two resizes 7.31 s, storage blocked 7.46 s, no sky 6.21 s, sky 30 s late 12.09 s |
  | the same on the production build, phone profile (run on 21 Nov before the last minors) | unslowed full 7.55 s; CPU 4× 7.62 s; slow 4G 7.30 s; CPU 4× and slow 4G 7.53 s |
  | `tools/sky/measure.mjs` | 201 of 201 |
  | `tools/sky/meaning.mjs` | 38 of 38 |
  | `tools/sky/meaning-all.mjs` (new) | 24 of 24: every meaning whole on screen, touching no star's button, not the logo, not B11 |
  | `tools/roots/words.mjs` | 197 of 197 |
  | `tools/roots/measure.mjs` | 245 of 245 |
  | `tools/transitions/measure.mjs` | 148 of 148 (the fall 34, the warp 34, the teleport 80) |
  | `tools/chrome/compare.mjs` | 48 of 48 |
  | `tools/sky/compare.mjs` (its own errors: a figure outside the safe area, the hand-off's pixels) | exit 0: no figure outside the safe area; `introProgress(1)` against `reset()`: 0 pixels differ at both sizes |
  | the first inspector's scripts, on the production build | keyboard 37 of 37, degrade 101 of 101, director-probes 34 of 34, director-storm 4 of 4, claim-rule 64 of 64, admin-start 29 of 29, turnstile-repeat 15 of 15 openings, strings 152 (30 with no source in the spec files, every one a name for a screen reader, none seen), flows-contact 121 of 126: the five are one opening in which Cloudflare's Turnstile script never arrived. Investigated and not the site (fixes.txt, "The Turnstile miss"); the same script ran 126 of 126 three more times that afternoon |

**How final verification was run (20 and 21 Nov; all three steps are done).** Three steps in sequence,
each committing its own output, so a cut-off loses at most the step in hand:
1. An inspector for the business and the code writes `refs/verification/business-and-code.txt`
   (the protected-systems diff review, the three flows, every check suite rerun, a type-check).
2. An inspector for the look writes `refs/verification/look.txt` and sheets under
   `refs/verification/matrix/` (every element at both sizes against its asset or the spec's
   words, a difference table, the spec's own checklist).
3. A fixer works through both reports and records each finding's outcome in
   `refs/verification/fixes.txt`. Three changes are decided regardless of the reports: every
   falling star strikes the ground with its own small burst (today only the first does); the
   logo's lit lines made visible at its real size; the teleport flash's traces thinner and bluer.
If a report file exists, that step is done: go on from the next one. Both inspections are
done. The fixer's full brief, with the order of work and the rulings on every finding, is
`refs/briefs/final-fixes.js` (the text between the backticks of `PROMPT`); the fixer records
each finding's outcome in `refs/verification/fixes.txt`. If the fixer is cut off, start
another on the same brief: it skips whatever `fixes.txt` already records as fixed.

**The orchestrator's rulings on the first inspector's findings**
(`refs/verification/business-and-code.txt`, its table, by number). The fixer follows these:
1. Tab icon: FIX. Derive the icon from the pack's lit emblem, the same crop as the logo
   (`scripts/build-assets.mjs`), as a PNG and an `.ico`; replace the stock files; point the
   `<link>` lines in `src/layouts/Base.astro` at them.
2. Loader over 8 s on slower devices: FIX. The owner's rule is 6 to 8 s, never under 6. Give it
   headroom (about 7.1 s nominal), credit real waiting time, shorten the hand-off when the
   clock is behind, never go under 6.0 s; `tools/loader/measure.mjs` must pass with the CPU
   slowed 4x and on slow 4G as well as unslowed.
3. Stars 100 to 146 unnamed in the owner's email: NOT OURS. The Worker is protected. Left for
   the owner.
4. A claim is lit only on the claimer's device: NOT OURS. Left for the owner.
5. Logo and menu hidden during the loader: KEEP as built; left for the owner to rule on.
6. Transitions suite stalls on Cloudflare's script: FIX the tool.
7. Hitch in the loader's first second on a slow phone: FIX (start loading the sky after the
   power-up has begun, with time to spare before the hand-off).
8. `/admin` edits only title and description now: no change (`public/admin` is protected);
   tell the owner.
9. No `<h1>`: FIX with a visually hidden one.
10. Star buttons share one name; the loader says nothing to a screen reader: FIX (names such as
    "Empty star 3 of 12 in Virgo"; a visually hidden status on the loader).
11. Six pictures shipped and never fetched: FIX (drop them from the build and the manifest).
12. One type error: FIX, and add a `typecheck` script (TypeScript as a dev dependency).
13. The twelve meanings are not in the repo's spec files: no change to the spec files (they are
    the owner's); they are word for word his Nov 18 sheet. Tell the owner.

### Round 2 (22 Nov 2026)

After the second look (21 Nov evening: no blocker, three majors, eleven minors), five fixers
worked one after another, one piece each. The record of every piece is
`refs/verification/fixes.txt`, "ROUND 2"; what each did is under "Exact next step", item 0.
- **What was fixed.** The fall (major): no burst is taken off the screen before its end, the
  far stars land as glints, crowded strikes share their light, 60 frames a second. A5
  (major): no frame without Cellestial's star at the hand-over (a rounding overshoot in the
  ease). The phone's sky (major): the six wide figures stand turned a quarter, Cellestial's
  star is clear of every star, knots are drawn smaller, B7 stands by its figure. Minors: the
  flash holds level through its peak; the loader's picture is on screen 7.5 s on a slow line,
  not 8.0 to 8.2; B7 on the desktop is clear of the far figures' points; the tab icon is the
  lit emblem at 16 and 32 px; the empty star's traces are lines, not blotches; the logo reads
  brass. Left by ruling: the loader's first arc (finding 14), the node's cyan (18), a sparse
  figure's sparse fall.
- **The close-out changed no file of the site.** It ran everything again, rebuilt the sheets,
  and corrected one check's way of reading (the warp's cover: the first full run gave 147 of
  148; the cause is in `fixes.txt`, piece 5, "THE WARP'S COVER": the reading was late, the
  cover is whole).
- **Every suite, on the last build** (22 Nov, 10:01 to 10:27; `tools/run-all.sh`; dev server
  with the Turnstile test key; real GPU unless said). `status.txt`: thirteen tools, thirteen
  `exit 0`.

  | Suite | Result now | Before the round |
  |---|---|---|
  | `pnpm build`, `pnpm lint`, `pnpm typecheck` | pass (4 pages; 103 files; no type error) | pass |
  | `pnpm test` | 138 of 138, and the three Workers' own checks 15, 16, 14 | 96 of 96 (the round added 42 tests) |
  | `tools/loader/measure.mjs --gpu` (1440×900) | 13 of 13: full 7.57 s from its mount, 7.45 s on the visitor's clock (the owner's 6 to 8 s is judged on that clock since piece 2); short 3.60; skipped at 1 s 2.71 / 2.71; Tab and modifiers 7.21; two resizes 7.12; storage blocked 7.11; no sky 6.06; sky 30 s late 11.99 | 13 of 13 |
  | `tools/loader/measure.mjs --gpu --throttle 4 --size phone` | 13 of 13: full 7.60 s (7.50 on the visitor's clock); short 3.65; skipped 3.00 / 3.08; Tab 7.45; resizes 7.45; storage blocked 7.43; no sky 6.07; sky 30 s late 12.06 | 13 of 13 |
  | `tools/sky/measure.mjs` | 201 of 201 | 201 |
  | `tools/sky/meaning.mjs` | 38 of 38 | 38 |
  | `tools/sky/meaning-all.mjs` | 24 of 24 | 24 |
  | `tools/roots/words.mjs` | 197 of 197 | 197 |
  | `tools/roots/measure.mjs` | 245 of 245 | 245 |
  | `tools/transitions/measure.mjs` | 148 of 148 (the fall 34, the warp 34, the teleport 80) | 148 |
  | `tools/chrome/compare.mjs` | 48 of 48 | 48 |
  | `tools/sky/compare.mjs` | exit 0: no figure outside the safe area; `introProgress(1)` against `reset()`: 0 pixels differ at both sizes | the same |
  | `tools/roots/compare.mjs`, `tools/transitions/strip.mjs`, `tools/loader/compare.mjs` | exit 0 | exit 0 |

- **The second look's scripts, on the production build** (`refs/verification/round-2/tools/`;
  `astro preview` on 4615; their output under `refs/verification/round-2/`, their logs in
  `round-2/logs-piece-5/`):

  | Script | Now | The second look |
  |---|---|---|
  | `fall-cut.mjs` (the light, frame by frame) | steepest drop between two frames 3.3% of the peak on the desktop (Virgo, Sagittarius; Aries 2.2%), 1.1 to 1.6% on the phone | 23.3 → 19.2 → 11.6 in two frames (its bar: no drop over 10%) |
  | `fall-cut.mjs` (frame times), and `--part A --fresh` | 16.7 ms at every figure, both sizes, none over 17 ms, also when each fall is a fresh browser's first; CPU 4×: 18.6 to 19.7 ms desktop, 16.7 to 17.1 phone | 19 to 20 ms, worst 67 to 83 |
  | `fall-cut.mjs` (solid white, 40 px tall or more) | 128 px (Virgo) and 132 px (Sagittarius) for one frame each on the desktop; 2 px on the phone | one mass 250 px wide; a lozenge for 0.7 s |
  | `fall.mjs` | 57 impacts from Virgo, 38 from Aries (33 on the phone), 72 from Sagittarius | 57, 38, 72 |
  | `a5-probe.mjs --runs 20` | a frame without the star in 0 of 20 (desktop), 0 of 20 (phone) | 8 of 12 |
  | `a5-probe.mjs --runs 12 --throttle 4` | 0 of 12, 0 of 12 | 7 of 12 |
  | `a5-probe-return.mjs` | 0 of 12 short loaders, 0 of 12 skipped | 7 of 12 short, 0 of 12 skipped |
  | `phone-sky.mjs` (390×844) and `--size small` (360×740) | ALL PASS at both: Cellestial's star 96.9 px (87.7), its rings 3.9 px (2.3) short of the nearest star; the wide figures all at least half the screen's height; deepest overlap 30.6% (31.5%); 292 of 292 touches at each | four of Virgo's stars inside the rings; overlaps to 64%; the wide figures 20 to 27% of the height |
  | `b7.mjs` | 24 of 24: desktop all twelve at 54 px with 0 far points on the words; phone all twelve by their figure at 24 px, the nearest 80 px above the exit button | 31 far points on the words; two 29 px above the button |
  | `flash.mjs`, then `flash-level.mjs` | a dip in 0 of 16; the lowest frame of the level stretch 90 to 97% of the peak; all sixteen land right | 6.2% lit → 3.8% → 6.1%; 5.4% → 1.4% → 5.4% |
  | `clock-slow.mjs` (first paint to the sky) | unslowed 7.14 to 7.49 s; slow 4G 7.51 to 7.52 s; slow 4G and CPU 4× 7.52 to 7.54 s | 8.0 to 8.2 s on slow 4G |
  | `favicon.mjs` | 16 px: brass-toned 38% of its pixels, brightest L 230; 32 px: 30%, L 238 | 16 px: 9%, L 118 |
  | `tools/loader/measure.mjs --gpu --size phone --url http://localhost:4615 --only full,short,skip,key,quiet-keys,broken,resize,no-storage` | 11 of 11 in each of four conditions; the full loader on the visitor's clock: unslowed 7.48 s; `--throttle 4` 7.50 s; `--net slow4g` 7.61 s; both 7.79 s | (round 1, from its mount: 7.55, 7.62, 7.30, 7.53) |

- **The sheets as the site is now.** Every scene's own folder, rebuilt in that run:
  `refs/loading/compare/`, `refs/sky/compare/`, `refs/roots/compare/`,
  `refs/transitions/compare/`, `refs/chrome/compare/`. The effects' own flash sheets and
  `refs/fx/compare/measure.txt` rebuilt from the head on the test page (the impact's, the
  warp's, `flash-peak.jpg` and `rm.jpg` came out byte for byte as committed). Looked at by
  the close-out after the rebuild: `sky/compare/stations-phone.jpg`, `b7-all-phone.jpg`,
  `handoff.jpg`; `transitions/compare/fall-desk.jpg`, `fall-phone.jpg`, `teleport-desk.jpg`,
  `teleport-phone.jpg`; `loading/compare/desk-1.jpg`, `phone-1.jpg`; `chrome/compare/logo.jpg`;
  `fx/compare/flash-down-desk.jpg`. The other rebuilt sheets were not opened after this run.
- **Where the runs' output is:** `refs/verification/round-2/logs/` (the last full run of
  `tools/run-all.sh`, a log for each tool and `status.txt`), `round-2/logs-piece-5/` (the
  production runs), `round-2/warp/` (the warp's cover: the first run's failing log and
  status, and the probe's runs), and one folder for each thing looked into (`fall/`, `a5/`,
  `phone-sky/`, `b7/`, `flash/`, `loader/`, `owner-list/`, `stars/`, `logo/`; `before/` in
  each is the build as the second look found it). `logs-piece-2/` to `-4/` are the suites as
  each earlier piece left them.
- **The protected systems**, at the head of round 2: the same command as above prints
  nothing (0 bytes). `src/components/ContactForm.astro` differs from `a31d2ee` in one hunk,
  inside its `<style>` block; `src/pages/contact.astro` and `src/pages/start/new.astro` in
  five lines, each a `class` value; `src/pages/start/index.astro` not at all.
- **Not done by anyone:** an inspector's look at what round 2 changed (the third look); a
  real phone.

### Round 3 (23 Nov 2026)

The third look (22 Nov; one inspector who built none of it, on the production build) ruled
every scene done at the owner's two sizes and found, outside them, one major and six minors.
Four fixers then worked one after another, one piece each. The record of every piece is
`refs/verification/fixes.txt`, "ROUND 3"; what each did is under "Exact next step", item 1b.
- **What was fixed.** A phone held on its side (major): the sky's layout keeps the exit
  button's own room on every screen and a figure too tall for the screen stands its foot 12 px
  above the button; no star nearer than 12 px to it at 844×390, 932×430, 667×375, 740×360
  (eleven, three, eleven and twelve stars reached it), and every star takes its touch. The
  meanings there stand by their figures, touching nothing (Leo's ran into three stars). A
  short phone: Leo's meaning in three rows at 18 px, touching nothing (it lay across two stars
  and three lines at 375×667). "claim yours" gives way to a meaning within 40 px (5 and 6 px
  at Aries and Taurus on the desktop; now 59 px and more). The knots' rule on every screen:
  the two stars at Taurus's western end at 1440×900 are 16% into each other, not 46%. The
  loader on a slow line: a skip pressed before the loader's script has arrived is kept (it
  was lost, 4 of 4); the unlit C is shown whole, never in halves; the clock starts when it is
  seen. The debug hooks' three console warnings are gone.
- **The close-out changed no file of the site and no check.** It ran everything again,
  rebuilt the sheets, ran the third look's scripts on the production build, and set the
  owner's two sizes beside what they were.
- **Every suite, on the last build** (23 Nov, 00:39 to 01:06; `tools/run-all.sh`; dev server
  with the Turnstile test key; real GPU unless said). `status.txt`: thirteen tools, thirteen
  `exit 0`.

  | Suite | Result now | Before the round |
  |---|---|---|
  | `pnpm build`, `pnpm lint`, `pnpm typecheck` | pass (4 pages; 108 files; no type error) | pass |
  | `pnpm test` | 174 of 174, and the three Workers' own checks 15, 16, 14 | 138 of 138 (the round added 36 tests: 10, 8 and 18) |
  | `tools/loader/measure.mjs --gpu` (1440×900) | 13 of 13: full 7.35 s from its mount, 7.34 s on the visitor's clock (from the first sight of the C since piece 3); short 3.53; skipped at 1 s 2.70 / 2.74; Tab and modifiers 7.26; two resizes 7.18; storage blocked 7.12; no sky 6.04; sky 30 s late 12.01 | 13 of 13 |
  | `tools/loader/measure.mjs --gpu --throttle 4 --size phone` | 13 of 13: full 7.52 s (7.53 on the visitor's clock); short 3.72; skipped 3.10 / 2.97; Tab 7.46; resizes 7.36; storage blocked 7.47; no sky 6.09; sky 30 s late 12.07 | 13 of 13 |
  | `tools/sky/measure.mjs` | 201 of 201 | 201 |
  | `tools/sky/meaning.mjs` | 38 of 38 | 38 |
  | `tools/sky/meaning-all.mjs` | 24 of 24 | 24 |
  | `tools/roots/words.mjs` | 197 of 197 | 197 |
  | `tools/roots/measure.mjs` | 245 of 245 | 245 |
  | `tools/transitions/measure.mjs` | 148 of 148 | 148 |
  | `tools/chrome/compare.mjs` | 48 of 48 | 48 |
  | `tools/sky/compare.mjs` | exit 0: no figure outside the safe area; `introProgress(1)` against `reset()`: 0 pixels differ at both sizes | the same |
  | `tools/roots/compare.mjs`, `tools/transitions/strip.mjs`, `tools/loader/compare.mjs` | exit 0 | exit 0 |

  One check was changed in the round, on purpose, by piece 3: `tools/loader/measure.mjs`
  judges the 6 to 8 s from the first sight of the picture, as the loader now counts, and
  prints the old number beside it.
- **The third look's scripts, on the production build** (`refs/verification/round-3/tools/`,
  run in order by `close-out.sh` there; `astro preview` on 4615; their output, pictures and
  logs under `refs/verification/round-3/piece-4/`):

  | Script | Now | The third look |
  |---|---|---|
  | `all-taps.mjs` at 1440×900, 390×844, 844×390 | 146 of 146 stars take their touch at each | 146, 146, 145 (Libra's lowest star started the fall) |
  | `phone-sky.mjs` (390×844) and `--size small` (360×740) | ALL PASS at both: Cellestial's star 96.9 px (87.7), its rings 3.9 px (2.3) short of the nearest star; deepest overlap 30.6% (31.5%); 292 of 292 touches at each | the same numbers |
  | `phone-sky.mjs --size short` (375×667) | one FAIL, as before: the star 77.1 px (the two judged phones' floor is 84); all else PASS, 292 of 292 | the same |
  | `phone-sky.mjs --size side` (844×390) | every star clear of the logo, the menu and the exit button; 146 on screen; 292 of 292 touches. Three FAIL lines, each the upright phone's rule: the star 72.7 px, "the wide figures half the height", deepest overlap 41.5% (Taurus's pair at the floor) | eleven stars 3 to 11 px into the button; overlaps to 63% |
  | `short-scope.mjs` (nearest star's disc to the exit button) | 844×390 12 px; 932×430 12; 667×375 14; 740×360 12; no star reaches it; eight other sizes 13 to 69 px | −11, −3, −7, −11 px |
  | `b7.mjs` at 1440×900, 390×844, 360×740, 375×667, 844×390 | 60 of 60 touch nothing; 0 far points on the words at every size; 54 px on the desktop, 24 px on the phones but Aquarius (22) and Leo (20 and 18) on the two smaller | Leo across two stars and three lines at 375×667; into three stars on its side; 32 far points on its side |
  | `f8.mjs` ("claim yours" beside a meaning) | 49 px or more in 30 of 30 taps; Aries and Taurus on the desktop 59 and 60 px at the least | 11 and 10 px, and over the meaning's box (the letters 5 and 6 px apart) |
  | `clock-all.mjs` (first sight of the C to the sky) | 7.09 to 7.43 s in 40 of 40 first visits; slow 4G 7.31 to 7.36 s, the sky 9.11 to 9.16 s after navigation; a return 3.37 to 3.52 s | 7.1 to 7.6 s from the first paint; 8.3 s after navigation on slow 4G |
  | `loader-seen.mjs` (slow 4G, recorded) | the C first seen and whole in the same frame, 6 of 6 (1.78 to 1.80 s) | something of it at 1.8 s, whole at 2.3 s |
  | `loader-slow.mjs` (slow 4G) | a key or a tap brings the sky at 5.92 to 6.06 s in 8 of 8 | a press before the script lost, 4 of 4 |
  | `a5-probe.mjs --runs 20`, and `--runs 12 --throttle 4` | a frame without the star in 0 of 20 and 0 of 20; 0 of 12 and 0 of 12 slowed | the same |
  | `a5-probe-return.mjs`, and `4 slow4g` | 0 of 12 skipped and 0 of 12 short at each size; an early skip on slow 4G (the press at 1.16 s, the loader live at 1.6 s): the sky at 5.94 to 6.15 s, no frame without the star, 8 of 8 | the same counts; an early press was lost, 4 of 4 |
  | `preload-console.mjs` | 0 console messages of any kind in 18 cases | three preload warnings on the debug hooks |
  | `tools/loader/measure.mjs --gpu --size phone --url http://localhost:4615 --only full,short,skip,key,quiet-keys,broken,resize,no-storage` | 11 of 11 in each of four conditions; the full loader on the visitor's clock: unslowed 7.31 s; `--throttle 4` 7.37 s; `--net slow4g` 7.32 s; both 7.38 s | (round 2, on the old clock: 7.48, 7.50, 7.61, 7.79) |

- **The owner's two sizes are what they were.** Two proofs. The scripts' own output, set
  beside the third look's file against file: `phone-sky.txt` at 390×844 is the same line for
  line but for one number of the turning rings (and at 360×740; at 375×667 every line);
  `all-taps-desk.txt` is the same, every line; the 24 verdict lines of `b7.txt` (1440×900
  and 390×844) are the same word for word. And the builders' sheets as rebuilt, set beside
  those committed before the round (`8724ef5`) by `round-3/tools/sheets-same.mjs`, with a
  control (round 2's two rebuilds of the same code, of whose 36 files 18 differ by
  themselves: the recorded and the moving ones): of the sky's 28 files and the loader's 8,
  16 are the same to the byte and 2 more as round 2's other rebuild; `b7-all.txt` and
  `meaning.txt` (every meaning's place at both sizes) and all the loader's frozen sheets
  (`desk-1`, `desk-2`, `phone-1`, `phone-2`, `short`) are among them; the rest differ no more
  than the control does, but for THREE DESKTOP SHEETS in which the two thinned stars of
  Taurus are to be seen: `stations-desk-2.jpg` (181 pixels), `b7-all-desk.jpg` (193),
  `beads-desk.jpg` (199). Nothing on the phone; nothing moved for "claim yours" in any
  sheet. The reports and the crops: `refs/verification/round-3/piece-4/sheets/`
  (`what-differs.jpg` sets the crops side by side). Earlier in the round, pixel for pixel on
  the production build (`sky-same.mjs`): 0 pixels in 36 captures at 1440×900 and 0 in 36 at
  390×844 across piece 2, 0 in 24 at each across piece 3, the desktop across piece 1 only
  inside the box of that pair.
- **The sheets as the site is now.** Every scene's own folder, rebuilt in that run:
  `refs/loading/compare/`, `refs/sky/compare/`, `refs/roots/compare/`,
  `refs/transitions/compare/`, `refs/chrome/compare/` (`refs/fx/compare/` was not rebuilt:
  no piece of this round touched the effects). Looked at by the close-out after the rebuild:
  `sky/compare/stations-desk-1.jpg`, `stations-desk-2.jpg`, `stations-phone.jpg`,
  `b7-all-desk.jpg`, `b7-all-phone.jpg`, `handoff.jpg`, `handoff-phone.jpg`;
  `loading/compare/desk-1.jpg`, `desk-2.jpg`, `phone-1.jpg`, `phone-2.jpg`, `a5-desk.jpg`,
  `a5-phone.jpg`; and from the production runs `round-3/piece-4/phone-sky/844/stations-empty.jpg`
  (a phone on its side, all twelve above the button), `b7/all-side.jpg` (the meanings there)
  and `loader/slow-desk.jpg` (slow 4G: black, then the C whole). The other rebuilt sheets
  were not opened after this run.
- **Where the runs' output is:** `refs/verification/round-3/logs/` (the last full run of
  `tools/run-all.sh`, a log for each tool and `status.txt`; `piece-1/` and `piece-2/` there
  are those pieces' own), `round-3/piece-4/` (the close-out's production runs: `logs/` with
  `status.txt`, and the scripts' output in `phone-sky/`, `desk-sky/`, `b7/`, `loader/`,
  `a5/`; `sheets/`), and the earlier pieces' evidence beside it (`before/`, `side/`, `same/`,
  `phone-sky/`, `desk-sky/`, `b7/`, `a5/`, `piece-2/`, `piece-3/`).
- **The protected systems**, at the head of round 3: the same command as above prints
  nothing (0 bytes). `src/components/ContactForm.astro` differs from `a31d2ee` in one hunk,
  inside its `<style>` block; `src/pages/contact.astro` and `src/pages/start/new.astro` in
  five lines, each a `class` value; `src/pages/start/index.astro` not at all; round 3
  touched none of the four. On the production build `/`, `/contact`, `/start`, `/start/new`
  and `/admin/` answer 200.
- **Not done by anyone at the close-out:** an inspector's look at what round 3 changed (it
  was done later that day: the next part); a real phone.

### The fourth look (23 Nov 2026)

One inspector who built none of it, on the production build. The report is
`refs/verification/fourth-look.txt`, its evidence `refs/verification/fourth-look/`.
- **The verdict:** no blocker, nothing major. Loading, the Sky, the Fall, the Roots, the
  Close, the Chrome, the Warp, reduced motion and the page without script are done at the
  owner's two sizes, as the third look ruled, and round 3 undid none of it.
- **The seven things the third look left: all resolved.** A phone on its side (584 of 584
  touches take their star at four sizes; no star nearer the exit button than 12 px; all twelve
  meanings touch nothing); B7 on short phones (36 of 36 touch nothing, the type never under
  18 px); the early skip (22 of 22 presses made before the loader was live are kept); the
  unlit C (never half-drawn in 26 slow visits; from the first sight of the C to the sky 7.01
  to 7.51 s in 46 of 46 first visits on every line and device tried); "claim yours" beside
  the words (none within 40 px of a meaning in 849 desktop and 444 phone taps); the knot on
  the desktop (Taurus's closest pair 17% into each other; 146 of 146 clicks take their star);
  the console (nothing on 18 of 18 paths, nothing in 245 recorded visits).
- **The owner's two sizes:** the loader's sheets the same to the byte as the third look's; the
  standing sky at 390×844 the same to the pixel in 36 captures, and at 1440×900 differing only
  in Taurus's two thinned stars; thirteen suites exit 0 with the third look's counts; the
  hand-off never loses the star (24 first visits, 60 skips, 20 returns); the fall 16.7 ms a
  frame with no light switched off; 292 of 292 touches on the phone's sky; one whole visit at
  each size, frame for frame what it was. Build, tests (174 of 174), lint and type-check
  pass; the protected-systems diff prints nothing; `/`, `/contact`, `/start`, `/start/new`
  and `/admin/` answer 200.
- **What stands:** two minors ("Exact next step", item 1c): "claim yours" across
  neighbouring stars (round 4 puts it right) and Taurus's close pair on a phone on its side
  (left for the owner). **For the owner to be told:** on slow 4G the sky comes 9.1 s after
  the tap on the link (it was 8.3): the cost of counting the 6 to 8 s from the moment the C is
  seen.

## Where things stand

| Piece | State | How it was verified |
|---|---|---|
| Spec and asset pack in the repo | done | — |
| Derived assets, palette, constellations, locked tile copy, scene contract | done; on 21 Nov the whole asset script was run again: every file that is kept came out byte for byte the same and the palette still equals the tokens; six pictures nothing fetched are no longer made; new derivations, all from the pack: `sky/b4-station.webp` (`scripts/assets/sky.mjs`), the logo with its lit lines widened, `public/favicon.png` and `favicon.ico`. The contract gained optional members only: the fall's `onLand` and `fx.impact`'s size, `SkyScene.introRings`, `LoaderScene.quiet`. | Tests (tile copy is compared character for character with the addendum; 18 constellation tests). Asset sheets looked at: `refs/asset-qa/`, `refs/constellations/`. |
| UI kit: Quicksand, brass button (5 forms), panel, both dialogs; `/contact` and `/start` restyled | done | Screenshots looked at, both sizes: `refs/foundation/kit/`. Contrast measured (all AA). Protected files: only class and style lines changed. |
| Experience core: scene director, claims store, claim flow, page shell | done (the director's three choreographies were written later: the "Transitions" rows) | Build, 96 tests + worker checks, lint all pass. Walk-through at both sizes looked at: `refs/foundation/walk/` (sky → exit button → roots → build request → star; menu to all four destinations; reduced motion; no JavaScript). |
| **Independent review** | **done for the whole site, not for the foundation alone**: two independent inspectors on 20 and 21 Nov | `refs/verification/business-and-code.txt` and `refs/verification/look.txt`; what became of each finding: `refs/verification/fixes.txt`. (The three reviewers of the foundation alone, cut off on 19 Nov, were never run again.) |
| Loading (A1–A5) | **Round 3, piece 3, 23 Nov (fixes.txt, "ROUND 3", piece 3): a skip made before the loader's script has arrived is kept (the markup's inline script writes the press down, `loader/skip.ts` judges it); the unlit C is shown whole, never half-drawn, and its file goes down the line before the other three pictures; the clock starts when the C is first seen (`firstSeen()` in `loader/clock.ts`), which on slow 4G is 1.78 s after navigation and not the 0.8 s of the browser's first paint, so the sky comes at 9.1 s there (8.3 before) after 7.3 s of loader; a fast line is unchanged. Where this cell says "from the first paint" below, read "from the first sight". At the close-out (23 Nov): 13 of 13 at each size, the full loader 7.34 s (desktop) and 7.53 s (phone, CPU 4×) on the visitor's clock; on the production build 7.31, 7.37, 7.32 (slow 4G) and 7.38 s (both); the four frozen sheets and `short.jpg` the same to the byte as before the round; `desk-1.jpg`, `desk-2.jpg`, `phone-1.jpg`, `phone-2.jpg`, `a5-desk.jpg`, `a5-phone.jpg` looked at.** **Round 2, 22 Nov (fixes.txt, "ROUND 2", piece 2): the loader's clock is the visitor's, from the first paint (`src/experience/loader/clock.ts`, tested), and the markup asks for its other three pictures, so on slow 4G its picture is on screen 7.5 s where it was 8.0 to 8.2; `tools/loader/measure.mjs` judges the owner's 6 to 8 s on that clock and prints both. The frame without Cellestial's star at the end of A5 is gone (see the Sky row). Now: 13 of 13 at each size, the full loader 7.45 s (desktop) and 7.50 s (phone, CPU 4×) on the visitor's clock; on the production build 7.48, 7.50, 7.61 (slow 4G) and 7.79 s (both). The numbers further on in this cell are from before the round.** **done against the reference, polish pass included, except what is listed here; A5 rebuilt, the clock re-planned and two minors closed by the fixer on 21 Nov (fixes.txt: look 6, code 2, code 7, look 14, look 15)** — `src/experience/loader/`, `src/components/scenes/Loader.astro`, asset module `scripts/assets/loader.mjs` (run by `node scripts/build-assets.mjs modules`; it writes `geometry.ts` and the matte, and run again it reproduces both) | Frozen at 14 times at 1440×900, no console errors, set beside the reference and looked at: `refs/loading/compare/desk-1.jpg`, `desk-2.jpg` (six rounds of fixes, then the polish pass of four items, each looked at close up: see the section below the table). On 21 Nov all four sheets were rebuilt and looked at again; the times on them are seconds of the script, which are the reference's seconds, and each caption also gives the moment on the visitor's clock, because the build now plays that script at 6.2 / 5.6 = 1.107 (`FULL_TEMPO` in `timeline.ts`: every beat scaled alike, none cut). Matches: the C's place and size; the order and tempo the circuits light in (a thin white wire with a blue glow); the cooling before the charge; the overload (a thin white-hot bolt from the top edge, the node lost in white with its rings showing through, a blue wash filling the bolt's half of the frame, spark dust); the camera pulling back; the first "e" thrown from the node by one tall arc and written in the reference's order; each letter written at the reference's moment as one thin white tube on its brass, with white ring nodes, in a wide navy haze; the node's rings lit white while the word is written; the cooling into the A4 picture itself. The two soft fields (the haze behind the letters, the overload's wash) were also measured, reference against build: `refs/loading/compare/light.txt`, written by `node tools/loader/light.mjs`. **Still different:** the first arc (3.67) is less wild and the first piece of the "e" bolder; the overload's white (a bloom without an edge since 21 Nov) is still a little larger and bluer at its rim than the reference's, and its sparks are coarser and fewer (the lit circuits at 1.33 were narrowed and made bluer on 21 Nov and are now close); close to the letter being written the haze is a little weaker (3.83) and the letters' edges cooler; once a letter is written the reference lets lightning play over it for longer, and it strikes the star (5.25) where the build only lights it; the node's lens keeps a darker blue ring round its white heart. **Phone (390×844, scale 2, touch):** the same 14 times looked at, `refs/loading/compare/phone-1.jpg`, `phone-2.jpg`: nothing clipped, the C is 62% of the width, the word fits at 87% with margins, the bolt comes down from the top edge. **Rules, measured in real time with `node tools/loader/measure.mjs` (mount to done) on 21 Nov after the last change, real GPU, 1440×900 / phone profile with the CPU slowed 4×:** full 7.53 / 7.62 s (the rule: 6 to 8); short 3.55 / 3.68 s; skipped at 1 s by a tap 2.84 / 3.12 s and by a key 2.85 / 3.10 s; Tab and modifier keys do not skip (7.16 / 7.33 s); two resizes mid-run keep the time (7.14 / 7.31 s); sessionStorage blocked 7.09 / 7.46 s; any one of the four pictures missing: it ends at once; the sky failing to load: 6.08 / 6.21 s, ending on the Roots; the sky 30 s late: 11.97 / 12.09 s. The plan: 5.6 s of script and a 1.5 s hand-off, 7.1 s when nothing is late; real waiting counts on the clock; a late run may end 0.4 s past the plan, then plays its hand-off faster (never under 1.1 s), then hurries the script (35% at most); never under 6.0 s from the mount. The sky is fetched from the first moment and mounted at the loader's one still moment (script second 1.92), so its half second of work no longer falls in the first second. On the production build, phone profile: 7.55 s unslowed, 7.62 s with the CPU slowed 4×, 7.30 s on slow 4G, 7.53 s with both. **A5 (the star-drop), rebuilt on 21 Nov, both sizes, looked at:** `refs/loading/compare/a5-desk.jpg`, `a5-phone.jpg` (every tenth of the hand-off) and full-size crops of 0.3 to 0.9: the star flashes and breaks into nine pieces cut from its own brass, which stay brass; they are thrown out, swing in on arcs and land on the circles of the sky's three rings (`sky.introRings()`) between 0.46 and 0.64 of the hand-off, lie down along the bands and run on round them, laying copies of themselves behind, while the rings fade in under them (0.4 to 0.85) and begin to turn; the letters take at most a fifth of the star's light, so they are still brass as they sink, gone by 0.6. **Short version** looked at again after the polish pass, both sizes: `refs/loading/compare/short.jpg` (the lit C in place, one bolt from the node writes the nine letters in about a second, cools, holds). **Also checked:** the same second always draws the same picture (two pages, and after seeking away and back: identical screenshots); after `done` the overlay is `display: none`, the canvas is 0×0 and the scene is the sky; with reduced motion the loader never shows; without script the cover is not on the page; the server-rendered C sits where the canvas draws it to 0.01 px at 1440×900, 390×844 and 844×390. **Not done:** frame times on a real phone (only headless Chromium with the CPU slowed); landscape phone, tablet and ultrawide framing were not looked at as pictures. |
| Sky (B, G1) | **Round 4, 23 Nov (fixes.txt, "ROUND 4"): "claim yours" stands under its star where that place is free and beside it where another star, Cellestial's rings or the screen's side is in the way (`sky/claim-label.ts`): across another star of its figure 25 to 0 of 137 at 1440×900 and 38 to 2 at 390×844, nothing else in the sky moved (0 pixels).** **Round 3, 22 Nov (fixes.txt, "ROUND 3", pieces 1 and 2): the layout keeps the exit button's own room under the figures on every screen (`B11` in `sky/config.ts`: 96 px under 480 px of height, what it was above), and a figure held at its furthest stand stands its foot 12 px above the button: on a phone held on its side (844×390, 932×430, 667×375, 740×360) no star is nearer than 12 px to the button and 146 of 146 take their touch (stars lay 3 to 11 px into it; one could not be taken). The knots' rule (no two stars more than a third into each other) and the 2 px of clear space round Cellestial's rings now hold on every screen, not on the upright phone alone: at 1440×900 that draws the two stars at Taurus's western end (slot-77, slot-64) at 12.5 px, 16% into each other where they were 46%, and changes nothing else there; on a phone on its side that pair is still a close double (41 to 49%, both at the floor of 6 px). "claim yours" stands under its star unless a meaning's words are within 40 px of that place, then above, right or left of it (`sky/claim-label.ts`, tested). At 390×844 the layout is the same number for number. 201 of 201; every sheet rebuilt on 23 Nov; looked at then: `stations-desk-1.jpg`, `stations-desk-2.jpg`, `stations-phone.jpg`, `handoff.jpg`, `handoff-phone.jpg`. Where this cell says "landscape phone not looked at" below, read: measured and looked at in headless Chromium in round 3, not on a device.** **Round 2, 22 Nov (fixes.txt, "ROUND 2", pieces 2, 3, 4): the hand-off's last frame keeps Cellestial's star (the eases are capped where they are made; the pose is `src/experience/sky/intro.ts`, tested): 0 of 40 first visits, 0 of 24 slowed, 0 of 24 returns and skips draw a frame without it. On a portrait phone the six wide figures are turned a quarter and `layout.plans` (`src/experience/sky/layout.ts`, tested) is the one place a star's place comes from: Cellestial's star 97 px and clear, no two stars more than a third into each other, 292 of 292 touches at 390×844 and at 360×740. An empty star's traces are filtered to lines at 36 to 58 px (`src/experience/sky-station-picture.test.ts`). 201 of 201; every sheet rebuilt on 22 Nov; looked at then: `stations-phone.jpg`, `b7-all-phone.jpg`, `handoff.jpg`.** **done, parts A and B, except what is listed in its two sections.** Part A: the void, the honeycomb, Cellestial's star, the twelve figures, the endless flight, the round and the exit button (B11), reduced motion, the governor, the hand-off from the loader, the fall. Part B: the beads (B8), the pulse and the words "claim yours" (B9), the empty-star panel (B10), the lit-star panel, a real send lighting the star, the waiting ask. B7 (the meaning written over a completed constellation) and the full fall transition were built later: see their own rows. — `src/experience/sky/`, `src/components/scenes/Sky.astro`, `tools/sky/` | Every sheet in `refs/sky/compare/` rebuilt by `node tools/sky/compare.mjs` on the real GPU at 1440×900 and 390×844 and looked at. `node tools/sky/measure.mjs`: 201 checks with real wheel, key, touch and mouse events, all passing, written to `refs/sky/measure.txt` (run again on 21 Nov after the last change: 201 of 201). **Changed by the fixer on 21 Nov (fixes.txt: look 4, 5, 8, 13, code 10):** an empty star at its station is drawn from `sky/b4-station.webp`, the pack's B4 with its brass traces made to carry at 26 to 50 px, with a thin rim of the blue at 21%, and becomes the pack's own picture as it is flown in on; a star of middling brightness stands at about 21 px on the desktop; on a portrait phone no star is under 13 px and Cellestial's star is 130 px across, whatever the figure's fit, and Virgo's nearest stars are drawn over its rings; no figure is turned or leaves the screen (**that sentence was reversed on 22 Nov, round 2, piece 3: the six wide figures are turned on a portrait screen, Cellestial's star is 97 px and clear, knots are drawn smaller, B7 stands by its figure on the phone; see decision 17 and `fixes.txt`, "ROUND 2", piece 3**); "claim yours" is never drawn over a meaning; the falling stars' trails are longer; each star's button is named in order ("Empty star 3 of 12 in Virgo"). Every sheet was rebuilt on 21 Nov after the last change; looked at then: by the fixer `open.jpg`, `handoff.jpg`, `beads-phone.jpg`, `meaning-settled.jpg`; by the orchestrator `open.jpg`, `stations-phone.jpg`, `meaning-settled.jpg`, `b7-all-desk.jpg`, `b7-all-phone.jpg` (`stars.jpg`, `panel.jpg` and the desktop stations sheets were looked at when their fix was made, not after the last rebuild). A real send walked through `scripts/shot.mjs` with `/api/contact` stubbed (`tools/sky/claim-200.steps.json`, `claim-400.steps.json`). **Not done:** frame times on a real phone (headless Chromium only, the real GPU and software with the CPU slowed 4×); landscape phone and tablet not looked at as pictures; no independent review. |
| Effects (C4 flash, D2 burst, G2 warp) | **Round 2, 22 Nov (fixes.txt, "ROUND 2", pieces 1 and 2): no burst is taken off the screen before its end (the list is `src/experience/fx/impacts.ts`, tested; `IMPACTS_MAX` is gone), the far figures' stars land as small glints, strikes close together share their soft light, and the bursts are drawn once unseen at the loader's still moment so the first crash does not wait for the browser. The flash's clock is `src/experience/fx/flash-time.ts` (tested): a swap that blocks is taken off its clock once, not twice, so the flash holds level through its peak (lowest frame 90 to 97% of the peak in all sixteen teleports). The six flash sheets and `measure.txt` in `refs/fx/compare/` were rebuilt on 22 Nov from the head (the flash without swap time now 404 to 432 ms, alpha 255 at the swap in 18 of 18; the other sheets came out byte for byte the same); `flash-down-desk.jpg` looked at. The numbers further on in this cell are round 1's.** **in place; the flash and the warp were changed by the fixer on 21 Nov (fixes.txt: look 3, look 11), and the impact takes a size (look 1).** `src/experience/fx/` (the pictures in `flash.ts`, `impact.ts`, `warp.ts`; the timekeeping in `layer.ts`), `src/components/scenes/Fx.astro`. It imports only `contracts.ts` and `tokens.ts`. Its test page `/dev/fx` (`src/pages/dev/fx.astro`, `src/experience/fx/dev/harness.ts`) was removed once the transitions were built; commit `8385356` is the last that has it, and `tools/fx/compare.mjs` says how to bring it back for a run. | `node tools/fx/compare.mjs` writes every sheet and `measure.txt` into `refs/fx/compare/`. **All of them were rebuilt on the afternoon of 21 Nov from `c211d9e`, after the fixer's changes** (in a copy of the checkout with the test page put back: fixes.txt, "The effects' own sheets"), so they show the effects as they are. Looked at then: `flash-peak.jpg`, `flash-down-desk.jpg`, `warp-desk.jpg`, `impact-desk.jpg`, `rm.jpg` (and the flash on the real page: `flash-real-page.jpg` and the teleport sheets). **Not looked at since the rebuild:** `flash-up-desk.jpg`, `flash-up-phone.jpg`, `flash-none-desk.jpg`, `flash-none-phone.jpg`, `flash-down-phone.jpg`, `impact-phone.jpg`, `warp-phone.jpg`. **The flash** frozen at nine moments for each direction over a pale page of dark figures (`flash-<dir>-desk.jpg`, `-phone.jpg`): right-angle and 45° traces ending in ring nodes grow the way of travel, a hub like the emblem's node at the centre, the centre blooms blue-white at the peak, and from t 0.3 to 0.7 nothing of the page shows. Close up beside the lit emblem (`flash-peak.jpg`): the same kind of line (a white core in a blue glow, round ring nodes); **since 21 Nov** the traces are 1.5 to 2 px of the blue with a narrow glow, white only at the hub and its nearest rings, on black, and the peak is held level across the swap. Also `refs/fx/compare/flash-real-page.jpg` (the flash on the real page, recorded with the DevTools screencast, both sizes, and its peak at full size) and the strips in `refs/transitions/compare/`. **Real time, desktop / phone:** the flash lasts 422–432 / 420–432 ms without swap time (must be 300–500); `swap()` runs at 203–215 ms and the lowest alpha anywhere on the canvas at that moment is 255 (fully opaque), every run; with a 400 ms swap 841 / 835 ms; with a 2 s swap 1433 / 1449 ms (the hold is capped at 1 s); a swap that throws: 433 ms, the promise rejects with the error and the canvas is put away; two flashes asked for at once play one after the other (831 / 847 ms). **The impact** at six moments at three places along a ground line (`impact-desk.jpg`, `-phone.jpg`): a white flash on the line, jagged rays thrown down and sideways into the ground, a shock of light running both ways along the line, sparks that arc and fall back; gone by the end (760 ms). **The warp** at eight moments over soil and over the pale page (`warp-desk.jpg`, `-phone.jpg`): streaks from a vanishing point high in the frame, few then many and long, a blue-white flare (since 21 Nov the peak is black, dense with streaks, under the flare, and no longer one pale field); in real time fully opaque from 797 to 940 ms of 1200 and 1178 to 1394 ms of 1800 on the desktop, 799 to 930 and 1184 to 1402 on the phone (the swap, at 0.7, is at 840 and 1260). **Reduced motion** (`rm.jpg`): plain fades through black, no impact. **At rest:** 0 animation frames asked for in 2 s, before any effect and after all three; the canvas is `display: none` and clear. **Frame times** (headless Chromium, software): 16.6–17.2 ms average; with the CPU slowed 4× the flash averages 33 / 43 ms with one 117 ms frame at its start (laying out the traces), the impact 17 / 17 ms, the warp 24 / 19 ms (worst 83 / 50 ms). **Not done:** not seen on a real phone; no independent review. |
| Roots (E1–E6) | **built (steps 1 to 4 by its builder; the last look by the orchestrator); what differs from the spec is listed at the end of its section. Three minors closed by the fixer on 21 Nov (fixes.txt: look 7, 10, 16): the guided light has a 300 px tail, rests 0.8 s and dims the trunk ahead of it; under 768 px the trunk bends gently and its branches lean away; the white heart of a thread is one pixel; the runner's light is out under the logo.** The soil (a tile of E1 with no mirror in it) with an uneven top edge, E6, five nodes as real buttons in a descending line, five tiles from the locked copy opened one at a time, the mycelium grown by code from where the nodes are, the guided light, the growth from an impact, the whole contract. The arrival and the return themselves (the fall, the crash, the warp) are the director's: see the "Transitions" rows. — `src/experience/roots/` (`index.ts`, `net.ts`, `edge.ts`), `src/components/scenes/Roots.astro`, `scripts/assets/roots.mjs`, `tools/roots/` | `node tools/roots/measure.mjs`: 245 checks with real clicks, taps and keys at 1440×900, 390×844 and 320×568, all passing, written to `refs/roots/measure.txt` (run again on 21 Nov after the last change: 245 of 245; `words.mjs`: 197 of 197). `node tools/roots/words.mjs`: all five tiles equal the addendum character for character, three ways (`refs/roots/words.txt`). `node tools/roots/compare.mjs`: every sheet in `refs/roots/compare/` rebuilt and looked at. Numbers in the section below. **Not done:** frame times on a real phone (headless Chromium only, the real GPU and software, CPU slowed 4×); landscape phone and tablet not looked at as pictures; no independent review. |
| Close (F1, F2) | **built**: exactly the two links the brief gives, F1 "Claim your star" (259×68 px, 21 px type) and F2 "Contact me" (137×44 px, 15 px type) 24 px under it, both centred, nothing else. — `src/components/scenes/Close.astro` | Same run: F1 opens the build request, F2 the message box; the menu lands on them; without script both are links to `/contact`. Looked at in the step 1 sheets. |
| Chrome (C1–C3) | **Round 2, 22 Nov (fixes.txt, "ROUND 2", piece 4): the logo's lit lines are widened by 1 px, not 2 (it read mauve at 52 px; red over blue 18.4 → 23.6, the pack's lit emblem 28.2); the tab icon at 16 and 32 px is the pack's lit emblem cropped to the C and lifted (brass-toned pixels 9% → 38% at 16 px). 48 of 48; sheets rebuilt on 22 Nov, `logo.jpg` looked at.** **built**, replacing the placeholder: `src/components/chrome/Chrome.astro`, `src/experience/chrome/index.ts`. **C1:** the emblem at rest (`/cellestial/chrome/c-logo.webp`, 43×48 px on a phone, 52×60 px from 768 px wide) with the live word "studio" under it in Quicksand, brass lit from above (13 px, 15 px wide); one link named "Cellestial studio", which asks the director for the sky; the main node's glow breathes over 7 s (drawn by code; still under reduced motion). **C2:** a 44×44 px button named "Menu": three 26×6 px bars cut from the brass skin with a 1 px blue line in a groove along each; the line turns blue-white with a blue glow under the pointer, with keyboard focus (plus a ring) and while the menu is open; pressed, the bars take the dark skin. **C3:** the kit's small panel as a native popover dropping from the button, with exactly "The Sky", "What we build", "Claim your star", "Contact me" (links to `/`, `#roots`, `/contact`, `/contact`; with script they call `director.go`). Hidden while the scene is `loading`, fading in over 400 ms after. The header takes no pointer events itself. Nothing else is in it. | `node tools/chrome/compare.mjs`: 48 checks at both sizes, all passing (`refs/chrome/compare/measure.txt`), with real clicks, taps and keys on the real page: the only words are "studio" and the four items; each item asked the director for its destination once and the menu closed with focus back on the button; the logo asks for the sky and does not navigate; Tab reaches "Skip to content", the logo, then the button; Enter opens the menu with focus on "The Sky", Tab walks the other three, Escape closes it with focus back on the button; a click or tap outside closes it; while `loading` it is hidden and cannot take focus; it is fully there 413 ms after the loader ends; reduced motion: no breathing, no fade, no drop; with script off the button still opens the menu and "Claim your star" goes to `/contact`; on a phone the logo and button end at 110, 76 px from the corner (21 Nov). The teleports walked again with the real chrome in (80 checks). Sheets looked at, `refs/chrome/compare/`: `closed.jpg` (over the sky and over soil, both sizes), `logo.jpg` (enlarged between A1 unlit and A1 lit), `bars.jpg` (rest, pointer, pressed, keyboard focus, menu open, both sizes), `menu.jpg` (open over the sky and soil at 1440, 390 and 320 px wide, and with script off). Contrast: "studio" is `--color-brass-text` or lighter, 6.7:1 on black and 5.6:1 on the earth (the tokens' measured figures); the menu's words are white at 90% on black. **Changed by the fixer on 21 Nov (fixes.txt: look 9, 17, code 1, 9):** the logo picture is rebuilt from the lit emblem with its lit lines widened so that they survive at this size: a blue line runs along every strut and the node is lit, clearly between A1 unlit and A1 lit at both sizes (`logo.jpg`, looked at; plainer on the phone's two pixels to one than on a desktop's one); its link is at least 44 px wide; the browser-tab icon is the same emblem (`public/favicon.png`, `favicon.ico`), no longer the framework's; the page has a visually hidden `<h1>`. `node tools/chrome/compare.mjs` again after the last change: 48 of 48. **Not done:** a browser without popovers (the fallback in the script and the stylesheet was written, not run); not seen on a real phone. |
| Transitions: the fall and the crash (D1, D2) | **Round 2, 22 Nov (fixes.txt, "ROUND 2", piece 1): the crash's light is no longer cut off (the steepest drop between two frames is 3.3% of the peak; it was a half), no white mass is left on the ground, and the fall runs at 16.7 ms a frame at every figure on both sizes (the Roots' growth draws 1,000 to 1,500 strokes a frame where it drew 2,500 to 9,800); desktop trails are in proportion to the star. From a turned figure on the phone the fall is the same (piece 3). 34 of 34; `fall-desk.jpg` and `fall-phone.jpg` rebuilt on 22 Nov and both looked at. The frame times further on in this cell are round 1's.** **built.** `fall()` in `src/experience/director.ts`; two rules in the shell's stylesheet (`src/pages/index.astro`): the sky's buttons go while the stars fall and during the warp, and E6 is not there until the visitor has arrived. Nothing in the sky, the Roots or the effects layer was changed. **What happens:** B11 is pressed; the scene becomes `fall`; every star drops, all alike, with a trail (`sky.fall`); the document is scrolled by script so the soil rises into the bottom of the frame (to 32% of the screen in 0.9 s); the stars pass behind the soil's edge (the sky is a fixed canvas under the ground); every star, in the frame it reaches it, fires `fx.impact(x, y, size)` (its own burst, smaller for the figures behind), and the first also `roots.growFrom(x)`; the burst's canvas is carried with the ground it struck; the view then follows the trunk's light down (1.2 s) until the top of the ground is the top of the screen; the scene becomes `roots` with the spacer collapsed and scrollTop corrected in the same frame; the sky is switched off and restored unseen; focus moves to the ground. The growth is left running (the network is not snapped whole). | Looked at as strips of sixteen frames, real clicks, real time, real GPU: `refs/transitions/compare/fall-desk.jpg`, `fall-phone.jpg` (`node tools/transitions/strip.mjs --only fall`). The desktop strip was looked at in its final form; the phone strip was looked at one round earlier (the rise 0.1 s longer, E6 still showing during the crash) and rebuilt since without being looked at again. One continuous event, no cut; the burst sits on the ground line and throws light down and sideways, then the trunk and node 1 light as the view goes down. `node tools/transitions/measure.mjs --only fall` (30 checks, all passing, in `refs/transitions/measure.txt`), desktop / phone: the ground is at the top 2168 / 2140 ms after the press; the star struck on screen at 464 / 495 ms (y 784 of 900 / 708 of 844); one impact, one growth; the ground never moved back down and moved 0.00 px in the frame the spacer collapsed; a second press at 300 ms, the menu at 500 ms and E6 at 700 ms did nothing; ends with scene `roots`, scrollY 0, focus on `#roots`, the sky's stars back. A reload 700 ms in opens on the sky again; back (to `/contact`) and forward 700 ms in leaves the page whole on the sky. Reduced motion: a fade straight to the Roots in about 0.6 s, no `fall` scene, no impact, the network whole. **Frame times during it:** real GPU 18.5–19.5 ms average, 33 ms at the 95th percentile, worst 50–100 ms over three runs, the worst frame being the one of the impact or of the arrival (desktop); 16.8 ms average, worst 33 ms (phone size). In software with the CPU slowed 4×: 143 / 183 ms average, worst 400 / 417 ms, and the fall then takes 4.1 / 4.3 s instead of 2.2: it slows, it does not skip. **Since 21 Nov (fixes.txt: look 1, look 13)** every star strikes the ground with its own burst and the trails are longer; the numbers earlier in this cell are the builders' of 20 Nov. `node tools/transitions/measure.mjs` after the last change: 148 of 148 (the fall 34, the warp 34, the teleport 80); `fall-desk.jpg` rebuilt and looked at. **Not done:** not seen on a real phone. |
| Transitions: the warp back (G2) | **built.** `warp()` in `src/experience/director.ts`; `ascend()` (E6) and `showStar()` from the Roots both use it. **What happens:** the scene becomes `warp` (the spacer returns, scrollTop corrected in the same frame, nothing moves); one frame of the sky's opening pose is drawn behind the ground; `fx.warp(1500)` plays while the ground drops away, faster and faster, from wherever the page was scrolled; in the first frame at or after 0.66 of the warp (the cover is whole from 0.64 to 0.76 and is centred on `WARP_COVER`, 0.7) the page becomes the sky by `arriveInSky()`: stars back, opening pose, B11 still there; the streaks thin and clear; focus moves to the sky. The swap is made in a frame callback on wall-clock time, with a timer 250 ms later for a tab with no frames. | Strips of sixteen frames, real clicks, real GPU, both sizes, from the top of the ground and from 1800 px down it: `refs/transitions/compare/warp-desk.jpg`, `warp-phone.jpg`, `warp-deep-desk.jpg`, `warp-deep-phone.jpg`. Looked at: `warp-deep-phone.jpg` in its final form, and `warp-desk.jpg` one round earlier (before the swap was moved from a timer into a frame callback); `warp-phone.jpg` and `warp-deep-desk.jpg` were not looked at. What they show: the ground falls away under growing streaks from a point high in the frame, a blue-white flare covers everything, and it clears on the sky. `node tools/transitions/measure.mjs --only warp` (34 checks, all passing): 1509–1532 ms from the press to focus on the sky; the page became the sky at 998–1007 ms and the effects canvas was fully opaque in that frame (lowest alpha 255), also in software with the CPU slowed 4× (swap at 1033–1097 ms, still under the cover); a second press at 300 ms, the menu at 500 ms and B11 at 1200 ms did nothing; ends on scene `sky`, scrollY 0, Virgo's stars back, B11 visible, focus on `#sky-ui`, the effects canvas put away. Reduced motion: a fade to the still sky in about 0.53 s with B11 there. **Frame times:** real GPU 16.7 ms every frame at both sizes; software with the CPU slowed 4×: 42–47 ms average, worst 233 ms. **Since 21 Nov (fixes.txt: look 11)** the peak is black, dense with streaks, under the flare; the four strips were rebuilt and `warp-desk.jpg` looked at; the frame is still fully covered when the page becomes the sky. **Not done:** `showStar()` after a real send from the Roots was not walked again with the warp in (it calls the same `warp()`); not seen on a real phone. |
| Transitions: the teleport (C4) | **Round 2, 22 Nov (fixes.txt, "ROUND 2", piece 2): the flash no longer dips at its peak from the sky to the ground (a dip in 0 of 16 on the production build; with the CPU slowed 4× it dipped in 9 of 9 before); 80 of 80; both strips rebuilt on 22 Nov and looked at.** **walked and measured; the director needed no change. The flash's light was changed on 21 Nov (see the Effects row); the 80 checks pass again and both strips were rebuilt.** `go()` in the director calls `fx.teleportFlash(swap, dir)`; the swap is `arriveInSky` or `arriveInRoots(at)`. | The menu opened and each item pressed with a real click, from the sky and from the middle of the Roots (scrollY 1500), both sizes, real GPU. `node tools/transitions/measure.mjs --only teleport` (80 checks, all passing): **The Sky** lands on scene `sky`, scrollY 0, Virgo's stars there, focus on `#sky-ui`; **What we build** on the top of the ground (scrollY 0, ground at the top), focus on `#roots`; **Claim your star** on the closing buttons, F1 and F2 both whole on screen (scrollY 3304 desktop, 3125 phone), focus on "Claim your star", no dialog; **Contact me** on the closing buttons and then `contact-dialog` open with focus in its first field. The direction asked of the flash: from the sky to anything on the ground `down`; from the Roots to the sky `up`; inside the Roots `up` to the top and `down` to the closing buttons; sky to sky `none`. The menu closes. The flash with the swap in it: 430–447 ms, except arriving on the ground from the sky: 581 ms on the desktop and 497 ms on the phone (the frame in which the whole network is drawn is held at the peak, about 150 and 65 ms). Looked at: `refs/transitions/compare/teleport-desk.jpg`, `teleport-phone.jpg` (`node tools/transitions/strip.mjs --only teleport`): for each of the eight walks at each size, the flash before, at and after its peak, and the landing. At the peak nothing of the old or the new section shows. |
| B7, the meaning written in light | **Round 3, 22 Nov (fixes.txt, "ROUND 3", piece 2): a screen under 450 px high (a phone on its side) has its own placing: the phone's type and scoring, the far figures' points counted as stars, the words free to stand beside the figure; all twelve touch nothing at 844×390, 667×375, 740×360, 932×430, at 24 px but Leo's at the two narrowest. On a short upright phone the search tries three rows at every size and smaller type before it takes a place that touches anything: Leo's meaning at 375×667 is three rows at 18 px, touching nothing (it lay across two stars and three lines). Under 450 px of height the next figure's words are first seen at 0.58 of their station size (`seenAt`), so they no longer stand faint against the station's own. At 1440×900 and 390×844 every meaning is where it was, box for box (`b7-all.txt` and `meaning.txt` the same to the byte). `b7.mjs` 60 of 60 at five sizes, `meaning.mjs` 38 of 38, `meaning-all.mjs` 24 of 24; `b7-all-desk.jpg` and `b7-all-phone.jpg` rebuilt on 23 Nov and both looked at.** **Round 2, 22 Nov (fixes.txt, "ROUND 2", pieces 3 and 4): on the phone the words stand by their figure, all twelve, at 24 px, a long line in two rows (they stood under it at 21 px); on the desktop the search also counts the points of the four figures further on: 0 points on the words at all twelve (31 before), all still 54 px. `b7.mjs` 24 of 24, `meaning.mjs` 38 of 38, `meaning-all.mjs` 24 of 24; `b7-all-desk.jpg` and `b7-all-phone.jpg` rebuilt on 22 Nov, the phone's looked at.** **built.** `src/experience/sky/meaning.ts` (new), its styles in `src/components/scenes/Sky.astro`, three lines in `src/experience/sky/index.ts` and one field in `hooks.ts` to mount it and show it to the tools (`sky.meaning.state()`); it reuses `src/experience/loader/lightning.ts`. **What happens:** when every star of a figure is lit (the sky's own lit set, watched live through the claims store and the `ignite` event) the figure gets one element in `#sky-ui` holding its `meaning` from `src/content/constellations.ts`; Leo's also holds `FINAL_LINE` on a second line. It is written the first time the visitor is at that figure's station with it complete (or when it completes while they are there, once the camera has let the star go): a jagged bolt runs from the figure's nearest star to each letter in turn, the letter's outline burns white-blue on a canvas, and the live letter appears white-hot and cools in 1 s to brass lit from above with a thin blue line inside it (the same letter in the regular weight, pared to a line). A line takes about 1.5 s (0.05 to 0.11 s a letter); the final line has its own beat, 1.15 s later. Afterwards, in that visit, the words are simply there, and they stay with the figure: they stand at a point of its plane and are drawn at the plane's scale, coming up out of the distance with it. Where they stand is chosen at the station pose. From 1024 px wide the line is set at 54 px (smaller only if the figure leaves no room) and placed by its figure: in the freest room inside or beside the figure's own bounds that covers no star, no star's button and no line of the figure, clear of the logo and well above B11; only if there is none, in the band under the figure. Narrower: the free band nearest the figure's foot, 34 px, or 21 px at or under 720 px wide; shrunk to fit the width if it must. (Rebuilt by the fixer on 21 Nov: fixes.txt, look 2 and look 8.) Reduced motion: no writing, the words are there. The sky starts empty, so at launch nothing is written. | `node tools/sky/meaning.mjs` (claims seeded in `localStorage` for all 4 stars of Aries and all 9 of Leo; the camera stood at the figure with `sky.debug.setCoord`; real GPU, real time, both sizes): 38 checks, all passing (`refs/sky/compare/meaning.txt`): no star lit, no meaning anywhere; with both figures seeded nothing is written or shown at launch on Virgo; on arriving the meaning is being written; the words are exactly "the Lamb", and "the Lion of the tribe of Judah" then "Jesus is King."; a screen reader gets each line once (the letters that are seen are `aria-hidden`); whole on screen (Aries 262×70 px desktop, 102×27 px phone; Leo 816×163 px and 318×63 px); they cover none of the 4 and 9 star buttons, nor B11, nor the chrome, and take no pointer; once written the lightning's canvas is gone; flying on and coming back writes nothing twice; with three of Aries' four stars lit there is nothing, and lighting the fourth while there writes it; reduced motion with Virgo complete: "the virgin birth" is simply there. Sheets in `refs/sky/compare/`: `meaning-aries-desk.jpg`, `-phone.jpg`, `meaning-leo-desk.jpg`, `-phone.jpg` (twelve moments of the writing each), `meaning-settled.jpg` (written, both sizes, and the words enlarged), `meaning-still.jpg` (reduced motion). Looked at: `meaning-leo-desk.jpg` and `meaning-aries-phone.jpg` in their final form; `meaning-leo-phone.jpg` one round earlier (when the bolt still went to the first letter only); `meaning-settled.jpg` before the last change to the blue line's colour. `meaning-aries-desk.jpg` and `meaning-still.jpg` were not looked at. The sky's own 201 checks were run again with B7 and the transitions in (`node tools/sky/measure.mjs`; one check's wait was lengthened: pressing B11 now takes 2.2 s to reach the Roots, not a 0.5 s fade). **Different from the spec:** the lightning runs along each glyph's outline as a burning stroke of the letter itself and a bolt to it, not as a jagged path traced round the outline; the blue line set in a cooled letter is about a pixel wide at 54 px and under a pixel at the phone's 21 px, where it reads as a cool glint in the brass. The cooled letters are the site's brass (sampled #9e8473 to #a18675 from screenshots at every figure, both sizes; "studio" samples #a38264 the same way). **All twelve figures** were photographed with every star seeded and looked at at both sizes on 21 Nov (`node tools/sky/meaning-all.mjs`: `b7-all-desk.jpg`, `b7-all-phone.jpg`, `b7-all.txt`; 24 of 24: every meaning whole on screen, touching no star's button, not the logo, not B11). **Not done:** a real send completing a figure was not walked end to end (the store's `recordSent` was called from the page); not seen on a real phone; a screen reader was not run (the accessibility tree was read by script). |
| The star-data credit | **done**: `public/credits.txt`, served at `/credits.txt`: the credit sentence (the `credit` field of `scripts/data/sky.json`, word for word) and d3-celestial's BSD 3-Clause notice. Nothing on the page links to it (the site has no footer and no words in the sky). | The notice was fetched on 20 Nov 2026 from that project's own file, `https://raw.githubusercontent.com/ofrohn/d3-celestial/master/LICENSE` (HTTP 200, 1480 bytes, "Copyright (c) 2015, Olaf Frohn"), and `diff` shows the file's lines 5 to the end identical to it but for a newline added at the very end. `pnpm build` copies it to `dist/credits.txt`; the dev server answers `/credits.txt` with 200, `text/plain`. |
| Final verification | **done on 21 Nov** (two inspectors' reports, the fixer's pass, every suite run again); **the second look that evening, and round 2 of fixes on 21 and 22 Nov, done; the third look on 22 Nov (every scene done at the owner's two sizes) and round 3 of fixes on 22 and 23 Nov, done; the fourth, narrow look on 23 Nov (no blocker, nothing major, two minors); round 4, one bounded fix for the first of them, done on 23 Nov; PUBLISHED on 23 Nov at 14:14 (`main` at `c66bb73`; "Exact next step", item 3); the fifth, narrow look at round 4's one fix done (no blocker, nothing major, three minors); the owner's changes of 23 Nov built, tested and published at 15:50 (item 5)** | See the section "Final verification" above (its part "Round 3" has every number as of 23 Nov), and `refs/verification/fixes.txt`. The protected-systems diff prints nothing at the head of round 3; `pnpm build`, `pnpm test` (174 of 174), `pnpm lint`, `pnpm typecheck` pass. |

Nothing is parked any more: every piece in this table is in `src/` and runs on the page. The sections below the table are the builders' own accounts, written on 19 and 20 Nov; where the fixer changed something on 21 Nov the table above and `refs/verification/fixes.txt` say so, and they win (so too for rounds 2 and 3: where those sections say a landscape phone was not looked at, or describe the knots' rule as the upright phone's, the Sky and B7 rows above are the present state). The
"walk-through" some rows cite (`refs/foundation/walk/`) was made over the placeholder scenes
of the foundation and is evidence for the core only.

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
- Without JavaScript the page is the logo, the menu button and its four links (a native
  popover), the five tiles and two links to `/contact` (`html:not([data-scene])`; anything
  that needs script is marked `data-needs-js`).
- The transitions are in `src/experience/director.ts`, in the block marked "THE FULL
  CHOREOGRAPHY": `fall()` (B11 pressed), `warp()` (E6 pressed, or a star claimed from the
  ground), `flash()` (a menu teleport). One runs at a time; a request made meanwhile is
  ignored. Each has a plain fade as its reduced-motion form and as its fallback when a part
  is missing. The effects they play are `src/experience/fx/` (one canvas, z 30).
- Debug: `?scene=sky|roots|loading`, `?t=3.2` freezes the loader (past 6.2 it runs on into
  the hand-off: `t=6.975` is halfway through A5), `?rm=1` forces reduced
  motion, `?debug` puts the live stage on `window.__cellestial`.
  (After round 2 `?scene=sky`, `?scene=roots` and `?rm=1` each raised three console warnings,
  the loader's pictures "preloaded but not used": never a visitor's path, and gone since round
  3, piece 3, which asks for those pictures only where the loader plays. Nothing to chase:
  `refs/verification/round-3/tools/preload-console.mjs` gives 0 messages in 18 cases.)
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
6. The loader ends as the "star-drop": the little star breaks into nine pieces of its own
   brass, which fly to the sky's three rings and become them, while the letters, lit a little by
   the star and still brass, sink and are gone (rebuilt on 21 Nov). The loader draws the pieces
   and a soft swell of light at the core; the star's core and rings are the sky's.
7. Brass words use the lit faces of the wordmark's letters (`--color-brass-text`); the median
   brass is too dark to read as type.
8. "$990 slashed → FREE": the price is struck through; the word "slashed" stays in the text
   for screen readers, hidden from sight.
9. The star-data credit (Yale Bright Star Catalog; d3-celestial) lives at `/credits.txt`, which
   nothing on the page links to: the old site showed it in a footer, and the new one has no
   footer and no words in the sky.

11. The fall: every star strikes the ground with its own burst (since 21 Nov; before that one
    did), the stars of the figures further on as small glints (22 Nov, round 2), and the
    first also starts the growth. The soil rises to 32% of the screen to meet them, then
    the view goes down with the light: 2.2 s in all. The sky's buttons (B11 among them) go as
    soon as it is pressed, and E6 is not on the ground until the visitor has arrived.
12. The warp: 1.5 s, from wherever the page is scrolled; the ground is seen dropping away
    under the streaks for the first second, then the flare covers the swap. The same warp
    carries the visitor up after a star is claimed from the ground.
13. The chrome: the logo is a link home, which on this page means "The Sky" (it plays the
    teleport flash like the menu item). It is 48 px tall on a phone and 60 px from 768 px
    wide. The menu drops from the button, beside the word "studio", not under the logo.
14. B7: on a wide screen the words stand by the figure, in the freest room inside or beside
    its bounds; on a narrow one under it (the free band nearest its foot that covers no star,
    button or line); they are written when the visitor is at the figure's
    station, also if they are flying through it at that moment; a figure completed far away
    is written when they first come to it. Type 54 px from 1024 px wide (placed by the
    figure), 21 px on a phone (under it). "Jesus is King." is a second line under Leo's
    meaning, in the same type, written 1.15 s after it. (22 Nov, round 2: on a phone the
    words now stand by the figure too, at 24 px, a long line in two rows; on the desktop the
    search keeps clear of the points of the figures further on as well. 22 Nov, round 3: see
    23 for a screen under 450 px high; on a short upright phone a line may take three rows
    and type down to 18 px before it takes a place that touches anything.)
15. `/credits.txt` is linked from nowhere on the page.
16. (21 Nov) The loader's full version plays the reference's 6.2 s in 5.6 s (1.107 times its
    speed, every beat alike), so that with the 1.5 s hand-off it takes 7.1 s when nothing is
    late and stays inside 6 to 8 s on a slow device and a slow line. A run that is late
    shortens its hand-off (never under 1.1 s) and then hurries the script (35% at most).
17. (21 Nov; **reversed in part on 22 Nov, round 2, piece 3**) On a portrait phone the stars are
    sized for the hand and not by the figure's fit (13 px at least). What followed from "north
    stays up" no longer holds: Cellestial's star was forced to 130 px with Virgo's four nearest
    stars drawn over its rings, and the dense figures' stars overlapped. Now the six wide figures
    (Virgo, Capricornus, Aquarius, Pisces, Aries, Leo) are turned a quarter counter-clockwise on a
    portrait screen (north to the left, the star pattern unchanged), Cellestial's star is its world
    size there (97 px at 390 wide) and clear of every star, and stars that would cover each other
    by more than a third are drawn smaller. `PORTRAIT.turn` in `src/experience/sky/config.ts` is
    the one switch back.
18. (21 Nov; the picture made again on 22 Nov, round 2, piece 4) An empty star at its station
    is drawn from a derived picture of B4 with its brass traces filtered to what a star of 36
    to 58 px can show and lifted (the pack's are a hair wide and cannot be seen at 40 px;
    thickened one by one they closed up into blotches); flown in on, it is the pack's own
    picture.
19. (21 Nov; 22 Nov, round 2, piece 4) The browser-tab icon is the emblem on black: at 180 px
    as the logo has it, at 16 and 32 px the pack's fully lit emblem cropped to the C and
    lifted until its brass shows.
20. (21 Nov) While the loader plays a screen reader is told "Loading. Press any key to skip.",
    and the page has a hidden heading, "Cellestial studio". Neither is seen.
21. (22 Nov, round 2, piece 3) **The quarter-turn on the phone.** The spec says real star
    patterns and is silent on which way up. On a portrait phone six of the twelve (Virgo,
    Capricornus, Aquarius, Pisces, Aries, Leo) are drawn turned a quarter counter-clockwise,
    north to the left, as each stands when it rises; the pattern itself is untouched and the
    desktop is as it was. It is what clears Cellestial's star and lets the wide figures fill
    the screen (see 17). One switch: `PORTRAIT.turn` in `src/experience/sky/config.ts`. For
    the owner to be told.
22. (22 Nov, round 2, piece 2) The loader's 6 to 8 s is counted on the visitor's clock, from
    the first paint of the unlit C, not from the moment the script starts. (Made more exact
    on 23 Nov: see 26.)
23. (22 Nov, round 3, pieces 1 and 2) **A phone held on its side.** The spec judges two sizes
    and says nothing of a screen 360 to 430 px high. There the figures stand upright (nothing
    is turned), the room kept under them is the exit button's own (its top and 12 px, where it
    was a fifth of the height), a figure that cannot be drawn smaller stands its foot 12 px
    above the button, Cellestial's star is its world size (67 to 80 px, not the upright
    phone's 84), and the meanings stand beside their figures at the phone's 24 px. For the
    owner to be told.
24. (22 Nov, round 3, piece 1) Two stars that would stand more than a third into each other
    are drawn smaller on every screen, and a star of Virgo that would stand within 2 px of
    Cellestial's rings likewise (both were the upright phone's rules only). At 1440×900 this
    thins the two stars at Taurus's western end (19 px to 12.5 px) and nothing else; a star is
    never drawn under 6 px in radius, so on a phone on its side that pair remains a close
    double.
25. (22 Nov, round 3, piece 2) "claim yours" stands under its star (B9), unless a meaning's
    words are within 40 px of that place: then it stands above, right or left of the star.
    The label gives way, never the meaning.
26. (23 Nov, round 3, piece 3) The loader's clock starts when the unlit C is first SEEN (the
    later of the browser's first paint and the frame the page showed it whole in), and the
    page keeps the C unseen until its file is whole. On a fast line nothing changes. On slow
    4G the screen is black until 1.8 s and the sky comes 9.1 s after navigation (it came at
    8.3 s, of which the first second was a black screen counted as loader). A press made
    before the loader's script has arrived is a skip. For the owner to be told; the place to
    change it is `LATE` and the plan in `src/experience/loader/timeline.ts`.
27. (23 Nov, round 4) "claim yours" gives way to a star as it does to a meaning (call 25).
    The spec says "underneath" (B9), and under its star is where it stands wherever that place
    is free: 4 px clear of every other star's disc as drawn, clear of Cellestial's star to the
    reach of its rings, its letters 16 px inside the screen, 40 px from a meaning, off the
    logo, the menu and the exit button. Where under is not free, the first free place beside
    the star, tight to it: right, left, above, the four corners, the places between. Where
    none is free, the place that covers least of the stars. A far figure's point does not by
    itself move the words. Never across Cellestial's star: a star whose words could stand
    nowhere else is not offered by a tap (three stars, Virgo complete, desktop). While the
    sky moves (the Home key's glide) the words keep the place they have. The rule and its
    numbers are in `src/experience/sky/claim-label.ts` (`LABEL`, `LABEL_SPOTS`).

10. Sky, part B: eleven smaller calls, listed at the end of "Sky, part B" (the colour of the lit
    edges, what a tap does when every star in front is lit, the panel's width, and so on).

## What is in refs/ and tools/

- `refs/loading-video/` — the reference video as frames (`f12/`, 12 per second, time printed on
  each) and contact sheets. `refs/asset-sheets/` — the pack's pictures at a glance.
- `refs/asset-qa/`, `refs/constellations/`, `refs/foundation/` — evidence for the finished pieces.
- `refs/alignment/` — the harness report and overlays. `refs/fx-wip/` — the effects builder's own
  captures; `refs/fx/compare/` — the effects layer's sheets and `measure.txt` (written by
  `tools/fx/compare.mjs`, which needs the test page `/dev/fx`: read its header).
- `refs/transitions/compare/` — the fall, the warp and the teleports as strips of frames (written by
  `tools/transitions/strip.mjs`); `refs/transitions/measure.txt` — their rules in numbers (written by
  `tools/transitions/measure.mjs`; a run of one part replaces that part's lines and keeps the rest).
- `refs/chrome/compare/` — the chrome's four sheets and `measure.txt` (written by `tools/chrome/compare.mjs`).
- `refs/sky/compare/meaning-*.jpg` and `meaning.txt` — B7 (written by `tools/sky/meaning.mjs`).
- `refs/verification/` — the inspectors' reports and the fixers' record (`fixes.txt`).
  `refs/verification/round-2/` — round 2: `tools/` (the second look's scripts, ready to run on
  the production build on port 4615, and the fixers' own), a folder of output for each thing
  looked into, `logs/` (the last full run of every suite). `tools/run-all.sh [folder]` runs
  every suite and sheet tool against the dev server with a log each and a `status.txt`.
  `refs/verification/third-look.txt` and `third-look/` — the third look and its evidence
  (nobody changes that folder). `refs/verification/round-3/` — round 3: `tools/` (the third
  look's scripts and the fixers' own, ready to run on the production build on port 4615;
  `lib.mjs` there knows the sizes and `R3_OUT`, a folder to write to; `close-out.sh` runs
  the close-out's list in order; `sheets-same.mjs` sets rebuilt sheets beside a commit's),
  `logs/` (the last full run of every suite), `piece-4/` (the close-out's production runs),
  and the earlier pieces' evidence (`before/` is the build as the third look found it).
- `tools/roots/lib.mjs` is what the newer tools share: the browser at the judged sizes, and contact sheets.
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
  There is no `wip/` any more: nothing is parked.

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
- 2026-11-20 — The arrival and the return, step 4: the menu walked to all four destinations from the
  sky and from the Roots at both sizes with the real flash in; 80 checks, sheets looked at.
- 2026-11-20 — The chrome (C1 to C3) replaces its placeholder: the emblem at rest with "studio", the
  three brass bars, the menu in the site's small panel; 48 checks, four sheets looked at; the
  teleports walked again through it.
- 2026-11-20 — B7: a complete figure's meaning is written over it by lightning, letter by letter, and
  cools into brass; "Jesus is King." follows Leo's. 38 checks, strips at both sizes looked at;
  the sky's own checks run again.
- 2026-11-20 — The credit: `/credits.txt` carries the star-data credit and d3-celestial's licence,
  fetched from that project.
- 2026-11-20 — The tidy: the effects layer's test page and its driver removed (last in `8385356`),
  the empty `wip/` gone; the fall and the warp measured once more afterwards (64 checks) and a
  first visit run clean at both sizes. The protected-systems diff prints nothing. Next is
  final verification.
- 2026-11-21 — Final verification. Two inspectors' reports (`refs/verification/`), then the
  fixer's pass: 10 commits from `a6aa32b` (the fall) to `c211d9e`. Fixed: the
  fall, A5, the loader's timing, B7, the empty star, the phone's sky, the flash, the logo, the
  tab icon and the minors; left for the owner: code 3, 4, 5, 8, 13 and look 18. Every suite
  was run again after the last change and the protected-systems diff prints nothing.
- 2026-11-21 — The close-out, by the orchestrator (the fixer was cut off by the usage limit at
  11:42): the last run's sheets and measures committed; its logs and the inspector's scripts'
  rerun kept in `refs/verification/after-fixes/`; the effects' own sheets rebuilt from the
  current code; the one failing opening of the contact-flow script traced to Cloudflare's
  Turnstile script not arriving, not to the site (three more runs 126 of 126; a held request
  reproduces the recorded state exactly). Build, lint, type-check and tests pass at `c211d9e`.
  Next: the second look, then the owner's decisions and the question of publishing.
- **21 Nov, evening — the second look, and round 2 begun.** An independent inspector went
  back over the site after the fixes (`refs/verification/second-look.txt`, commits `f7c0321`
  to `dcedab9`; no file of the site changed). Thirteen of the first look's nineteen findings
  resolved, five partly, one untouched (from the pack); nothing worse. No blocker. Three
  majors: the fall's light is cut off in one frame (a cap on bursts shifts live ones out), the
  sky draws one frame without Cellestial's star at the end of the hand-off in about half of
  visits, and on a phone four of Virgo's stars sit on Cellestial's rings. Eleven minors. The
  orchestrator traced the blink to a rounding overshoot (see "Exact next step", piece 2) and
  computed with the layout's own code what a quarter-turn buys each figure on a phone
  (piece 3). Round 2 set up: the briefs (`refs/briefs/fix-round-2.js`), the second look's
  scripts copied for running again (`refs/verification/round-2/tools/`), a runner for every
  suite (`tools/run-all.sh`). Next: the five pieces of round 2, in order.
- **21 and 22 Nov — round 2, all five pieces.** The fall (`b032db7`), three clocks
  (`64a40dc`), the phone's sky (`3cc6ce1`), four minors (`8280bdf`), and the close-out on
  22 Nov (cut off once by the usage limit at 02:16, taken up again at 09:20). The close-out
  changed no file of the site: every suite again (thirteen tools, thirteen `exit 0`; one
  check's way of reading the warp's cover corrected after it failed once, the cover itself
  whole), the second look's scripts on the production build, every scene's sheets and the
  flash's own rebuilt, the protected-systems diff 0 bytes. Next: the third look, then the
  owner's decisions.
- **22 Nov — the third look, and round 3 set up.** One inspector who built none of it, on
  the production build (`refs/verification/third-look.txt`, `8724ef5`; no file of the site
  changed): every scene done at 390×844 and 1440×900, all three of the second look's majors
  and the eight minors round 2 took on resolved, nothing undone. Standing: one major outside
  the owner's sizes (a phone held on its side) and six minors. Round 3 set up (`05c768d`):
  the briefs (`refs/briefs/fix-round-3.js`), the third look's scripts copied for running
  again (`refs/verification/round-3/tools/`).
- **22 and 23 Nov — round 3, all four pieces.** The sky on a phone on its side (`ddac183`),
  where the meanings stand (`44a3032`; cut off once by the usage limit, taken up again), the
  loader's first two seconds on a slow line (`7474c86`), and the close-out on 23 Nov (00:38
  to 02:30). The close-out changed no file of the site and no check: build, tests (174 of
  174), lint and type-check pass; every suite again (thirteen tools, thirteen `exit 0`, every
  count what it was); the third look's scripts on the production build (twenty-three runs);
  the owner's two sizes shown to be what they were (the scripts' output the third look's line
  for line; the rebuilt sheets differing only by the two thinned stars of Taurus in three
  desktop sheets); the protected-systems diff 0 bytes. Next: a fourth, narrow look, then the
  owner's decisions and the question of publishing.
- **23 Nov — the fourth look (02:28 to 06:18; cut off twice, taken up again each time).** One
  inspector on the production build: all seven things the third look left are resolved, the
  owner's two sizes are what the third look ruled done, no blocker, nothing major
  (`f7d5ea4`). Two minors: "claim yours" written across neighbouring stars (older than every
  round; round 4 puts it right) and Taurus's close pair on a phone on its side (left for the
  owner). Next: round 4's one fix, a narrow look at it, the final report.
- **23 Nov — round 4 (one fix; its first fixer cut off by the usage limit, a second went on
  from the record).** "claim yours" gives way to the stars: under its star where free, else
  beside it, never across Cellestial's star, letters 16 px inside (`4ec982f`; call 27). The
  fourth look's scripts on the production build: across another star 25 to 0 and 38 to 2 at
  the owner's two sizes; with a figure complete 66 to 19 and 75 to 22. Found on the way and
  put right: Cellestial's star far off was not among the discs kept clear of; in the Home
  key's glide the words flicked from side to side (they now keep their place while the sky
  moves). The sky's picture unchanged to the pixel; 146 of 146 taps; pnpm test 185; the
  thirteen tools exit 0 (one check of `tools/sky/measure.mjs` changed to ask what the rule
  now is); the protected-systems diff 0 bytes. Left, set down in `fixes.txt`: nine labels in
  knots on the phone, and the far figure's crowd. Next: the narrow fifth look, the final
  report.
- **23 Nov — published (14:14).** On the owner's word `main` was fast-forwarded from `052f82a`
  to `c66bb73` and pushed; the live site served the redesign 69 s later. Gates on `c66bb73`
  first (build, 185 tests, lint, type-check, the protected-systems diff 0 bytes), and a clean
  clone built to the same site. On the live site: five pages 200 and the clean build's to the
  byte but for the real spam-check key, 34 other files byte for byte, the three Workers
  answering on their routes, a visitor's pass at both sizes with nothing sent
  (`refs/verification/live/`). Not done: one real message through the live form (the owner's).
  The fifth look, cut off once by the usage limit, was launched again at the same time.
- **23 Nov — the owner's changes, and the fifth look (14:40 to 16:00).** He saw the live site
  on his phone and asked for five things; all five are built, tested and live ("Exact next
  step", item 5): stars 100 to 146 in his email; the shared sky (a KV store behind the contact
  Worker, the text of a star shown to others only after he approves it); the beads no longer
  start over on a second tap; no two stars touch (the knots' rule replaced); the meanings in
  the addendum. Built in a second working copy while the fifth look ran in this one. The fifth
  look finished at 15:55: no blocker, nothing major, three minors about "claim yours" in the
  tightest knots.
- **23 Nov, 16:00 — a false alarm, set down so that nobody chases it again.** After the last
  push GitHub's check for Cloudflare's build read "completed, failure" for two commits in a
  row (`6e59ba0`, and the empty `4c614ba` pushed to try again), while the same commits built
  from a clean clone here on Node 26 and Node 22. Minutes later both checks read "success" and
  Cloudflare lists both deployments (22:59 and 23:01 UTC). The check flips: read it again
  before believing a failure. The commit message of `4c614ba` says the build failed; it did
  not.
- **24 Nov — the owner's two more.** The star's panel no longer goes under the exit button
  (78 of 438 to 0); the first light after the loader. Both published.
- **24 Nov — the first light's words.** "claim yours" by each star the first light reaches,
  one after another, struck white-hot; published.
