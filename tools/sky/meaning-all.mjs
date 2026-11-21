#!/usr/bin/env node
// B7 at all twelve figures: every star of every figure is seeded as claimed
// (localStorage "cellestial:claims"), the camera is stood at each figure in
// turn, and its meaning is photographed once it is written.
//
//   node tools/sky/meaning-all.mjs [--url http://localhost:4500] [--only desk,phone] [--still]
//
// Writes refs/sky/compare/b7-all-desk.jpg, b7-all-phone.jpg (twelve to a sheet)
// and b7-all.txt: for each figure where the words stand, their size, how far
// they are from the nearest star and from the exit button, and the mean colour
// of the letters sampled from the screenshot (the site's brass text is #ae8a68).
// --still asks for reduced motion (the words are simply there): quick, for
// looking at placement only. Needs the real GPU. Exits non-zero if a meaning
// is missing, is not whole on screen, or touches a star's button, the logo or
// the exit button.
// (Grown from the look inspector's refs/verification/look-tools/b7-and-numbers.mjs.)

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../src/content/constellations.ts';
import { launch, openPage, ROOT, SIZES, sharp, sheet } from '../roots/lib.mjs';

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		only: { type: 'string', default: 'desk,phone' },
		still: { type: 'boolean', default: false },
		out: { type: 'string' },
	},
});
const OUT = values.out ?? join(ROOT, 'refs/sky/compare');
const out = [];
let failed = 0;
const log = (s) => {
	console.log(s);
	out.push(s);
};
const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const browser = await launch({ gpu: true });

/** Mean colour of the bright pixels of a region of a PNG. */
async function sample(png, clip, dpr) {
	const { data, info } = await sharp(png)
		.extract({
			left: Math.max(0, Math.round(clip.x * dpr)),
			top: Math.max(0, Math.round(clip.y * dpr)),
			width: Math.round(clip.width * dpr),
			height: Math.round(clip.height * dpr),
		})
		.raw()
		.toBuffer({ resolveWithObject: true });
	let r = 0;
	let g = 0;
	let b = 0;
	let n = 0;
	for (let i = 0; i < data.length; i += info.channels) {
		if (Math.max(data[i], data[i + 1], data[i + 2]) > 110) {
			r += data[i];
			g += data[i + 1];
			b += data[i + 2];
			n++;
		}
	}
	return n ? hex(r / n, g / n, b / n) : 'none';
}

const all = CONSTELLATIONS.flatMap((c) => c.stars.map((s) => s.slot).filter(Boolean)).map((slot) => ({
	slot,
	ask: 'A site for my bakery',
}));
log(`B7, every figure complete (${all.length} claims seeded)${values.still ? ', reduced motion' : ''}`);

for (const size of values.only.split(',')) {
	const dpr = SIZES[size].deviceScaleFactor;
	const { width: W, height: H } = SIZES[size].viewport;
	const o = await openPage(browser, size, null, values.still ? { reducedMotion: 'reduce' } : {});
	await o.page.addInitScript((list) => {
		sessionStorage.setItem('cellestial:round', '1');
		localStorage.setItem('cellestial:claims', JSON.stringify(list));
	}, all);
	await o.page.goto(`${values.url}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.meaning && window.__cellestial?.claims);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await o.page.waitForTimeout(values.still ? 600 : 1500);
	const cells = [];
	for (let k = 0; k < CONSTELLATIONS.length; k++) {
		const name = CONSTELLATIONS[k].name;
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await o.page.waitForTimeout(values.still ? 500 : k === 11 ? 7500 : 4200);
		const png = await o.page.screenshot({ type: 'png' });
		const m = await o.page.evaluate(
			([n, w, h]) => {
				const el = document.querySelector(`.sky-meaning[data-meaning="${n}"]`);
				if (!el || el.hidden) return null;
				const r = el.getBoundingClientRect();
				const boxes = [...document.querySelectorAll('button.sky-star:not([hidden])')]
					.map((b) => b.getBoundingClientRect())
					.filter((q) => q.right > 0 && q.left < w && q.bottom > 0 && q.top < h);
				const stars = boxes.map((q) => ({ x: q.x + q.width / 2, y: q.y + q.height / 2 }));
				const ys = stars.map((s) => s.y);
				const xs = stars.map((s) => s.x);
				const over = (q) => q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top;
				const b11 = document.querySelector('[data-descend]').getBoundingClientRect();
				const logo = document.querySelector('#chrome')?.getBoundingClientRect();
				const gap = Math.min(
					...stars.map((s) =>
						Math.hypot(Math.max(r.left - s.x, 0, s.x - r.right), Math.max(r.top - s.y, 0, s.y - r.bottom)),
					),
				);
				return {
					text: [...el.querySelectorAll('.sky-meaning__say')].map((say) => say.textContent.trim()).join(' / '),
					x: r.x,
					y: r.y,
					w: r.width,
					h: r.height,
					font: getComputedStyle(el).fontSize,
					fig: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
					starGap: gap,
					touches: boxes.filter(over).length,
					b11: over(b11),
					toB11: b11.top - r.bottom,
					logo: logo ? r.left < 150 && r.top < 92 : false,
				};
			},
			[name, W, H],
		);
		if (!m) {
			failed++;
			log(`${size} ${name}: NO MEANING SHOWN`);
			cells.push({ img: png, label: `${k + 1} ${name}: none` });
			continue;
		}
		const colour = await sample(png, { x: m.x, y: m.y, width: m.w, height: m.h }, dpr);
		const whole = m.x >= 0 && m.y >= 0 && m.x + m.w <= W && m.y + m.h <= H;
		const [fx0, fy0, fx1, fy1] = m.fig;
		const cx = m.x + m.w / 2;
		const cy = m.y + m.h / 2;
		const where =
			cx >= fx0 && cx <= fx1 && cy >= fy0 && cy <= fy1
				? 'inside the figure'
				: m.y >= fy1
					? `under the figure (${Math.round(m.y - fy1)} px below its lowest star)`
					: m.y + m.h <= fy0
						? 'above the figure'
						: 'beside the figure';
		const ok = whole && m.touches === 0 && !m.b11 && !m.logo;
		if (!ok) failed++;
		log(
			`${size} ${String(k + 1).padStart(2)} ${name.padEnd(12)} "${m.text}" ${Math.round(m.w)}x${Math.round(m.h)} at ${Math.round(m.x)},${Math.round(m.y)} font ${m.font}; ${where}; nearest star centre ${Math.round(m.starGap)} px; ${Math.round(m.toB11)} px above B11; letters ${colour}; ${ok ? 'ok' : `FAIL (whole ${whole}, star buttons touched ${m.touches}, B11 ${m.b11}, logo ${m.logo})`}`,
		);
		cells.push({ img: png, label: `${k + 1} ${name}: "${m.text}"` });
	}
	await sheet(
		join(OUT, `b7-all-${size}.jpg`),
		cells,
		size === 'desk' ? { cols: 4, cellW: 390, cellH: 244 } : { cols: 6, cellW: 258, cellH: 558 },
	);
	await o.context.close();
}
await browser.close();
writeFileSync(join(OUT, 'b7-all.txt'), `${out.join('\n')}\n`);
process.exit(failed ? 1 : 0);
