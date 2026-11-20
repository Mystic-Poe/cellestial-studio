export const meta = {
  name: 'cellestial-roots',
  description: 'Build the Roots (E1-E6) and the Close (F1, F2) in their own worktree: soil, mycelium, guided light, five offer tiles with the locked copy; review; fix',
  phases: [
    { title: 'Build', detail: 'soil, mycelium, nodes, tiles with the locked copy, guided light, close buttons' },
    { title: 'Review', detail: 'look and copy against the assets and the addendum; behaviour, accessibility, performance' },
    { title: 'Fix', detail: 'apply findings, re-verify' },
  ],
}

const MAIN = '/home/poe/cellestial-studio'
const WT = '/home/poe/cellestial-wt/roots'
const SCR = '/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad'
const SCRATCH = SCR + '/roots'

const PRE = `You are one of several agents building the Cellestial Studio website redesign: an Astro 7 static site (Tailwind 4, pnpm, TypeScript run natively by Node 26, Biome). The site sells websites by being one. The owner's words: "A visitor should feel in the first ten seconds that whoever built this can build something extraordinary for them — then, when they reach the offers, find plain language, honest prices, and a simple way to ask. Wonder up top, clarity underneath. That contrast is the whole design: the Sky is the proof, the Roots are the pitch." You are building the pitch.

Your working copy is the git worktree ${WT} (branch wt/roots). Work ONLY inside it, plus the scratch directory ${SCRATCH} for throwaway scripts and screenshots (create it). The main checkout ${MAIN} is being edited by other agents right now: never write there. Read from it only ${MAIN}/claude-vault/redesign/BLUEPRINT.md — the design authority for how the pieces meet; read it first. The spec is BUILD_SPEC.md and SPEC-ADDENDUM.md in your worktree (the addendum wins on conflict); read the line ranges your task names, not the whole file.

Hard rules:
- No git commit, push, checkout, stash, reset, clean, merge or rebase. The orchestrator commits.
- Edit only the files your task says you own. In particular do not edit package.json, src/experience/contracts.ts, tokens.ts or assets.ts, src/content/**, src/pages/index.astro, src/layouts/**, src/styles/**, src/components/ui/** (the UI kit), the dialogs or the contact form. If the kit lacks something you need or has a defect, work within it and say so in your report. The other scenes' files (src/experience/{loader,sky,fx,chrome}/**, src/components/scenes/{Loader,Sky,Fx}.astro, src/components/chrome/**) hold small placeholders that other agents are replacing on other branches right now: leave them alone.
- Never touch the protected paths: workers/**, src/onboard/**, src/scripts/contact-submit.ts, src/scripts/start-flow.ts, src/scripts/start-builder.ts, public/admin/**, src/content/home.json, src/config.ts.
- Imagery: only files derived from cellestial-assets/ (crops, resizes, keys and format changes of the pack images). No generated, stock or substitute images, no icon libraries, no emoji, no social icons. Light drawn by code (the mycelium, pulses, glows) is code, not imagery. No sound of any kind.
- COPY IS LOCKED. Every word a visitor can read in this scene comes from src/content/offers.ts (which a test holds character for character to SPEC-ADDENDUM.md) or is quoted in this brief. Invent nothing: no headings, no taglines, no helper text, no offers, no prices, no "learn more".
- Code style is Biome (tabs, single quotes, semicolons, width 100): run "pnpm exec biome check --write <your files>" before finishing and fix what it reports.
- If an approach fails twice, abandon it and take another route instead of stacking fixes.
- Dev server: "PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm astro dev --port <YOUR PORT> --ignore-lock" (Cloudflare's always-pass test key; the page carries the contact dialogs) as a background process from the worktree; kill it when you finish ("fuser -k <PORT>/tcp"). Never use port 4321.
- Screenshots: the harness scripts/shot.mjs (read its header: viewports, --eval, --steps files with click / scroll / key / shot / expect steps, --no-js, --reduced-motion, --full; it exits non-zero on console errors) or your own playwright-core script (system Chromium is /usr/bin/chromium; from outside the worktree load playwright with createRequire('${WT}/package.json')). Look at every image you produce with the Read tool (downscale anything larger than about 1600 px on a side to JPEG first, and cut very tall full-page captures into viewport-sized pieces — "magick in.png -resize 1600x1600\\> out.jpg"). "It rendered" is not verification; "I looked, and it matches the asset and the spec" is.
- Your final message is a report to the orchestrator, not to a human: files written, how each element is built, what you measured, what you ran and saw, and every known gap, stated plainly. Never claim something works unless you ran it.
`

const WHAT = `THE SCENE — the Roots ("What we build", spec section E) and the Close (section F).

The owner's test, verbatim: "Roots: stars fall, crash, and become mycelium; underground, 5 nodes in spec order, prices inside the tiles, guided light that suggests but never locks navigation. Wording on screen matches the addendum character-for-character." And: "Close and chrome: "Claim your star" big, "Contact me" smaller under it, both wired to the existing flows." The spec's setting: "underground, dark earth, still and grounded, the opposite feel to the sky. This is where prices and offers live, so clarity beats spectacle."

How the owner first described this scene (his words; they decide whatever the spec leaves open):
- "The light from the roots LEADS the visitor to NODES in sequence."
- "Each node they CLICK opens a PANEL (a tile). They read it, close it. Closing it, the light leads them to the NEXT node."
- "Each node goes DEEPER DOWN than the last — descent is the progression."
- "One node / one panel at a time — no wall of tiers shown all at once."
- "Prices live INSIDE each tile — each panel breaks down what that thing costs."
- "GUIDED, not locked. The light suggests/pulses the next node, but any visible node is clickable at any time, and visitors can go back up to re-read a node. No forced order, no unlocking."
- "The ending of this scene is the BOTTOM of the page. A visitor can scroll all the way back UP; once they hit the top of the ground, a button to RETURN TO THE SKY appears. Clicking it LAUNCHES them back up — like a warp drive."
- The Site tile's price "shows as a slashed price stack: $990 — SLASHED THROUGH → FREE", and the care price the same way.
- "Performance note: Lighter than the Hero by design — static earthen scene, panels, guided light."

Read: BLUEPRINT.md in full (note sections 2, 3, 4, 6 "Mounting" and "Scene test pages", 8 "Roots" and "No JavaScript", 9). BUILD_SPEC.md lines 10-29 (global rules), 52-56 (image prep notes), 185-188 (D2, the crash), 190-239 (sections E and F) and 241-249 (section G). SPEC-ADDENDUM.md lines 22-42. cellestial-assets/reference/original-visual-spec-sheet_2026-11-18.md from the heading "SECTION E" to the end of section F (how each element should look). src/experience/contracts.ts — RootsScene (every method and its comment), MountRoots, SceneContext, Director, ClaimFlow. src/content/offers.ts and its test — OFFERS (five, in order: site, systems, app, addons, care), each with title, short, lead and lines: Segment[][] where a Segment is { text, brass?, strike?, srOnly? }; offerText(o) and visibleText(o). src/experience/assets.ts — ASSETS.roots: soilLandscape and soilPortrait (URL, size, the mirror line "half", and an AVIF twin), e4Node (on black, for screen blending) and e4NodeAlpha (keyed), with the bulb's centre and radius and the points where the threads leave the image (threadTop, threadEnd, threadBottom). src/experience/tokens.ts and src/styles/tokens.css — the sampled palette; every brass WORD uses --color-brass-text (utility text-brass-text), --color-brass is for lines, borders and fills. The UI kit you build with: src/components/ui/BrassButton.astro (variants default, primary, quiet, small, chevron) and src/components/ui/Panel.astro (the one panel of the site: black face, brass border, inset blue circuit line; classes .panel, .panel--large, .panel__title, .panel__close; inside it strong and .brass are brass, .strike is a struck-through price, .sr-only is hidden from sight) — read both files and src/styles/global.css before you write markup. Look at the three source images in cellestial-assets/images/e-roots/.

Files this scene owns: src/experience/roots/** (index.ts must export "mount", typed MountRoots); src/components/scenes/Roots.astro (renders the whole <main id="roots" tabindex="-1"> — in the document flow, opaque, z-index 1 — and includes Close.astro at its bottom); src/components/scenes/Close.astro (F1 and F2); scripts/assets/roots.mjs and its outputs under public/cellestial/roots/ (ONLY if you need further derivations of the pack images; the module contract is in the header of scripts/build-assets.mjs; run with "node scripts/build-assets.mjs modules"); and, only if you need it, a test page src/pages/dev/roots.astro.

THE PAGE IS ALREADY THERE. src/pages/index.astro is the shell: read it, with its header comment and its stylesheet (the scroll model, which layers each scene shows, and the page without script). src/experience/main.ts mounts every scene through its mount function and src/experience/director.ts moves between them (read both). Your three files exist already as small working PLACEHOLDERS written by the core agent — src/experience/roots/index.ts, src/components/scenes/Roots.astro (which renders the five offers as plain panels) and src/components/scenes/Close.astro: replace their contents with the real scene, keeping what the shell relies on (<main id="roots" tabindex="-1">, Roots.astro including Close.astro at its bottom, the mount export). The shell's rules you must follow: (1) the page without script is html:not([data-scene]) — there is no <noscript> block; anything that means nothing without script carries the attribute data-needs-js and the shell hides it there; (2) only scripts ever set data-scene; (3) do not edit src/pages/index.astro, src/experience/main.ts, director.ts or stage.ts — if the shell is wrong or lacks something you need, work around it inside your own files and say so in your report. Also: the fixed chrome (logo and menu button) covers roughly the top-left 110x80 px on a phone — keep words and controls clear of that corner wherever it matters (the top of the ground, an open tile scrolled to the top); anchorY() is called once the scene is roots, so its values are document positions in the layout where the sky's spacer is gone; under the sky the shell keeps #roots laid out but visibility: hidden. Verify on the REAL page: /?scene=roots opens straight on the ground; add &debug and the live stage is on window.__cellestial (window.__cellestial.roots is your mounted scene, window.__cellestial.director the director; the claims store and the two dialogs are real, with /api/contact absent in dev — stub it with the harness's route step if you need a send).

WHAT TO BUILD
- E1, the soil. "tile/mirror vertically for the descent. Keep it dark; it should sit behind the glow, never compete." The derived tiles already mirror-tile (background-repeat: repeat-y); landscape on wide screens, portrait on phones, AVIF with the WebP as fallback (image-set), --color-earth behind while it loads. The top edge of the ground is where the stars crash: give it a natural, slightly uneven line against the black sky rather than a ruler-straight one.
- E6, the return button, "at the TOP of the ground": the kit's chevron button, no words (its accessible name is "Return to the sky"). Clicking it calls (await ctx.when('director')).ascend(). Without script there is no sky to return to: mark it data-needs-js.
- E4, the nodes. "5 nodes in a descending line, each deeper than the last: 1 Site · 2 Site + Systems · 3 Site + App · 4 Add-ons (AI + automation) · 5 Care." Each is the e4 sprite composited over the soil, "its threads join the E2 trunk"; "Idle: a slow breathing glow. Hover: brighter. Click: opens E5." It must look "clearly clickable — like a bulb growing on a root". Each node is a real <button> (the bulb is the target, at least 44 px, aria-expanded, aria-controls) whose accessible name is that offer's title as visually hidden text. There is NO visible label beside a node (the spec: "A small brass label beside each node is optional and not in the original spec, so confirm with Gabriel before adding it" — it has not been confirmed). Leave a good stretch of soil between one node and the next: the descent is the progression. A node whose tile has been read stays steadily lit; an unread one breathes.
- E5, the tiles. "opens over the soil when a node is clicked ... the same panel component as B10/C3, larger: dark face, brass border with a blue circuit line, short lines of plain white text with key words in brass. Clean and roomy." One tile at a time: opening a node closes any other tile. The tile opens next to its node (on a wide screen beside it, on the side with more room; on a phone directly under the bulb, the full width less the margins), is never taller than the viewport (it scrolls inside if it must) and is brought fully into view when it opens. Focus moves into the tile; its close button (the kit's .panel__close, accessible name "Close"), the Escape key, or a click outside it closes it and returns focus to its node.
  Inside: the offer's title as the heading (OFFERS[i].title), then OFFERS[i].lines — one paragraph per line, one inline <span> per segment (measured by the copy agent: inline-block or flex items swallow a segment's leading space; plain inline spans do not). brass segments in brass; strike segments struck through; srOnly segments visually hidden (they keep the word "slashed" in the text for screen readers while the eye sees "$990 → FREE"). The acceptance check, which will be run in a browser for each tile: the tile body's textContent with runs of whitespace collapsed and trimmed === offerText(OFFERS[i]), and what the eye can read === visibleText(OFFERS[i]). Render the tiles on the server (Astro), all five, complete: that markup is what a visitor without JavaScript and a search engine read. Do not print "lead" as well as "lines" (lines[0] is the lead). Add nothing: no "Includes" headings of your own, no buttons inside the tiles, no icons.
- E2, the mycelium. "procedural branching lines in blue, thicker trunk lines with thinner branches off them, small glowing joints, and a soft additive glow. The main trunk passes through each node's top and bottom threads in a descending line; secondary branches wander outward to fill the frame." The spec's own fallback ("if the code-drawn mycelium looks thin or cheap against the photo soil, generate an E2 image") is NOT available — no generated imagery is allowed — so the code-drawn network has to be genuinely good: grown-looking, irregular, tapering, hair-fine at the tips, luminous at the joints, sitting IN the soil rather than drawn on top of it. Straight segments, uniform stroke widths and neat symmetric forks are the failure to avoid. It is drawn from the measured positions of the nodes, so it meets each sprite's threads exactly at any screen size, and it is stable (seeded) — the same network on every visit and after a resize. The trunk runs from the surface to node 1, from each node to the next, and from node 5 on down to the "Claim your star" button, where it ends.
- E3, the guided light. "a brighter segment of blue / blue-white travelling along the path with a soft trailing fade, looping every few seconds toward the next unopened node. It suggests; it does not force." It runs along the trunk from the node last read (or from the surface, at first) to the next node not yet read; when a tile is closed it sets off at once from that node towards the next; when all five have been read it runs on down to "Claim your star". It never scrolls the page and never opens anything by itself.
- D2, the arrival. growFrom(x) is called at the instant a falling star hits the top edge of the ground at viewport x: "from the impact point blue light bursts downward and sideways, growing instantly into the E2 mycelium branches." The network grows out of that point — fine roots racing sideways just under the surface, the trunk racing down to node 1 and on — fast and alive, the nodes lighting as it reaches them; it resolves when the growth has passed the first node. showGrown() shows the whole network at once (used for a teleport and for reduced motion). Before either is called, the network is not visible.
- F, the Close, "the bottom of the Roots descent, dark earth". F1: "centred at the very bottom ... the B11 button component, the largest on the site: thicker brass, a stronger blue circuit line, live text "Claim your star"." F2: "directly under F1 ... noticeably smaller and quieter: dark brass skin, a dimmer blue line, live text "Contact me". No social icons." Exactly: <BrassButton variant="primary" href="/contact" data-open-claim>Claim your star</BrassButton> and under it <BrassButton variant="quiet" href="/contact" data-open-contact>Contact me</BrassButton>. Another module listens for [data-open-claim] and [data-open-contact] on the document and opens the existing build-request and message dialogs; you only render the two links. Nothing else is in this section: no heading, no footer, no small print.
- The contract (contracts.ts is exact): setActive(on) starts and stops everything that animates; surfaceY() is the viewport y of the ground's top edge right now; anchorY('top' | 'first-node' | 'close') are document y positions to scroll to (the top of the ground at the top of the viewport; node 1 comfortably in view; the two buttons in view at the bottom of the page); focusClose('claim' | 'contact') moves keyboard focus to F1 or F2 without scrolling.
- Without JavaScript: the soil, the five tiles open and readable one under another in order, the nodes as pictures, and the two links. Nothing hidden, nothing overlapping.
- Reduced motion (ctx.reducedMotion): no growth animation (showGrown), no travelling pulse (the next unread node is marked by a steady, stronger glow instead), no breathing; tiles open and close without motion.
- Keyboard: Tab reaches E6, then each node in order, then F1 and F2; Enter or Space opens a tile; Escape closes it. Visible focus rings.
- Phones (spec checklist: "Mobile pass: portrait soil, panel sizing, tap targets"): comfortable at 390x844 and at 320 px wide; no horizontal scroll; body text at least 16 px.
- Weight: animate only what is on screen; no animation frame is requested when nothing is moving; scrolling stays smooth on a throttled phone.

DRIVING IT FOR CAPTURES: in development only (import.meta.env.DEV) your module may read a few query parameters of its own on the real page — for example grow=<x> (play growFrom from that viewport x), open=<offer id>, read=<comma-separated ids> (tiles already read), t=<seconds> (freeze the animation clock) — so that every state can be captured repeatably; ?rm=1 already forces reduced motion. The stand-alone test page is optional.
`

const VERIFY = `HOW THIS SCENE IS JUDGED — "A scene that merely renders is not done; a scene that matches its reference is." Capture at 390x844 (deviceScaleFactor 2, isMobile, hasTouch) and 1440x900, and LOOK:
1. The top of the ground: the edge against the black, E6, the first node, the network.
2. Every node closed, and every tile open, at both sizes (ten tile captures). Beside the tiles, the addendum's text: is every word there, is anything there that is not in the addendum, are the bold words of the addendum the brass words on screen, is "$990" struck through with "FREE" after it and "$69/mo" struck through with "$39/mo" after it, is the word "slashed" invisible?
3. The copy check in the browser for all five tiles: textContent (whitespace collapsed, trimmed) === offerText(o); the rendered, visible text === visibleText(o). Print both comparisons.
4. The whole descent, top to bottom, cut into viewport-sized pieces: the soil dark and behind everything; the mycelium against E4_node.jpg and the spec's words — does it look grown and luminous, or thin and cheap? Does the trunk meet each node's threads exactly? Mirror seams in the soil: visible or not?
5. A node close up beside E4_node.jpg: idle (several phases of the breathing), hover, read.
6. The guided light: a burst of frames; after closing tile 1 it leaves node 1 for node 2; after all five it runs to "Claim your star".
7. growFrom at three x positions: a burst of frames from the first to the settled network.
8. The Close: F1 clearly the largest button, F2 clearly smaller and quieter directly under it, centred, nothing else.
9. JavaScript disabled, full page, both sizes. Reduced motion. 320 px wide.
10. Keyboard walk: Tab order, Enter, Escape, focus return; a screen-reader view (the accessibility tree) of one node and its tile.
11. Scrolling the whole page at 390x844 with the CPU throttled 4x (Chrome DevTools Protocol, Emulation.setCPUThrottlingRate): frame times; and animation frames requested per second when nothing should be moving.
`

const BUILD = PRE + WHAT + `
YOUR JOB: build it. Your dev-server port: 4801.

${VERIFY}
Do all of it yourself and iterate until a hard judge would accept each picture; independent reviewers will look after you. Save your captures in ${SCRATCH}/build/ and name the important ones in your report, with the layout numbers you chose (node sizes and spacing at both viewports, tile widths, type sizes) and anything in the kit you had to work around.
`

const FINDINGS = {
  type: 'object',
  properties: {
    matches: { type: 'boolean', description: 'True only if, judged hard, this scene is done: it matches the spec, the pack assets and the locked copy, with nothing left that a careful owner would send back.' },
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

const REVIEW_PRE = `You are an independent reviewer of one scene of the Cellestial Studio website redesign. The site sells websites by being one. The owner's words: "A visitor should feel in the first ten seconds that whoever built this can build something extraordinary for them — then, when they reach the offers, find plain language, honest prices, and a simple way to ask. Wonder up top, clarity underneath." The owner will judge the finished scene against its spec, its assigned assets and the locked copy, and "a scene that merely renders is not done; a scene that matches its reference is."

The scene lives in the git worktree ${WT} (branch wt/roots). You are a REVIEWER: do not edit any file in the worktree, do not commit. Put your own scripts and screenshots in the scratch directory you are given. Design authority: ${MAIN}/claude-vault/redesign/BLUEPRINT.md (read it; do not write there).
Dev server: "pnpm astro dev --port <YOUR PORT> --ignore-lock" in the background from the worktree; kill it when done ("fuser -k <PORT>/tcp"). Screenshots: playwright-core from the worktree (createRequire('${WT}/package.json')) with /usr/bin/chromium, headless. Look at every image with the Read tool (downscale anything over about 1600 px to JPEG first; cut tall captures into pieces).
Report only what you can prove — a screenshot you looked at, a number you measured, a line you read. For every finding give the evidence and the concrete fix. Rank honestly: blocker = the owner would reject the scene for it; major = clearly visible or clearly wrong; minor = polish. Do not pad the list, and do not soften it either: your judgement is the only independent one this scene gets.

`

const reviewLook = (round, previous) => REVIEW_PRE + WHAT + `
YOUR LENS — the look and the words. Port 4811. Scratch: ${SCRATCH}/review-look-${round}/.
The scene runs on the real page: /?scene=roots (add &debug for window.__cellestial; read src/experience/roots/index.ts for the development-only query parameters it understands). Use the harness scripts/shot.mjs or your own playwright script.

${VERIFY}
Make captures 1 to 9 yourself. Then judge as the owner would:
- The words. Extract each tile's text from the page and compare it with SPEC-ADDENDUM.md lines 24, 26, 28, 30 and 33 yourself (strip the ** markers and the "N. Title:" lead-in; do not trust offers.ts or its test to have done it for you): character for character. List every visible string in the whole scene and say where each comes from; anything not from the addendum or the brief is a blocker. Check the forbidden things are absent: any post-cohort offer, "Google", an ownership line in Add-ons, the care-goes-up line outside Care, any price other than $990, $69/mo and $39/mo.
- Clarity: are the tiles "clean and roomy", plain white text with the key words in brass, comfortable to read on a phone? Are the slashed prices unmistakable?
- The material: the tile is the site's one panel (pure black face, brass border, thin blue circuit line inset); the buttons are the kit's brass; F1 is the largest button on the site and F2 clearly quieter. Is everything brass, blue, white, black or earth?
- The ground: dark, behind everything, never competing. The mycelium: grown and luminous or thin and cheap; does it join the nodes' threads without a visible seam; does it read as one living network from the surface to the last button? The nodes against E4_node.jpg: "clearly clickable — like a bulb growing on a root"?
- The guided light: does it suggest where to go without forcing? The arrival (growFrom): does light burst from the point of impact down and sideways and become the network?
- Is anything cheap: banding, aliasing, hard rectangles around sprites, a seam in the soil, clipped glows, text touching borders, overflow at 390 px or 320 px?
${previous ? `
This is review round ${round}. The previous round's findings are below: check each again (fixed, partly fixed, not fixed) and say so in your verdict, then look for anything new or anything the fixes broke.
PREVIOUS FINDINGS:
${previous}
` : ''}`

const REVIEW_CODE = REVIEW_PRE + WHAT + `
YOUR LENS — behaviour, accessibility, robustness, performance. Port 4812. Scratch: ${SCRATCH}/review-code/.
Read every file under src/experience/roots/, src/components/scenes/Roots.astro and Close.astro, scripts/assets/roots.mjs if it exists, and the shell (src/pages/index.astro, src/experience/main.ts, director.ts). Then prove or refute each of these by running something:
- Contract: index.ts exports "mount" typed MountRoots and returns exactly a RootsScene; every method does what its comment in contracts.ts says (drive each from window.__cellestial.roots on /?scene=roots&debug: surfaceY while scrolling, anchorY for each landing spot — scroll there and capture, focusClose, setActive, growFrom, showGrown); the scene imports nothing from other parts of src/experience except contracts.ts, assets.ts and tokens.ts, and reaches the director only through ctx.when.
- One tile at a time; any node at any time; closing returns focus; Escape; click outside; opening a tile near the bottom of the viewport brings it fully into view; a tile never exceeds the viewport (try 390x600 and 320x568); rapid clicking across nodes; opening while the growth animation runs.
- The guided light follows the rule (next unread in order; after the fifth, the claim button); it never scrolls the page and never opens a tile.
- Without JavaScript: all five tiles open in order, readable, no overlap, both links go to /contact; E6 either goes to "/" or is marked data-needs-js and hidden. With JavaScript but the module failing to load (block the script): the page must be the same readable thing, not a set of dead closed nodes.
- Accessibility: the accessibility tree for the nodes (name = the offer's title, expanded state), the tiles (heading), the buttons; tab order; focus visible; contrast of every text colour on its background (compute the ratios; AA); tap targets at least 44 px; no horizontal scroll at 320 px; text at least 16 px; honours prefers-reduced-motion (count animation frames, look for running CSS animations).
- F1 and F2 are exactly the two links the brief gives (attributes included) and nothing else is in the Close.
- Performance: frame times while scrolling the whole page at 390x844 with the CPU throttled 4x; animation frames per second at rest; layout shift when tiles open; the network is regenerated on resize without leaking nodes or listeners (resize 30 times and count DOM nodes and listeners); image bytes and which soil file each viewport loads (AVIF used where supported).
- Robustness: resize and orientation change with a tile open; very tall and very short viewports; setActive(false) really stops everything.
- "pnpm build" passes and the built page still contains all five tiles as HTML; "pnpm exec biome check" is clean on the scene's files; "git status --short" in the worktree shows only files this scene owns.
`

phase('Build')
const build = await agent(BUILD, { label: 'build the roots and the close', phase: 'Build' })

const rounds = []
let previous = ''
for (let round = 1; round <= 2; round++) {
  phase('Review')
  const thunks = [() => agent(reviewLook(round, previous), { label: `review look and words ${round}`, phase: 'Review', schema: FINDINGS, effort: 'high' })]
  if (round === 1) thunks.push(() => agent(REVIEW_CODE, { label: 'review behaviour and access', phase: 'Review', schema: FINDINGS, effort: 'high' }))
  const reviews = (await parallel(thunks)).filter(Boolean)
  const all = reviews.flatMap((r) => r.findings)
  const serious = all.filter((f) => f.severity !== 'minor')
  log(`Round ${round}: ${all.length} findings, ${serious.length} serious; matches=${reviews.map((r) => r.matches).join(',')}`)
  const entry = { round, reviews }
  rounds.push(entry)
  if (!all.length) break
  if (round === 2 && !serious.length) break
  phase('Fix')
  entry.fix = await agent(PRE + WHAT + `
YOUR JOB: fix the review findings on the Roots and the Close, which another agent built. Your dev-server port: 4821. Scratch: ${SCRATCH}/fix-${round}/.

Read the scene's code first (src/experience/roots/**, src/components/scenes/Roots.astro and Close.astro) and the shell it lives in (src/pages/index.astro). The findings are below as JSON. For each: reproduce it; if it is real, fix it at the root; if it is not real, say exactly why. Fix every blocker and major, and every minor that is cheap and clearly right. Where a finding says something does not look right, do not tweak a constant and hope: capture it beside its asset or the spec's words, find what actually differs, change it, capture again, and repeat until a hard judge would accept it. If the current way of drawing something cannot get there, replace it. The copy is locked: a finding about words is fixed by rendering offers.ts faithfully, never by editing words.
Then re-verify the whole scene, because fixes break things:
${VERIFY}
Report per finding: fixed (how, and the capture that shows it) / not real (why) / not fixed (why, and what you tried).

FINDINGS:
${JSON.stringify(all, null, 1)}
`, { label: `fix round ${round}`, phase: 'Fix' })
  previous = JSON.stringify(all, null, 1)
  if (!serious.length) break
}

return { build, rounds }
