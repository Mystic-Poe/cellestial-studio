#!/usr/bin/env node
// Round 4's own: WITH MOTION ON, as a visitor meets it. Production build, real GPU, the round done.
// For stars whose words now stand BESIDE them (and two whose words stand under, for the control): a
// point of empty sky that offers the star is found (sky.answer.plan: it changes nothing), and then
// everything is done with the hands: a REAL tap or click there; the beads run; the words come when the
// beads arrive; where they stand (place, box, 7 px from their star, what they touch); the pulse (the
// words' light sampled on every frame for 4.4 s); and a REAL tap or click on the words: that star is
// picked, its panel opens, nothing is claimed.
//   node r4-motion.mjs [--sizes desk,phone]     writes motion/motion.txt and motion/<size>.jpg
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'desk,phone' } } });
const dir = outDir('motion');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
// [station, slot]: beside their star on this build (labels/desk.txt, phone.txt), and two under it.
const CASES = {
	desk: [[0, 'slot-34'], [0, 'slot-52'], [2, 'slot-7'], [3, 'slot-143'], [3, 'slot-140'], [6, 'slot-115'], [8, 'slot-69'], [8, 'slot-54'], [1, 'slot-70'], [10, 'slot-91']],
	phone: [[0, 'slot-34'], [0, 'slot-98'], [2, 'slot-2'], [3, 'slot-140'], [3, 'slot-39'], [6, 'slot-141'], [9, 'slot-4'], [5, 'slot-130'], [1, 'slot-70'], [1, 'slot-88']],
};
let fails = 0;
for (const size of values.sizes.split(',')) {
	const { width: W, height: H } = SIZES[size].viewport;
	const dpr = SIZES[size].deviceScaleFactor ?? 1;
	const o = await open(browser, size, { init: { fn: () => { sessionStorage.setItem('cellestial:round', '1'); } } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await sleep(2500);
	const cells = [];
	for (const [k, slot] of CASES[size]) {
		const name = `${size} ${CONSTELLATIONS[k].name} ${slot}`;
		await o.page.keyboard.press('Escape');
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(2000);
		// A point of empty sky that offers this star, well off the star itself and any control.
		const pt = await o.page.evaluate((want) => {
			const sky = window.__cellestial.sky, c = sky.hooks.starCircle(want);
			let best = null;
			for (let y = 135; y < innerHeight - 110; y += 10) for (let x = 15; x < innerWidth - 10; x += 10) {
				if (sky.answer.plan(x, y)?.slot !== want) continue;
				const el = document.elementFromPoint(x, y);
				if (!el || el.closest('button, a, .sky-claim') || el.tagName !== 'CANVAS') continue;
				const d = c ? Math.hypot(x - c.x, y - c.y) : 0;
				if (c && d < c.r + 26) continue;
				if (!best || d > best.d) best = { x, y, d };
			}
			return best ? [best.x, best.y] : null;
		}, slot);
		if (!pt) { say(`FAIL  ${name}: no point of empty sky offers it`); fails++; continue; }
		await o.pressAt(...pt);
		await sleep(80);
		const run = await o.page.evaluate(() => { const r = window.__cellestial.sky.answer.run(); return r ? { slot: r.route.slot, arrive: r.route.arrive ?? null } : null; });
		const early = await o.page.evaluate(() => !document.querySelector('[data-claim-words]').hidden);
		let got = null;
		const t0 = Date.now();
		while (Date.now() - t0 < 5000) {
			got = await o.page.evaluate(() => {
				const w = document.querySelector('[data-claim-words]');
				if (!w || w.hidden || getComputedStyle(w).visibility === 'hidden') return null;
				const sky = window.__cellestial.sky, hooks = sky.hooks, layout = hooks.layout();
				const b = w.getBoundingClientRect(), box = { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom };
				const own = hooks.starCircle(w.dataset.slot);
				const gap = (s) => Math.hypot(Math.max(box.x0 - s.x, 0, s.x - box.x1), Math.max(box.y0 - s.y, 0, s.y - box.y1)) - s.r;
				const front = hooks.lattice.layer();
				let stars = 0, deep = 0, points = 0, rings = Infinity, air = Infinity;
				for (let layer = front; layer <= front + 11; layer++) {
					const g = ((layer % 12) + 12) % 12, plan = layout.plans[g], fit = layout.fits[g];
					if (!plan || !fit) continue;
					plan.stars.forEach((star, i) => {
						if (star.slot === w.dataset.slot) return;
						const p = hooks.project(star.x, star.y, -layer * 6);
						if (p.scale <= 0 || p.depth < 0.25) return;
						if (layer > front + 5 && (i !== plan.epicentre || p.depth >= 54)) return;
						const isRings = i === plan.epicentre;
						const r = isRings ? 0.215 * layout.b3 * p.scale : Math.max(fit.starR * layout.sizeOf(star) * p.scale, 1.25);
						if (p.x < -r || p.x > layout.w + r || p.y < -r || p.y > layout.h + r) return;
						const d = gap({ x: p.x, y: p.y, r });
						if (isRings) { rings = Math.min(rings, d); return; }
						if (r > 3) air = Math.min(air, d);
						if (d < 0) { if (r > 3) { stars++; deep = Math.max(deep, -d); } else points++; }
					});
				}
				const range = document.createRange();
				range.selectNodeContents(w);
				const t = range.getBoundingClientRect();
				return { slot: w.dataset.slot, pulsing: sky.answer.pulsing(), side: w.dataset.side ?? 'under', slide: Number(w.dataset.slide ?? 0), box, own, tight: own ? gap({ ...own, r: own.r * 1.1 }) : null, stars, deep, points, rings, air, edge: Math.min(t.left, innerWidth - t.right), steady: w.dataset.steady, text: w.textContent };
			});
			if (got) break;
			await sleep(40);
		}
		const after = Date.now() - t0;
		if (!got) { say(`FAIL  ${name}: a real tap at ${pt}: no words came in 5 s (the beads ${run ? `ran to ${run.slot}` : 'did not run'})`); fails++; continue; }
		const png = await o.page.screenshot({ type: 'png' });
		// The pulse: the words' light on every frame for 4.4 s.
		const wave = await o.page.evaluate(() => new Promise((done) => { const el = document.querySelector('[data-claim-words]'); const out = []; const t = performance.now(); const tick = () => { out.push([performance.now() - t, Number(el.style.getPropertyValue('--pulse')), el.dataset.side ?? 'under', el.style.transform]); if (performance.now() - t < 4400) requestAnimationFrame(tick); else done(out); }; requestAnimationFrame(tick); }));
		const peaks = [];
		for (let i = 1; i < wave.length - 1; i++) if (wave[i][1] > 0.98 && wave[i][1] >= wave[i - 1][1] && wave[i][1] > wave[i + 1][1]) peaks.push(wave[i][0]);
		const period = peaks.length >= 2 ? (peaks.at(-1) - peaks[0]) / (peaks.length - 1) / 1000 : Number.NaN;
		const low = Math.min(...wave.map((p) => p[1]));
		const moved = new Set(wave.map((p) => `${p[2]} ${p[3]}`)).size;
		// A real tap or click on the words.
		const mid = [(got.box.x0 + got.box.x1) / 2, (got.box.y0 + got.box.y1) / 2];
		const under = await o.page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.sky-claim') ? 'the words' : document.elementFromPoint(x, y)?.tagName, mid);
		await o.pressAt(...mid);
		await sleep(700);
		const picked = await o.page.evaluate(() => { const p = document.querySelector('#sky-ui [data-sky-panel="empty"]'); return { picked: window.__cellestial.claims.picked(), lit: window.__cellestial.claims.all().size, panel: !!p && !p.hidden && p.getBoundingClientRect().width > 0, words: !document.querySelector('[data-claim-words]').hidden }; });
		const where = `${got.side}${got.slide ? (got.slide > 0 ? '+' : '') + got.slide : ''}`;
		const ok = run?.slot === slot && !early && got.slot === slot && got.pulsing === slot && got.text === 'claim yours' && Math.abs(got.tight - 7) < 0.6 && got.rings >= 0 && got.edge >= 16 - 0.05 && Math.abs(period - 2) < 0.12 && low < 0.05 && moved === 1 && under === 'the words' && picked.picked === slot && picked.panel && picked.lit === 0;
		if (!ok) fails++;
		say(`${ok ? 'PASS' : 'FAIL'}  ${name}: a real ${o.phone ? 'tap' : 'click'} at ${pt}: the beads run to ${run?.slot ?? 'NOTHING'} (the words not yet there: ${!early}); the words come ${after + 80} ms after the press by ${got.slot}, ${where.toUpperCase()}, box ${Math.round(got.box.x0)},${Math.round(got.box.y0)}, ${got.tight?.toFixed(1)} px from their star's disc; across ${got.stars} star(s)${got.stars ? ` (${got.deep.toFixed(1)} px in)` : ''} and ${got.points} far point(s); the nearest star's disc ${Number.isFinite(got.air) ? `${got.air.toFixed(1)} px` : 'none'}; Cellestial's rings ${Number.isFinite(got.rings) ? `${got.rings.toFixed(0)} px off` : 'not in view'}; letters ${got.edge.toFixed(0)} px inside; the pulse ${period.toFixed(2)} s from peak to peak (${peaks.length} peaks, lowest ${low.toFixed(2)}); places taken in 4.4 s at rest: ${moved}; a real ${o.phone ? 'tap' : 'click'} on the words (under the finger: ${under}): picked ${picked.picked}, its panel ${picked.panel ? 'open' : 'NOT open'}, claimed ${picked.lit}`);
		const bw = 260, bh = 170;
		const cx = (got.box.x0 + got.box.x1 + 2 * got.own.x) / 4, cy = (got.box.y0 + got.box.y1 + 2 * got.own.y) / 4;
		const left = Math.max(0, Math.min(W - bw, Math.round(cx - bw / 2))), top = Math.max(0, Math.min(H - bh, Math.round(cy - bh / 2)));
		cells.push({ img: await sharp(png).extract({ left: left * dpr, top: top * dpr, width: bw * dpr, height: bh * dpr }).resize(520, 340).jpeg({ quality: 92 }).toBuffer(), label: `${name}: ${where}, motion on${ok ? '' : ' FAIL'}` });
		await o.page.keyboard.press('Escape');
		await sleep(300);
	}
	const errs = o.errors.filter((e) => !/about:blank/.test(e));
	say(`${size}: console errors ${errs.length}${errs.length ? `: ${errs.join(' | ').slice(0, 300)}` : ''}`);
	if (cells.length) await sheet(join(dir, `${size}.jpg`), cells, { cols: 3, cellW: 520, cellH: 340 });
	await o.context.close();
}
writeFileSync(join(dir, 'motion.txt'), `${log.join('\n')}\n`);
await browser.close();
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
