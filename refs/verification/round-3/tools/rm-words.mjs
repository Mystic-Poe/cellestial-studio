#!/usr/bin/env node
// Round 3, piece 2: reduced motion, every star lit. The meanings are to be simply THERE: at each
// station the figure's words are shown, in the "written" state, whole (opacity 1, lit), and 2 s
// later they are in the same place and at the same size to a twentieth of a pixel, as bright (the
// box's mean within 2%). The pixels of the two pictures that differ inside the words' box are
// counted too, but are not the verdict: about once in a hundred arrivals (oftener with the CPU
// slowed) the browser draws the same words a fraction of a device pixel higher or lower in the
// first picture than in the second, with every number in the page the same (seen enlarged: the
// letters' upper edges a shade darker, the lower a shade lighter, the mean unchanged). Also what the page itself says of the placing (type, rows, how it was
// come by). And the words of the figures FURTHER ON, which are there too once written and travel
// with their figure: none of them may stand at a tenth of its strength or more within 40 px of the
// station's own words (on a phone on its side the next figure is half its size already, in the middle
// of the screen, where the room for this figure's words is). Production build, real GPU.
//   node rm-words.mjs [--sizes desk,side,short] [--tag before]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'desk,side,short' }, tag: { type: 'string', default: '' } } });
const tag = values.tag ? `-${values.tag}` : '';
const dir = outDir('b7');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
let fails = 0;
const all = CONSTELLATIONS.flatMap((c) => c.stars.map((s) => s.slot).filter(Boolean)).map((slot) => ({ slot, ask: 'A site for my bakery' }));
for (const size of values.sizes.split(',')) {
	const dpr = SIZES[size].deviceScaleFactor ?? 1;
	const o = await open(browser, size, { reducedMotion: true, init: { fn: (list) => { sessionStorage.setItem('cellestial:round', '1'); localStorage.setItem('cellestial:claims', JSON.stringify(list)); }, arg: all } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.meaning);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await sleep(800);
	const cells = [];
	let there = 0, moved = 0, redrawn = 0, farSeen = 0, farNear = 0, farLeast = Infinity, farStrongest = 0;
	const hows = {};
	for (let k = 0; k < CONSTELLATIONS.length; k++) {
		const c = CONSTELLATIONS[k];
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(400);
		const read = () => o.page.evaluate((name) => {
			const el = document.querySelector(`.sky-meaning[data-meaning="${name}"]`);
			if (!el || el.hidden) return null;
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle(el);
			const st = window.__cellestial.sky.meaning.state().find((s) => s.name === name);
			const gap = (q) => Math.hypot(Math.max(r.x - (q.x + q.width), 0, q.x - (r.x + r.width)), Math.max(r.y - (q.y + q.height), 0, q.y - (r.y + r.height)));
			const far = [...document.querySelectorAll('.sky-meaning:not([hidden])')].filter((e) => e !== el).map((e) => { const q = e.getBoundingClientRect(); return { name: e.dataset.meaning, opacity: Number(getComputedStyle(e).opacity), x: q.x, y: q.y, w: q.width, h: q.height, gap: gap(q) }; });
			return { x: r.x, y: r.y, w: r.width, h: r.height, opacity: cs.opacity, visibility: cs.visibility, transform: el.style.transform, state: st?.state, placed: st?.placed, far, text: el.textContent.trim().replace(/\s+/g, ' ') };
		}, c.name);
		const a = await read();
		const p1 = await o.page.screenshot({ type: 'png' });
		await sleep(2000);
		const b = await read();
		const p2 = await o.page.screenshot({ type: 'png' });
		if (!a || !b) { fails++; say(`FAIL  ${size} ${c.name}: no meaning shown under reduced motion`); continue; }
		const box = { left: Math.max(0, Math.floor(a.x * dpr)), top: Math.max(0, Math.floor(a.y * dpr)), width: Math.ceil(a.w * dpr), height: Math.ceil(a.h * dpr) };
		const [d1, d2] = await Promise.all([p1, p2].map((p) => sharp(p).extract(box).ensureAlpha().raw().toBuffer()));
		let differ = 0;
		for (let i = 0; i < d1.length; i += 4) if (d1[i] !== d2[i] || d1[i + 1] !== d2[i + 1] || d1[i + 2] !== d2[i + 2]) differ++;
		// Lit letters in the box at 0.4 s: the words are drawn, not waiting to be.
		let lit = 0, sum1 = 0, sum2 = 0;
		for (let i = 0; i < d1.length; i += 4) {
			if (Math.max(d1[i], d1[i + 1], d1[i + 2]) > 110) lit++;
			sum1 += d1[i] + d1[i + 1] + d1[i + 2];
			sum2 += d2[i] + d2[i + 1] + d2[i + 2];
		}
		const same = Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05 && Math.abs(a.w - b.w) < 0.05 && Math.abs(a.h - b.h) < 0.05 && Math.abs(sum1 - sum2) <= 0.02 * sum2;
		const far = a.far.filter((f) => f.opacity >= 0.1);
		const close = far.filter((f) => f.gap < 40);
		farSeen += far.length;
		farNear += close.length;
		for (const f of far) { farLeast = Math.min(farLeast, f.gap); farStrongest = Math.max(farStrongest, f.opacity); }
		const ok = a.state === 'written' && a.visibility === 'visible' && Number(a.opacity) === 1 && lit > 200 && same && close.length === 0;
		if (ok) there++; else fails++;
		if (!same) moved++;
		if (differ) redrawn++;
		const how = a.placed ? `${a.placed.px}px, ${a.placed.rows} row(s), ${a.placed.how}` : 'unknown';
		hows[a.placed?.how ?? 'unknown'] = (hows[a.placed?.how ?? 'unknown'] ?? 0) + 1;
		say(`${ok ? 'ok  ' : 'FAIL'}  ${size} ${String(k + 1).padStart(2)} ${c.name.padEnd(12)} 0.4 s after arriving: state ${a.state}, opacity ${a.opacity}, ${lit} lit px in its box ${Math.round(a.w)}x${Math.round(a.h)} at ${Math.round(a.x)},${Math.round(a.y)}; 2 s later ${same ? 'the same place, size and brightness' : `NOT THE SAME (the box ${b.x.toFixed(2)},${b.y.toFixed(2)} ${b.w.toFixed(2)}x${b.h.toFixed(2)}, it was ${a.x.toFixed(2)},${a.y.toFixed(2)} ${a.w.toFixed(2)}x${a.h.toFixed(2)})`} (${differ} px of the box differ${differ ? `, the box's mean ${(sum1 / d1.length).toFixed(2)} then ${(sum2 / d2.length).toFixed(2)}` : ''}); placed: ${how}; words of figures further on showing at 0.1 or more: ${far.length ? far.map((f) => `${f.name} at ${f.opacity.toFixed(2)}, ${Math.round(f.w)}x${Math.round(f.h)}, ${Math.round(f.gap)} px from these words`).join('; ') : 'none'}`);
		cells.push({ img: p1, label: `${k + 1} ${c.name}, reduced motion, +0.4 s` });
	}
	say(`${there === CONSTELLATIONS.length ? 'PASS' : 'FAIL'}  ${size} (${SIZES[size].viewport.width}x${SIZES[size].viewport.height}), reduced motion: ${there} of ${CONSTELLATIONS.length} meanings simply there; moved or changed in the 2 s after ${moved}; drawn a fraction of a pixel off in one of the two pictures ${redrawn}; placed ${Object.entries(hows).map(([h, n]) => `${h} ${n}`).join(', ')}; words of figures further on showing at 0.1 or more: ${farSeen} (the strongest ${farStrongest.toFixed(2)}; the nearest to a station's words ${Number.isFinite(farLeast) ? `${Math.round(farLeast)} px` : 'none'}; within 40 px: ${farNear}); console errors ${o.errors.length ? o.errors.join(' | ').slice(0, 200) : 'none'}`);
	const { width: W, height: H } = SIZES[size].viewport;
	await sheet(join(dir, `rm-words-${size}${tag}.jpg`), cells, W > H ? { cols: 4, cellW: 390, cellH: Math.round((390 * H) / W) } : { cols: 6, cellW: 258, cellH: Math.round((258 * H) / W) });
	await o.context.close();
}
writeFileSync(join(dir, `rm-words${tag}.txt`), `${log.join('\n')}\n`);
await browser.close();
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
