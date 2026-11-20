export const meta = {
  name: 'cellestial-foundation',
  description: 'Redesign foundation: derived assets + palette, constellation data, locked offer copy, UI kit + restyle, experience core, then review and fix',
  phases: [
    { title: 'Data', detail: 'assets + palette, constellations, offer copy (parallel)' },
    { title: 'Core', detail: 'UI kit + protected-surface restyle, experience core + shell (parallel)' },
    { title: 'Review', detail: 'protected diff audit, kit visual review, core logic review' },
    { title: 'Fix', detail: 'apply confirmed findings, re-verify' },
  ],
}

const REPO = '/home/poe/cellestial-studio'
const SCRATCH = '/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad/foundation'

const PRE = `You are one of several agents building the Cellestial Studio website redesign (an Astro 7 static site). Repo: ${REPO} (git branch "redesign"). Work ONLY inside that directory, plus the scratch directory ${SCRATCH} for throwaway files (create it if missing).

Read first: ${REPO}/claude-vault/redesign/BLUEPRINT.md — the design authority for structure, ownership and decisions. Then the spec line ranges named in your task (use the Read tool with offset/limit). Do NOT read the whole of BUILD_SPEC.md; you are given exactly the part your piece needs.

Hard rules:
- Do NOT git commit, push, checkout, stash, reset or clean. The orchestrator commits. Other agents are editing OTHER files in this same working tree right now: touch only the files your task says you own, and never revert or "tidy" a file you do not own.
- Never touch the protected paths (BLUEPRINT section 2): workers/**, src/onboard/**, src/scripts/contact-submit.ts, src/scripts/start-flow.ts, src/scripts/start-builder.ts, public/admin/**, src/content/home.json, src/config.ts.
- Imagery: only files derived from ${REPO}/cellestial-assets/. No generated, stock or substitute images, no icon libraries, no emoji used as icons, no social icons. No sound or audio of any kind.
- Invent no copy: no offers, prices, taglines or helper text beyond what your task quotes.
- Code style is Biome: tabs, single quotes, semicolons, line width 100. Before finishing run: pnpm exec biome check --write <the files you own> and fix what it reports.
- If an approach fails twice, abandon it and take another route instead of stacking fixes.
- A dev server, if you need one: run "pnpm astro dev --port <YOUR PORT> --ignore-lock" as a background process and kill it when you finish ("fuser -k <PORT>/tcp"). Never use port 4321. Prefix with PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA when a page shows the contact form (Cloudflare's always-pass test key).
- Screenshots: playwright-core is installed in the repo; system Chromium is /usr/bin/chromium (headless WebGL works). From a script outside the repo, load it with createRequire('${REPO}/package.json'). Look at every image you produce with the Read tool — "it rendered" is not verification, "I looked and it matches" is.
- Your final message is a report to the orchestrator, not to a human: files written, key decisions and measurements, anything unfinished or uncertain, and exactly what you ran and saw to verify. Be precise and honest. Never claim something works unless you ran it.
`

const TASK_A = PRE + `
TASK A — Asset pipeline and palette.

Spec: BUILD_SPEC.md lines 10-56 only (global rules, colour samples, asset index, image prep notes). BLUEPRINT sections 4 and 5.

Deliver:
1. scripts/build-assets.mjs — a Node script (sharp is installed as a devDependency) that derives every web asset from cellestial-assets/images/** into public/cellestial/. Idempotent; run with "node scripts/build-assets.mjs". After its own derivations it must import and run every scripts/assets/*.mjs module that exists (each "export default async function (ctx)" receiving { sharp, src(rel), out(rel) }), so later scene agents can add derivations without editing your file. Outputs are checked in (the Cloudflare build never runs this script).

   Derivations (WebP; add AVIF only where it clearly helps the big photos; keep the whole set tight, well under about 1.5 MB in total):
   - loader/c-unlit.webp and loader/c-lit.webp: the SAME framing for both so they can be cross-faded and masked pixel-registered. The two sources are the same render at the same scale on different canvases: unlit is 2576x1438 with the C bounding box about 1043x1207 at +767+119; lit is 2048x2048 with the C bounding box about 1042x1208 at +502+421. Verify the registration yourself (difference image or a 50% overlay) and correct any pixel offset; the brass struts must coincide exactly. Leave enough margin around the C for the lit glow around the main node (the large round node at the lower-right tip). About 1400px on the long side.
   - loader/wordmark.webp: the A4 full frame (it is the loader's end state), about 2048px wide.
   - sky/b3-core.webp (kept on black, it is used additively); sky/b3-ring.webp (black keyed to alpha — it must occlude what is behind it: clean edge, no dark halo, the blue glow in the cracks kept as soft alpha); sky/b4-empty.webp (keyed to alpha); sky/b5-lit.webp (keyed to alpha with its glow as soft alpha, plus sky/b5-lit-add.webp left on black for additive use). Trim each to its content plus a small margin. Sizes: 512px for core, B4 and B5; 1024px for the ring.
   - roots/soil-landscape.webp (+ .avif) and roots/soil-portrait.webp (+ .avif): crop away the edge vignette, then MIRROR-TILE vertically (the image stacked on its own vertical flip) so it repeats seamlessly down a very long page with background-repeat: repeat-y. Keep it dark. Landscape about 1920px wide, portrait about 1080px wide.
   - roots/e4-node.webp (on black, for screen/additive compositing) and roots/e4-node-alpha.webp (keyed). Trim, but keep the full threads at the top and bottom of the bulb.
   - ui/brass-main.webp and ui/brass-dark.webp: cropped from the even middle third of each skin (the skins have uneven light: bright top-right and a darker band down the left — avoid both), about 1024x512, usable as a CSS background on buttons and panel borders. It must read as brushed brass at button scale, not as a blurry gradient: check it at 100% on a 280x56 rounded-button mock.
   - chrome/c-logo.webp: the C emblem for the top-left logo in its idle state (spec C1: "the lit image at reduced brightness/glow, or blend 60% lit over unlit"). Make the blend from your registered pair, key black to alpha (it also sits over soil), trim, about 192px tall.
   - Leave public/favicon.* alone.

2. The palette, sampled from the images (medians of clean regions, never single pixels; report the regions you sampled and the values): brass (A4 letter body mid-tone), brass-hi (specular highlight), brass-lo (shadowed brass), blue (the lit circuit lines in A1 lit), blue-white (centre of the B3 core), earth (average of the dark soil).
   - src/styles/tokens.css: ONLY a Tailwind 4 "@theme { ... }" block (and comments) defining --color-black (#000), --color-brass, --color-brass-hi, --color-brass-lo, --color-brass-dim (brass at 20% alpha), --color-blue, --color-blue-white, --color-white (white at 90% alpha), --color-earth, PLUS the legacy alias names mapped onto the new palette so existing utility classes keep working: --color-night (black), --color-soil (earth), --color-card (a near-black panel face), --color-root, --color-root-featured, --color-hairline (brass about 14% alpha), --color-border (brass about 32% alpha), --color-moss (brass-lo), --color-heading (brass), --color-body (white 90%), --color-secondary (white about 76%), --color-muted (white about 66%), --color-label (brass), --color-faint (white about 50%), --color-glow (blue), and --color-tier-site, --color-tier-systems, --color-tier-app, --color-tier-companion, --color-tier-slot (legacy; map to blue). No font tokens (another agent owns fonts).
   - src/experience/tokens.ts: the same colours as exported constants for canvas and WebGL, both hex strings and [r, g, b] triples in 0-1 (for example: export const BLUE = '#...'; export const BLUE_RGB = [..] as const;).

3. src/experience/assets.ts — a typed manifest: for every derived file its public URL (starting /cellestial/...), its pixel width and height, and the measurements the scenes need, all in that derived image's own pixel coordinates:
   - c-unlit / c-lit: the C bounding box; centre and radius of the main node.
   - wordmark: bounding box of the whole wordmark; of the C emblem inside it; the main node centre and radius; centre and radius of the small star above the "i"; and a tight bounding box for each of the nine letters e, l, l, e, s, t, i, a, l in reading order.
   - sprites: visual centre and radius of the disc for b3-core, b4-empty, b5-lit; for e4-node the bulb centre and radius plus the x position where the threads leave the top edge and the bottom edge; for the ring the ellipse centre and semi-axes.
   Measure by analysis (sharp raw pixel buffers and thresholds), then VERIFY by drawing the boxes and circles over each image and looking at the result. Wrong measurements here break the loader animation, so check every one by eye.

Verify and show your work in ${SCRATCH}/assets/ (PNG contact sheets; Read each one and fix what is wrong): every keyed sprite composited over pure black AND over a soil crop (proving no halo and no visible box); the two brass crops as 280x56 rounded buttons; the soil tile repeated three times vertically (proving the seam is invisible); the lit/unlit registration overlay; the annotated measurement overlays. Report the total bytes of public/cellestial.

Files you own: scripts/build-assets.mjs, scripts/assets/** , public/cellestial/**, src/styles/tokens.css, src/experience/tokens.ts, src/experience/assets.ts.
`

const TASK_B = PRE + `
TASK B — The twelve constellations as data.

Spec: BUILD_SPEC.md lines 112-133 only (B3, B4, B5, B6). BLUEPRINT section 9 items 2-4.

Source data already in the repo: public/sky/sky.json, built by scripts/build-sky-data.mjs from the Yale Bright Star Catalog (public domain) and d3-celestial's constellation lines (BSD 3-Clause). Format: stars = [ra x100 deg, dec x100 deg, vmag x100, (B-V) x100][] ; lines = { n: name, p: number[][] }[] where each polyline is [ra, dec, ra, dec, ...] in degrees x100.

Deliver:
1. Move public/sky/sky.json to scripts/data/sky.json (it must no longer ship to visitors; delete the now-empty public/sky). Update scripts/build-sky-data.mjs so it writes there, and update the matching ignore entry in biome.json (only that one line).
2. scripts/build-constellations.mjs, which generates src/content/constellations.ts (checked in, with a "generated — do not edit by hand" header and the data credit line from sky.json). For the 12 constellations in THIS order — Virgo, Libra, Scorpius, Sagittarius, Capricornus, Aquarius, Pisces, Aries, Taurus, Gemini, Cancer, Leo:
   - stars: every distinct vertex of that constellation's line figure — the full real stick figure, do not simplify (expect 13, 6, 14, 25, 10, 15, 22, 4, 12, 12, 5, 9 = 147). Match each vertex to its catalogue star (nearest). A few vertices have no catalogue star within 0.3 degrees in this magnitude-limited file: keep them anyway with magnitude 5.0 and say which.
   - position: a gnomonic (tangent-plane) projection centred on the figure's own centre, NORTH UP and EAST TO THE LEFT — the way the constellation looks in the night sky, not its mirror image. Handle right-ascension wrap at 0/360 degrees (Pisces, Aquarius). Normalise to a unit box: centre the figure's bounding box on (0, 0) and scale so the larger half-extent is exactly 1, keeping the aspect ratio; y points up. Round to 4 decimals. Also export each figure's aspect (width / height of its bounding box).
   - lines: index pairs [a, b] into the stars array, de-duplicated.
   - mag (number) and the catalogue ra / dec in degrees (2 decimals) for provenance.
   - Virgo only: "epicentre" = the index of the star replaced by Cellestial's own star (B3, "centre of the first constellation"). Choose the hub of the figure: the highest-degree vertex nearest the figure's centre. This should come out as Porrima (gamma Virginis, RA about 190.4, Dec about -1.4) — verify and report. That star has slot: null.
   - slot: every other star gets a SlotId "slot-N", N = 1..146, numbered BRIGHTEST FIRST across all twelve constellations (ascending magnitude; ties broken by constellation order, then star index). The contact Worker can only name slot-1..slot-99 in its email, so the brightest 99 get those numbers.
   - meaning, verbatim, exactly these strings: Virgo "the virgin birth"; Libra "the price paid"; Scorpius "the conflict"; Sagittarius "the victor"; Capricornus "sacrifice and life"; Aquarius "living water poured out"; Pisces "His people"; Aries "the Lamb"; Taurus "He comes to judge"; Gemini "His twofold nature"; Cancer "His people held safe"; Leo "the Lion of the tribe of Judah". Also export FINAL_LINE = 'Jesus is King.' (written after Leo completes).
   Typed exports: CONSTELLATIONS (readonly Constellation[]), SLOT_COUNT (146), FINAL_LINE, the types Constellation and ConstellationStar, and helpers slotToStar(slot) returning { constellation: number; star: number } | null, starToSlot(constellation, star), and isSlotId(v: unknown): v is SlotId accepting exactly slot-1..slot-146 with no leading zeros. Import the SlotId type from '../experience/contracts.ts' (type-only import).
3. src/content/constellations.test.ts (node:test; this Node runs .ts files directly — follow the style of the existing src/sky/*.test.ts): order and names; star count per figure; 146 distinct slots covering 1..146 and exactly one null (Virgo's epicentre); slots are brightest-first; every line index valid and every star on at least one line; each figure connected (or, if the source data draws a figure in separate pieces, assert the real number of pieces and say so in your report); every coordinate within [-1, 1] and the larger half-extent exactly 1; meanings exact; isSlotId edge cases (slot-0, slot-147, slot-01, 'slot-1 ', numbers, null).

Verify by LOOKING: render all twelve figures to one contact sheet PNG (dots sized by magnitude, thin lines, the name as a caption, the epicentre marked) at ${SCRATCH}/constellations.png (sharp can rasterise an SVG string). Read it and check every shape against what that constellation really looks like with north up and east left. Leo: the Sickle (a backwards question mark) on the west side, which is the RIGHT, with Regulus at its base and the triangle with Denebola to the left. Scorpius: Antares right of centre, the head and claws up to the right, the tail curving down to the lower LEFT and hooking back up at the stinger. Sagittarius: the Teapot, spout to the right (west). Gemini: Castor and Pollux at the upper left. If a figure is mirrored or upside down your projection is wrong — fix it.

Run: node scripts/build-constellations.mjs && node --test src/content/constellations.test.ts
Files you own: scripts/build-constellations.mjs, scripts/build-sky-data.mjs (output path only), scripts/data/**, public/sky/** (delete), biome.json (that one ignore line), src/content/constellations.ts, src/content/constellations.test.ts.
`

const TASK_C = PRE + `
TASK C — The locked offer copy as data.

Spec: SPEC-ADDENDUM.md lines 22-38 (the five Roots tiles, LOCKED VERBATIM, and the pricing rules); BUILD_SPEC.md lines 150-153 (B10) and 217-220 (E5); BLUEPRINT section 9 item 6.

Deliver:
1. src/content/offers.ts — typed, no dependencies:
   - OFFERS: readonly Offer[], five, in order, with ids site, systems, app, addons, care.
   - Each has: id; title — exactly "Site", "Site + Systems", "Site + App", "Add-ons — AI + automation", "Care" (the bold lead-in of each tile without its list number and without the trailing colon); short — the name used in the sky's breakdown panel: "Site", "Site + Systems", "Site + App", "Add-ons", "Care"; lead — the first sentence of the body, verbatim, used as that offer's single line in the breakdown panel ("A custom site built for your business." / "Everything in Site, plus the work behind it wired in." / "Everything in Site, plus a real app your customers actually use." / "Upgrades that take work off your plate." / "What keeps your site alive after launch."); and lines: Segment[][].
   - Segment = { text: string; brass?: true; strike?: true; srOnly?: true }.
   - The body is everything after the "N. Title:" lead-in. Concatenating every segment's text within a line, and joining the lines with a single space, must reproduce the addendum's tile text CHARACTER FOR CHARACTER once the markdown ** markers are removed: same punctuation, same em dashes, same arrows, same spaces. Nothing added, dropped or reordered.
   - brass: true marks exactly the spans that are bold in the addendum.
   - Slashed prices: "**$990 slashed → FREE**" becomes three brass segments — { text: '$990', strike: true }, { text: ' slashed', srOnly: true }, { text: ' → FREE' } — so the old price renders struck through, the word "slashed" stays in the text (for screen readers and so the DOM text matches the addendum exactly) but is visually hidden, and the arrow and new price show. The same for "**$69/mo slashed → $39/mo**". Choose the whitespace split so the concatenation is exact AND the visible text (srOnly segments removed) reads "$990 → FREE" and "$69/mo → $39/mo" with single spaces.
   - The parenthetical "(Note: ...)" lines in the addendum are instructions to the builder, NOT tile copy: leave them out.
   - lines groups the body into natural short lines, one per sentence or tight pair of sentences, following the tiles' own structure (what it is / what is included / price / what you own), so a panel can set them as separate lines.
   - Export offerText(o: Offer): string (the exact plain text) and visibleText(o: Offer): string (srOnly segments removed).
2. src/content/offers.test.ts (node:test; this Node runs .ts files directly; mirror the style of src/sky/*.test.ts): read SPEC-ADDENDUM.md at test time (resolve the path from import.meta.url), extract the five tile paragraphs, strip the ** markers, drop the "N. Title:" lead-in, and assert offerText(o) === the addendum text exactly for each; assert titles; assert the brass spans equal the addendum's bold spans exactly, in order; assert the Add-ons tile has no ownership wording (no "own"); assert "Their care goes up" appears only in Care; assert "Google" appears nowhere; assert the only dollar amounts anywhere are $990, $69/mo and $39/mo; assert the Site tile's visible text contains "$990 → FREE" and "$69/mo → $39/mo"; assert no line is empty.
3. src/content/stars.json — the published registry of stars that are lit for every visitor. It starts as the empty array [] because the sky starts EMPTY. (A future entry looks like { "slot": "slot-12", "ask": "exactly what was asked" }.)

Run: node --test src/content/offers.test.ts
Files you own: src/content/offers.ts, src/content/offers.test.ts, src/content/stars.json.
`

const KIT_API = `The UI kit API (fixed — both the kit agent and the core agent code against exactly this):
- src/components/ui/BrassButton.astro. Props: variant?: 'default' | 'primary' | 'quiet' | 'small' | 'chevron'; href?: string (renders <a>, otherwise <button type={type ?? 'button'}>); type?: 'button' | 'submit'; label?: string (aria-label, required for chevron); class?: string; every other attribute (id, data-*, disabled, hidden ...) is passed through to the element. The label text is the default slot. Global classes: .brass-btn plus .brass-btn--primary | --quiet | --small | --chevron, so markup created by scripts gets the same look.
- src/components/ui/Panel.astro. Props: as?: 'div' | 'section' | 'aside' | 'article' | 'dialog' (default 'div'); size?: 'small' | 'large'; class?; other attributes passed through. Global classes: .panel, .panel--small, .panel--large, .panel__title, .panel__close, and inside a panel: strong and .brass render in brass, .strike is a struck-through old price, .sr-only is visually hidden.
- Dialogs: <dialog id="claim-dialog"> containing <form id="claim-form"> (hidden input [data-star-input], a [data-turnstile-slot], button[type=submit], [data-status]) and a close button [data-claim-close]; <dialog id="contact-dialog"> containing <form id="contact-box-form"> (same form without the star input) and a close button [data-contact-close]. Components: src/components/ClaimDialog.astro and src/components/ContactDialog.astro.
`

const TASK_D1 = PRE + `
TASK D1 — Type, global styles, the UI kit, and the restyle of the protected surfaces. Your dev-server port: 4401.

Already written by another agent (read them): src/styles/tokens.css (the palette @theme block and legacy aliases), public/cellestial/ui/brass-main.webp and brass-dark.webp, src/experience/assets.ts, src/experience/tokens.ts.
Spec: BUILD_SPEC.md lines 10-29 (global rules), 150-158 (B10 panel and B11 button — the base components), 168-171 (C2 + C3, the panel family), 217-239 (E5, E6, F1, F2 — the button variants), 247 (G3). SPEC-ADDENDUM.md lines 10-20.
Look at the material you are matching before you write any CSS: cellestial-assets/images/a-loading/A4_wordmark_cellestial.jpg and A1_c-emblem_lit.jpg — brushed brass forms with ONE thin glowing blue circuit line running through them and small round nodes at the line ends — and the two brass skins.

${KIT_API}
Another agent is rebuilding the homepage (src/pages/index.astro, src/experience/**, src/components/scenes/**, src/components/chrome/**) at the same time as you and is deleting the old homepage components. Do not depend on the homepage for anything: verify on your own showcase page.

Deliver:
1. Type. astro.config.mjs: replace the two font entries with Quicksand (fontProviders.google(), cssVariable '--font-quicksand', weights 400, 500, 600, 700 or the variable range if the provider supports it, normal style, latin subset, fallbacks ['ui-rounded', 'system-ui', 'sans-serif']). src/layouts/Base.astro: preload it and drop the two old <Font> tags; theme-color #000000; replace the inline motion script with one that sets <html data-motion="off|on"> from (prefers-reduced-motion: reduce) ONLY — no localStorage switch any more — with "?rm=1" in the URL forcing "off", and that keeps it in sync when the OS setting changes. Keep the skip link, restyled.
2. src/styles/global.css: @import "tailwindcss"; @import "./tokens.css"; then an @theme block mapping --font-sans, --font-mono and --font-display to var(--font-quicksand); base styles (black body, white-90 copy, Quicksand, a blue focus-visible ring); and the legacy helper classes that protected markup and scripts still emit, restyled to the new look: .display (brass, Quicksand 600, tight), .eyebrow, .pill, .pill--primary (must now LOOK like the brass button), .pill--secondary. html[data-motion="off"] still kills animations and transitions. Remove .sky-canvas and anything only the old homepage used.
3. The UI kit, exactly per the API above:
   - BrassButton: B11 is the base; E6, F1 and F2 are variants. A rounded (pill) brass body skinned with /cellestial/ui/brass-main.webp with a real metal feel (subtle bevel: light top edge, dark bottom edge, a soft shadow on black); ONE thin --color-blue circuit line running just inside its edge all the way round, with two or three tiny round nodes on it (inline SVG or pseudo-elements — drawn in code, never baked into an image); the label as live text, engraved dark on the brass. Hover and focus-visible: the circuit line brightens and gains a soft glow. Active: switches to /cellestial/ui/brass-dark.webp and the text becomes pale brass. primary (F1) is the largest button on the site — thicker brass, a stronger blue line. default is B11. quiet (F2) is noticeably smaller and quieter: the dark brass skin, a dimmer blue line, pale-brass text. small is compact, for inside panels. chevron (E6) is the same component shaped as an upward chevron/arrow with the blue circuit line rising through it, no words. Tap targets at least 44x44px. Text must meet WCAG AA contrast on both skins (measure it). Disabled state. Styles go in the component as <style is:global> under the .brass-btn namespace.
   - Panel: a pure #000 face, a thin brass border skinned with the BRASS skin, and a thin --color-blue circuit line inset in the border with small round nodes at two or three corners. Inside: short lines of plain white text, key words in brass. Clean and roomy, never busy. Must also work as <dialog class="panel"> (style ::backdrop: black at about 60% — no blur needed).
4. Restyle, surface only (BLUEPRINT section 2 says exactly what must not change — re-read it now):
   - src/components/ContactForm.astro: class attributes and the <style> block only. Fields with black faces, brass hairline borders, white text and a blue focus ring; pale labels; Send becomes the brass button (it may keep or change its class names, but stays button[type=submit] with the same disabled binding); readable status text. Nothing else in that file changes.
   - src/components/ClaimDialog.astro: becomes a .panel dialog. Keep #claim-dialog, #claim-form, [data-claim-close], aria-labelledby, and the <ContactForm id="claim-form" turnstile="explicit" withStar /> usage. Title "Claim your star" in brass. The old lede was two sentences; the second ("Your star stays lit while you write.") is no longer true (a star is now claimed only on send): keep only the first sentence, "Tell us what you want to build." A bottom sheet on phones, centred on desktop, never taller than the viewport (scroll inside). The Turnstile iframe needs at least 300px of width: keep the existing narrow-screen scale rule.
   - NEW src/components/ContactDialog.astro per the API above: title "Contact me", a close button, <ContactForm id="contact-box-form" turnstile="explicit" />. No other copy.
   - src/pages/contact.astro: restyle the wrapper and header classes only, so the page is black / brass / Quicksand with the brass button. The <script> blocks and the form usage stay byte-identical.
   - src/pages/start/index.astro and src/pages/start/new.astro: they pick up the new palette through the legacy token aliases. Adjust classes only where something is unreadable (the QR container must stay white so the code scans). Scripts and data-* attributes untouched.

Verify by LOOKING, at 390x844 (deviceScaleFactor 2, mobile) and 1440x900. Build a temporary showcase page src/pages/kit.astro (DELETE IT before you finish) with every button variant in rest, hover, pressed, focus-visible and disabled states on black and on the soil (/cellestial/roots/soil-landscape.webp), the chevron, a small panel with five short lines, a large panel with a long paragraph containing <strong> words and a struck price, and both dialogs (open them with showModal()). Write a throwaway playwright-core script in ${SCRATCH}/kit/ to capture it. Judge it hard against the A1/A4 material: is the brass convincingly the same metal? Is the blue line thin, crisp and softly glowing like the circuit line in A4? Does the button look like something a craftsman made, or like a gradient with a border? Iterate until it is right — every scene uses this kit, so it sets the bar for the whole site. Then capture /contact and /start/new and /start/ (it shows "This link is incomplete" without a valid hash; fine).
Prove the protected surfaces are logic-identical: "git diff -- src/components/ContactForm.astro src/pages/contact.astro src/pages/start" shows only class and style changes; "git status --short workers src/onboard src/scripts/contact-submit.ts src/scripts/start-flow.ts src/scripts/start-builder.ts public/admin src/content/home.json src/config.ts" prints nothing. Run "pnpm build" at the end; if it fails only because of the homepage files the other agent is still writing, say so and do not touch them.

Files you own: astro.config.mjs, src/layouts/Base.astro, src/styles/global.css, src/components/ui/**, src/components/ContactForm.astro, src/components/ClaimDialog.astro, src/components/ContactDialog.astro, src/pages/contact.astro, src/pages/start/*.astro, and your temporary src/pages/kit.astro.
`

const TASK_D2 = PRE + `
TASK D2 — The experience core: stage, director, claims, the two flows, the page shell with working stub scenes, and the screenshot harness. Your dev-server port: 4402.

Read: BLUEPRINT.md in full; src/experience/contracts.ts (the contract — you implement it, you do not edit it); src/content/constellations.ts; src/content/offers.ts; src/content/stars.json; src/experience/assets.ts; src/experience/tokens.ts; and the OLD flow you are replacing: src/scripts/claim-controller.ts with src/sky/claim.ts, plus the protected src/scripts/contact-submit.ts (read-only: you call wireContactForm, you never edit it).
Spec: BUILD_SPEC.md lines 60-67 (scene flow), 155-158 (B11), 173-176 (C4), 227-249 (F and G). SPEC-ADDENDUM.md lines 5-20 and 40-45.

${KIT_API}
The kit, the dialogs, global.css and Base.astro are being written by another agent RIGHT NOW (about 30 minutes). Write your markup against the API above. Start with the parts that do not need the kit (stage, motion, quality, claims, director, harness). Before your browser verification, check that src/components/ui/BrassButton.astro, src/components/ui/Panel.astro and src/components/ContactDialog.astro exist; if they do not yet, wait and re-check (sleep in a loop, up to 40 minutes) rather than writing your own copies.

Deliver:
1. src/experience/stage.ts — register(name, impl), when(name): Promise, get(name) for the Stage parts in contracts.ts. With "?debug" in the URL the live Stage is exposed as window.__cellestial.
2. src/experience/motion.ts — reducedMotion() (reads html[data-motion], which Base.astro sets before first paint), onMotionChange(fn), a shared RAF ticker onFrame(fn) returning an unsubscribe that pauses while the tab is hidden, and a few easing helpers.
3. src/experience/quality.ts — move src/sky/quality.ts here with its test, keeping the tested governor behaviour; change the four levels to generic fields the new scenes can use: { dpr: 2 | 1.5 | 1; detail: 1 | 0.75 | 0.5 | 0.35 }.
4. src/experience/claims.ts — the ClaimsStore. Sources: the published registry (src/content/stars.json; validate with isSlotId; ignore bad entries) and this device (localStorage 'cellestial:claims' = JSON array of { slot, ask }; the picked star in sessionStorage 'cellestial:picked'; a waiting ask in localStorage 'cellestial:unplaced'). Storage can be blocked or corrupt: everything must still work for the visit. The registry wins on conflict. recordSent(ask, slot): a valid, not-yet-lit slot is added and 'claimed' is emitted; null or an already-lit slot stores the ask as unplaced and emits 'unplaced'. place(slot) moves the waiting ask onto an empty star. pick() refuses lit stars. A pure core plus a thin storage adapter so it is unit-testable: src/experience/claims.test.ts (node:test) covers all of the above, including "no send, no claim".
5. src/experience/claim-flow.ts — the ClaimFlow, replacing src/scripts/claim-controller.ts (delete the old file). It drives both dialogs and MUST reuse wireContactForm from '../scripts/contact-submit.ts' the way the old controller did (onSent; onFail resets Turnstile; onStart returns the stale-submit guard) and the same explicit Turnstile rendering (load https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit once, lazily; render into [data-turnstile-slot] with { sitekey, theme: 'dark', size: 'flexible' }; reset when a dialog is reopened) — one widget per dialog. Behaviour:
   - openClaim(slot?): slot defaults to claims.picked(). Sets the hidden [data-star-input] to the slot id, or '' when there is none. showModal(), focus the first field.
   - The ask is captured when a submit STARTS (read the message field inside onStart — wireContactForm resets the form on success) and committed only in onSent: claims.recordSent(ask, slot). A failed or stale send records nothing.
   - After the existing "Sent." beat (about 1.4s) the dialog closes; then director.showStar(slot) if a star was claimed, or director.go('sky') if the ask is waiting to be placed.
   - openContact(): the plain message box; closes after the same beat on success. No claim.
   - Triggers, delegated on document: [data-open-claim] (optional data-slot), [data-open-contact], the dialogs' close buttons, and a click on the backdrop. Without JS those triggers are plain links to /contact; you only enhance.
   - Nothing else is ever posted, and nothing is ever added to the message.
6. src/experience/director.ts — the Director. Owns <html data-scene>, fires SCENE_EVENT, and owns the scroll model of BLUEPRINT section 3 (scroll locked in the sky; the #sky-window spacer collapsed or restored with scrollTop corrected in the same frame). Calls scene parts through stage.when(). Implement EVERY transition now in its simple form — a fade through black (about 250ms out, swap, 250ms in): go(dest) for all four destinations exactly as BLUEPRINT section 8 "Menu" says, descend(), ascend(), showStar(slot) (make sure the scene is the sky, then sky.focusStar(slot, { ignite: true })). This simple form is ALSO the final reduced-motion behaviour, so make it good. Structure the code so a later agent can replace the motion-on path of descend(), ascend() and go() with the full choreography by filling in clearly marked functions; when motion is on, go() should already call fx.teleportFlash(swap, dir) with dir derived from the order sky < build < claim = contact. Ignore a transition requested while one is running. Move keyboard focus sensibly after each transition.
7. src/experience/main.ts — boot per BLUEPRINT section 7: the query parameters (scene, debug, rm, t); create claims, claimFlow and director; mount the loader at once; load sky, roots, fx and chrome with dynamic imports so three.js can never land in the first chunk; reduced motion or ?scene=... skips the loader; when loader.done resolves the scene becomes 'sky'. If any part fails to load, the page must degrade to the readable Roots, never to a black screen.
8. Stub scenes that satisfy the contract, so the whole page already works end to end in its simple form. Each will be replaced by a scene agent: keep them small and plainly placeholders, but correct.
   - src/experience/loader/index.ts and src/components/scenes/Loader.astro: the #loader overlay; done resolves immediately.
   - src/experience/sky/index.ts and src/components/scenes/Sky.astro: #sky-canvas (a plain black canvas) and #sky-ui holding the B11 button (BrassButton default, text exactly "See what holds up the sky", hidden until roundComplete(); the stub may reveal it on the first wheel, swipe or key) wired to director.descend(). Every SkyScene method is a safe no-op or a resolved promise.
   - src/experience/roots/index.ts, src/components/scenes/Roots.astro and src/components/scenes/Close.astro: <main id="roots">. The five offers rendered server-side from src/content/offers.ts as real, readable HTML (an <article> per offer: its title, then its lines; brass, strike and srOnly segments rendered with the kit classes) — this markup is also the no-JS and search-engine content. A stub E6 at the top: BrassButton chevron, label "Return to the sky", wired to director.ascend(). Close: F1 <BrassButton variant="primary" href="/contact" data-open-claim>Claim your star</BrassButton> and directly under it F2 <BrassButton variant="quiet" href="/contact" data-open-contact>Contact me</BrassButton>, centred, nothing else. RootsScene methods real where trivial (surfaceY, anchorY, focusClose) and resolved promises otherwise.
   - src/experience/fx/index.ts: #fx-canvas; teleportFlash is the simple fade calling swap at the midpoint; impact is a no-op; warp resolves after ms.
   - src/experience/chrome/index.ts and src/components/chrome/Chrome.astro: a working placeholder <header id="chrome">: the logo image (/cellestial/chrome/c-logo.webp) with the word "studio" under it, a three-bar menu button, and a Panel with exactly "The Sky" / "What we build" / "Claim your star" / "Contact me" as links (#sky, #roots, /contact, /contact when there is no JS) wired to director.go().
9. src/pages/index.astro — the shell of BLUEPRINT section 3; title and description still come from src/content/home.json meta. Remove the old homepage: delete src/components/Header.astro, MotionSwitch.astro, ProofChips.astro, Sky.astro, SkyAnchor.astro, SkySlot.astro, src/components/sections/**, src/sky/** (after moving quality), public/stars/**, src/scripts/claim-controller.ts. Grep to be sure nothing still imports them. A <noscript> style block makes the no-JS page the logo, the five offers and the two /contact links, with the loader and sky hidden.
10. package.json "test" script becomes: node --test 'src/experience/*.test.ts' 'src/content/*.test.ts' 'src/onboard/*.test.ts' && node workers/contact/test/contact.test.mjs && node workers/auth/test/broker.test.mjs && node workers/onboard/test/onboard.test.mjs  (the three worker commands stay exactly as they are). Change nothing else in package.json.
11. scripts/shot.mjs — the screenshot harness every later agent will use: node scripts/shot.mjs --url <url> --out <dir> [--name <base>] [--viewports 390x844,1440x900] [--wait <ms>] [--eval "<js run in the page before the shot>"] [--full] [--gpu] [--reduced-motion] [--no-js] [--click "<selector>"] [--steps <file.json>]. It writes <name>-390x844.png and <name>-1440x900.png (the phone at deviceScaleFactor 2 with isMobile and hasTouch; the desktop at 1). --steps takes a JSON list of actions for multi-state captures: { eval }, { click }, { wait }, { shot: name }, { scroll: y }, { key }, { tap: [x, y] }, { wheel: dy }, { route: { url, status, json } } (to stub /api/contact). playwright-core with executablePath /usr/bin/chromium, headless; --gpu adds --use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu; --reduced-motion emulates the media feature. It prints console errors and page errors and exits non-zero if there were any, so a shot doubles as a smoke test. Document every flag in a header comment.

Verify: pnpm build, pnpm test and pnpm lint all pass. With "PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm astro dev --port 4402 --ignore-lock", use your own harness to walk the whole simple flow at both viewports and LOOK at every shot: / (sky stub) -> B11 -> roots -> open the claim dialog -> fill and submit with /api/contact stubbed to 200 {"ok":true}, and separately to 400 {"error":"x"} -> the claim is in localStorage only after the 200 -> the contact dialog; the menu to all four destinations; ?scene=roots; ?rm=1; JS disabled. Zero console errors. Confirm that "git status --short workers src/onboard src/scripts/contact-submit.ts src/scripts/start-flow.ts src/scripts/start-builder.ts public/admin src/content/home.json src/config.ts" prints nothing.

Files you own: src/experience/** except contracts.ts, tokens.ts and assets.ts; src/components/scenes/**; src/components/chrome/**; src/pages/index.astro; package.json (the test script only); scripts/shot.mjs; and the deletions in step 9. Do not edit the UI kit, global.css, Base.astro or the dialogs: if one is wrong or lacks something you need, say so in your report.
`

const FINDINGS = {
  type: 'object',
  properties: {
    verdict: { type: 'string', description: 'One paragraph: is this foundation safe to build the scenes on?' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          file: { type: 'string' },
          summary: { type: 'string' },
          evidence: { type: 'string', description: 'What you ran or saw that proves it (command output, screenshot path, line numbers).' },
          fix: { type: 'string', description: 'The concrete change to make.' },
        },
        required: ['severity', 'summary', 'evidence', 'fix'],
      },
    },
  },
  required: ['verdict', 'findings'],
}

const REVIEW_PRE = `You are reviewing the foundation of the Cellestial Studio website redesign before four scene agents build on it. Repo: ${REPO} (branch "redesign"; the work is uncommitted on top of the commit "spec freeze"). Read ${REPO}/claude-vault/redesign/BLUEPRINT.md first.
You are a REVIEWER: do not edit any file in the repo. Do not commit. Report only what you can prove — run it, diff it, or look at it. For each finding give the evidence and the concrete fix. Do not pad the list with style opinions; an empty list is a fine answer if the work is sound.
Dev server if needed: "PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm astro dev --port <YOUR PORT> --ignore-lock" in the background; kill it when done (fuser -k <PORT>/tcp). Screenshot harness: node scripts/shot.mjs (read its header comment). Scratch directory for your files: ${SCRATCH}/review/. Look at screenshots with the Read tool.
`

const REVIEW_PROTECTED = REVIEW_PRE + `
YOUR LENS — the three protected systems. Port 4411.
The owner's rule: never change routes, handlers or logic for (1) the contact form (Turnstile -> Resend), (2) /admin (the Decap broker), (3) the /start deep links. Their surfaces may be restyled; nothing else.
Check, with git:
- "git status --short" and "git diff HEAD --stat": nothing under workers/, src/onboard/, public/admin/, and no change to src/scripts/contact-submit.ts, src/scripts/start-flow.ts, src/scripts/start-builder.ts, src/content/home.json, src/config.ts.
- "git diff HEAD -- src/components/ContactForm.astro src/pages/contact.astro src/pages/start": every changed line is a class attribute or CSS. Field names, ids, maxlength, required, autocomplete, method, action, the hidden [data-star-input], both Turnstile slots and their data-sitekey, button[type=submit] and its disabled binding, [data-status], and every <script> block are unchanged.
- src/experience/claim-flow.ts against the file it replaced ("git show HEAD:src/scripts/claim-controller.ts"): it still submits ONLY through wireContactForm from src/scripts/contact-submit.ts; Turnstile is still rendered explicitly with the same options and reset on reopen and on failure; the stale-submit guard still works; the hidden star field carries a slot id or ''; nothing else is posted; nothing is appended to the message; no fetch to /api/* exists anywhere else in src/ (grep).
- A claim is recorded only after a 200 from /api/contact (read the code path, then prove it in a browser with the route stubbed to 200 and to 400 and 502, checking localStorage each time).
- Build the site (pnpm build) and confirm dist/ still contains admin/index.html and admin/config.yml byte-identical to public/admin, contact/index.html with the form posting to /api/contact, and start/index.html and start/new/index.html. Load /contact, /start/new and /start/ in the browser and confirm they work as before: build a link on /start/new (fill the form) and confirm the generated link opens the guided flow on /start/.
- Run "pnpm test": all worker tests still pass.
`

const REVIEW_KIT = REVIEW_PRE + `
YOUR LENS — does the kit look right? Port 4412.
The whole site is skinned with this kit, and the site sells websites by being one. Judge the brass button, the panel, the dialogs, the type and the restyled /contact and /start pages against the material they must match: look at cellestial-assets/images/a-loading/A4_wordmark_cellestial.jpg and A1_c-emblem_lit.jpg (brushed brass forms, ONE thin glowing blue circuit line, small round nodes), the two skins in cellestial-assets/images/brass/, and the spec text: BUILD_SPEC.md lines 10-29, 150-158, 168-171, 217-239.
Capture at 390x844 and 1440x900 with scripts/shot.mjs: "/?scene=roots" (the stub Roots shows the five offers, E6, F1 and F2), the claim dialog and the contact dialog open, the menu panel open, /contact, /start/new. Zoom in (crop and enlarge with sharp or ImageMagick) on a button and on a panel corner.
Report concrete visual defects only, each with a screenshot path and a specific CSS fix: brass that reads as a flat gradient or plastic rather than the pack's brushed metal; a circuit line that is too thick, too dull, clipped or misaligned; missing nodes; label text that fails WCAG AA on either skin (compute the ratio); buttons under 44px; F2 not clearly smaller and quieter than F1; a panel that is not a pure black face with a brass border and inset blue line; text overflow or clipping at 390px wide; type that is not Quicksand or falls back; anything that is not brass, blue, white or black; focus rings missing. Also check the legacy pages for unreadable leftovers of the old teal palette.
`

const REVIEW_CORE = REVIEW_PRE + `
YOUR LENS — is the experience core correct? Port 4413.
Read src/experience/contracts.ts, then stage.ts, main.ts, director.ts, motion.ts, quality.ts, claims.ts, claim-flow.ts, the stub scenes under src/experience/{loader,sky,roots,fx,chrome}/ and src/components/scenes/, src/pages/index.astro, src/content/constellations.ts, src/content/offers.ts, and scripts/shot.mjs.
Hunt for real defects, and prove each one by running something:
- Contract: does every part implement its interface exactly? Could a scene agent replace a stub without touching the director?
- Director: the scroll model (BLUEPRINT section 3) — spacer collapse/restore without a visual jump; scroll locked in the sky on touch devices too; re-entrancy; what happens when go() is called during the loader, during a dialog, twice quickly; focus after each transition; the back button and a reload in each scene; ?scene=roots; ?rm=1.
- Claims: every rule in BLUEPRINT section 8 "Claim" and "Lit star"; blocked or corrupt storage; the registry winning over the device; pick() of a lit star; recordSent with null; place().
- Boot: no three.js in the first chunk (inspect dist/_astro after pnpm build); a failing dynamic import degrades to the readable Roots; nothing flashes for a reduced-motion visitor before first paint.
- No JS: with JavaScript disabled the page shows the logo, the five offers and two links to /contact, and nothing is hidden or black.
- The locked copy: with scripts/shot.mjs --eval, read document.querySelector('#roots').innerText and the textContent of each offer and compare with SPEC-ADDENDUM.md lines 24-33 (after removing the ** markers and the "N. Title:" lead-ins): character for character. Confirm the visible wording of the slashed prices.
- Constellations: run the tests; spot-check three figures' star positions against the real sky yourself.
- The harness: does scripts/shot.mjs do what its header says (run each flag once)?
- pnpm build, pnpm test, pnpm lint.
`

phase('Data')
const [a, b, c] = await parallel([
  () => agent(TASK_A, { label: 'assets + palette', phase: 'Data' }),
  () => agent(TASK_B, { label: 'constellations', phase: 'Data' }),
  () => agent(TASK_C, { label: 'offer copy', phase: 'Data' }),
])
log('Data phase done; starting kit and core in parallel')

phase('Core')
const [d1, d2] = await parallel([
  () => agent(TASK_D1, { label: 'UI kit + restyle', phase: 'Core' }),
  () => agent(TASK_D2, { label: 'experience core + shell', phase: 'Core' }),
])
log('Core phase done; reviewing')

phase('Review')
const reviews = (await parallel([
  () => agent(REVIEW_PROTECTED, { label: 'review: protected systems', phase: 'Review', schema: FINDINGS }),
  () => agent(REVIEW_KIT, { label: 'review: kit visuals', phase: 'Review', schema: FINDINGS }),
  () => agent(REVIEW_CORE, { label: 'review: core logic', phase: 'Review', schema: FINDINGS }),
])).map((r, i) => ({ lens: ['protected', 'kit', 'core'][i], ...(r || { verdict: 'REVIEWER FAILED', findings: [] }) }))

const all = reviews.flatMap((r) => r.findings.map((f) => ({ lens: r.lens, ...f })))
log(`Review: ${all.length} findings (${all.filter((f) => f.severity === 'blocker').length} blocker, ${all.filter((f) => f.severity === 'major').length} major)`)

phase('Fix')
let fix = 'No findings to fix.'
if (all.length) {
  fix = await agent(PRE + `
TASK FIX — apply the review findings to the foundation. Your dev-server port: 4421.

Three reviewers examined the foundation (derived assets, palette, constellation data, offer copy, UI kit, restyled contact/start surfaces, experience core, page shell, screenshot harness). Their findings are below as JSON. For each one: reproduce it first; if it is real, fix it properly at the root (you may edit any redesign file EXCEPT src/experience/contracts.ts and the protected paths); if it is not real, say why in your report. Fix every blocker and major, and every minor that is cheap and clearly right. Do not refactor beyond the findings.
Then re-verify: pnpm build, pnpm test, pnpm lint all pass; "git status --short workers src/onboard src/scripts/contact-submit.ts src/scripts/start-flow.ts src/scripts/start-builder.ts public/admin src/content/home.json src/config.ts" prints nothing; re-capture the affected screens with scripts/shot.mjs at 390x844 and 1440x900 and LOOK at them. Make sure src/pages/kit.astro (a temporary showcase page) no longer exists.
Report per finding: fixed (how) / not real (why) / deferred (why).

FINDINGS:
${JSON.stringify(all, null, 1)}
`, { label: 'fix findings', phase: 'Fix' })
}

return { reports: { assets: a, constellations: b, offers: c, kit: d1, core: d2 }, reviews, fix }
