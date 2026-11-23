#!/usr/bin/env node
// Builds the proof-sheets page: every scene's comparison sheet, beside what it has to match.
//
//   cd /home/poe/cellestial-studio && node <this file> <out dir> [--status <status.json>]
//
// Writes <out>/page.html (the page as a fragment, for publishing), <out>/local.html (the same page
// wrapped as a whole document, to open from refs/ in the repo) and copies every sheet it shows to
// <out>/<scene>/compare/<file>, the path the page asks for. status.json holds the lines that change
// from run to run (the checks, the inspector's verdict): see STATUS below for its shape.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const require = createRequire(join(ROOT, 'package.json'));
const sharp = require('sharp');
const OUT = process.argv[2];
if (!OUT) throw new Error('usage: build.mjs <out dir> [--status status.json]');
const statusAt = process.argv.indexOf('--status');
const STATUS = statusAt > 0 ? JSON.parse(readFileSync(process.argv[statusAt + 1], 'utf8')) : null;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The scenes in the spec's order; every plate is one sheet from refs/<scene>/compare/. */
const SCENES = [
	{
		id: 'loading',
		name: 'Loading',
		match: 'It has to feel like the reference video in the asset pack: the C lights, the bolt strikes, the wordmark is written and cools to brass. 6 to 8 seconds, never under 6.',
		plates: [
			['loading/compare/desk-1.jpg', '1440×900', 'The first half, 0 to 3.3 s', 'Seven moments. In each pair the left frame is the reference video and the right is the build at the same moment of its script.'],
			['loading/compare/desk-2.jpg', '1440×900', 'The second half, 3.7 to 6.2 s', 'The wordmark is written by the lightning and cools to brass.'],
			['loading/compare/phone-1.jpg', '390×844', 'The first half on a phone', 'Top row: the reference frames. Bottom row: the build.'],
			['loading/compare/phone-2.jpg', '390×844', 'The second half on a phone', 'Top row: the reference frames. Bottom row: the build.'],
			['loading/compare/a5-desk.jpg', '1440×900', 'The hand-off to the sky', 'The wordmark\'s small star breaks into pieces of its own brass. They fly out and become the three rings of Cellestial\'s star while the sky comes up behind.'],
			['loading/compare/a5-phone.jpg', '390×844', 'The hand-off on a phone', 'The same eleven steps.'],
			['loading/compare/short.jpg', 'both', 'The short version', 'What a visitor sees on coming back in the same session: about two seconds. Desktop above, phone below.'],
		],
	},
	{
		id: 'sky',
		name: 'The Sky',
		match: 'Twelve constellations in the spec\'s order, each the real star pattern, on a faint brass honeycomb. The sky starts empty except for Cellestial\'s own star.',
		plates: [
			['sky/compare/stations-desk-1.jpg', '1440×900', 'Constellations 1 to 6', 'In each pair the left is the real pattern from the star catalogue and the right is the build at that station.'],
			['sky/compare/stations-desk-2.jpg', '1440×900', 'Constellations 7 to 12', 'Real pattern left, build right.'],
			['sky/compare/stations-phone.jpg', '390×844', 'All twelve on a phone', 'Six wide figures are drawn turned a quarter so that they fill a tall screen and Cellestial\'s star stands clear. The pattern itself is unchanged. The spec is silent on which way up; one switch turns it off.'],
			['sky/compare/b3.jpg', 'both', 'Cellestial\'s star', 'Three moments of its turning rings, desktop above and phone below, beside the pack\'s core and ring (B3).'],
			['sky/compare/stars.jpg', 'both', 'An empty star and a lit star', 'As they appear and enlarged, beside the pack\'s B4 (empty, brass traces) and B5 (lit).'],
			['sky/compare/beads-desk.jpg', '1440×900', 'A tap, and the beads', 'Beads of light run along the honeycomb to the star that was picked, and "claim yours" appears when they arrive. The last column is the route they took, drawn in green by the test.'],
			['sky/compare/panel.jpg', 'both', 'An empty star\'s panel', 'The five offers in a line each, and "Claim your star". A star is claimed only when the request is sent.'],
			['sky/compare/lit.jpg', 'both', 'A lit star shows what was asked', 'A short ask, a long one that scrolls, and one with markup in it, which is shown as plain text.'],
			['sky/compare/b7-all-desk.jpg', '1440×900', 'The meaning beside each completed figure', 'Written in brass when a constellation is complete. "Jesus is King." follows Leo\'s.'],
			['sky/compare/b7-all-phone.jpg', '390×844', 'The meanings on a phone', 'Each stands by its figure, clear of stars, lines, the logo and the exit button.'],
		],
	},
	{
		id: 'fall',
		name: 'The fall',
		match: 'The owner\'s words: all the stars fall out of the sky, speeding faster and faster, crashing into the ground, sinking in, and exploding into the mycelium.',
		plates: [
			['transitions/compare/fall-desk.jpg', '1440×900', '"See what holds up the sky"', 'Sixteen frames across 3.2 s. Every star strikes the ground with its own burst, and the bursts\' light becomes the roots.'],
			['transitions/compare/fall-phone.jpg', '390×844', 'The fall on a phone', 'From a figure drawn turned a quarter.'],
		],
	},
	{
		id: 'roots',
		name: 'The Roots',
		match: 'Five nodes in the spec\'s order, one tile open at a time, the prices inside the tiles, the wording character for character as the addendum has it.',
		plates: [
			['roots/compare/descent-desk-1.jpg', '1440×900', 'The ground and the first two nodes', 'The first two screens of the way down: soil, the trunk of light, the mycelium.'],
			['roots/compare/tiles-desk.jpg', '1440×900', 'The five tiles', 'Site, Site + Systems, Site + App, Add-ons, Care. The build\'s own suite compares every word with the addendum.'],
			['roots/compare/tiles-phone.jpg', '390×844', 'The five tiles on a phone', 'Each opens under its node.'],
			['roots/compare/nojs-phone.jpg', '390×844', 'With scripts switched off', 'The logo, five readable tiles and the two closing buttons are still there.'],
		],
	},
	{
		id: 'close',
		name: 'Close and chrome',
		match: '"Claim your star" big, "Contact me" smaller under it. The logo and the three-bar menu throughout; the menu teleports to four places.',
		plates: [
			['roots/compare/descent-desk-3.jpg', '1440×900', 'The close', 'The last screen of the Roots.'],
			['chrome/compare/menu.jpg', 'both', 'The menu', 'Over the sky and over the soil, at desktop, phone and 320 px wide: The Sky, What we build, Claim your star, Contact me.'],
			['chrome/compare/logo.jpg', 'both', 'The logo', 'At its real sizes, enlarged, between the pack\'s emblem unlit and lit (A1).'],
			['transitions/compare/teleport-desk.jpg', '1440×900', 'The four teleports', 'From the sky and from the Roots: three frames of the flash, then where each one lands.'],
			['transitions/compare/warp-desk.jpg', '1440×900', 'The way back up', 'The warp from the Roots to the sky, 1.5 s.'],
		],
	},
	{
		id: 'live',
		name: 'Live, 23 November',
		match: 'What cellestialstudio.com served after publishing, and the two things the owner asked for that afternoon.',
		plates: [
			['verification/live/live-sheet.jpg', 'both', 'One visitor\'s pass over the live site', 'Desktop above, phone below: the loader, the sky, "claim yours", a star\'s panel, the request form with the real spam check, the menu, the Roots, /contact, /start/new and a client link opening. Nothing was sent.'],
			['verification/live/spacing-phone-before-after.jpg', '390×844', 'Clean spacing', 'The crowded figures on a phone, as first published (left of each pair) and with the new rule (right): no two stars touch. The pattern is the true one; only Taurus\'s closest pair is moved, by 3 px each.'],
			['verification/live/beads-three-runs.jpg', 'both', 'A second tap sends more beads', 'Three quick taps: three runs of beads at once, each finishing its course.'],
		],
	},
	{
		id: 'still',
		name: 'Reduced motion',
		match: 'A still sky with the exit button already there. No flight, no loader.',
		plates: [['sky/compare/meaning-still.jpg', '1440×900', 'The sky for a visitor who asks for less motion', 'Nothing moves; the button to the Roots is there from the start.']],
	},
];

const dims = new Map();
for (const s of SCENES) {
	for (const [file] of s.plates) {
		const from = join(ROOT, 'refs', file);
		if (!existsSync(from)) throw new Error(`missing sheet: refs/${file}`);
		const m = await sharp(from).metadata();
		dims.set(file, [m.width, m.height]);
		const to = join(OUT, file);
		mkdirSync(dirname(to), { recursive: true });
		copyFileSync(from, to);
	}
}

const checks = STATUS?.checks ?? [];
const verdict = STATUS?.verdict ?? [];
const open = STATUS?.open ?? [];
const asOf = STATUS?.asOf ?? '';

const plate = ([file, size, title, text], first) => {
	const [w, h] = dims.get(file);
	return `<figure class="plate">
<figcaption><span class="size">${esc(size)}</span><span class="what"><b>${esc(title)}.</b> ${esc(text)}</span><button type="button" class="zoom" aria-pressed="false">Full size</button></figcaption>
<div class="sheet"><img src="${file}" alt="${esc(`${title}: ${text}`)}" width="${w}" height="${h}"${first ? '' : ' loading="lazy"'}></div>
</figure>`;
};

const page = `<title>Cellestial Proof Sheets</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap">
<style>
/* One column of plates on the site's own night: each plate a wide sheet under a brass-ruled label. */
:root {
	color-scheme: dark;
	--night: #000;
	--card: #0c0a09;
	--soil: #1d1817;
	--brass: #74573f;
	--brass-text: #ae8a68;
	--brass-hi: #d5ae88;
	--blue: #6480ce;
	--text: rgb(255 255 255 / 0.9);
	--muted: rgb(255 255 255 / 0.68);
	--hairline: rgb(116 87 63 / 0.4);
	--face: "Quicksand", "Nunito", ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body { background: var(--night); color: var(--text); font-family: var(--face); font-size: 16px; line-height: 1.55; }
.wrap { max-width: 1240px; margin: 0 auto; padding-block: 40px 96px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 56px; }
header { display: flex; flex-direction: column; gap: 14px; }
h1 { margin: 0; font-size: clamp(30px, 5vw, 46px); line-height: 1.1; font-weight: 600; color: var(--brass-hi); letter-spacing: 0.01em; text-wrap: balance; }
.lede { margin: 0; max-width: 62ch; color: var(--text); font-size: 18px; }
.asof { margin: 0; color: var(--muted); font-size: 14px; }
h2 { margin: 0; font-size: 26px; font-weight: 600; color: var(--brass-hi); text-wrap: balance; }
h3 { margin: 0; font-size: 14px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brass-text); }
p { margin: 0; }
a { color: var(--brass-hi); text-underline-offset: 3px; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
.rail { display: flex; flex-wrap: wrap; gap: 8px 10px; }
.rail a { text-decoration: none; padding: 6px 14px; border: 1px solid var(--hairline); border-radius: 999px; color: var(--brass-text); font-weight: 600; font-size: 15px; }
.rail a:hover { border-color: var(--brass-text); color: var(--brass-hi); }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 330px), 1fr)); gap: 32px 48px; }
.facts > section { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.facts ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.facts li { padding-left: 16px; border-left: 1px solid var(--hairline); color: var(--text); }
.facts li b { color: var(--brass-hi); font-weight: 600; }
.checks { margin: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 20px; font-variant-numeric: tabular-nums; }
.checks dt { color: var(--text); min-width: 0; }
.checks dd { margin: 0; color: var(--brass-hi); font-weight: 600; text-align: right; }
.scene { display: flex; flex-direction: column; gap: 22px; scroll-margin-top: 16px; }
.scene > .match { max-width: 68ch; color: var(--muted); }
.plate { margin: 0; display: flex; flex-direction: column; gap: 10px; }
.plate figcaption { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; padding-top: 12px; border-top: 1px solid var(--hairline); }
.size { flex: none; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: var(--blue); font-variant-numeric: tabular-nums; min-width: 78px; }
.what { flex: 1 1 320px; min-width: 0; color: var(--muted); }
.what b { color: var(--text); font-weight: 600; }
.zoom { flex: none; font: inherit; font-size: 13px; font-weight: 600; color: var(--brass-text); background: none; border: 1px solid var(--hairline); border-radius: 999px; padding: 3px 12px; cursor: pointer; }
.zoom:hover, .zoom[aria-pressed="true"] { color: var(--brass-hi); border-color: var(--brass-text); }
.sheet { overflow-x: auto; background: var(--card); border-radius: 4px; }
.sheet img { display: block; width: 100%; height: auto; max-width: 100%; }
.sheet.full img { width: auto; max-width: none; }
footer { color: var(--muted); font-size: 14px; max-width: 70ch; border-top: 1px solid var(--hairline); padding-top: 20px; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
</style>
<div class="wrap">
<header>
<h1>Cellestial Studio, scene by scene</h1>
<p class="lede">Every scene of the redesign, screenshotted at 1440×900 and 390×844 and set beside the asset or the line of the spec it has to match.</p>
${asOf ? `<p class="asof">${esc(asOf)}</p>` : ''}
<nav class="rail" aria-label="Scenes">${SCENES.map((s) => `<a href="#${s.id}">${esc(s.name)}</a>`).join('')}</nav>
</header>
${
	checks.length + verdict.length + open.length > 0
		? `<div class="facts">
${verdict.length ? `<section><h3>Where it stands</h3><ul>${verdict.map((v) => `<li>${v}</li>`).join('')}</ul></section>` : ''}
${checks.length ? `<section><h3>Checks</h3><dl class="checks">${checks.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>` : ''}
${open.length ? `<section><h3>Waiting on the owner</h3><ul>${open.map((v) => `<li>${v}</li>`).join('')}</ul></section>` : ''}
</div>`
		: ''
}
${SCENES.map(
	(s, i) => `<section class="scene" id="${s.id}">
<h2>${esc(s.name)}</h2>
<p class="match">${esc(s.match)}</p>
${s.plates.map((p, j) => plate(p, i === 0 && j === 0)).join('\n')}
</section>`,
).join('\n')}
<footer>The sheets are made by the build's own tools from the page as it runs in headless Chromium on a real GPU, and are kept in the repository under refs/&lt;scene&gt;/compare/. No real phone was used.</footer>
</div>
<script>
document.querySelectorAll('.zoom').forEach(function (b) {
	b.addEventListener('click', function () {
		var sheet = b.closest('.plate').querySelector('.sheet');
		var on = sheet.classList.toggle('full');
		b.setAttribute('aria-pressed', on ? 'true' : 'false');
		b.textContent = on ? 'Fit width' : 'Full size';
	});
});
</script>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'page.html'), page);
writeFileSync(
	join(OUT, 'local.html'),
	`<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body style="margin:0">\n${page}</body>\n</html>\n`,
);
const files = [...dims.keys()];
writeFileSync(join(OUT, 'files.json'), `${JSON.stringify(files, null, 1)}\n`);
console.log(`${files.length} sheets, page ${Buffer.byteLength(page)} bytes`);
