#!/usr/bin/env node
// Finding 4: the empty star at its real size and enlarged, beside the pack's B4, and beside a lit
// star and B5. Production build, real GPU, both sizes; Aries (4 stars: two seeded lit) and Taurus.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, ROOT, SIZES, hex, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';

const dir = outDir('stars');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const B4 = join(ROOT, 'cellestial-assets/images/b-sky/B4_star_empty-sleeping.jpg');
const B5 = join(ROOT, 'cellestial-assets/images/b-sky/B5_star_lit-claimed.jpg');
const browser = await launch({ gpu: true });
for (const size of ['desk', 'phone']) {
	const dpr = SIZES[size].deviceScaleFactor;
	for (const fig of [7, 8]) {
		const c = CONSTELLATIONS[fig];
		const slots = c.stars.map((s) => s.slot).filter(Boolean);
		const lit = [slots[0], slots[2]];
		const o = await open(browser, size, { init: { fn: (list) => { sessionStorage.setItem('cellestial:round', '1'); localStorage.setItem('cellestial:claims', JSON.stringify(list)); }, arg: lit.map((slot) => ({ slot, ask: 'A site for my bakery' })) } });
		await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
		await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
		await o.page.evaluate(() => window.__cellestial.sky.ready);
		await sleep(1000);
		await o.page.evaluate((k) => window.__cellestial.sky.debug.setCoord(k), fig);
		await sleep(3000);
		const png = await o.page.screenshot({ type: 'png' });
		const stars = await o.page.evaluate(([w, h]) => [...document.querySelectorAll('button.sky-star:not([hidden])')].map((b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, bw: r.width, label: b.getAttribute('aria-label'), slot: b.dataset.slot ?? null }; }).filter((p) => p.x > 20 && p.x < w - 20 && p.y > 20 && p.y < h - 20), [o.W, o.H]);
		const circles = await o.page.evaluate((list) => list.map((s) => window.__cellestial.sky.hooks?.starCircle?.(s) ?? null), slots);
		const starPx = await o.page.evaluate(() => window.__cellestial.sky.debug.stats().starPx);
		say(`${size} ${c.name}: ${stars.length} star buttons; starPx ${JSON.stringify(starPx)}; circles ${JSON.stringify(circles.filter(Boolean).slice(0, 4).map((q) => ({ x: Math.round(q.x), y: Math.round(q.y), r: Math.round(q.r * 10) / 10 })))}`);
		const cells = [{ img: await sharp(png).resize({ width: size === 'desk' ? 1440 : 780 }).jpeg({ quality: 92 }).toBuffer(), label: `${c.name} at its station, ${size}, two stars lit (as shown, whole screen)` }];
		const measure = async (q, name) => {
			const R = Math.ceil(q.r * 1.9);
			const box = { left: Math.max(0, Math.round((q.x - R) * dpr)), top: Math.max(0, Math.round((q.y - R) * dpr)), width: Math.round(2 * R * dpr), height: Math.round(2 * R * dpr) };
			const crop = await sharp(png).extract(box).png().toBuffer();
			const { data, info } = await sharp(crop).raw().toBuffer({ resolveWithObject: true });
			let warm = 0, inside = 0, rimN = 0, rr = 0, rg = 0, rb = 0, br = 0, bg = 0, bb = 0, peak = [0, 0, 0], peakL = -1, wr = 0, wg = 0, wb = 0;
			const cx = info.width / 2, cy = info.height / 2, rad = q.r * dpr;
			for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
				const i = (y * info.width + x) * info.channels;
				const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
				const d = Math.hypot(x - cx, y - cy) / rad;
				if (d < 0.8) {
					inside++; br += r; bg += g; bb += b;
					if (r > b + 18 && r > 70) { warm++; wr += r; wg += g; wb += b; }
				} else if (d >= 0.88 && d <= 1.2) {
					const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
					if (L > 40) { rimN++; rr += r; rg += g; rb += b; }
					if (L > peakL) { peakL = L; peak = [r, g, b]; }
				}
			}
			say(`   ${name}: radius ${q.r.toFixed(1)} px; body mean ${hex(br / inside, bg / inside, bb / inside)}; warm (brass) pixels ${(100 * warm / inside).toFixed(1)}% of the disc${warm ? `, their mean ${hex(wr / warm, wg / warm, wb / warm)}` : ''}; rim (0.88-1.2 r, lit pixels) mean ${rimN ? hex(rr / rimN, rg / rimN, rb / rimN) : 'none'}, brightest ${hex(...peak)}`);
			return crop;
		};
		const emptySlot = slots.findIndex((s, i) => !lit.includes(s) && circles[i]);
		const litSlot = slots.findIndex((s, i) => lit.includes(s) && circles[i]);
		const e = await measure(circles[emptySlot], 'empty star');
		const l = await measure(circles[litSlot], 'lit star');
		const big = 330;
		cells.push({ img: e, label: `empty, as it appears (r ${circles[emptySlot].r.toFixed(1)} px, device pixels)` });
		cells.push({ img: await sharp(e).resize({ width: big, kernel: 'nearest' }).png().toBuffer(), label: 'empty, enlarged', enlarge: true });
		cells.push({ img: await sharp(B4).resize({ width: big }).png().toBuffer(), label: 'the pack: B4_star_empty-sleeping.jpg' });
		cells.push({ img: l, label: `lit, as it appears (r ${circles[litSlot].r.toFixed(1)} px)` });
		cells.push({ img: await sharp(l).resize({ width: big, kernel: 'nearest' }).png().toBuffer(), label: 'lit, enlarged', enlarge: true });
		cells.push({ img: await sharp(B5).resize({ width: big }).png().toBuffer(), label: 'the pack: B5_star_lit-claimed.jpg' });
		// the pack's B4 reduced to the size the star is drawn at: what the asset itself gives at that size
		const d = Math.round(circles[emptySlot].r * 2 * dpr / 0.92);
		cells.push({ img: await sharp(await sharp(B4).resize({ width: d }).png().toBuffer()).resize({ width: big, kernel: 'nearest' }).png().toBuffer(), label: `B4 itself reduced to ${d} px, enlarged`, enlarge: true });
		// first cell wide, the rest in a row
		const top = await sharp(cells[0].img).resize({ width: 1500, height: 620, fit: 'inside' }).toBuffer();
		await sheet(join(dir, `${size}-${c.name.toLowerCase()}-station.jpg`), [{ img: top, label: cells[0].label }], { cols: 1, cellW: 1500, cellH: 620 });
		await sheet(join(dir, `${size}-${c.name.toLowerCase()}-close.jpg`), cells.slice(1), { cols: 7, cellW: 220, cellH: 220 });
		await o.context.close();
	}
}
writeFileSync(join(dir, 'stars.txt'), `${log.join('\n')}\n`);
await browser.close();
