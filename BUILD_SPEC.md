# Cellestial Studio — Asset Pack & Build Spec
### Visual redesign · Nov 18, 2026

This pack holds every locked image for the redesign, plus a spec for everything else, which is built in code. For each element it gives what it is, where it appears, what it's for, and how it's made.

**Scope:** visual redesign only. The contact form, the /admin editor and the /start links already work and are not touched.

---

## 1. Global rules

- **Palette:** brushed brass + electric blue on pure black (`#000`). The Roots scenes swap black for dark earth. No other colours.
- **Material:** every brass UI piece (buttons, panel borders, menu bars) is skinned with `images/brass/BRASS_skin_main-light.jpg`. Thin electric-blue circuit lines are drawn in code on top, never baked into the image.
- **Blue:** one electric blue for circuits, beads, pulses and mycelium, sampled from `A1_c-emblem_lit.jpg`. The star cores are blue-white.
- **Sprites on black:** B3 core/ring, B4, B5 and E4 are on pure black. Composite them with `screen`/additive blending (or key the black to alpha) so they sit cleanly over the sky or soil.
- **Lettering:** all on-screen words are live text, never baked into images, in a rounded typeface matching the A4 wordmark. Colour is brass (sample from A4) or plain white for body copy.
- **Sound:** none. The whole site is silent.
- **No social media icons anywhere.**
- **Reduced motion:** see G3.

### Colour samples (starting points; re-sample from the images)
| Token | Use | Source |
|---|---|---|
| `--black` | sky ground | `#000000` |
| `--brass` | brass text, lines | sample from A4 letters |
| `--brass-dim` | faint lines (honeycomb, constellation) | `--brass` at ~15–25% opacity |
| `--blue` | circuits, beads, pulses, mycelium | sample from A1 lit circuit lines |
| `--blue-white` | star cores, flash peaks | sample from B3 core centre |
| `--white` | body copy in panels | `#FFFFFF` at ~90% |

---

## 2. Asset index

| File | Element | Size | Notes |
|---|---|---|---|
| `images/a-loading/A1_c-emblem_unlit.jpg` | A1 C emblem, unlit | 2576×1438 | Loading screen start state |
| `images/a-loading/A1_c-emblem_lit.jpg` | A1 C emblem, lit | 2048×2048 | Loading screen end state; also source for C1 |
| `images/a-loading/A2-A3_power-up-and-lightning-writing.mp4` | A2 + A3 | video | Reference for the power-up and lightning-writing motion |
| `images/a-loading/A4_wordmark_cellestial.jpg` | A4 wordmark | 2576×1438 | Final logo, with the star above the "i" |
| `images/b-sky/B3_core_radiant-star.jpg` | B3 core | 1024² | Radiant blue-white star with corona |
| `images/b-sky/B3_ring_cracked-brass.jpg` | B3 ring | 1024² | Cracked brass band with blue circuits; reused at several tilts |
| `images/b-sky/B4_star_empty-sleeping.jpg` | B4 empty star | 1024² | Dark sphere with brass traces, unpowered |
| `images/b-sky/B5_star_lit-claimed.jpg` | B5 lit star | 2048² | Same sphere, traces glowing, lit from inside |
| `images/e-roots/E1_soil_landscape-16x9.jpg` | E1 soil | 2576×1438 | Desktop background |
| `images/e-roots/E1_soil_portrait-9x16.jpg` | E1 soil | 1438×2576 | Phone background |
| `images/e-roots/E4_node.jpg` | E4 node | 1024² | Glowing mycelium bulb with threads top and bottom |
| `images/brass/BRASS_skin_main-light.jpg` | Brass skin | 2576×1438 | Main skin for all brass UI |
| `images/brass/BRASS_skin_dark-variant.jpg` | Brass skin, dark | 2576×1438 | Pressed/hover-out states, F2, quieter borders |
| `reference/original-visual-spec-sheet_2026-11-18.md` | — | — | The original element spec this pack follows |

**Image prep notes**
- The brass skins have uneven light (bright top-right, a darker band down the left). Crop skin regions from the even middle third.
- The soil has a slight edge vignette. For the vertical descent, crop the edges and mirror-tile vertically, or use the portrait version on phones.
- B4 nearly disappears on black at small sizes. Give it a faint rim glow in code (a thin `--blue` outer glow at ~20%).
- Image dimensions are uneven (1024 to 2576). Export each sprite at 2× its largest display size and compress to WebP/AVIF.

---

## 3. Scene flow

1. **Loading** (A1 → A2 → A3 → A4 → A5): the C powers up, lightning writes "Cellestial", and the star above the "i" shatters into B3.
2. **The Sky** (B): fly through 12 constellation layers around the B3 star; claim stars.
3. **Fall** (D1 → D2): after one full flight, B11 drops every star into the ground.
4. **Roots** (E): descend through the soil along the mycelium to the 5 offer nodes.
5. **Close** (F): Claim your star / Contact me.
6. **Chrome** (C) sits on every scene. **Teleport** (C4) jumps between sections.

---

## 4. Elements

Legend: **ASSET** = uses a file from this pack · **CODE** = built entirely in code · **ASSET + CODE** = file composited and animated in code.

### SECTION A — LOADING SCREEN

**A1 · C emblem** — ASSET + CODE
- Files: `A1_c-emblem_unlit.jpg`, `A1_c-emblem_lit.jpg`
- Where: centre of a black screen, the first thing a visitor sees.
- Purpose: the colour and material source for the whole site.
- Build: show unlit, then crossfade or mask-reveal to lit as A2 runs.

**A2 · Circuitry lighting path** — CODE (matching the reference video)
- Where: on the C emblem.
- Purpose: the emblem powering up.
- Build: starting at the main node (lower-right tip), blue light travels back through the C's circuits, lighting nodes as it goes, until the main node overloads. Use a path-following mask over the unlit→lit images, timed to the reference video.

**A3 · Writing electricity** — CODE (matching the reference video)
- Where: from the overloaded main node, rightward across the screen.
- Purpose: writes "Cellestial"; the C emblem becomes the C of the word.
- Build: jagged electric-blue bolts arc from the node and zigzag, writing the remaining letters one at a time. They start hot blue / blue-white, then cool into the A4 brass letters (crossfade each letter into A4 as it lands).

**A4 · Wordmark "Cellestial"** — ASSET
- File: `A4_wordmark_cellestial.jpg`
- Where: the end state of the loading screen.
- Purpose: the finished logo. Unified brass, NOT neon.

**A5 · Star transformation** — CODE using B3 assets
- Where: the small brass star above the "i" in A4.
- Purpose: the transition out of the loading screen into the sky.
- Build: the little brass star BREAKS APART. Its pieces sweep outward and settle into the B3 rings (use `B3_ring_cracked-brass.jpg`, fading in as the shards arrive). The star's core grows into `B3_core_radiant-star.jpg` at the centre, and the rings begin spinning. The camera pulls into the sky; the wordmark fades.

### SECTION B — THE SKY (hero)

Setting: pure black deep space, endless 3D depth, still and silent, no text except where noted.

**B1 + B2 · Sky and brass honeycomb** — CODE
- Where: the background of the entire sky scene.
- Purpose: the empty world the visitor flies into; the honeycomb is the hidden structure that holds up the stars.
- Build: a black 3D void (Three.js or similar). A hexagonal lattice of thin `--brass-dim` lines recedes in perspective and fades to black with distance (fog or a distance alpha falloff). Barely visible. It moves with the flight (G1). The B8 beads travel along its edges, so keep the lattice as real geometry/paths, not a flat texture.

**B3 · Epicentre site star** — ASSET + CODE
- Files: `B3_core_radiant-star.jpg`, `B3_ring_cracked-brass.jpg`
- Where: centre of the first constellation; the start of the flight.
- Purpose: Cellestial's own star, the most important light in the sky.
- Build: the core sprite is billboarded at the centre. Three copies of the ring sprite (or the ring as a texture on a 3D torus/plane) sit at different tilts like an armillary sphere, each spinning slowly on its own axis. The front halves of the rings draw over the core and the back halves under it (split the ring into front and back layers, or use real 3D depth). The faint constellation in the core image can be masked out; the code draws the real one (B6).

**B4 · Empty star** — ASSET + CODE
- File: `B4_star_empty-sleeping.jpg`
- Where: on constellation lines in every constellation layer.
- Purpose: a spot a visitor can claim for their own site. Must read as "empty / available".
- Build: a sprite with a faint `--blue` rim glow so it reads on black. Optionally a slow idle drift or rotation. Clickable: it opens B10.

**B5 · Lit / claimed star** — ASSET + CODE
- File: `B5_star_lit-claimed.jpg`
- Where: the same positions as B4 once a star is claimed.
- Purpose: a claimed spot where someone's site lives. Must read as "taken / alive".
- Build: same size and position as B4. Claiming crossfades B4 → B5 with a brief brightening (the traces fire, then it settles to a steady glow). Lit state is permanent. Claimed status comes from the build-request data (F1).

**B6 · Constellation pattern** — CODE
- Where: 12 layers flown through in order: Virgo, Libra, Scorpius, Sagittarius, Capricornus, Aquarius, Pisces, Aries, Taurus, Gemini, Cancer, Leo.
- Purpose: each layer is one stage of the flight.
- Build: each constellation is one flat-ish layer in 3D space at increasing depth. Stars sit at the real star-pattern positions for each constellation (from a star catalogue, normalised), joined by thin faint `--brass-dim` lines. Each star point is a B4 or B5 sprite depending on claimed state. No labels in the sky.

**B7 · Meaning reveal text** — CODE
- Where: in the black sky, over a constellation once every star in it is claimed.
- Purpose: reveals that constellation's meaning, written in light. After the last one (Leo), the line reads **"Jesus is King."**
- Build: the same technique as A3. Jagged electric-blue bolts write the line letter by letter, then each letter cools into brass with a thin blue circuit line (the A4 letter style). Live text in the wordmark-matching typeface, with SVG/canvas lightning paths along the glyph outlines.

**B8 · Beads of light** — CODE
- Where: along the honeycomb edges, from the visitor's touch/click point.
- Purpose: light flows from the touch along the honeycomb to one empty star.
- Build: on tap/click, pathfind along the lattice edges from the nearest vertex to the nearest unclaimed B4. Animate a trail of small round `--blue` beads along that path: brightest at the head, fading bead by bead toward the tail, and briefly brightening the brass edges they pass. On arrival, trigger B9.

**B9 · "claim yours" pulse** — CODE using the B4 asset
- Where: the empty star the beads landed on.
- Purpose: marks that this star can be claimed.
- Build: the B4 sprite brightens slightly with a slow pulse (scale/glow, ~2s loop). Underneath, the words "claim yours" in tiny `--brass` live text in the wordmark-matching typeface. Clicking it opens B10.

**B10 · Empty-star preview panel** — CODE
- Where: a small panel floating next to a clicked empty star.
- Purpose: a short breakdown of what Cellestial can build: Site / Site + Systems / Site + App / Add-ons / Care.
- Build: a dark `#000` face with a thin brass border (BRASS skin) and a thin `--blue` circuit line inset in the border. A few short lines of plain white text, with one or two key words in `--brass`. Simple, readable, not busy. Content comes from the existing locked offer copy. Close on outside click.

**B11 · Exit button "See what holds up the sky"** — CODE
- Where: bottom centre of the screen, appearing only after one full flight through all 12 constellations.
- Purpose: ends the sky scene; clicking it starts D1.
- Build: a rounded button skinned with BRASS (main-light), a thin `--blue` circuit line running just inside its edge, and live text "See what holds up the sky". On hover the circuit line brightens; on press it switches to the dark skin. This is the base button component for E6, F1 and F2.

### SECTION C — CHROME (every scene)

**C1 · Top-left logo** — ASSET + CODE
- File: crop of `A1_c-emblem_lit.jpg`
- Where: top-left corner, on every scene.
- Purpose: the only branding that stays on screen the whole visit. It reads "Cellestial / studio" together with the sky itself.
- Build: the C emblem, small, in the idle state (between unlit and lit: circuits on but calm). Use the lit image at reduced brightness/glow, or blend 60% lit over unlit. Under it, the word "studio" in small `--brass` live text in the wordmark style.

**C2 + C3 · Menu button and panel** — CODE
- Where: the button sits next to C1; the panel drops down from it.
- Purpose: the button opens the panel; the panel teleports the visitor to any section.
- Build: the button is three short horizontal bars in BRASS skin, each with a hair-thin `--blue` line. The panel uses the same treatment as B10: a dark face, brass border with a blue circuit line, and four lines of plain brass/white text: "The Sky" / "What we build" / "Claim your star" / "Contact me". Each item triggers C4, then jumps to its section.

**C4 · Teleport circuit flash** — CODE
- Where: full screen, during a teleport between sections.
- Purpose: the split-second transition.
- Build: about 300–500ms. Glowing `--blue` circuit lines and round nodes fill the frame on black, like the A2 circuits seen very close up. Brightness peaks to `--blue-white` at the centre mid-flash, the section swaps underneath at the peak, then it fades out. Procedurally generated right-angle traces (canvas/SVG) work best.

### SECTION D — TRANSITION: SKY TO ROOTS

**D1 · Falling stars** — CODE using the B4/B5 assets
- Where: the whole sky, right after B11 is clicked.
- Purpose: every star falls out of the sky toward the ground.
- Build: every star sprite (B4 and B5) accelerates straight down the same way, with motion trails (stretched sprite or trail particles). No star is special. The honeycomb and B3 fade out.

**D2 · Crash into mycelium** — CODE using E1 + E4 + B5
- Where: the hand-off between sky and Roots.
- Purpose: the stars become the underground network of the Roots scene.
- Build: the soil (E1) rises into the bottom of the frame. A star hits the soil's top edge, and from the impact point `--blue` light bursts downward and sideways, growing instantly into the E2 mycelium branches. The camera follows down into the Roots scene.

### SECTION E — ROOTS ("What we build")

Setting: underground, dark earth, still and grounded, the opposite feel to the sky. This is where prices and offers live, so clarity beats spectacle.

**E1 · Soil background** — ASSET
- Files: `E1_soil_landscape-16x9.jpg` (desktop), `E1_soil_portrait-9x16.jpg` (phone)
- Where: the background of the whole Roots scene.
- Purpose: the ground the scene lives in.
- Build: tile/mirror vertically for the descent (see the prep notes). Keep it dark; it should sit behind the glow, never compete.

**E2 · Mycelium network** — CODE
- Where: through the soil, connecting the five E4 nodes from top to bottom.
- Purpose: carries light from offer to offer.
- Build: procedural branching lines in `--blue`, thicker trunk lines with thinner branches off them, small glowing joints, and a soft additive glow. The main trunk passes through each node's top and bottom threads in a descending line; secondary branches wander outward to fill the frame.
- Fallback: if the code-drawn mycelium looks thin or cheap against the photo soil, generate an E2 image and trace the five paths over it for the pulses.

**E3 · Guided light pulse** — CODE
- Where: along the E2 trunk, travelling from the current node toward the next.
- Purpose: shows the visitor where to go next. It suggests; it does not force.
- Build: a brighter segment of `--blue`/`--blue-white` travelling along the path with a soft trailing fade, looping every few seconds toward the next unopened node.

**E4 · Node** — ASSET + CODE
- File: `E4_node.jpg`
- Where: 5 nodes in a descending line, each deeper than the last: **1 Site · 2 Site + Systems · 3 Site + App · 4 Add-ons (AI + automation) · 5 Care**.
- Purpose: one offer lives at each node.
- Build: the sprite composited over the soil; its threads join the E2 trunk. Idle: a slow breathing glow. Hover: brighter. Click: opens E5. A small brass label beside each node is optional and not in the original spec, so confirm with Gabriel before adding it.

**E5 · Offer panel / tile** — CODE
- Where: opens over the soil when a node is clicked.
- Purpose: that offer's details and price.
- Build: the same panel component as B10/C3, larger: dark face, brass border with a blue circuit line, short lines of plain white text with key words in `--brass`. Clean and roomy. Copy is already written and locked; pull it from the existing content.

**E6 · Return-to-sky button** — CODE
- Where: the top of the Roots scene.
- Purpose: warp-launches the visitor back up into the sky (G2).
- Build: the B11 button component shaped as an upward chevron/arrow with the blue circuit line rising through it. No words needed.

### SECTION F — BOTTOM / CLOSE

Setting: the bottom of the Roots descent, dark earth.

**F1 · "Claim your star" (primary)** — CODE
- Where: centred at the very bottom of the Roots scene.
- Purpose: the main closing action, the build request. Sending it is what claims a visitor's star in the sky (B4 → B5).
- Build: the B11 button component, the largest on the site: thicker brass, a stronger blue circuit line, live text "Claim your star". It opens the existing build-request flow (plumbing unchanged).

**F2 · "Contact me" (secondary)** — CODE
- Where: directly under F1.
- Purpose: the secondary action; opens a simple email/message box (the existing contact form).
- Build: the same component, noticeably smaller and quieter: dark brass skin, a dimmer blue line, live text "Contact me". No social icons.

### SECTION G — MOTION & BEHAVIOUR (code only)

**G1 · Flight:** fly forward and back through the sky layers at medium speed. Speed builds the longer the visitor scrolls; a tap stops it instantly.

**G2 · Warp return:** when E6 is clicked, a launch-up effect (streaks, speed ramp) carries the visitor back to the sky.

**G3 · Reduced motion:** when the device asks for reduced motion (`prefers-reduced-motion`), show a still sky (B1/B2 + B3, rings static) with B11 already visible. No flight, no falling, and a simple fade in place of C4.

**G4 · Sound:** none.

---

## 5. Build checklist

- [ ] Loading: A1 → A2 → A3 → A4 → A5
- [ ] Sky: B1/B2 lattice · B3 assembly · B6 ×12 constellations · B4/B5 claim states
- [ ] Interaction: B8 beads → B9 pulse → B10 panel
- [ ] B7 reveal per completed constellation; "Jesus is King." after Leo
- [ ] B11 after one full flight
- [ ] Chrome: C1 · C2/C3 · C4
- [ ] D1 fall → D2 crash
- [ ] Roots: E1 · E2 · E3 · E4 ×5 · E5 panels · E6
- [ ] Close: F1 · F2
- [ ] G1 flight · G2 warp · G3 reduced motion
- [ ] Mobile pass: portrait soil, panel sizing, tap targets
