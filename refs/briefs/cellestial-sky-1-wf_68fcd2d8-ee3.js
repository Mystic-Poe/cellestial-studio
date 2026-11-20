export const meta = {
  name: 'cellestial-sky-1',
  description: 'Build the Sky world in its own worktree: lattice, B3, real constellations, flight, intro, fall; review against spec and assets; then beads and picking',
  phases: [
    { title: 'World', detail: 'lattice, B3, constellations, stars, flight, intro, fall, governor' },
    { title: 'Review', detail: 'against the spec and the pack assets; contract, input, performance' },
    { title: 'Fix', detail: 'apply findings, re-verify' },
    { title: 'Beads', detail: 'B8 beads along the lattice, B9 pulse, picking flow' },
  ],
}

const MAIN = '/home/poe/cellestial-studio'
const WT = '/home/poe/cellestial-wt/sky'
const SCR = '/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad'
const SCRATCH = SCR + '/sky'

const PRE = `You are one of several agents building the Cellestial Studio website redesign: an Astro 7 static site (Tailwind 4, pnpm, TypeScript run natively by Node 26, Biome). The site sells websites by being one. The owner's bar: "A visitor should feel in the first ten seconds that whoever built this can build something extraordinary for them." The Sky is that proof.

Your working copy is the git worktree ${WT} (branch wt/sky). Work ONLY inside it, plus the scratch directory ${SCRATCH} for throwaway scripts and screenshots (create it). The main checkout ${MAIN} is being edited by other agents right now: never write there. Read from it only ${MAIN}/claude-vault/redesign/BLUEPRINT.md — the design authority for how the pieces meet; read it first. The spec is BUILD_SPEC.md and SPEC-ADDENDUM.md in your worktree (the addendum wins on conflict); read the line ranges your task names, not the whole file.

Hard rules:
- No git commit, push, checkout, stash, reset, clean, merge or rebase. The orchestrator commits.
- Edit only the files your task says you own. In particular do not edit package.json, src/experience/contracts.ts, src/experience/tokens.ts, src/experience/assets.ts, src/content/**, src/pages/index.astro, src/layouts/**, src/styles/**. The old homepage (src/pages/index.astro, src/sky/**, src/components/*.astro) is still in this worktree; it is being replaced elsewhere — leave it alone and depend on none of it (you may READ src/sky/quality.ts, a tested frame-time governor, and adapt its idea inside your own folder).
- Never touch the protected paths: workers/**, src/onboard/**, src/scripts/contact-submit.ts, src/scripts/start-flow.ts, src/scripts/start-builder.ts, public/admin/**, src/content/home.json, src/config.ts.
- Imagery: only files derived from cellestial-assets/ (crops, resizes, splits, keys and format changes of the pack images). No generated, stock or substitute images, no icon libraries, no emoji. Light drawn by code (glows, lines, beads, trails) is code, not imagery. No sound of any kind.
- Invent no copy. The sky has no visible words in this stage.
- Code style is Biome (tabs, single quotes, semicolons, width 100): run "pnpm exec biome check --write <your files>" before finishing and fix what it reports.
- If an approach fails twice, abandon it and take another route instead of stacking fixes.
- Dev server: "pnpm astro dev --port <YOUR PORT> --ignore-lock" as a background process from the worktree; kill it when you finish ("fuser -k <PORT>/tcp"). Never use port 4321.
- Screenshots: playwright-core is installed in the worktree; system Chromium is /usr/bin/chromium, headless. WebGL works in software by default; add the launch arguments --use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu to render on the machine's real GPU (do that when you judge the look or measure smoothness). From a script outside the worktree, load playwright with createRequire('${WT}/package.json'). Look at every image you produce with the Read tool (downscale anything larger than about 1600 px to JPEG first — "magick in.png -resize 1600x1600\\> out.jpg"). "It rendered" is not verification; "I looked, and it matches the asset and the spec" is.
- Your final message is a report to the orchestrator, not to a human: files written, how each element is built, the numbers you measured, what you ran and saw, and every known gap, stated plainly. Never claim something works unless you ran it.
`

const WHAT = `THE SCENE — the Sky (spec section B, and G1).

The owner's test, verbatim: "Sky: endless 3D flight through the 12 constellations in the spec's order, real star patterns, faint brass honeycomb the light-beads actually travel. Sky starts empty except Cellestial's star. Any empty star is pickable; a star is claimed only when a build request is sent, then stays lit; a lit star shows exactly what was asked, nothing added. "See what holds up the sky" appears only after one full round. Flight is smooth on a phone — if frame rate drops, scale effects down automatically rather than shipping jank." And: "prefers-reduced-motion gets a still sky with the exit button already present — no flight". The spec's setting: "pure black deep space, endless 3D depth, still and silent, no text except where noted."

Read: BLUEPRINT.md in full. BUILD_SPEC.md lines 10-29 (global rules), 60-67 (scene flow), 103-158 (section B), 180-188 (D1 and D2, the fall) and 241-249 (section G). SPEC-ADDENDUM.md lines 10-20. src/experience/contracts.ts — SkyScene (every method and its comment), ClaimsStore, Claim, ClaimsEvent, SceneContext, MountSky, ScreenCircle, SlotId. src/content/constellations.ts — CONSTELLATIONS: the twelve figures in flight order; each star has x, y in the figure's unit box (+x right, +y up, north up and east left as in the night sky), mag (lower is brighter), and its slot; lines are index pairs; Virgo has "epicentre", the index of the star that Cellestial's own star (B3) replaces (it has no slot and cannot be claimed); helpers slotToStar, starToSlot, isSlotId. src/experience/assets.ts — ASSETS.sky: b3Core (on black, for additive blending), b3Ring (keyed alpha, with fitted outer and inner ellipses), b4Empty (keyed), b5Lit (keyed) and b5LitAdd (on black, additive), each with its disc centre and radius — B4 and B5 are the same sphere in different frames: align them by their discs. src/experience/tokens.ts — the sampled palette (brass, brass-dim alpha, blue, blue-white). Look at the four source images in cellestial-assets/images/b-sky/ and at the contact sheet of the twelve figures, ${SCR}/foundation/constellations.png (what each figure must look like on screen).

Files this scene owns: src/experience/sky/** (index.ts must export "mount", typed MountSky); src/components/scenes/Sky.astro (renders <canvas id="sky-canvas"> — fixed, full viewport, z-index 0 — and <div id="sky-ui"> — fixed, full viewport, z-index 2, pointer-events none except on its interactive children — with their CSS); scripts/assets/sky.mjs and its outputs under public/cellestial/sky/ (ONLY for further derivations of the pack images, for example the ring split into its near and far halves; the module contract is in the header of scripts/build-assets.mjs; run with "node scripts/build-assets.mjs modules"); the test page src/pages/dev/sky.astro and dev-only stand-ins in src/experience/sky/dev/.

Technique: three.js 0.187 (installed; import only what you use from 'three'). No post-processing passes (no EffectComposer, no bloom): glow is additive sprites and shader falloff, which is what keeps it smooth on a phone. A scene reaches the rest of the page only through the SceneContext it is mounted with: ctx.when('claims'), ctx.when('director'), ctx.when('claimFlow'). It imports nothing from other parts of src/experience except contracts.ts (types), assets.ts and tokens.ts, and src/content/constellations.ts.

THE WORLD
- The void (B1): pure #000. The camera looks down -z and flies along z. Constellation layer k (any integer, the flight is endless in both directions) sits at z = -k x SPACING and shows figure k mod 12: Virgo, Libra, Scorpius, Sagittarius, Capricornus, Aquarius, Pisces, Aries, Taurus, Gemini, Cancer, Leo, then Virgo again. Each layer has a "station": the camera position from which its whole figure sits inside the safe area of the viewport (leave about 96 px at the top for the logo and menu, about 120 px at the bottom for the exit button, 20 px at the sides on a phone and 64 px on a desktop). On a portrait phone a wide figure fits the width; it is small, and the visitor flies closer to make it bigger — that is fine. Ahead, the next layers are visible, smaller and dimmer with distance: that is the depth.
- The honeycomb (B2): "A hexagonal lattice of thin brass-dim lines recedes in perspective and fades to black with distance. Barely visible. It moves with the flight. The B8 beads travel along its edges, so keep the lattice as real geometry/paths, not a flat texture." It is "the hidden structure that holds up the stars". Build it as a real graph (vertices and edges you can pathfind on): a honeycomb plane under each constellation layer, the planes tied together by struts so the structure visibly recedes down the flight axis and gives the eye its perspective. It must stay barely visible — a visitor notices it on the second look — and never busy: tune line alpha, cell size and fade distance by looking at screenshots at both viewports. Each edge can be brightened individually for a moment (beads will do that later).
- Cellestial's star (B3): "the core sprite is billboarded at the centre. Three copies of the ring sprite (or the ring as a texture on a 3D torus/plane) sit at different tilts like an armillary sphere, each spinning slowly on its own axis. The front halves of the rings draw over the core and the back halves under it (split the ring into front and back layers, or use real 3D depth). The faint constellation in the core image can be masked out; the code draws the real one." It stands where Virgo's epicentre star is, in every Virgo layer. It is "the most important light in the sky": the core must glow (additive), the rings must read as three physical cracked-brass bands with blue light leaking from the cracks, crossing each other believably with no popping as they turn. Judge it against the two B3 images.
- Empty stars (B4): the b4-empty sprite at every other star position, with "a faint blue rim glow so it reads on black" (the spec's prep note: "B4 nearly disappears on black at small sizes. Give it a faint rim glow in code (a thin blue outer glow at ~20%)"), and optionally a slow idle drift or rotation. It "must read as empty / available". Size follows magnitude gently (the brightest about 1.35 times the base size, the faintest about 0.8) so the real figure is recognisable.
- Lit stars (B5): "same size and position as B4. Claiming crossfades B4 to B5 with a brief brightening (the traces fire, then it settles to a steady glow). Lit state is permanent." It "must read as taken / alive". Which stars are lit comes from the claims store: (await ctx.when('claims')).all(), kept live with subscribe(). The sky starts with none.
- The figures (B6): "Stars sit at the real star-pattern positions for each constellation, joined by thin faint brass-dim lines. No labels in the sky."
- Depth and near fades: everything fades in out of the black with distance and fades out again just before it would touch the camera; the camera's path must carry it past B3 and through each layer without ever passing through a star (ease the path around B3 so the great star slides by with its rings turning).

THE FLIGHT (G1; addendum: "medium speed, builds with continued scrolling, tap stops instantly, forward + backward")
- Wheel down, swipe up, ArrowDown / PageDown / Space: forward (Virgo towards Libra). Wheel up, swipe down, ArrowUp / PageUp: backward. Home: back to the opening pose.
- Scrolling gives thrust: the first gesture starts a medium cruise; continued scrolling builds speed up to a firm maximum; when the input stops the flight glides on and eases down over a couple of seconds, and as it comes to rest it settles softly on the nearest station, so a visitor who stops is looking at a well-framed constellation.
- A tap or click on empty sky stops the flight instantly, dead, wherever it is.
- The flight is endless both ways. One full round is complete when all twelve figures have been at their stations (in either direction): roundComplete() is then true for the rest of the session (remember it in sessionStorage, key "cellestial:round"; storage may be blocked).
- The sky does not scroll the document. While active it owns wheel, touch and those keys (but never when focus is inside a dialog, a form field or the menu); when not active it owns nothing.

THE CONTRACT (contracts.ts is exact; this is the intent)
- ready: resolves when the textures have decoded and a first frame is drawn. If WebGL is not available, reject it with an Error — never leave it pending — and draw nothing; mount itself must not throw.
- setActive(on): flight input and the idle render loop on or off. fall(), focusStar() and the intro keep the loop running by themselves for as long as they need it, whatever setActive says.
- reset(): the opening pose — Virgo's station, B3 centred on screen, no velocity, rings spinning.
- setStill(on): reduced motion. The opening pose, rings static, no flight and no idle animation; draw one frame, and again only when something changes (resize, a claim). Stars are still clickable.
- introPrime, introProgress, coreCircle: the A5 hand-off from the loading screen, exactly as the comments in contracts.ts and "A5 hand-off" in the BLUEPRINT say. introProgress must be a pure function of t. The owner's picture of this moment: the little star above the i of the wordmark breaks apart, "its shattered brass pieces form RINGS around it, the rings cracked with blue electric light and blue circuits, and its core becomes a glowing radiant star with the brass rings spinning around it", the letters "float down", and "that float-down effect drops the star onto the first layer/pattern" — so over t the star settles onto Virgo as Virgo and the honeycomb come up out of the black around it.
- fall({ groundY, onImpact }) — D1: "every star sprite (B4 and B5) accelerates straight down the same way, with motion trails (stretched sprite or trail particles). No star is special. The honeycomb and B3 fade out." Every star falls alike under one gravity; far layers fall slower on screen only because they are far. groundY() gives, every frame, the viewport y of the top edge of the soil, which rises into the frame while the stars fall (the soil is an opaque element ABOVE your canvas, so stars simply sink behind it). Call onImpact(x) once, with the viewport x of the first star to cross groundY(). Resolve when no star is left above the ground or inside the viewport.
- restore(): every star back in its place, the honeycomb and B3 back, as if the fall had not happened.
- focusStar(slot, { ignite }): fly to that star's layer and ease in on the star until it is large and near the centre of the safe area; with ignite, play the B4 to B5 claim there. Resolves when the camera and the star have settled.
- Picking: every star of the nearest layer has a real <button> in #sky-ui, kept exactly over the star each frame (at least 44x44 px, transparent, with an aria-label such as "Empty star in Virgo" or "Claimed star in Virgo" — there are no visible labels), so mouse, touch, keyboard and screen readers all pick the same way. Clicking an EMPTY star: claims.pick(slot) — that only remembers the visitor's choice; nothing is claimed. If claims.unplaced() is not null (a build request was already sent with no star chosen), clicking an empty star calls claims.place(slot) instead and the star ignites. Clicking a LIT star: focusStar(slot). A click on a star never counts as a tap on empty sky.
- Quality: cap the pixel ratio at 2. Watch the frame time and step down by yourself — pixel ratio 2, then 1.5, then 1; then lattice reach and density, trail length, idle animation — and step back up carefully when there is headroom. "If frame rate drops, scale effects down automatically rather than shipping jank."
- Pause rendering when the tab is hidden. Handle resize, orientation change and WebGL context loss and restore.

HOOKS FOR THE NEXT AGENT (inside src/experience/sky/, not part of the contract): a small typed event emitter with at least "tap-empty" ({ x, y } in viewport pixels — fired when a tap on empty sky has stopped the flight), "star-pick" ({ slot, lit }), "station" ({ layer, figure }) and "round-complete"; starCircle(slot) giving the star's current ScreenCircle or null when it is not on screen; the lattice graph (vertices, edges, a way to brighten an edge for a moment, a way to find the vertex nearest a viewport point and the vertex nearest a star); and the claims store instance. The beads (B8), the "claim yours" pulse (B9), the preview panel (B10), the lit-star panel and the exit button (B11) will be built on those.

THE TEST PAGE src/pages/dev/sky.astro: a standalone page (its own <html>, black body; do NOT use the site layout) that includes Sky.astro and mounts the sky with stand-ins: an in-memory ClaimsStore (seeded by "?lit=slot-3,slot-17" and "?unplaced=some%20text"), a director and a claimFlow that only log. Query parameters: layer=<number> starts at that layer's station (fractions are between stations); still=1; intro=1 plays the hand-off with a stand-in for the loader (a small circle near the top right, where the wordmark's star would be, then introProgress 0 to 1 over 1.6 s) and introT=<0..1> freezes it; fall=1 plays the fall against a stand-in soil (a dark element rising from the bottom, above the canvas); focus=<slot>&ignite=1; freeze=<seconds> fixes the animation clock so captures are repeatable; hud=1 shows frame time and the governor level. Expose the mounted scene and your internal hooks as window.__sky for capture scripts.
`

const VERIFY_A = `HOW THIS STAGE IS JUDGED — "A scene that merely renders is not done; a scene that matches its reference is." Capture at 390x844 (deviceScaleFactor 2, isMobile, hasTouch) and 1440x900, on the real GPU, and LOOK:
1. The opening pose. Then each of the twelve stations: is every figure the real constellation (compare with ${SCR}/foundation/constellations.png), whole and inside the safe area?
2. Between stations (layer = 0.5, 3.5): does it read as deep space with more ahead, the honeycomb receding and barely visible?
3. B3 close up (crop and enlarge) beside B3_core_radiant-star.jpg and B3_ring_cracked-brass.jpg: the same metal, the same light, three rings crossing believably. Several clock values, to see the rings turn.
4. An empty star and a lit star close up (crop and enlarge) beside B4_star_empty-sleeping.jpg and B5_star_lit-claimed.jpg; and the ignition, frame by frame.
5. The hand-off: introT = 0, 0.3, 0.5, 0.7, 0.85, 1.
6. The fall: a burst of frames from the click to the empty sky, with the stand-in soil rising; trails visible; every star alike.
7. Still mode. A resize from desktop to phone size and back.
8. A scripted real-time flight through at least four layers forward and two back, recording every frame time: average, 95th percentile, worst. Then the same in software rendering with the CPU throttled 4x (Chrome DevTools Protocol, Emulation.setCPUThrottlingRate) to watch the governor step down and the frame time recover.
9. Input: wheel, touch swipe, keys; speed builds with continued scrolling; a tap stops it dead; it settles on a station; twelve stations set roundComplete().
`

const BUILD_A = PRE + WHAT + `
YOUR JOB — stage A: build the world and the flight: everything above. Do NOT build the beads (B8), the "claim yours" pulse and label (B9), the preview panel (B10), the lit-star panel or the exit button (B11); leave the hooks for them. Your dev-server port: 4601.

${VERIFY_A}
Do all of it yourself and iterate until a hard judge would accept each picture; independent reviewers will look after you. Save your captures in ${SCRATCH}/a/ and name the important ones in your report, with the numbers you measured (SPACING, field of view, station distances, star sizes in pixels at a station on both viewports, frame times, governor behaviour) and the internal hooks' exact signatures.
`

const FINDINGS = {
  type: 'object',
  properties: {
    matches: { type: 'boolean', description: 'True only if, judged hard, this stage is done: it matches the spec and the pack assets, with nothing left that a careful owner would send back.' },
    verdict: { type: 'string', description: 'One paragraph, plain and specific.' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          summary: { type: 'string' },
          evidence: { type: 'string', description: 'What you ran or saw that proves it: screenshot path, measured numbers, command output, file and line.' },
          fix: { type: 'string', description: 'The concrete change to make.' },
        },
        required: ['severity', 'summary', 'evidence', 'fix'],
      },
    },
  },
  required: ['matches', 'verdict', 'findings'],
}

const REVIEW_PRE = `You are an independent reviewer of one scene of the Cellestial Studio website redesign. The site sells websites by being one; the owner's bar is: "A visitor should feel in the first ten seconds that whoever built this can build something extraordinary for them." The owner will judge the finished scene against its spec and its assigned assets, and "a scene that merely renders is not done; a scene that matches its reference is."

The scene lives in the git worktree ${WT} (branch wt/sky). You are a REVIEWER: do not edit any file in the worktree, do not commit. Put your own scripts and screenshots in the scratch directory you are given. Design authority: ${MAIN}/claude-vault/redesign/BLUEPRINT.md (read it; do not write there).
Dev server: "pnpm astro dev --port <YOUR PORT> --ignore-lock" in the background from the worktree; kill it when done ("fuser -k <PORT>/tcp"). Screenshots: playwright-core from the worktree (createRequire('${WT}/package.json')) with /usr/bin/chromium, headless; add --use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu to render on the real GPU. Look at every image with the Read tool (downscale anything over about 1600 px to JPEG first).
Report only what you can prove — a screenshot you looked at, a number you measured, a line you read. For every finding give the evidence and the concrete fix. Rank honestly: blocker = the owner would reject the scene for it; major = clearly visible or clearly wrong; minor = polish. Do not pad the list, and do not soften it either: your judgement is the only independent one this scene gets.

`

const REVIEW_A_VISUAL = REVIEW_PRE + WHAT + `
STAGE UNDER REVIEW: stage A (the world and the flight). The beads (B8), the "claim yours" pulse (B9), the preview panel (B10), the lit-star panel and the exit button (B11) are NOT built yet — do not report their absence.
YOUR LENS — does it look right, and does it feel like flying through deep space? Port 4611. Scratch: ${SCRATCH}/review-a-visual/.
The test page is /dev/sky (read src/pages/dev/sky.astro for its query parameters and window.__sky).

${VERIFY_A}
Make captures 1 to 7 yourself. Then judge as the owner would:
- Is the black really #000 and is everything else brass, blue or blue-white (sample pixels)? Is the honeycomb "barely visible" — there on the second look, never a grid that competes with the stars? Does it recede in real perspective?
- B3 against its two images: is the core radiant, are the rings the same cracked brass with blue light in the cracks, do they cross like physical bands, does anything pop or z-fight as they turn? Is it the most important light in the sky?
- B4 against its image at the size it really appears: does it read as a dark sphere with brass traces, "empty / available", or does it vanish? B5 against its image: alive and clearly different from B4 at a glance?
- Are the twelve figures the real constellations (compare each with the contact sheet), not mirrored, not squashed, complete, inside the safe area on a phone and on a desktop? Are the brass-dim lines thin and faint?
- Depth: can you see the next constellations waiting in the distance? Does flying feel like travelling through space rather than zooming a picture? Does the camera ever pass through a star, and does B3 slide past gracefully?
- Is anything cheap: aliased lines, visible sprite rectangles, banding in glows, popping at the fade distances, stars swimming against their lines?
- The hand-off and the fall: do they read as the spec describes them?
`

const REVIEW_A_CODE = REVIEW_PRE + WHAT + `
STAGE UNDER REVIEW: stage A (the world and the flight). The beads (B8), the "claim yours" pulse (B9), the preview panel (B10), the lit-star panel and the exit button (B11) are NOT built yet — do not report their absence.
YOUR LENS — is it correct, robust and smooth? Port 4612. Scratch: ${SCRATCH}/review-a-code/.
Read every file under src/experience/sky/, src/components/scenes/Sky.astro, scripts/assets/sky.mjs if it exists, and the test page. Then prove or refute each of these by running something:
- Contract: index.ts exports "mount" typed MountSky and returns exactly a SkyScene; every method does what its comment in contracts.ts says (drive each one from window.__sky and look); the scene imports nothing from other parts of src/experience except contracts.ts, assets.ts and tokens.ts; ready rejects (does not hang, does not throw from mount) when WebGL is unavailable (launch Chromium with --disable-gpu --disable-software-rasterizer, or stub getContext to return null).
- introProgress is a pure function of t (call it out of order and compare captures); at t = 1 the picture equals reset().
- Flight: forward and backward; speed builds with continued scrolling and has a maximum; a tap stops it in the same frame; it settles on a station; it is endless both ways (fly 30 layers forward and 15 back: figures repeat every twelve, nothing drifts, no precision trouble far from the origin); roundComplete() only after all twelve stations; the keys; no input is taken while inactive, or while focus is in an input or a dialog.
- Picking: the buttons sit over their stars (measure the offset between each button's centre and the star's projected centre at both viewports, while flying and at rest); empty star calls pick and claims nothing; with an unplaced ask it calls place and ignites; a lit star flies in; a star click never fires "tap-empty".
- Claims: seed lit stars; add a claim through the store while watching (live update); the sky starts with no star lit when the store is empty.
- fall(): onImpact is called exactly once with a sensible x; every star falls alike; it resolves; restore() brings everything back; calling fall() twice, or restore() mid-fall, does not break it.
- Still mode: no animation frames are requested at rest (count them); it redraws on resize and on a claim.
- Performance: frame times over a scripted flight on the real GPU at both viewports (average, 95th percentile, worst); then software rendering with the CPU throttled 4x — does the governor step down, does the frame time recover, does it step back up without oscillating? Draw calls and triangles per frame (renderer.info); any per-frame allocation in the hot path; texture memory.
- Robustness: tab hidden and shown; resize and orientation change mid-flight; WebGL context lost and restored (WEBGL_lose_context); devicePixelRatio 3; a 320 px wide viewport; an ultrawide one.
- "pnpm build" passes; the size of the scene's JavaScript chunk and whether three.js is tree-shaken; "pnpm exec biome check" clean on the scene's files; "git status --short" in the worktree shows only files this scene owns.
`

const fixPrompt = (stage, port, verify, all) => PRE + WHAT + `
YOUR JOB: fix the review findings on stage ${stage} of the Sky, which another agent built. Your dev-server port: ${port}. Scratch: ${SCRATCH}/fix-${stage.toLowerCase()}/.

Read the scene's code first (src/experience/sky/**, src/components/scenes/Sky.astro, src/pages/dev/sky.astro). The findings are below as JSON. For each: reproduce it; if it is real, fix it at the root; if it is not real, say exactly why. Fix every blocker and major, and every minor that is cheap and clearly right. Where a finding says something does not look like its asset or the spec, do not tweak a constant and hope: capture it beside the asset, find what actually differs, change it, capture again, and repeat until a hard judge would accept it. If the current way of drawing something cannot get there, replace it.
Then re-verify the whole stage, because fixes break things:
${verify}
Report per finding: fixed (how, and the capture that shows it) / not real (why) / not fixed (why, and what you tried).

FINDINGS:
${JSON.stringify(all, null, 1)}
`

// ───────────────────────────────────────────── stage A
phase('World')
const buildA = await agent(BUILD_A, { label: 'build the sky world', phase: 'World' })

phase('Review')
const reviewsA = (await parallel([
  () => agent(REVIEW_A_VISUAL, { label: 'review A: look and feel', phase: 'Review', schema: FINDINGS }),
  () => agent(REVIEW_A_CODE, { label: 'review A: contract, input, performance', phase: 'Review', schema: FINDINGS }),
])).filter(Boolean)
const allA = reviewsA.flatMap((r) => r.findings)
log(`Stage A review: ${allA.length} findings, ${allA.filter((f) => f.severity !== 'minor').length} serious; matches=${reviewsA.map((r) => r.matches).join(',')}`)

phase('Fix')
let fixA = 'No findings.'
if (allA.length) fixA = await agent(fixPrompt('A', 4621, VERIFY_A, allA), { label: 'fix stage A', phase: 'Fix' })

// ───────────────────────────────────────────── stage B
const VERIFY_B = `HOW THIS STAGE IS JUDGED. Capture at 390x844 (deviceScaleFactor 2, isMobile, hasTouch) and 1440x900, on the real GPU, and LOOK:
1. A tap on empty sky at three different places and three different stations: a burst of frames from the tap until the beads arrive. The beads run ALONG the honeycomb's real edges (overlay the path on a capture to prove it), brightest at the head and fading bead by bead towards the tail; the brass edges they pass brighten briefly; they end at the nearest empty star.
2. The star they land on: the slow pulse (about a 2 s loop), captured at several phases, close up.
3. With every star of the nearest layer lit (seed the store): what a tap does then (the beads go to the nearest empty star in a neighbouring layer, or do nothing gracefully — say which and show it).
4. A tap while flying fast: the flight stops dead AND the beads start from where the finger is.
5. Frame times during ten bead runs in a row, real GPU and software with the CPU throttled 4x.
6. Everything stage A was judged on still holds: the opening pose, three stations, B3 close up, the hand-off at introT 0.5 and 1, the fall, still mode (no beads animate in still mode: a tap goes straight to the pulse).
`

const BUILD_B = PRE + WHAT + `
YOUR JOB — stage B: the light that answers a touch. Another agent built stage A (the world and the flight) and it has been reviewed and fixed. Read all of src/experience/sky/ and src/pages/dev/sky.astro first, and use the hooks it left (the event emitter, starCircle, the lattice graph, the claims store). Your dev-server port: 4602.

Build, inside the files this scene owns:
- B8, the beads of light. Spec: "Where: along the honeycomb edges, from the visitor's touch/click point. Purpose: light flows from the touch along the honeycomb to one empty star. Build: on tap/click, pathfind along the lattice edges from the nearest vertex to the nearest unclaimed B4. Animate a trail of small round blue beads along that path: brightest at the head, fading bead by bead toward the tail, and briefly brightening the brass edges they pass. On arrival, trigger B9." The owner's wording: "faint brass honeycomb the light-beads actually travel", and in his original notes: "little beads of light flow along the FAINT, almost invisible 3D HONEYCOMB pattern (the beads travel the honeycomb, not the constellation lines), and light it up around themselves as they go. The beads impact ONE chosen empty star for the layer the visitor is closest to — that star PULSES ... Touch/click does NOT claim or fill anything — it highlights the claimable star." So the target is the empty star nearest the touch in the layer the visitor is closest to, and the path must be a real shortest path over the lattice graph (A* or Dijkstra), from the vertex nearest the touch to the vertex nearest the target star, then one last hop to the star itself. Round beads, the sampled blue, additive, with a soft glow; a new tap replaces the run in progress.
- B9, the pulse. Spec: "the B4 sprite brightens slightly with a slow pulse (scale/glow, ~2s loop). Underneath, the words "claim yours" in tiny brass live text ... Clicking it opens B10." Build the pulse on the star now. The words and the panel need the site's type and panel components, which arrive from another branch: emit an internal event "bead-arrive" ({ slot }) and keep "pulsing" as queryable state (which slot is pulsing, or null), so the label and the panel can be attached without touching your code. The pulse ends when the visitor flies away, taps elsewhere, or the star is picked or lit.
- When claims.unplaced() is not null (a request was sent with no star chosen): on entering the sky and after each stop, send beads from the centre of the screen to the nearest empty star by themselves, so the visitor is shown where to put their star.
- Reduced motion (still mode): no travelling beads; a tap marks the nearest empty star with the steady, non-animated form of the pulse.
- Extend the test page with whatever you need to drive and freeze this (for example "?tap=x,y" and "?beadT=0.5").

${VERIFY_B}
Do all of it yourself and iterate until a hard judge would accept each picture. Save your captures in ${SCRATCH}/b/ and name the important ones in your report, with the exact signatures of the events and state the next agent will use.
`

const REVIEW_B = REVIEW_PRE + WHAT + `
STAGE UNDER REVIEW: stage B — the beads of light (B8) and the pulse on the star they reach (B9, without its "claim yours" words, which come later with the site's type), on top of the already reviewed world. The preview panel (B10), the lit-star panel and the exit button (B11) are NOT built yet — do not report their absence.
The spec for the beads: "on tap/click, pathfind along the lattice edges from the nearest vertex to the nearest unclaimed B4. Animate a trail of small round blue beads along that path: brightest at the head, fading bead by bead toward the tail, and briefly brightening the brass edges they pass. On arrival, trigger B9." For the pulse: "the B4 sprite brightens slightly with a slow pulse (scale/glow, ~2s loop)." The owner: "faint brass honeycomb the light-beads actually travel".
YOUR LENS — everything: the look, the behaviour, the code. Port 4613. Scratch: ${SCRATCH}/review-b/.

${VERIFY_B}
Make these captures yourself and judge as the owner would. Prove the path is a real path over the lattice graph (read the code, then overlay the computed path on a capture). Check the beads are round, blue, additive, clearly a TRAIL with a bright head; that edges brighten as they pass and fall back; that the pulse is slow and calm; that a tap on a star button never launches beads; that repeated and rapid taps, taps during a run, taps while flying, taps at the screen edges, and a tap when no empty star is left all behave; that nothing leaks (run 200 taps and watch memory and frame time); that still mode never animates; that the unplaced case points the visitor to a star; and that nothing stage A did has regressed (opening pose, stations, B3, hand-off, fall, flight feel, frame times). Also read the new code for contract or ownership violations and run "pnpm build" and biome.
`

phase('Beads')
const buildB = await agent(BUILD_B, { label: 'build beads and pulse', phase: 'Beads' })

phase('Review')
const reviewB = await agent(REVIEW_B, { label: 'review B: beads, pulse, regressions', phase: 'Review', schema: FINDINGS })
const allB = reviewB ? reviewB.findings : []
log(`Stage B review: ${allB.length} findings, ${allB.filter((f) => f.severity !== 'minor').length} serious; matches=${reviewB ? reviewB.matches : 'n/a'}`)

phase('Fix')
let fixB = 'No findings.'
if (allB.length) fixB = await agent(fixPrompt('B', 4622, VERIFY_B, allB), { label: 'fix stage B', phase: 'Fix' })

return { buildA, reviewsA, fixA, buildB, reviewB, fixB }
