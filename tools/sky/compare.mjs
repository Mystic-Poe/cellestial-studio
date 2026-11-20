#!/usr/bin/env node
// Comparison sheets for the Sky: the build on the real page, on the real GPU,
// beside the pictures it must match.
//
//   node tools/sky/compare.mjs [--url http://localhost:4500] [--only open,stations,b3,stars,between]
//                              [--out <dir>]
//
// Needs the dev server running (see PROGRESS.md). Opens "/?scene=sky&debug"
// at 1440x900 and at 390x844 (scale 2, mobile, touch), pins the sky's clock
// and moves the camera through window.__cellestial.sky.debug, so every frame
// can be taken again and comes out the same. Writes into refs/sky/compare/:
//
//   open.jpg                  the opening pose, both sizes
//   stations-desk-1.jpg, -2   the twelve stations at 1440x900, each beside its figure
//                             from refs/constellations/constellations.jpg
//   stations-phone.jpg        the same at 390x844
//   b3.jpg                    Cellestial's star close up at three moments of its
//                             turning, beside the two B3 pictures
//   stars.jpg                 an empty and a lit star at the size they appear and
//                             enlarged, beside B4 and B5
//   between.jpg               two views between stations, both sizes
//
// The dashed lines on the station cells are the safe area: 96 px at the top
// for the logo and menu, 120 px at the bottom for the exit button. The run
// also measures every figure at its station and prints how far it stays
// inside that area; a figure that leaves it is an error.
// Exits non-zero if the page logged an error or a figure left the safe area.

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PACK = join(ROOT, 'cellestial-assets/images/b-sky');
const FIGURES = join(ROOT, 'refs/constellations/constellations.jpg');
const NAMES = [
	'Virgo',
	'Libra',
	'Scorpius',
	'Sagittarius',
	'Capricornus',
	'Aquarius',
	'Pisces',
	'Aries',
	'Taurus',
	'Gemini',
	'Cancer',
	'Leo',
];
/** Lit for the close-ups: Spica and two more of Virgo, and one star of Libra behind it. */
const LIT = ['slot-3', 'slot-53', 'slot-110', 'slot-28'];
const SAFE = { top: 96, bottom: 120 };

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		only: { type: 'string', default: 'open,stations,b3,stars,between' },
		out: { type: 'string', default: join(ROOT, 'refs/sky/compare') },
	},
});
const only = new Set(values.only.split(','));
const OUT = values.out;
mkdirSync(OUT, { recursive: true });

const SIZES = {
	desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
	phone: {
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
	},
};

let errors = 0;
const browser = await chromium.launch({
	executablePath: '/usr/bin/chromium',
	args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'],
});

/** A page on the sky, its clock pinned at 2 s. `lit` seeds the claims this device made. */
async function open(size, lit = []) {
	const context = await browser.newContext(SIZES[size]);
	const page = await context.newPage();
	if (lit.length > 0) {
		await page.addInitScript((slots) => {
			localStorage.setItem(
				'cellestial:claims',
				JSON.stringify(slots.map((slot) => ({ slot, ask: 'A site for my bakery.' }))),
			);
		}, lit);
	}
	page.on('console', (m) => {
		if (m.type() === 'error') {
			errors++;
			console.error(`[${size}] console: ${m.text()}`);
		}
	});
	page.on('pageerror', (e) => {
		errors++;
		console.error(`[${size}] page error: ${e.message}`);
	});
	await page.goto(`${values.url}/?scene=sky&debug`, { waitUntil: 'networkidle' });
	await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
	await page.waitForFunction(() => window.__cellestial?.sky?.debug);
	await page.evaluate(() => window.__cellestial.sky.ready);
	// The page comes up out of black over 600 ms.
	await page.waitForTimeout(900);
	const renderer = await page.evaluate(() => {
		const gl = document.createElement('canvas').getContext('webgl2');
		const info = gl?.getExtension('WEBGL_debug_renderer_info');
		return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
	});
	console.log(`[${size}] ${renderer}`);
	const at = async (coord, clock = 2) => {
		await page.evaluate(
			([c, t]) =>
				new Promise((done) => {
					const { debug } = window.__cellestial.sky;
					debug.setCoord(c);
					debug.setClock(t);
					requestAnimationFrame(() => requestAnimationFrame(done));
				}),
			[coord, clock],
		);
		return page.screenshot({ type: 'png' });
	};
	return { page, at, close: () => context.close(), scale: SIZES[size].deviceScaleFactor };
}

const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (text, w) =>
	Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20"><rect width="100%" height="100%" fill="#181818"/><text x="6" y="15" font-family="monospace" font-size="12" fill="#e8e8e8">${esc(text)}</text></svg>`,
	);

/** Dashed lines at the edges of the safe area, for a cell `w` by `h` showing a `vh`-tall viewport. */
const safeLines = (w, h, vh) => {
	const k = h / vh;
	const line = (y) =>
		`<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="#5fd08a" stroke-opacity="0.55" stroke-width="1" stroke-dasharray="5 5"/>`;
	return Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${line(SAFE.top * k)}${line((vh - SAFE.bottom) * k)}</svg>`,
	);
};

const fit = (input, w, h, bg = '#000') =>
	sharp(input).resize(w, h, { fit: 'contain', background: bg }).png().toBuffer();

/** Lay cells out in rows of `cols`. A cell is { img, w, h, caption }. */
async function sheet(name, cells, cols) {
	const GAP = 6;
	const parts = [];
	let y = GAP;
	let width = 0;
	for (let i = 0; i < cells.length; i += cols) {
		const row = cells.slice(i, i + cols);
		let x = GAP;
		let rowH = 0;
		for (const cell of row) {
			parts.push({ input: label(cell.caption, cell.w), left: x, top: y });
			parts.push({ input: cell.img, left: x, top: y + 20 });
			x += cell.w + GAP;
			rowH = Math.max(rowH, cell.h + 20);
		}
		width = Math.max(width, x);
		y += rowH + GAP;
	}
	if (width > 1600 || y > 1600) throw new Error(`${name} is ${width}x${y}: over 1600 px`);
	await sharp({ create: { width, height: y, channels: 3, background: '#303030' } })
		.composite(parts)
		.jpeg({ quality: 88 })
		.toFile(join(OUT, name));
	console.log(`wrote ${join(OUT, name)} (${width}x${y})`);
}

/** A square of the screenshot about a point given in CSS pixels, scaled to `to` pixels. */
async function crop(png, scale, cx, cy, half, to, kernel = 'lanczos3') {
	const size = Math.round(2 * half * scale);
	const left = Math.round(cx * scale - size / 2);
	const top = Math.round(cy * scale - size / 2);
	// Pad with black where the square leaves the screenshot.
	const wide = await sharp(png)
		.extend({ top: size, bottom: size, left: size, right: size, background: '#000' })
		.png()
		.toBuffer();
	const padded = await sharp(wide)
		.extract({ left: left + size, top: top + size, width: size, height: size })
		.png()
		.toBuffer();
	return sharp(padded).resize(to, to, { kernel }).png().toBuffer();
}

// ───────────────────────────────────────────────────────── (a) and (e) ──

if (only.has('open') || only.has('between')) {
	const desk = await open('desk');
	const phone = await open('phone');
	const pair = async (coord, clock, what) => [
		{ img: await fit(await desk.at(coord, clock), 1100, 688), w: 1100, h: 688, caption: `${what}, 1440x900` },
		{ img: await fit(await phone.at(coord, clock), 318, 688), w: 318, h: 688, caption: `${what}, 390x844` },
	];
	if (only.has('open')) await sheet('open.jpg', await pair(0, 2, 'opening pose'), 2);
	if (only.has('between')) {
		const cells = [];
		for (const coord of [0.5, 3.5]) cells.push(...(await pair(coord, 2, `layer ${coord}`)));
		await sheet('between.jpg', cells, 2);
	}
	await desk.close();
	await phone.close();
}

// ──────────────────────────────────────────────────────────────── (b) ──

if (only.has('stations')) {
	const figure = (i, w, h) =>
		sharp(FIGURES)
			.extract({ left: (i % 4) * 520, top: Math.floor(i / 4) * 564, width: 520, height: 564 })
			.resize(w, h, { fit: 'contain', background: '#000' })
			.png()
			.toBuffer();

	/** How far every star of the figure in front stays inside the safe area, CSS pixels. */
	const measure = (page) =>
		page.evaluate(() => {
			const { sky } = window.__cellestial;
			const { hooks } = sky;
			const layout = hooks.layout();
			const { w, h } = layout;
			let top = Infinity;
			let bottom = Infinity;
			let side = Infinity;
			let n = 0;
			const take = (c) => {
				n++;
				// A star that is not on screen at all is as far outside as can be.
				if (!c) {
					top = bottom = side = -Infinity;
					return;
				}
				top = Math.min(top, c.y - c.r);
				bottom = Math.min(bottom, h - (c.y + c.r));
				side = Math.min(side, c.x - c.r, w - (c.x + c.r));
			};
			for (const star of layout.plans[hooks.flight().figure].stars) {
				if (star.slot) take(hooks.starCircle(star.slot));
				else {
					// Cellestial's own star, out to its outer ring.
					const core = sky.coreCircle();
					take({ x: core.x, y: core.y, r: core.r / 0.27 });
				}
			}
			return { stars: n, top, bottom, side };
		});

	for (const size of ['desk', 'phone']) {
		const view = await open(size);
		const vp = SIZES[size].viewport;
		const cells = [];
		console.log(`[${size}] figure        stars  clear at top  at bottom  at the sides`);
		for (let k = 0; k < 12; k++) {
			const png = await view.at(k);
			const m = await measure(view.page);
			const ok = m.top >= SAFE.top - 0.5 && m.bottom >= SAFE.bottom - 0.5 && m.side >= 0;
			if (!ok) errors++;
			console.log(
				`[${size}] ${NAMES[k].padEnd(12)} ${String(m.stars).padStart(5)}  ${m.top.toFixed(0).padStart(12)}  ${m.bottom.toFixed(0).padStart(9)}  ${m.side.toFixed(0).padStart(12)}${ok ? '' : '   OUTSIDE THE SAFE AREA'}`,
			);
			const [bw, bh] = size === 'desk' ? [496, 310] : [185, 400];
			const [rw, rh] = size === 'desk' ? [286, 310] : [185, 200];
			const build = await sharp(await fit(png, bw, bh))
				.composite([{ input: safeLines(bw, bh, vp.height), left: 0, top: 0 }])
				.png()
				.toBuffer();
			cells.push({ img: await figure(k, rw, rh), w: rw, h: rh, caption: `${k + 1} ${NAMES[k]}: real` });
			cells.push({ img: build, w: bw, h: bh, caption: `build, ${vp.width}x${vp.height}` });
		}
		await view.close();
		if (size === 'desk') {
			await sheet('stations-desk-1.jpg', cells.slice(0, 12), 4);
			await sheet('stations-desk-2.jpg', cells.slice(12), 4);
		} else {
			await sheet('stations-phone.jpg', cells, 8);
		}
	}
}

// ──────────────────────────────────────────────────────────────── (c) ──

if (only.has('b3')) {
	const SIDE = 300;
	const cells = [];
	for (const size of ['desk', 'phone']) {
		const view = await open(size);
		for (const clock of [0, 4, 9]) {
			const png = await view.at(0, clock);
			const core = await view.page.evaluate(() => window.__cellestial.sky.coreCircle());
			// The outer ring's longer half-axis is the core's radius over 0.27.
			const half = (core.r / 0.27) * 1.25;
			cells.push({
				img: await crop(png, view.scale, core.x, core.y, half, SIDE),
				w: SIDE,
				h: SIDE,
				caption: `${size} t=${clock}s, ${Math.round(2 * half)} px wide`,
			});
		}
		await view.close();
		const ref = size === 'desk' ? 'B3_core_radiant-star.jpg' : 'B3_ring_cracked-brass.jpg';
		cells.push({ img: await fit(join(PACK, ref), SIDE, SIDE), w: SIDE, h: SIDE, caption: ref });
	}
	await sheet('b3.jpg', cells, 4);
}

// ──────────────────────────────────────────────────────────────── (d) ──

if (only.has('stars')) {
	const SIDE = 230;
	const cells = [];
	for (const size of ['desk', 'phone']) {
		const view = await open(size, LIT);
		const png = await view.at(0);
		// Virgo's star 3 is empty (slot-34); Spica (slot-3) and slot-53 are lit.
		for (const [slot, what] of [
			['slot-34', 'empty'],
			['slot-3', 'lit'],
		]) {
			const c = await view.page.evaluate(
				(s) => window.__cellestial.sky.hooks.starCircle(s),
				slot,
			);
			if (!c) throw new Error(`${slot} is not on screen at ${size}`);
			cells.push({
				img: await crop(png, view.scale, c.x, c.y, SIDE / 2 / view.scale, SIDE, 'nearest'),
				w: SIDE,
				h: SIDE,
				caption: `${size} ${what}, as it appears`,
			});
			cells.push({
				img: await crop(png, view.scale, c.x, c.y, c.r * 2.4, SIDE),
				w: SIDE,
				h: SIDE,
				caption: `enlarged (r ${c.r.toFixed(1)} px)`,
			});
		}
		await view.close();
		const ref = size === 'desk' ? 'B4_star_empty-sleeping.jpg' : 'B5_star_lit-claimed.jpg';
		// The sphere fills about 45% of B4's frame and 30% of B5's: crop to it.
		const meta = await sharp(join(PACK, ref)).metadata();
		const side = Math.round(meta.width * (size === 'desk' ? 0.66 : 0.72));
		const refImg = await sharp(join(PACK, ref))
			.extract({
				left: Math.round((meta.width - side) / 2),
				top: Math.round((meta.height - side) / 2),
				width: side,
				height: side,
			})
			.resize(SIDE, SIDE)
			.png()
			.toBuffer();
		cells.push({ img: refImg, w: SIDE, h: SIDE, caption: ref.slice(0, 22) });
		// The whole figure with its lit stars, to judge them at a glance.
		cells.push({
			img: await fit(png, size === 'desk' ? 368 : 106, SIDE),
			w: size === 'desk' ? 368 : 106,
			h: SIDE,
			caption: size === 'desk' ? 'Virgo, three stars lit' : 'phone',
		});
	}
	await sheet('stars.jpg', cells, 6);
}

await browser.close();
if (errors > 0) {
	console.error(`${errors} problem(s)`);
	process.exit(1);
}
