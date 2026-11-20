export const meta = {
  name: 'cellestial-fx',
  description: 'Build the effects layer in its own worktree: C4 teleport circuit flash, D2 impact burst, G2 warp; review against the spec and the A1 circuits; fix',
  phases: [
    { title: 'Build', detail: 'teleport flash, impact burst, warp streaks' },
    { title: 'Review', detail: 'look, timing, contract, performance' },
    { title: 'Fix', detail: 'apply findings, re-verify' },
  ],
}

const MAIN = '/home/poe/cellestial-studio'
const WT = '/home/poe/cellestial-wt/fx'
const SCR = '/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad'
const SCRATCH = SCR + '/fx'

const PRE = `You are one of several agents building the Cellestial Studio website redesign: an Astro 7 static site (Tailwind 4, pnpm, TypeScript run natively by Node 26, Biome). The site sells websites by being one. The owner's bar: "A visitor should feel in the first ten seconds that whoever built this can build something extraordinary for them."

Your working copy is the git worktree ${WT} (branch wt/fx). Work ONLY inside it, plus the scratch directory ${SCRATCH} for throwaway scripts and screenshots (create it). The main checkout ${MAIN} is being edited by other agents right now: never write there. Read from it only ${MAIN}/claude-vault/redesign/BLUEPRINT.md — the design authority for how the pieces meet; read it first. The spec is BUILD_SPEC.md and SPEC-ADDENDUM.md in your worktree (the addendum wins on conflict); read the line ranges your task names, not the whole file.

Hard rules:
- No git commit, push, checkout, stash, reset, clean, merge or rebase. The orchestrator commits.
- Edit only the files your task says you own. In particular do not edit package.json, src/experience/contracts.ts, src/experience/tokens.ts, src/experience/assets.ts, src/pages/index.astro, src/layouts/**, src/styles/**. The old homepage (src/pages/index.astro, src/sky/**, src/components/*.astro) is still in this worktree; it is being replaced elsewhere — leave it alone and depend on none of it.
- Never touch the protected paths: workers/**, src/onboard/**, src/scripts/contact-submit.ts, src/scripts/start-flow.ts, src/scripts/start-builder.ts, public/admin/**, src/content/home.json, src/config.ts.
- Imagery: this layer uses NO image files at all — it is light drawn by code. No generated, stock or substitute images, no icon libraries, no emoji. No sound of any kind.
- Invent no copy. This layer has no words.
- Code style is Biome (tabs, single quotes, semicolons, width 100): run "pnpm exec biome check --write <your files>" before finishing and fix what it reports.
- If an approach fails twice, abandon it and take another route instead of stacking fixes.
- Dev server: "pnpm astro dev --port <YOUR PORT> --ignore-lock" as a background process from the worktree; kill it when you finish ("fuser -k <PORT>/tcp"). Never use port 4321.
- Screenshots: playwright-core is installed in the worktree; system Chromium is /usr/bin/chromium, headless. From a script outside the worktree, load playwright with createRequire('${WT}/package.json'). Look at every image you produce with the Read tool (downscale anything larger than about 1600 px to JPEG first — "magick in.png -resize 1600x1600\\> out.jpg"). "It rendered" is not verification; "I looked, and it matches the spec" is.
- Your final message is a report to the orchestrator, not to a human: files written, how each effect is drawn, the timings you measured, what you ran and saw, and every known gap, stated plainly. Never claim something works unless you ran it.
`

const WHAT = `THE PIECE — the effects layer: three short effects drawn on one full-screen canvas that sits above every scene.

Read: BLUEPRINT.md sections 1 to 4 and 6 to 8. BUILD_SPEC.md lines 10-29 (global rules), 160-188 (section C and section D), 241-249 (section G). SPEC-ADDENDUM.md lines 10-20 and 40-45. src/experience/contracts.ts — FxLayer (every method and its comment), MountFx, SceneContext. src/experience/tokens.ts — the sampled palette (BLUE, BLUE_WHITE, BRASS and friends; rgba() and linear() helpers). Look at cellestial-assets/images/a-loading/A1_c-emblem_lit.jpg, enlarged around its struts and its main node: glowing blue circuit lines on brass, ending in small round nodes. That is the circuit look the teleport flash must have. Also look at ${SCR}/ref/sheet12_2.jpg (frames of the loading screen's reference video around its lightning strike) for how bright, how blue-white and how alive light is on this site.

Files this piece owns: src/experience/fx/** (index.ts must export "mount", typed MountFx); src/components/scenes/Fx.astro (renders <canvas id="fx-canvas"> — fixed, full viewport, z-index 30, pointer-events none, aria-hidden — and its CSS); the test page src/pages/dev/fx.astro and dev-only helpers in src/experience/fx/dev/.

Technique: a 2D canvas, no libraries. The palette comes from tokens.ts and nothing else: blue, blue-white, black, and brass glints where said. When no effect is playing the layer costs nothing: the canvas is clear, no animation frame is requested, nothing is composited.

1. teleportFlash(swap, dir) — C4, the menu teleport. Spec: "Where: full screen, during a teleport between sections. Purpose: the split-second transition. Build: about 300–500ms. Glowing blue circuit lines and round nodes fill the frame on black, like the A2 circuits seen very close up. Brightness peaks to blue-white at the centre mid-flash, the section swaps underneath at the peak, then it fades out. Procedurally generated right-angle traces (canvas/SVG) work best."
   - In: the frame goes to solid black while circuit traces (right-angle and 45-degree runs, like a printed circuit, each ending in a small round ring node) grow across it and brighten. Peak: the frame is fully opaque, the traces are at full glow and the centre blooms blue-white. At the peak — and only when not one pixel of the old section can show through — call swap() exactly once; if it returns a promise, hold the peak (alive, softly flickering, not frozen) until it settles, for at most one second. Out: the traces fade and the black clears to fully transparent.
   - "About 300–500ms" is the whole flash, not counting any time swap() itself takes.
   - dir is the felt direction of travel: 'down' (towards the Roots) — the traces race downward; 'up' (back to the sky) — upward; 'none' — outward from the centre. The owner's words for the teleport: "the whole page FLIES them there — shift out ... a flash of blue circuits that takes up the page, then fly IN to the clicked section. Direction is felt: a section above gives a slight fly-UP feel, a section below a slight fly-DOWN feel."
   - It resolves when the canvas is clear again. If swap() throws or rejects, the flash still fades out fully and then the returned promise rejects with that error: the screen is never left black. A second call while one is running waits its turn.
   - A new layout of traces every time (seeded, so a given seed and time always draw the same frame).
   - Reduced motion (ctx.reducedMotion): a plain fade to black, swap() at black, a plain fade back — about 200 ms each way, no traces. (Spec G3: "a simple fade in place of C4".)
2. impact(x, y) — D2, the instant a falling star meets the ground. Spec: "The soil rises into the bottom of the frame. A star hits the soil's top edge, and from the impact point blue light bursts downward and sideways, growing instantly into the E2 mycelium branches." The Roots scene grows the mycelium itself; this is the burst that sets it off: at the viewport point (x, y) a blue-white flash, light thrown DOWNWARD and SIDEWAYS from it (short jagged rays into the ground, a quick shock of light running both ways along the ground line at y), and a few sparks kicked up that arc and fall back. About 600 to 900 ms, additive, then gone. Fire and forget: it returns nothing; several may overlap. Reduced motion: it does nothing (there is no fall).
3. warp(ms) — G2, the return to the sky. Spec: "when E6 is clicked, a launch-up effect (streaks, speed ramp) carries the visitor back to the sky." The visitor is launched UPWARD: streaks of light pour down past them from a vanishing point high in the frame, few and slow at first, then longer, faster and denser (the speed ramp), blue and blue-white with a few brass glints; near 70% of ms the frame flares towards blue-white and is briefly fully covered (the page swaps the Roots for the sky underneath during that cover — so the cover must be truly opaque for at least 80 ms and centred on 0.7 x ms); then the streaks thin, slow and clear, leaving the canvas transparent. It resolves after ms. Reduced motion: a plain fade to black and back over ms, covering at the same moment.
   - Export the constant WARP_COVER = 0.7 from src/experience/fx/index.ts so the page can time its swap.

General: draw at min(devicePixelRatio, 2) and step down to 1.5 or 1 if a frame takes too long; handle resize and orientation change mid-effect; pause safely if the tab is hidden (an effect that was mid-flight when the tab comes back must finish or clear, and every pending promise must still settle); never leave anything on the canvas after an effect ends.

THE TEST PAGE src/pages/dev/fx.astro: a standalone page (its own <html>; do NOT use the site layout) that includes Fx.astro, mounts the layer, and shows it over a choice of backgrounds: bg=black, bg=soil (the image /cellestial/roots/soil-landscape.webp tiled), bg=split (black above a soil ground whose top edge is at 62% of the height — for the impact), bg=bright (a pale page with large dark text, to prove the flash's and the warp's cover are truly opaque). Query parameters: fx=flash|impact|warp; dir=up|down|none; x and y for the impact; ms for the warp; t=<0..1> freezes the effect at that fraction of its length; seed=<number>; rm=1; loop=1 replays it every two seconds. With fx=flash the test page's swap() changes the background (so a capture shows whether the old one leaked). Expose the mounted layer as window.__fx for capture scripts.
`

const VERIFY = `HOW THIS PIECE IS JUDGED — "A scene that merely renders is not done; a scene that matches its reference is." Capture at 390x844 (deviceScaleFactor 2, isMobile, hasTouch) and 1440x900 and LOOK:
1. The flash frozen at t = 0, 0.15, 0.3, 0.45, 0.5, 0.55, 0.7, 0.85, 1 for each dir, over bg=bright. Beside the peak frame, an enlarged crop of the circuits of A1_c-emblem_lit.jpg: are these the same kind of lines — thin, glowing, blue with a white-hot core, right-angle runs ending in round ring nodes — "like the A2 circuits seen very close up"? Does the centre peak blue-white? Is the frame fully opaque at the moment swap() runs (sample pixels across the frame: none may show the bright page)?
2. The flash in real time: measure its length without swap time (must be 300 to 500 ms) at both viewports, and with a swap() that takes 400 ms, 2 s (capped) and one that throws.
3. The impact frozen at t = 0, 0.1, 0.25, 0.5, 0.75, 1 over bg=split at three x positions: does the light go down and sideways from the ground line, is it a burst and not a blob, do the sparks arc?
4. The warp frozen at t = 0, 0.2, 0.4, 0.6, 0.7, 0.8, 0.9, 1 over bg=soil and bg=bright, and in real time for ms = 1200 and 1800: does it read as being launched upward at growing speed? Is the cover opaque around 0.7?
5. Reduced motion versions of all three.
6. Frame times for each effect at 390x844 DPR 2 with the CPU throttled 4x (Chrome DevTools Protocol, Emulation.setCPUThrottlingRate): average and worst. And at rest: no animation frames requested (count calls for two seconds), canvas fully transparent.
`

const BUILD = PRE + WHAT + `
YOUR JOB: build it. Your dev-server port: 4701.

${VERIFY}
Do all of it yourself and iterate until a hard judge would accept each picture; an independent reviewer will look after you. Save your captures in ${SCRATCH}/build/ and name the important ones in your report, with the timings and frame times you measured.
`

const FINDINGS = {
  type: 'object',
  properties: {
    matches: { type: 'boolean', description: 'True only if, judged hard, this piece is done: it matches the spec, with nothing left that a careful owner would send back.' },
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

const review = (round, previous) => `You are an independent reviewer of one piece of the Cellestial Studio website redesign. The site sells websites by being one; the owner's bar is: "A visitor should feel in the first ten seconds that whoever built this can build something extraordinary for them." The owner will judge the finished site against its spec, and "a scene that merely renders is not done; a scene that matches its reference is."

The piece lives in the git worktree ${WT} (branch wt/fx). You are a REVIEWER: do not edit any file in the worktree, do not commit. Put your own scripts and screenshots in ${SCRATCH}/review-${round}/. Design authority: ${MAIN}/claude-vault/redesign/BLUEPRINT.md (read it; do not write there).
Dev server: "pnpm astro dev --port 4711 --ignore-lock" in the background from the worktree; kill it when done ("fuser -k 4711/tcp"). Screenshots: playwright-core from the worktree (createRequire('${WT}/package.json')) with /usr/bin/chromium, headless. Look at every image with the Read tool (downscale anything over about 1600 px to JPEG first).
Report only what you can prove — a screenshot you looked at, a number you measured, a line you read. For every finding give the evidence and the concrete fix. Rank honestly: blocker = the owner would reject it; major = clearly visible or clearly wrong; minor = polish. Do not pad the list, and do not soften it either: your judgement is the only independent one this piece gets.

` + WHAT + `
YOUR LENS — everything: the look, the timing, the contract, the code.
The test page is /dev/fx (read src/pages/dev/fx.astro for its query parameters and window.__fx).

${VERIFY}
Make all of these captures and measurements yourself. Judge the look as the owner would: is the flash a real circuit seen close up or a generic "tech" pattern? Is the light alive — white-hot cores, soft blue falloff, no flat discs, no banding, no aliasing? Does each direction feel different? Does the impact throw light down and sideways from the ground line? Does the warp feel like a launch?
Then the code: read every file under src/experience/fx/ and src/components/scenes/Fx.astro. index.ts exports "mount" typed MountFx and returns exactly an FxLayer; nothing is imported from other parts of src/experience except contracts.ts and tokens.ts; swap() is called exactly once per flash, at full cover, and awaited; a throwing swap() still clears the screen and rejects; overlapping calls (two flashes, a flash during a warp, ten impacts at once) behave; every promise settles even if the tab is hidden mid-effect (emulate with document visibility or by pausing animation frames); resize mid-effect; devicePixelRatio 3; a 320 px wide viewport and an ultrawide one; nothing is left on the canvas afterwards (read back pixels); zero animation frames at rest; no sound; no colour outside the palette (sample the frames); "pnpm build" passes and "pnpm exec biome check" is clean on the piece's files; "git status --short" shows only files this piece owns.
${previous ? `
This is review round ${round}. The previous round's findings are below: check each again (fixed, partly fixed, not fixed) and say so in your verdict, then look for anything new or anything the fixes broke.
PREVIOUS FINDINGS:
${previous}
` : ''}`

phase('Build')
const build = await agent(BUILD, { label: 'build the effects layer', phase: 'Build' })

const rounds = []
let previous = ''
for (let round = 1; round <= 2; round++) {
  phase('Review')
  const r = await agent(review(round, previous), { label: `review ${round}`, phase: 'Review', schema: FINDINGS })
  const all = r ? r.findings : []
  const serious = all.filter((f) => f.severity !== 'minor')
  log(`Round ${round}: ${all.length} findings, ${serious.length} serious; matches=${r ? r.matches : 'n/a'}`)
  const entry = { round, review: r }
  rounds.push(entry)
  if (!all.length) break
  if (round === 2 && !serious.length) break
  phase('Fix')
  entry.fix = await agent(PRE + WHAT + `
YOUR JOB: fix the review findings on the effects layer that another agent built. Your dev-server port: 4721. Scratch: ${SCRATCH}/fix-${round}/.

Read the code first (src/experience/fx/**, src/components/scenes/Fx.astro, src/pages/dev/fx.astro). The findings are below as JSON. For each: reproduce it; if it is real, fix it at the root; if it is not real, say exactly why. Fix every blocker and major, and every minor that is cheap and clearly right. Where a finding says an effect does not look right, do not tweak a constant and hope: capture it, find what actually differs from the spec's words and from the A1 circuits, change it, capture again, and repeat until a hard judge would accept it. If the current way of drawing something cannot get there, replace it.
Then re-verify the whole piece, because fixes break things:
${VERIFY}
Report per finding: fixed (how, and the capture that shows it) / not real (why) / not fixed (why, and what you tried).

FINDINGS:
${JSON.stringify(all, null, 1)}
`, { label: `fix round ${round}`, phase: 'Fix' })
  previous = JSON.stringify(all, null, 1)
  if (!serious.length) break
}

return { build, rounds }
