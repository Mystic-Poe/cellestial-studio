export const meta = {
  name: 'cellestial-loader',
  description: 'Build the Loading scene (A1-A5) in its own worktree, compare it frame by frame with the reference video, and fix until it matches',
  phases: [
    { title: 'Build', detail: 'power-up, overload bolt, lightning writing, cool-down, star hand-off' },
    { title: 'Review', detail: 'frame by frame against the reference video; contract, robustness, performance' },
    { title: 'Fix', detail: 'apply findings, re-verify' },
  ],
}

const MAIN = '/home/poe/cellestial-studio'
const WT = '/home/poe/cellestial-wt/loader'
const SCR = '/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad'
const SCRATCH = SCR + '/loader'
const REF = SCR + '/ref'

const PRE = `You are one of several agents building the Cellestial Studio website redesign: an Astro 7 static site (Tailwind 4, pnpm, TypeScript run natively by Node 26, Biome). The site sells websites by being one. The owner's bar: "A visitor should feel in the first ten seconds that whoever built this can build something extraordinary for them."

Your working copy is the git worktree ${WT} (branch wt/loader). Work ONLY inside it, plus the scratch directory ${SCRATCH} for throwaway scripts and screenshots (create it). The main checkout ${MAIN} is being edited by other agents right now: never write there. Read from it only ${MAIN}/claude-vault/redesign/BLUEPRINT.md — the design authority for how the pieces meet; read it first. The spec is BUILD_SPEC.md and SPEC-ADDENDUM.md in your worktree (the addendum wins on conflict); read the line ranges your task names, not the whole file.

Hard rules:
- No git commit, push, checkout, stash, reset, clean, merge or rebase. The orchestrator commits.
- Edit only the files your task says you own. In particular do not edit package.json, src/experience/contracts.ts, src/experience/tokens.ts, src/experience/assets.ts, src/pages/index.astro, src/layouts/**, src/styles/**. The old homepage (src/pages/index.astro, src/sky/**, src/components/*.astro) is still in this worktree; it is being replaced elsewhere — leave it alone and depend on none of it.
- Never touch the protected paths: workers/**, src/onboard/**, src/scripts/contact-submit.ts, src/scripts/start-flow.ts, src/scripts/start-builder.ts, public/admin/**, src/content/home.json, src/config.ts.
- Imagery: only files derived from cellestial-assets/ (crops, resizes, masks and format changes of the pack images). No generated, stock or substitute images, no icon libraries, no emoji. The reference video is a reference for motion only: it is never shipped, embedded or played. No sound of any kind: no audio element, no AudioContext.
- Invent no copy. This scene has no words at all.
- Code style is Biome (tabs, single quotes, semicolons, width 100): run "pnpm exec biome check --write <your files>" before finishing and fix what it reports.
- If an approach fails twice, abandon it and take another route instead of stacking fixes.
- Dev server: "pnpm astro dev --port <YOUR PORT> --ignore-lock" as a background process from the worktree; kill it when you finish ("fuser -k <PORT>/tcp"). Never use port 4321.
- Screenshots: playwright-core is installed in the worktree; system Chromium is /usr/bin/chromium (headless). From a script outside the worktree, load it with createRequire('${WT}/package.json'). Look at every image you produce with the Read tool (downscale anything larger than about 1600 px to JPEG first with sharp or ImageMagick — "magick in.png -resize 1600x1600\\> out.jpg"). "It rendered" is not verification; "I looked, and it matches the reference" is.
- Your final message is a report to the orchestrator, not to a human: files written, how each element is drawn, the measured timeline, what you ran and saw, and every known gap against the reference, stated plainly. Never claim something works unless you ran it.
`

const WHAT = `THE SCENE — Loading (spec elements A1 to A5).

The owner's test for this scene, verbatim: "Loading: the C powers up, electricity writes "Cellestial" and cools to brass-and-blue, 6–8s (never under 6), skippable by tap/click/key, short version on same-session return. It must feel like the reference video in the assets, not an approximation of it." And for reduced motion: "no flight, no loader sequence."

Read: BLUEPRINT.md sections 1 to 4 and 6 to 9 (note "Mounting", "Scene test pages" and "A5 hand-off"). BUILD_SPEC.md lines 10-29 (global rules), 75-101 (section A) and 112-116 (B3, which A5 hands over to). SPEC-ADDENDUM.md lines 5-8 and 20. src/experience/contracts.ts — LoaderScene, LoaderOptions, MountLoader, SceneContext, ScreenCircle, and the three intro methods of SkyScene (introPrime, introProgress, coreCircle) with their comments: that is the hand-off contract. src/experience/assets.ts — ASSETS.loader.cUnlit, cLit, wordmark and ASSETS.sky.b3Core, b3Ring: URLs, pixel sizes and measured geometry (the C box, the main node, the wordmark box, the emblem inside it, the star above the "i", a tight box for each of the nine letters). src/experience/tokens.ts — the sampled palette.

THE REFERENCE. cellestial-assets/images/a-loading/A2-A3_power-up-and-lightning-writing.mp4 (1920x1080, 24 fps, 8.04 s; it has an audio track — ignore it). Already extracted for you at 12 fps with the time burned into each frame: ${REF}/f12/f_001.png ... f_097.png (640 px wide; frame n shows time (n-1)/12 s) and six contact sheets of 16 frames each, ${REF}/sheet12_0.jpg ... sheet12_5.jpg. Look at all six sheets before you design anything. Pull more frames at full resolution with ffmpeg whenever you need detail (ffmpeg -ss 3.0 -i <the mp4> -frames:v 1 out.png).

The orchestrator's reading of the reference (the frames are the truth; correct this where it is wrong):
- 0.00-0.25 the unlit brass C alone, centred on black, about 80% of the frame height.
- 0.33-0.50 the main node (the large round node at the C's lower-right tip) wakes: a blue-white point, then a glow.
- 0.50-1.58 a blue-white neon line travels from the main node BACK through the C's circuits, lighting nodes as it passes: first strut at 0.58, bottom node 0.67, the left-most node at 1.00 with the whole lower half lit, the upper-left node 1.25, the top node 1.33 (peak glow), the upper-right tip node at 1.58.
- 1.58-1.92 the lines cool back towards brass; the main node holds its light longest.
- 2.00-2.83 charge builds: a flickering crackle of small arcs at the main node.
- 2.92-3.42 OVERLOAD: one thick jagged bolt from the top edge of the frame (x about 62% of the width) down to the node; white bloom at the node; a blue wash over the right half of the frame; a shower of sparks. 3.50 a thin residual filament; 3.58 gone.
- from about 3.6 the camera pulls back and pans, so the C shrinks and moves left to become the C of the word.
- 3.67-3.83 lightning arcs out of the node and draws the first "e": a jagged arc that resolves into a clean neon tube (white core, blue halo, small ring nodes at the stroke ends).
- then one letter at a time, about 0.23 s each, each with a crackling head: l 4.00, l 4.25, e 4.50, s 4.75, t 5.00, i 5.17 (the star above the i lights at about 5.25), a 5.50, l 5.67. Small arcs keep playing at the main node throughout, and a soft blue haze sits behind the lit letters.
- 5.67-5.75 the whole word in neon, halo fading. 5.75-6.17 the letters cool into brass with a thin blue circuit line (the A4 look). 6.17-8.04 hold on the finished wordmark, the main node glowing.

WHAT TO BUILD

Files you own: src/experience/loader/** (index.ts must export "mount", typed MountLoader); src/components/scenes/Loader.astro (the <div id="loader"> overlay: fixed, full viewport, z-index 50, black; its markup and CSS); scripts/assets/loader.mjs and its outputs under public/cellestial/loader/ (ONLY if you need further derivations of the pack images, for example a travel-time map of the circuits or per-letter masks; the module contract is described in the header of scripts/build-assets.mjs; run it with "node scripts/build-assets.mjs modules"; a module that needs geometry writes its own .ts next to your code); your test page src/pages/dev/loader.astro and dev-only stand-ins in src/experience/loader/dev/.

Technique: a 2D canvas (raw WebGL for a single effect is acceptable if you can show it is needed; no three.js, no libraries, no video). Everything is drawn from the three loader images plus code-drawn light. Keep the lightning generator in its own module, src/experience/loader/lightning.ts, depending on nothing but a CanvasRenderingContext2D and plain numbers: the Sky's meaning-reveal text (B7) will reuse it to write words in lightning later.

The timeline. Follow the reference one-to-one up to the cooled wordmark at about 6.2 s (A1 to A4), then A5 in about 1.6 s. The full sequence, from first frame to the moment the loader is gone, must take between 6 and 8 seconds — never under 6.
- A1: the unlit C, centred. Also server-render an <img> of c-unlit.webp in Loader.astro at exactly the place and size the canvas will draw it (fetchpriority="high", decoding="async", alt=""), so the emblem is on screen before any script has run; the canvas takes over without a jump.
- A2: the power-up. The spec: "starting at the main node (lower-right tip), blue light travels back through the C's circuits, lighting nodes as it goes, until the main node overloads. Use a path-following mask over the unlit to lit images, timed to the reference video." c-unlit and c-lit are pixel-registered (same 1400x1400 frame), so the lit image can be revealed through a mask that grows along the circuits. One exact way: a travel-time map — for every lit-line pixel, its distance along the circuit network from the main node (a breadth-first flood over the difference between the two images, starting at the node) — then the reveal at time t is every pixel whose travel time is below t, with a hot blue-white head where it equals t. You may precompute that in scripts/assets/loader.mjs or draw it another way; what matters is that the light visibly TRAVELS along the real struts and through the real nodes in the order the reference shows, and that it holds 60 fps on a phone (no per-pixel JavaScript loops over a full-screen canvas every frame).
- A3: charge, overload bolt, the writing. Bolts are jagged polylines (midpoint displacement with a few short branches), redrawn every 30 to 50 ms so they flicker, stroked in layers with additive blending: a wide soft blue, a medium bright blue, a thin white core. The head of the writing bolt travels along each letter's own stroke and leaves a neon tube behind it (white core, blue halo, ring nodes at the ends) exactly over where that letter sits in the A4 image. Each A4 letter already has a thin blue circuit line running along its centre: that line IS the stroke path — derive the nine paths from the image (or author polylines over it and prove them by overlay). As each letter lands it "starts hot blue / blue-white, then cools into the A4 brass letters (crossfade each letter into A4 as it lands)" — in the reference the whole word stays neon until about 5.75 and then cools together over about 0.4 s; match the reference.
- The camera: one similarity transform (scale and translate) carries the whole stage from framing A (the C centred and large) to framing B (the finished wordmark centred). The emblem inside the wordmark and the C sprite are the same render at different scales (ASSETS.loader.wordmark.emblem against ASSETS.loader.cLit.c): map one onto the other exactly and prove the registration by overlay, so that the C the visitor watched power up IS the C of the word, with no jump when the picture becomes the A4 image.
- A4: by the end of the cool-down the canvas shows the A4 wordmark image itself, untouched ("Unified brass, NOT neon"), with a soft living glow at the main node.
- Any viewport. The reference is 16:9. At 1440x900 match its framing. On a portrait phone (390x844) the finished wordmark must fit the width with comfortable margins (about 87% of the width), the opening C is about 62% of the width, and the overload bolt still comes down from the top edge. Landscape phones, tablets and ultrawide screens must also compose sensibly. Use min(devicePixelRatio, 2); recompute on resize and orientation change without restarting the timeline.
- A5, the hand-off (spec: "the little brass star BREAKS APART. Its pieces sweep outward and settle into the B3 rings ... The star's core grows into B3_core_radiant-star.jpg at the centre, and the rings begin spinning. The camera pulls into the sky; the wordmark fades."). There is only ever one B3 and the SKY draws it; you draw the breaking star, the shards and the fading wordmark. Sequence: get the sky with ctx.when('sky') and wait for sky.ready; measure where the little star above the "i" is on screen right now and call sky.introPrime({ x, y, r }) with r a little under half the star's tip radius, so the sky's glowing core sits inside the brass star; let the loader's black backdrop go transparent over about 250 ms (the sky behind is black too, so the only thing that changes is the core glowing through); the star flashes blue-white and breaks into 6 to 9 irregular shards cut from its own pixels in the A4 image; they sweep outward on curved paths, tumbling and glinting; meanwhile you call sky.introProgress(t) every frame with t going 0 to 1 on your clock (ease it); the sky moves and grows its core to the centre of the screen — read sky.coreCircle() every frame — and your shards curve back and home in on a ring around that circle, arriving between t 0.4 and t 0.85, each fading as it arrives while the sky fades its real rings in underneath; and the word falls away: the owner's own description of this moment is "The star above the i BREAKS APART (it does not simply grow). Its shattered brass pieces form RINGS around it ... and its core becomes a glowing radiant star with the brass rings spinning around it. The letters are drowned out by its light and float down — that float-down effect drops the star onto the first layer/pattern. The wordmark letters do not carry into the hero." (the addendum calls it "the hero star-drop"). So as the core ignites, its blue-white light washes over the wordmark (the letters bleach towards the light and lose their brass), and the letters and the C then sink — float DOWN, gently, a little staggered letter by letter — fading as they go, gone by about t 0.6. Nothing swells or zooms; the star is left alone in the sky. At t = 1 hide the overlay (display none), stop your loop, release the canvas, and resolve "done".
- If the sky is not ready when A4 completes: hold on the finished wordmark with the node glow breathing, for at most 6 more seconds; then fade the overlay out anyway and resolve "done". If an image fails to load, or anything throws, the loader must still end and resolve "done" — it may never trap the visitor. And if the script never runs at all, CSS alone must retire the overlay (for example a long-delayed keyframe that hides it, cancelled by a class your script sets on mount).
- Skip (addendum: "tap / click / any key skips straight to the hero star-drop"): any pointerdown, or any keydown except Tab and bare modifier keys, jumps to the start of A5 with the finished wordmark on screen (a 150 to 200 ms settle so it does not pop), and A5 then plays normally. skip() is idempotent and does nothing once A5 has begun.
- The short version (addendum: "Return visits in the same session: short version — C already lit, electricity writes the word fast"): the lit C already in its place in the word, one fast bolt writes the nine letters in about a second, a quick cool-down, a short hold, then A5; about 3 to 3.5 s in all. When opts.mode is not given the loader decides for itself: sessionStorage key "cellestial:loader" is set once a run finishes or is skipped; storage may be blocked — then every visit plays the full version.
- seek(t) and opts.freezeAt: freeze the timeline at t seconds and draw that exact frame. Every random number comes from a seeded generator keyed on the time, so the same t always draws the same picture (the screenshot comparison depends on it).
- The clock: advance by real elapsed time, clamped to 50 ms a frame and paused while the tab is hidden, so a visitor who switches tabs does not come back to a finished show.
- ctx.reducedMotion true: the page does not mount the loader at all; if you are mounted anyway, hide the overlay and resolve "done" at once.
- Performance on a phone: no shadowBlur over large areas; pre-render glow sprites to offscreen canvases; cap the canvas at DPR 2 and step it down (1.5, then 1) if the average frame time over the first second is over about 22 ms.
- Accessibility: the canvas is aria-hidden; the overlay has no focusable content and no words.

The test page src/pages/dev/loader.astro: a standalone page (its own <html>, black body; do NOT use the site layout) that includes Loader.astro and mounts the loader with a STAND-IN sky on a 2D canvas behind the loader, implementing the intro contract exactly as contracts.ts words it: ready (resolves when its images have decoded; "?skyDelay=4000" delays it; "?skyDelay=never" never resolves), introPrime, introProgress (the b3-core sprite, drawn additively, travelling from the primed circle to the opening circle — the centre of the viewport, radius clamp(0.085 x min(width, height), 30, 80) px — three b3-ring sprites at different tilts fading in over t 0.4 to 0.85, a faint brass hexagon pattern fading in over t 0.3 to 1) and coreCircle. Query parameters: t=<seconds> freezes the timeline there; mode=full|short; speed=0.25 plays in slow motion; skyDelay; rm=1. Expose the mounted loader as window.__loader for capture scripts. The stand-in is dev-only: the real sky is being built by another agent against the same contract, so do not rely on anything the contract does not say.
`

const VERIFY = `HOW THIS SCENE IS JUDGED — "A scene that merely renders is not done; a scene that matches its reference is."
1. Frame comparison at 1440x900: for each of these times — 0.0, 0.42, 0.67, 1.0, 1.33, 1.58, 1.83, 2.25, 2.75, 2.92, 3.0, 3.17, 3.33, 3.5, 3.67, 3.75, 3.83, 4.0, 4.25, 4.5, 4.75, 5.0, 5.25, 5.5, 5.75, 6.0, 6.2 — capture the loader frozen at that time and set it beside the reference frame for the same time in comparison sheets (reference on the left, build on the right, the time printed). Read every sheet. Compare: where the emblem is and how big; which circuits and nodes are lit; the bolt's shape, thickness and brightness; the colour and reach of the glow (the blue wash over the right half during the overload); the spark shower; which letters exist and the state of the one being written; the neon tube look; the cooling. The reference is 16:9 and the viewport is 16:10: compare composition, not pixel positions.
2. The same times at 390x844 (deviceScaleFactor 2, isMobile, hasTouch): nothing clipped, the word fits with margins, the bolt still enters from the top edge.
3. A5 at both viewports, at 0, 0.15, 0.3, 0.5, 0.7, 0.9 and 1.0 of its length.
4. Real-time runs with the stand-in sky ready: time from mount to "done" for the full version (must be at least 6.0 s and at most 8.0 s), for the short version, and for a skip at 1 s; and a run with skyDelay=never (must end by itself).
5. The last frame of A4 against the A4 asset itself: by the end of the cool-down it must BE the asset.
6. Frame times over a full real-time run at 390x844, DPR 2, with the CPU throttled 4x (Chrome DevTools Protocol, Emulation.setCPUThrottlingRate): average and 95th percentile.
`

const BUILD = PRE + WHAT + `
YOUR JOB: build it. Your dev-server port: 4501.

${VERIFY}
Do all six yourself and iterate until the comparison sheets look right to a hard judge; an independent reviewer will make the same comparison after you. Save the sheets in ${SCRATCH}/compare/ and name them in your report, with a timeline table (phase, start, end) and the measured durations and frame times.
`

const FINDINGS = {
  type: 'object',
  properties: {
    matches: { type: 'boolean', description: 'True only if, judged hard, the scene is done: it matches its reference and the spec, with nothing left that a careful owner would send back.' },
    verdict: { type: 'string', description: 'One paragraph, plain and specific.' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          summary: { type: 'string' },
          evidence: { type: 'string', description: 'What you ran or saw that proves it: screenshot or sheet path and the time, command output, file and line.' },
          fix: { type: 'string', description: 'The concrete change to make.' },
        },
        required: ['severity', 'summary', 'evidence', 'fix'],
      },
    },
  },
  required: ['matches', 'verdict', 'findings'],
}

const REVIEW_PRE = `You are an independent reviewer of one scene of the Cellestial Studio website redesign. The site sells websites by being one; the owner's bar is: "A visitor should feel in the first ten seconds that whoever built this can build something extraordinary for them." The owner will judge the finished scene against its reference, and "a scene that merely renders is not done; a scene that matches its reference is."

The scene lives in the git worktree ${WT} (branch wt/loader). You are a REVIEWER: do not edit any file in the worktree, do not commit. Put your own scripts and screenshots in the scratch directory you are given. Design authority: ${MAIN}/claude-vault/redesign/BLUEPRINT.md (read it; do not write there).
Dev server: "pnpm astro dev --port <YOUR PORT> --ignore-lock" in the background from the worktree; kill it when done ("fuser -k <PORT>/tcp"). Screenshots: playwright-core from the worktree (createRequire('${WT}/package.json')) with /usr/bin/chromium, headless. Look at every image with the Read tool (downscale anything over about 1600 px to JPEG first).
Report only what you can prove — a screenshot you looked at, a number you measured, a line you read. For every finding give the evidence and the concrete fix. Rank honestly: blocker = the owner would reject the scene for it; major = clearly visible or clearly wrong; minor = polish. Do not pad the list, and do not soften it either: your judgement is the only independent one this scene gets.

`

const reviewVisual = (round, previous) => REVIEW_PRE + WHAT + `
YOUR LENS — does it match the reference? Port 4511. Scratch: ${SCRATCH}/review-visual-${round}/.
The build is finished according to its builder; trust nothing, look for yourself. The test page is /dev/loader (read src/pages/dev/loader.astro for its query parameters).

${VERIFY}
Make all of these comparisons yourself, from your own captures. Then judge as the owner would, sitting the reference video and the build side by side: does the power-up travel through the real circuits in the reference's order and tempo? Is the overload bolt as violent — as thick, as white-hot, with the blue wash and the sparks? Do the letters get WRITTEN by a crackling head, or do they merely appear? Does the neon read as neon (white core, blue halo, ring nodes) and then cool into exactly the A4 brass? Is the C that powered up visibly the same C that ends as the first letter, with no jump? Does A5 read as a star breaking apart and becoming the rings of a greater star, or as a crossfade? Is anything cheap: banding, aliasing, visible rectangles around sprites, popping, a glow that is a flat disc? Is anything on screen that is not brass, blue, white or black?
Also run it in real time (not only frozen frames) and capture bursts of consecutive frames during the overload and during the writing, to judge the flicker and the motion.
${previous ? `
This is review round ${round}. The previous round's findings are below: check each one again (fixed, partly fixed, not fixed) and say so in your verdict, then look for anything new or anything the fixes broke.
PREVIOUS FINDINGS:
${previous}
` : ''}`

const REVIEW_CODE = REVIEW_PRE + WHAT + `
YOUR LENS — is it correct, robust and fast? Port 4512. Scratch: ${SCRATCH}/review-code/.
Read every file under src/experience/loader/, src/components/scenes/Loader.astro, scripts/assets/loader.mjs if it exists, and the test page. Then prove or refute each of these by running something:
- Contract: index.ts exports "mount" typed MountLoader; the returned object is exactly a LoaderScene; the loader reaches the sky only through ctx.when('sky') and uses only ready, introPrime, introProgress and coreCircle, with the semantics contracts.ts words; nothing imports from outside src/experience/loader except contracts.ts (types), assets.ts and tokens.ts.
- Timing: mount to "done" for the full version is at least 6.0 s and at most 8.0 s (measure five runs); the short version; skip at 0.2 s, 1 s, 3 s, 5 s and during A5 (idempotent; nothing after A5 begins); Tab and bare modifier keys do not skip.
- It can never trap the visitor: skyDelay=never ends by itself; a 404 on each of the three images in turn still ends (use request interception); an exception thrown inside the frame callback still ends; with JavaScript disabled or the module blocked, the overlay retires by CSS alone.
- Determinism: two captures at the same ?t= are identical (compare the PNGs).
- Clean-up: after "done" the animation-frame loop has stopped, listeners are removed, the canvas is released and the overlay is display none (inspect in the page).
- Tab hidden mid-run, resize and orientation change mid-run, devicePixelRatio 1, 2 and 3, a 320 px wide viewport, a 2560x1080 viewport, a landscape phone (844x390).
- sessionStorage blocked (throwing) does not break anything.
- Performance: frame times over a full real-time run at 390x844 DPR 2 with the CPU throttled 4x; anything in the frame path that allocates heavily or loops over pixels; total bytes of the loader's JavaScript after "pnpm build" (find its chunk) and of the images it loads.
- No sound anywhere; no network request other than the page's own assets; nothing outside the ownership list was edited ("git status --short" in the worktree: only the files this scene owns).
- "pnpm build" passes and "pnpm exec biome check" is clean on the scene's files.
`

phase('Build')
const build = await agent(BUILD, { label: 'build the loader', phase: 'Build' })

const rounds = []
let previous = ''
for (let round = 1; round <= 3; round++) {
  phase('Review')
  const thunks = [() => agent(reviewVisual(round, previous), { label: `visual review ${round}`, phase: 'Review', schema: FINDINGS })]
  if (round === 1) thunks.push(() => agent(REVIEW_CODE, { label: 'code review', phase: 'Review', schema: FINDINGS }))
  const reviews = (await parallel(thunks)).filter(Boolean)
  const all = reviews.flatMap((r) => r.findings)
  const serious = all.filter((f) => f.severity !== 'minor')
  log(`Round ${round}: ${all.length} findings, ${serious.length} serious; matches=${reviews.map((r) => r.matches).join(',')}`)
  const entry = { round, reviews }
  rounds.push(entry)
  if (!all.length) break
  if (round === 3 && !serious.length) break
  phase('Fix')
  entry.fix = await agent(PRE + WHAT + `
YOUR JOB: fix the review findings on the loader that another agent built. Your dev-server port: 4521. Scratch: ${SCRATCH}/fix-${round}/.

Read the scene's code first (src/experience/loader/**, src/components/scenes/Loader.astro, src/pages/dev/loader.astro). The findings are below as JSON. For each: reproduce it; if it is real, fix it at the root; if it is not real, say exactly why. Fix every blocker and major, and every minor that is cheap and clearly right. Where a finding says the scene does not look like the reference, do not tweak a constant and hope: capture the reference frame and your frame side by side, find what actually differs, change it, capture again, and repeat until a hard judge would accept it. If the current way of drawing something cannot reach the reference, replace it.
Then re-verify the whole scene, because fixes break things:
${VERIFY}
Report per finding: fixed (how, and the sheet that shows it) / not real (why) / not fixed (why, and what you tried).

FINDINGS:
${JSON.stringify(all, null, 1)}
`, { label: `fix round ${round}`, phase: 'Fix' })
  previous = JSON.stringify(all, null, 1)
  if (!serious.length) break
}

return { build, rounds }
