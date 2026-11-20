export const meta = {
  name: 'cellestial-chrome',
  description: 'Build the chrome (C1 logo, C2 three-bar menu button, C3 menu panel) in its own worktree; review against the spec and the A1 emblem; fix',
  phases: [
    { title: 'Build', detail: 'logo with "studio", three brass bars, the menu panel and its four teleports' },
    { title: 'Review', detail: 'look, behaviour, accessibility' },
    { title: 'Fix', detail: 'apply findings, re-verify' },
  ],
}

const MAIN = '/home/poe/cellestial-studio'
const WT = '/home/poe/cellestial-wt/chrome'
const SCR = '/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad'
const SCRATCH = SCR + '/chrome'

const PRE = `You are one of several agents building the Cellestial Studio website redesign: an Astro 7 static site (Tailwind 4, pnpm, TypeScript run natively by Node 26, Biome). The site sells websites by being one. The owner's bar: "A visitor should feel in the first ten seconds that whoever built this can build something extraordinary for them."

Your working copy is the git worktree ${WT} (branch wt/chrome). Work ONLY inside it, plus the scratch directory ${SCRATCH} for throwaway scripts and screenshots (create it). The main checkout ${MAIN} is being edited by other agents right now: never write there. Read from it only ${MAIN}/claude-vault/redesign/BLUEPRINT.md — the design authority for how the pieces meet; read it first. The spec is BUILD_SPEC.md and SPEC-ADDENDUM.md in your worktree (the addendum wins on conflict); read the line ranges your task names, not the whole file.

Hard rules:
- No git commit, push, checkout, stash, reset, clean, merge or rebase. The orchestrator commits.
- Edit only the files your task says you own. In particular do not edit package.json, src/experience/contracts.ts, tokens.ts or assets.ts, src/pages/index.astro, src/layouts/**, src/styles/**, src/components/ui/** (the UI kit). If the kit lacks something you need or has a defect, work within it and say so in your report. The other scenes' files (src/experience/{loader,sky,fx,roots}/**, src/components/scenes/**) hold small placeholders that other agents are replacing on other branches right now: leave them alone.
- Never touch the protected paths: workers/**, src/onboard/**, src/scripts/contact-submit.ts, src/scripts/start-flow.ts, src/scripts/start-builder.ts, public/admin/**, src/content/home.json, src/config.ts.
- Imagery: only files derived from cellestial-assets/. No generated, stock or substitute images, no icon libraries, no emoji, no social icons. The three menu bars are drawn in code and skinned with the pack's brass. No sound of any kind.
- Invent no copy. The only words in this piece are "studio" and the four menu items, exactly as quoted below.
- Code style is Biome (tabs, single quotes, semicolons, width 100): run "pnpm exec biome check --write <your files>" before finishing and fix what it reports.
- If an approach fails twice, abandon it and take another route instead of stacking fixes.
- Dev server: "PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm astro dev --port <YOUR PORT> --ignore-lock" (Cloudflare's always-pass test key; the page carries the contact dialogs) as a background process from the worktree; kill it when you finish ("fuser -k <PORT>/tcp"). Never use port 4321.
- Screenshots: the harness scripts/shot.mjs (read its header: viewports, --eval, --steps files with click / key / hover / shot / expect steps, --no-js, --reduced-motion; it exits non-zero on console errors) or your own playwright-core script (system Chromium is /usr/bin/chromium; from outside the worktree load playwright with createRequire('${WT}/package.json')). Look at every image you produce with the Read tool (downscale anything larger than about 1600 px to JPEG first; enlarge small crops so you can actually judge them). "It rendered" is not verification; "I looked, and it matches the asset and the spec" is.
- Your final message is a report to the orchestrator, not to a human: files written, how each element is built, what you measured, what you ran and saw, and every known gap, stated plainly. Never claim something works unless you ran it.
`

const WHAT = `THE PIECE — the chrome: the only things that stay on screen the whole visit (spec section C: C1, C2, C3).

The owner's test, verbatim: "Logo and three-bar menu present throughout; menu teleports match the spec's four destinations." His original description: "The logo exists in the TOP LEFT corner — circuits lit but IDLE. Under it, in the same brass style of lettering, reads "studio" — completing the logo (Cellestial / studio). That is the only persistent branding element." "A MENU BUTTON next to the logo — three brass bars — opens the menu." "Menu sections, with these names: 1. The Sky (top / landing), 2. What we build (the Roots tiles), 3. Claim your star (the bottom buttons), 4. Contact me (email / message box)." "No social media icons anywhere."

Read: BLUEPRINT.md sections 1 to 4, 6 ("Mounting", "Scene test pages"), 8 ("Menu", "No JavaScript", "Reduced motion") and 9. BUILD_SPEC.md lines 10-29 (global rules) and 160-176 (section C). SPEC-ADDENDUM.md lines 44-45. cellestial-assets/reference/original-visual-spec-sheet_2026-11-18.md, "SECTION C" (how C1 to C3 should look). src/experience/contracts.ts — MountChrome, SceneContext, Director (go and its four destinations: 'sky' | 'build' | 'claim' | 'contact'), SCENE_EVENT. src/experience/assets.ts — ASSETS.chrome.cLogo (the C emblem already blended to its idle state: 60% lit over unlit, keyed, 192 px tall, with the emblem box and the main node measured) and ASSETS.ui.brassMain / brassDark (the brass skins). src/styles/tokens.css — the palette; every brass WORD uses --color-brass-text (utility text-brass-text), --color-brass is for lines, borders and fills. The UI kit: src/components/ui/Panel.astro (the one panel of the site: black face, brass border, inset blue circuit line; classes .panel, .panel--small) and BrassButton.astro — read both and src/styles/global.css before writing markup. Look at cellestial-assets/images/a-loading/A1_c-emblem_lit.jpg, A1_c-emblem_unlit.jpg and A4_wordmark_cellestial.jpg (the lettering "studio" must feel related to).

Files this piece owns: src/experience/chrome/** (index.ts must export "mount", typed MountChrome); src/components/chrome/Chrome.astro (renders <header id="chrome"> — fixed, top left, z-index 40 — and its CSS); and, only if you need it, a test page src/pages/dev/chrome.astro.

THE PAGE IS ALREADY THERE. src/pages/index.astro is the shell: read it, with its header comment and its stylesheet. src/experience/main.ts mounts every scene through its mount function and src/experience/director.ts owns the four destinations (read both: director.go is what your menu calls). Your two files exist already as a small working PLACEHOLDER written by the core agent — src/experience/chrome/index.ts and src/components/chrome/Chrome.astro (a native popover menu): replace their contents with the real thing, keeping <header id="chrome"> (it is deliberately the first element in the body, so the menu is the first thing the keyboard reaches). The shell's rules you must follow: (1) the page without script is html:not([data-scene]) — there is no <noscript> block; anything that means nothing without script carries the attribute data-needs-js and the shell hides it there; (2) only scripts ever set data-scene; (3) do not edit src/pages/index.astro, src/experience/main.ts, director.ts or stage.ts — if the shell is wrong or lacks something you need, work around it inside your own files and say so in your report. Also: on the page without script the shell makes #chrome position: absolute (the logo heads the page and scrolls away with it); hiding the chrome while the scene is "loading" is YOUR stylesheet's job (the shell does not do it). Verify on the REAL page: /?scene=sky and /?scene=roots open straight on a scene, /?scene=loading&t=3 freezes the loading screen; add &debug and the live stage is on window.__cellestial (the director is real: your menu really teleports, through placeholder scenes).

WHAT TO BUILD
- C1, the logo. Spec: "the C emblem, small, in the idle state (between unlit and lit: circuits on but calm) ... Under it, the word "studio" in small brass live text in the wordmark style." "The only branding that stays on screen the whole visit. It reads "Cellestial / studio" together with the sky itself." The emblem image is /cellestial/chrome/c-logo.webp (alt ""); under it the live word "studio" in Quicksand, in brass (--color-brass-text or a restrained brass gradient that echoes the A4 letters), small but crisp and legible at arm's length on a phone. The two together are one link, to "/" (accessible name "Cellestial studio"); with JavaScript it calls director.go('sky') instead of navigating. Calm means calm: no flashing; at most a very slow, barely noticeable breathing of the main node's glow, and none under reduced motion.
- C2, the menu button, "next to C1": "three short horizontal bars in BRASS skin, each with a hair-thin blue line". A real <button> with a hit area of at least 44x44 px and the accessible name "Menu"; the bars skinned with the brass image, the blue line drawn in code; hover and focus-visible brighten the blue; pressed switches to the dark skin; aria-expanded follows the panel.
- C3, the menu panel, which "drops down from" the button: "the same treatment as B10: a dark face, brass border with a blue circuit line, and four lines of plain brass/white text: "The Sky" / "What we build" / "Claim your star" / "Contact me"." Use the kit's Panel (small). The four items, in that order, exactly those words, each a real link at least 44 px tall: The Sky -> href "/" and director.go('sky'); What we build -> href "#roots" and director.go('build'); Claim your star -> href "/contact" and director.go('claim'); Contact me -> href "/contact" and director.go('contact'). With JavaScript a click prevents the navigation, closes the panel and calls the director (reached only through ctx.when('director')); the director plays the teleport flash and moves the visitor — you do not. Nothing else is in the panel: no heading, no icons, no dividers with text.
- Opening and closing: the button toggles it; Escape, a click or tap outside, or choosing an item closes it; focus goes to the first item on opening and back to the button on closing. Build it so that it also opens WITHOUT JavaScript (the HTML popover attribute with popovertarget does this natively and gives light-dismiss and Escape for free; give browsers without it a sensible fallback), because without JavaScript the four links are how a visitor gets to /contact.
- Where it sits: top-left, clear of the notch and rounded corners (env(safe-area-inset-*)), small enough to leave the sky alone: on a phone the whole chrome (logo plus button) should fit in roughly the top-left 140x80 px. It sits above the sky, the soil and the offer tiles, and below the loading overlay and the dialogs.
- When it shows: the loading screen is the emblem alone, so the chrome is hidden while <html data-scene="loading"> and fades in (about 400 ms; instantly under reduced motion) when the scene changes to anything else. Only scripts ever set data-scene, so without JavaScript the chrome is simply there.
- It never traps or steals: no global key handlers except Escape while the panel is open; it must not take wheel or touch events from the sky (pointer-events only on its own controls).
- Reduced motion (ctx.reducedMotion, and the CSS media query): no drop animation, no breathing.

CHECKING THE CALLS: on the real page, wrap window.__cellestial.director.go from your capture script (page.evaluate) to record the destinations your menu asks for, and also watch what the page then does (document.documentElement.dataset.scene, scroll position, focus). A stand-alone test page is optional.
`

const VERIFY = `HOW THIS PIECE IS JUDGED — "A scene that merely renders is not done; a scene that matches its reference is." Capture at 390x844 (deviceScaleFactor 2, isMobile, hasTouch) and 1440x900, and LOOK:
1. The chrome closed, over black and over soil; an enlarged crop of the logo beside crops of A1_c-emblem_unlit.jpg and A1_c-emblem_lit.jpg: is it visibly BETWEEN them — "circuits on but calm"? Is "studio" crisp, brass, and clearly a sibling of the A4 letters? Does the lockup read as one logo?
2. An enlarged crop of the three bars: brushed brass (not a flat colour), a hair-thin blue line in each, evenly spaced; rest, hover, focus-visible, pressed.
3. The menu open at both sizes: the site's panel (pure black face, brass border, thin blue circuit line), four items, exact words, comfortable tap targets, nothing clipped at 390 px or 320 px wide; where it sits relative to the button ("drops down from it").
4. Behaviour, driven for real on the real page: click each item and record the director calls (go('sky'), go('build'), go('claim'), go('contact'), once each, and the panel closed) and where the page ends up; the logo calls go('sky'); Escape; click outside; focus moves in on opening and returns on closing; Tab order.
5. JavaScript disabled: the menu still opens, and the four links go to "/", "#roots", "/contact", "/contact".
6. /?scene=loading&t=3: hidden and not focusable; when the scene becomes "sky": it fades in. Reduced motion: no animation at all.
7. Contrast of "studio" and of the menu text on their backgrounds (compute; AA), and the accessibility tree of the header.
`

const BUILD = PRE + WHAT + `
YOUR JOB: build it. Your dev-server port: 4901.

${VERIFY}
Do all of it yourself and iterate until a hard judge would accept each picture; an independent reviewer will look after you. Save your captures in ${SCRATCH}/build/ and name the important ones in your report, with the sizes you chose (logo, type, bars, hit areas, offsets) at both viewports and anything in the kit you had to work around.
`

const FINDINGS = {
  type: 'object',
  properties: {
    matches: { type: 'boolean', description: 'True only if, judged hard, this piece is done: it matches the spec and the pack assets, with nothing left that a careful owner would send back.' },
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

const review = (round, previous) => `You are an independent reviewer of one piece of the Cellestial Studio website redesign. The site sells websites by being one; the owner's bar is: "A visitor should feel in the first ten seconds that whoever built this can build something extraordinary for them." The owner will judge the finished site against its spec and its assigned assets, and "a scene that merely renders is not done; a scene that matches its reference is."

The piece lives in the git worktree ${WT} (branch wt/chrome). You are a REVIEWER: do not edit any file in the worktree, do not commit. Put your own scripts and screenshots in ${SCRATCH}/review-${round}/. Design authority: ${MAIN}/claude-vault/redesign/BLUEPRINT.md (read it; do not write there).
Dev server: "pnpm astro dev --port 4911 --ignore-lock" in the background from the worktree; kill it when done ("fuser -k 4911/tcp"). Screenshots: playwright-core from the worktree (createRequire('${WT}/package.json')) with /usr/bin/chromium, headless. Look at every image with the Read tool (enlarge small crops; downscale anything over about 1600 px to JPEG first).
Report only what you can prove — a screenshot you looked at, a number you measured, a line you read. For every finding give the evidence and the concrete fix. Rank honestly: blocker = the owner would reject it; major = clearly visible or clearly wrong; minor = polish. Do not pad the list, and do not soften it either: your judgement is the only independent one this piece gets.

` + WHAT + `
YOUR LENS — everything: the look, the behaviour, the accessibility, the code.
The piece runs on the real page: /?scene=sky and /?scene=roots (add &debug for window.__cellestial). Use the harness scripts/shot.mjs or your own playwright script.

${VERIFY}
Make all of these captures and checks yourself and judge as the owner would. This is the one piece of branding on screen for the whole visit: is it finely made, or does it look like a placeholder? Is everything brass, blue, white or black? Then the code: read src/experience/chrome/** and src/components/chrome/Chrome.astro. index.ts exports "mount" typed MountChrome; the director is reached only through ctx.when('director'); nothing is imported from other parts of src/experience except contracts.ts, assets.ts and tokens.ts; no listener leaks; no handler swallows wheel, touch or keys it does not own (put a scrollable page under it and scroll with the pointer over the chrome); it works when the director is slow to arrive (resolve ctx.when after two seconds: a click in between must still teleport, or at least navigate — never do nothing); it works at 320 px and with a very large text size (200% zoom); the words are exactly "studio", "The Sky", "What we build", "Claim your star", "Contact me" and nothing else is visible; "pnpm build" passes; "pnpm exec biome check" is clean on the piece's files; "git status --short" shows only files this piece owns.
${previous ? `
This is review round ${round}. The previous round's findings are below: check each again (fixed, partly fixed, not fixed) and say so in your verdict, then look for anything new or anything the fixes broke.
PREVIOUS FINDINGS:
${previous}
` : ''}`

phase('Build')
const build = await agent(BUILD, { label: 'build the chrome', phase: 'Build' })

const rounds = []
let previous = ''
for (let round = 1; round <= 2; round++) {
  phase('Review')
  const r = await agent(review(round, previous), { label: `review ${round}`, phase: 'Review', schema: FINDINGS, effort: 'high' })
  const all = r ? r.findings : []
  const serious = all.filter((f) => f.severity !== 'minor')
  log(`Round ${round}: ${all.length} findings, ${serious.length} serious; matches=${r ? r.matches : 'n/a'}`)
  const entry = { round, review: r }
  rounds.push(entry)
  if (!all.length) break
  if (round === 2 && !serious.length) break
  phase('Fix')
  entry.fix = await agent(PRE + WHAT + `
YOUR JOB: fix the review findings on the chrome, which another agent built. Your dev-server port: 4921. Scratch: ${SCRATCH}/fix-${round}/.

Read the code first (src/experience/chrome/**, src/components/chrome/Chrome.astro) and the shell it lives in (src/pages/index.astro). The findings are below as JSON. For each: reproduce it; if it is real, fix it at the root; if it is not real, say exactly why. Fix every blocker and major, and every minor that is cheap and clearly right. Where a finding says something does not look right, capture it enlarged beside its asset, find what actually differs, change it, capture again, and repeat until a hard judge would accept it.
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
