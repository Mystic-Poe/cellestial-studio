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
//   handoff.jpg               (--only handoff) the sky's side of the loader's hand-off, alone:
//                             introProgress at 0, 0.3, 0.5, 0.7, 0.85 and 1, then reset().
//                             Prints the core's circle at each and how many pixels differ
//                             between introProgress(1) and reset() (must be 0).
//   beads-desk.jpg, -phone    (--only beads) a touch at three places, at three stations: the
//                             beads at five moments from the touch until after they arrive,
//                             cropped to their route, and the route itself drawn over the
//                             honeycomb (green) to show that the beads keep to its edges.
//                             Prints, for each bead in each frame, how far it is from the route.
//   pulse.jpg                 (--only pulse) the star the beads reached, close up with the
//                             words under it, at five moments of its two-second pulse, both
//                             sizes; and the same star marked in the still sky (reduced motion)
//   panel.jpg                 (--only panel) the empty-star panel (B10) opened by a real click
//                             or tap on three stars at each size (the leftmost, the rightmost
//                             and the lowest of a figure), the whole screen, and the panel
//                             itself pixel for pixel. Prints where each panel was put and
//                             whether it is whole on the screen and clear of the logo.
//   lit.jpg                   (--only lit) a lit star clicked: the camera flown in and the
//                             panel with what was asked, for a short ask, a long one (it must
//                             scroll inside the panel) and one written as markup (it must show
//                             as the text it is), both sizes, and the long one pixel for pixel
//   ignite.jpg                (--only ignite) the claim as it plays after a send: the camera
//                             on the star (focusStar with ignite), then B4 to B5 at seven
//                             moments, close up, both sizes; the last with its panel
//   fall.jpg                  (--only fall) the fall as the contract promises it, frozen at
//                             six moments against a ground line that rises (drawn in green),
//                             then restore(). Prints when and where onImpact fired, when the
//                             promise resolved and whether restore() put every star back.
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
async function open(size, lit = [], query = '') {
	const context = await browser.newContext(SIZES[size]);
	const page = await context.newPage();
	if (lit.length > 0) {
		await page.addInitScript((slots) => {
			localStorage.setItem(
				'cellestial:claims',
				JSON.stringify(
					slots.map((s) =>
						typeof s === 'string' ? { slot: s, ask: 'A site for my bakery.' } : { slot: s[0], ask: s[1] },
					),
				),
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
	await page.goto(`${values.url}/?scene=sky&debug${query}`, { waitUntil: 'networkidle' });
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

// ─────────────────────────────────────────────── the hand-off, alone ──

/** How many pixels of two screenshots differ by more than `tol` in any channel. */
async function differing(a, b, tol = 2) {
	const [x, y] = await Promise.all([a, b].map((png) => sharp(png).removeAlpha().raw().toBuffer()));
	let n = 0;
	for (let i = 0; i < x.length; i += 3) {
		if (
			Math.abs(x[i] - y[i]) > tol ||
			Math.abs(x[i + 1] - y[i + 1]) > tol ||
			Math.abs(x[i + 2] - y[i + 2]) > tol
		)
			n++;
	}
	return n;
}

if (only.has('handoff')) {
	const cells = [];
	for (const size of ['desk', 'phone']) {
		const view = await open(size);
		const vp = SIZES[size].viewport;
		// About where the wordmark's little star is, and its size (the loader passes its own).
		const star = size === 'desk' ? { x: 1108, y: 318, r: 6 } : { x: 300, y: 398, r: 2.4 };
		const [cw, ch] = size === 'desk' ? [384, 240] : [111, 240];
		const shotAt = async (t) => {
			const core = await view.page.evaluate(
				([at, u]) =>
					new Promise((done) => {
						const { sky } = window.__cellestial;
						sky.debug.setClock(2);
						if (u === 0) sky.introPrime(at);
						if (u === 'reset') sky.reset();
						else sky.introProgress(u);
						sky.debug.drawNow();
						const c = sky.coreCircle();
						requestAnimationFrame(() => requestAnimationFrame(() => done(c)));
					}),
				[star, t],
			);
			console.log(
				`[${size}] hand-off ${String(t).padEnd(5)} core at ${core.x.toFixed(1)}, ${core.y.toFixed(1)} r ${core.r.toFixed(2)}`,
			);
			return view.page.screenshot({ type: 'png' });
		};
		let end = null;
		for (const t of [0, 0.3, 0.5, 0.7, 0.85, 1, 'reset']) {
			const png = await shotAt(t);
			if (t === 1) end = png;
			if (t === 'reset') {
				const n = await differing(end, png);
				console.log(`[${size}] introProgress(1) against reset(): ${n} pixels differ`);
				if (n > 0) errors++;
			}
			cells.push({
				img: await fit(png, cw, ch),
				w: cw,
				h: ch,
				caption: t === 'reset' ? 'reset()' : `t ${t}`,
			});
		}
		await view.close();
		void vp;
	}
	await sheet('handoff.jpg', cells.slice(0, 7), 4);
	await sheet('handoff-phone.jpg', cells.slice(7), 7);
}

// ──────────────────────────────────────────────────────── the beads ──

/** A rectangle of a screenshot (CSS pixels), fitted into a cell. */
async function cut(png, scale, box, w, h) {
	const meta = await sharp(png).metadata();
	const left = Math.max(0, Math.round(box.x * scale));
	const top = Math.max(0, Math.round(box.y * scale));
	const width = Math.min(meta.width - left, Math.round(box.w * scale));
	const height = Math.min(meta.height - top, Math.round(box.h * scale));
	const part = await sharp(png).extract({ left, top, width, height }).png().toBuffer();
	return fit(part, w, h);
}

if (only.has('beads')) {
	// A station, and where on the screen the touch lands (fractions of the viewport).
	const CASES = [
		[0, 0.12, 0.8],
		[3, 0.85, 0.2],
		[7, 0.6, 0.62],
	];
	for (const size of ['desk', 'phone']) {
		let view = await open(size);
		const vp = SIZES[size].viewport;
		const cells = [];
		const CW = size === 'desk' ? 258 : 190;
		const CH = size === 'desk' ? 200 : 250;
		// Last, Virgo with every one of its stars lit: the beads must go on to Libra.
		const virgo = await view.page.evaluate(() =>
			window.__cellestial.sky.hooks
				.layout()
				.plans[0].stars.filter((s) => s.slot)
				.map((s) => s.slot),
		);
		for (const [station, fx, fy, full] of [...CASES, [0, 0.3, 0.72, true]]) {
			if (full) {
				await view.close();
				view = await open(size, virgo);
			}
			await view.at(station, 2);
			const x = Math.round(fx * vp.width);
			const y = Math.round(fy * vp.height);
			const run = await view.page.evaluate(
				([px, py]) => {
					const { sky } = window.__cellestial;
					const route = sky.answer.touch(px, py);
					if (!route) return null;
					const r = sky.answer.run();
					const screen = route.points.map((p) => {
						const q = sky.hooks.project(p.x, p.y, -p.layer * sky.debug.stats().spacing);
						return [q.x, q.y];
					});
					return {
						slot: route.slot,
						edges: route.edges.length,
						edges2: route.edges2.length,
						strut: route.strut,
						arrive: r.arriveAfter,
						end: r.endAfter,
						screen,
						star: sky.hooks.starCircle(route.slot),
					};
				},
				[x, y],
			);
			if (!run) throw new Error(`no route at station ${station}`);
			// The frame's crop: the whole route, with room round it.
			const xs = run.screen.map((p) => p[0]);
			const ys = run.screen.map((p) => p[1]);
			const pad = size === 'desk' ? 70 : 45;
			let box = {
				x: Math.min(...xs) - pad,
				y: Math.min(...ys) - pad,
				w: Math.max(...xs) - Math.min(...xs) + 2 * pad,
				h: Math.max(...ys) - Math.min(...ys) + 2 * pad,
			};
			// Keep the cell's shape, so every frame of a row is cut alike.
			const want = CW / CH;
			if (box.w / box.h < want) {
				const w = box.h * want;
				box = { ...box, x: box.x - (w - box.w) / 2, w };
			} else {
				const h = box.w / want;
				box = { ...box, y: box.y - (h - box.h) / 2, h };
			}
			box.x = Math.max(0, Math.min(vp.width - box.w, box.x));
			box.y = Math.max(0, Math.min(vp.height - box.h, box.y));
			box.w = Math.min(box.w, vp.width);
			box.h = Math.min(box.h, vp.height);
			const k = Math.min(CW / box.w, CH / box.h);
			let worst = 0;
			let overlaid = null;
			for (const u of [0.12, 0.4, 0.7, 1, 'after']) {
				const dt = u === 'after' ? run.arrive + 0.3 : run.arrive * u - (u === 1 ? 0.004 : 0);
				const beads = await view.page.evaluate(
					(d) =>
						new Promise((done) => {
							const { sky } = window.__cellestial;
							sky.debug.setClock(2 + d);
							const at = sky.answer.beads.screen();
							requestAnimationFrame(() => requestAnimationFrame(() => done(at)));
						}),
					dt,
				);
				// How far each bead is from the route's polyline, pixels.
				for (const b of beads) {
					let best = Infinity;
					for (let i = 1; i < run.screen.length; i++) {
						const [ax, ay] = run.screen[i - 1];
						const [bx, by] = run.screen[i];
						const dx = bx - ax;
						const dy = by - ay;
						const len2 = dx * dx + dy * dy;
						const t = len2 > 0 ? Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.y - ay) * dy) / len2)) : 0;
						best = Math.min(best, Math.hypot(b.x - ax - dx * t, b.y - ay - dy * t));
					}
					worst = Math.max(worst, best);
				}
				const png = await view.page.screenshot({ type: 'png' });
				const img = await cut(png, view.scale, box, CW, CH);
				cells.push({
					img,
					w: CW,
					h: CH,
					caption:
						u === 'after'
							? 'arrived +0.3 s'
							: `${full ? 'all lit' : NAMES[station]} ${dt.toFixed(2)} s${u === 1 ? ' (arrives)' : ''}`,
				});
				if (u === 0.7) {
					// The same frame with the route drawn over it.
					const ox = (CW - box.w * k) / 2;
					const oy = (CH - box.h * k) / 2;
					const pts = run.screen
						.map(([px, py]) => `${(ox + (px - box.x) * k).toFixed(1)},${(oy + (py - box.y) * k).toFixed(1)}`)
						.join(' ');
					const svg = Buffer.from(
						`<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}"><polyline points="${pts}" fill="none" stroke="#5fd08a" stroke-width="1" stroke-opacity="0.9"/></svg>`,
					);
					overlaid = await sharp(img).composite([{ input: svg }]).png().toBuffer();
				}
			}
			const walk = run.strut >= 0 ? `${run.edges} edges, a strut, ${run.edges2}` : `${run.edges} edges`;
			cells.push({ img: overlaid, w: CW, h: CH, caption: `the route: ${walk}` });
			console.log(
				`[${size}] ${(full ? 'Virgo, all lit' : NAMES[station]).padEnd(14)} touch at ${x}, ${y}: ${walk} to ${run.slot}, head arrives ${run.arrive.toFixed(2)} s, last bead ${run.end.toFixed(2)} s; no bead is more than ${worst.toFixed(2)} px off the route`,
			);
			if (worst > 0.6) errors++;
			await view.page.evaluate(() => {
				window.__cellestial.sky.answer.clear();
				window.__cellestial.sky.debug.setClock(2);
			});
		}
		await view.close();
		await sheet(`beads-${size}.jpg`, cells, 6);
	}
}

// ───────────────────────────────────────────────── the pulse, the words ──

if (only.has('pulse')) {
	const SIDE = 216;
	const cells = [];
	for (const size of ['desk', 'phone']) {
		const vp = SIZES[size].viewport;
		const x = Math.round(0.3 * vp.width);
		const y = Math.round(0.7 * vp.height);
		const half = size === 'desk' ? 62 : 54;
		const view = await open(size);
		await view.at(0, 2);
		const run = await view.page.evaluate(
			([px, py]) => {
				const { sky } = window.__cellestial;
				const route = sky.answer.touch(px, py);
				return { slot: route.slot, arrive: sky.answer.run().arriveAfter };
			},
			[x, y],
		);
		for (const phase of [0, 0.5, 1, 1.5, 2]) {
			const got = await view.page.evaluate(
				([t, slot]) =>
					new Promise((done) => {
						const { sky } = window.__cellestial;
						sky.debug.setClock(t);
						const words = document.querySelector('[data-claim-words]');
						const box = words.getBoundingClientRect();
						const c = sky.hooks.starCircle(slot);
						const style = getComputedStyle(words);
						requestAnimationFrame(() =>
							requestAnimationFrame(() =>
								done({
									c,
									text: words.textContent,
									hidden: words.hidden,
									opacity: style.opacity,
									size: style.fontSize,
									dx: box.left + box.width / 2 - c.x,
									gap: box.top - (c.y + c.r),
								}),
							),
						);
					}),
				[2 + run.arrive + 0.001 + phase, run.slot],
			);
			const png = await view.page.screenshot({ type: 'png' });
			cells.push({
				img: await crop(png, view.scale, got.c.x, got.c.y + half * 0.25, half, SIDE),
				w: SIDE,
				h: SIDE,
				caption: `${size} +${phase} s, r ${got.c.r.toFixed(1)}`,
			});
			if (phase === 0 || phase === 1) {
				console.log(
					`[${size}] pulse +${phase} s: star r ${got.c.r.toFixed(2)} px; words "${got.text}" ${got.size}, opacity ${got.opacity}, centred ${got.dx.toFixed(2)} px off the star, ${got.gap.toFixed(1)} px under its disc`,
				);
			}
		}
		await view.close();
		// The still sky: a touch marks the star at once, and nothing moves.
		const still = await open(size, [], '&rm=1');
		const marked = await still.page.evaluate(
			([px, py]) =>
				new Promise((done) => {
					const { sky } = window.__cellestial;
					const route = sky.answer.touch(px, py);
					requestAnimationFrame(() =>
						requestAnimationFrame(() =>
							done({
								slot: route?.slot,
								run: sky.answer.run() !== null,
								pulsing: sky.answer.pulsing(),
								c: route ? sky.hooks.starCircle(route.slot) : null,
							}),
						),
					);
				}),
			[x, y],
		);
		const png = await still.page.screenshot({ type: 'png' });
		console.log(
			`[${size}] still sky: a touch marks ${marked.pulsing} at once; beads running: ${marked.run}`,
		);
		if (marked.run || marked.pulsing !== marked.slot) errors++;
		cells.push({
			img: await crop(png, still.scale, marked.c.x, marked.c.y + half * 0.25, half, SIDE),
			w: SIDE,
			h: SIDE,
			caption: `${size}, still sky: marked`,
		});
		await still.close();
	}
	await sheet('pulse.jpg', cells, 6);
}

// ─────────────────────────────────────────────── the empty-star panel ──

/** A panel's place on screen and how it stands to its star and to the screen. */
const PANEL = ([kind, slot]) => {
	const { sky } = window.__cellestial;
	const el = document.querySelector(`#sky-ui [data-sky-panel="${kind}"]`);
	const b = el.getBoundingClientRect();
	const c = sky.hooks.starCircle(slot);
	const dx = Math.max(b.left - c.x, c.x - b.right, 0);
	const dy = Math.max(b.top - c.y, c.y - b.bottom, 0);
	return {
		hidden: el.hidden,
		box: { x: b.left, y: b.top, w: b.width, h: b.height },
		star: c,
		// From the star's disc to the panel's nearest edge.
		gap: Math.hypot(dx, dy) - c.r,
		whole: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight,
		margin: Math.min(b.left, b.top, innerWidth - b.right, innerHeight - b.bottom),
		overChrome: b.left < 110 && b.top < 80,
		text: el.innerText,
	};
};

if (only.has('panel')) {
	const cells = [];
	for (const size of ['desk', 'phone']) {
		const view = await open(size);
		const vp = SIZES[size].viewport;
		const [fw, fh] = size === 'desk' ? [400, 250] : [150, 325];
		let close = null;
		// Virgo's leftmost and lowest star, and the rightmost star of Scorpius (far right on a phone).
		for (const [station, which] of [
			[0, 'left'],
			[0, 'low'],
			[2, 'right'],
		]) {
			await view.at(station, 2);
			const slot = await view.page.evaluate(
				([w]) => {
					const { hooks } = window.__cellestial.sky;
					const stars = hooks
						.layout()
						.plans[hooks.flight().figure].stars.filter((s) => s.slot)
						.map((s) => ({ slot: s.slot, c: hooks.starCircle(s.slot) }))
						.filter((s) => s.c);
					const by = { left: (s) => s.c.x, right: (s) => -s.c.x, low: (s) => -s.c.y }[w];
					return stars.sort((a, b) => by(a) - by(b))[0].slot;
				},
				[which],
			);
			const c = await view.page.evaluate((s) => window.__cellestial.sky.hooks.starCircle(s), slot);
			if (size === 'desk') await view.page.mouse.click(c.x, c.y);
			else await view.page.touchscreen.tap(c.x, c.y);
			await view.page.waitForTimeout(350);
			const p = await view.page.evaluate(PANEL, ['empty', slot]);
			const png = await view.page.screenshot({ type: 'png' });
			const ok = !p.hidden && p.whole && !p.overChrome && p.gap > 0 && p.box.w <= vp.width - 24;
			if (!ok) errors++;
			console.log(
				`[${size}] ${NAMES[station]}, the ${which}most star (${slot}) at ${p.star.x.toFixed(0)}, ${p.star.y.toFixed(0)}: panel ${p.box.w.toFixed(0)}x${p.box.h.toFixed(0)} at ${p.box.x.toFixed(0)}, ${p.box.y.toFixed(0)}; ${p.gap.toFixed(0)} px from the star's disc, at least ${p.margin.toFixed(0)} px inside the screen${ok ? '' : '   WRONG'}`,
			);
			cells.push({ img: await fit(png, fw, fh), w: fw, h: fh, caption: `${size}: ${NAMES[station]}, ${which}most star` });
			if (!close) {
				close = await cut(png, view.scale, p.box.x - 8 < 0 ? { ...p.box, x: 0, y: p.box.y - 8, w: p.box.w + 16, h: p.box.h + 16 } : { x: p.box.x - 8, y: p.box.y - 8, w: p.box.w + 16, h: p.box.h + 16 }, 330, 325);
				console.log(`[${size}] the panel's words:\n${p.text.split('\n').map((l) => `        ${l}`).join('\n')}`);
			}
			await view.page.keyboard.press('Escape');
			await view.page.waitForTimeout(100);
		}
		cells.push({ img: close, w: 330, h: 325, caption: `${size}: the panel, pixel for pixel` });
		await view.close();
	}
	await sheet('panel.jpg', cells, 4);
}

// ─────────────────────────────────────────────────── the lit-star panel ──

const ASKS = [
	['slot-3', 'A site for my bakery, with the week\'s bread on the first page.'],
	[
		'slot-53',
		`We are a family plumbing business, three vans, twenty-two years in the same town.\n\nWhat we need:\n- a site that says who we are and shows the work\n- a way to book a visit without ringing us\n- reminders the day before, so nobody forgets\n- a page for emergencies, with the number in large type\n\nWhat we do not need: a blog, a chat bubble, or anything that moves when you scroll past it. My father started this business with one van and a notebook, and the site should feel like him: plain, on time, and there when you call. We would like to be able to change the prices ourselves, and to add a photograph when a job turns out well. If it can be ready before the cold weather, that would be the best thing of all.`,
	],
	['slot-110', '<b>Bold</b> ideas & a shop <img src=x onerror="document.title=\'broken\'"> for <i>hats</i>'],
];

if (only.has('lit')) {
	const cells = [];
	for (const size of ['desk', 'phone']) {
		const view = await open(size, ASKS);
		const [fw, fh] = size === 'desk' ? [400, 250] : [150, 325];
		let close = null;
		await view.page.evaluate(() => window.__cellestial.sky.debug.setClock(null));
		for (const [slot, ask] of ASKS) {
			const c = await view.page.evaluate((s) => window.__cellestial.sky.hooks.starCircle(s), slot);
			if (size === 'desk') await view.page.mouse.click(c.x, c.y);
			else await view.page.touchscreen.tap(c.x, c.y);
			await view.page.waitForFunction(() => window.__cellestial.sky.panels.open()?.kind === 'lit', null, { timeout: 8000 });
			await view.page.waitForTimeout(400);
			const p = await view.page.evaluate(PANEL, ['lit', slot]);
			const png = await view.page.screenshot({ type: 'png' });
			const same = p.text === ask;
			const ok = !p.hidden && p.whole && !p.overChrome && p.gap > 0 && same;
			if (!ok) errors++;
			console.log(
				`[${size}] ${slot}, an ask of ${ask.length} characters: the star at ${p.star.x.toFixed(0)}, ${p.star.y.toFixed(0)} r ${p.star.r.toFixed(0)}; panel ${p.box.w.toFixed(0)}x${p.box.h.toFixed(0)} at ${p.box.x.toFixed(0)}, ${p.box.y.toFixed(0)}, ${p.gap.toFixed(0)} px from the star; its text is ${same ? 'exactly the ask' : 'NOT the ask'}${ok ? '' : '   WRONG'}`,
			);
			cells.push({ img: await fit(png, fw, fh), w: fw, h: fh, caption: `${size}: ${ask.length} characters` });
			if (ask.length > 300) {
				close = await cut(png, view.scale, { x: Math.max(0, p.box.x - 8), y: p.box.y - 8, w: p.box.w + 16, h: p.box.h + 16 }, 330, 325);
			}
			await view.page.keyboard.press('Escape');
			await view.page.waitForTimeout(1300);
		}
		cells.push({ img: close, w: 330, h: 325, caption: `${size}: the long ask, pixel for pixel` });
		const title = await view.page.title();
		if (title === 'broken') {
			errors++;
			console.error(`[${size}] the ask's markup was run`);
		}
		await view.close();
	}
	await sheet('lit.jpg', cells, 4);
}

// ───────────────────────────────────────────────────────── the ignition ──

if (only.has('ignite')) {
	const SIDE = 218;
	const cells = [];
	const slot = 'slot-34';
	for (const size of ['desk', 'phone']) {
		const view = await open(size, [[slot, 'A site for my bakery.']]);
		await view.at(0, 2);
		// As the director does after a send: fly to the star and play the claim there.
		const began = await view.page.evaluate(async (s) => {
			const { sky } = window.__cellestial;
			let at = null;
			sky.hooks.on('ignite', () => {
				at = sky.hooks.time();
			});
			void sky.focusStar(s, { ignite: true });
			for (let t = 2; t < 8 && at === null; t += 0.02) {
				sky.debug.setClock(t);
				await Promise.resolve();
			}
			return at;
		}, slot);
		if (began === null) throw new Error('the claim never played');
		console.log(`[${size}] the camera reached the star and the claim began ${(began - 2).toFixed(2)} s after focusStar`);
		for (const dt of [-0.02, 0.2, 0.45, 0.7, 0.95, 1.4, 2.4]) {
			const c = await view.page.evaluate(
				([t, s]) =>
					new Promise((done) => {
						const { sky } = window.__cellestial;
						sky.debug.setClock(t);
						const circle = sky.hooks.starCircle(s);
						requestAnimationFrame(() => requestAnimationFrame(() => done(circle)));
					}),
				[began + dt, slot],
			);
			const png = await view.page.screenshot({ type: 'png' });
			cells.push({
				img: await crop(png, view.scale, c.x + c.r * 0.35, c.y, c.r * 1.75, SIDE),
				w: SIDE,
				h: SIDE,
				caption: `${size} ${dt < 0 ? 'before' : `+${dt} s`}`,
			});
		}
		await view.close();
	}
	await sheet('ignite.jpg', cells, 7);
}

// ───────────────────────────────────────────────────────── the fall ──

if (only.has('fall')) {
	const cells = [];
	for (const size of ['desk', 'phone']) {
		const view = await open(size, LIT);
		const vp = SIZES[size].viewport;
		const [cw, ch] = size === 'desk' ? [384, 240] : [111, 240];
		// The ground comes up from the bottom edge to 55% of the height over 1.2 s.
		const before = await view.at(0, 2);
		const places = () =>
			view.page.evaluate(() => {
				const { hooks } = window.__cellestial.sky;
				const out = [];
				for (const star of hooks.layout().plans[0].stars) {
					if (!star.slot) continue;
					const c = hooks.starCircle(star.slot);
					out.push(c ? [c.x, c.y, c.r] : null);
				}
				return out;
			});
		const was = await places();
		await view.page.evaluate(() => {
			const { sky } = window.__cellestial;
			const { hooks } = sky;
			const h = hooks.layout().h;
			const t0 = hooks.time();
			const log = { impacts: [], resolvedAt: null, t0 };
			window.__fall = log;
			log.ground = () => h - 0.45 * h * Math.min(1, (hooks.time() - t0) / 1.2);
			sky
				.fall({ groundY: log.ground, onImpact: (x) => log.impacts.push({ x, at: hooks.time() - t0 }) })
				.then(() => {
					log.resolvedAt = hooks.time() - t0;
				});
		});
		for (const dt of [0, 0.15, 0.3, 0.45, 0.6, 0.8]) {
			const ground = await view.page.evaluate(
				(d) =>
					new Promise((done) => {
						const { sky } = window.__cellestial;
						sky.debug.setClock(2 + d);
						const y = window.__fall.ground();
						requestAnimationFrame(() => requestAnimationFrame(() => done(y)));
					}),
				dt,
			);
			const png = await view.page.screenshot({ type: 'png' });
			const k = ch / vp.height;
			const line = Buffer.from(
				`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}"><line x1="0" x2="${cw}" y1="${ground * k}" y2="${ground * k}" stroke="#5fd08a" stroke-width="1"/></svg>`,
			);
			cells.push({
				img: await sharp(await fit(png, cw, ch)).composite([{ input: line }]).png().toBuffer(),
				w: cw,
				h: ch,
				caption: `fall +${dt}s`,
			});
		}
		// Let it run out, then put everything back.
		const log = await view.page.evaluate(async () => {
			const { sky } = window.__cellestial;
			// In small steps, so that the moment the promise resolves is seen.
			for (let d = 0.8; d <= 8 && window.__fall.resolvedAt === null; d += 0.02) {
				sky.debug.setClock(2 + d);
				await Promise.resolve();
			}
			await new Promise((r) => setTimeout(r, 50));
			const { impacts, resolvedAt } = window.__fall;
			return { impacts, resolvedAt };
		});
		const gone = await view.page.screenshot({ type: 'png' });
		await view.page.evaluate(() => window.__cellestial.sky.restore());
		const after = await view.at(0, 10);
		const now = await places();
		const moved = was.filter(
			(c, i) => !c || !now[i] || Math.hypot(c[0] - now[i][0], c[1] - now[i][1]) > 0.01,
		).length;
		console.log(
			`[${size}] fall: onImpact fired ${log.impacts.length} time(s)${log.impacts[0] ? ` at x ${log.impacts[0].x.toFixed(0)} of ${vp.width}, ${log.impacts[0].at.toFixed(2)} s in` : ''}; resolved ${log.resolvedAt === null ? 'NEVER' : `${log.resolvedAt.toFixed(2)} s in`}; after restore() ${moved} of ${was.length} stars are out of place`,
		);
		if (log.impacts.length !== 1 || log.resolvedAt === null || moved > 0) errors++;
		cells.push({ img: await fit(gone, cw, ch), w: cw, h: ch, caption: 'resolved: empty' });
		cells.push({ img: await fit(after, cw, ch), w: cw, h: ch, caption: 'restore()' });
		void before;
		await view.close();
	}
	await sheet('fall.jpg', cells.slice(0, 8), 4);
	await sheet('fall-phone.jpg', cells.slice(8), 8);
}

await browser.close();
if (errors > 0) {
	console.error(`${errors} problem(s)`);
	process.exit(1);
}
