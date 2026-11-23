#!/usr/bin/env node
// Findings 2 and 8: B7, the meaning. Every claim seeded; all twelve figures at both sizes, on the
// production build, real GPU: where the words stand, their size, their sampled colour, what they
// touch (stars, the figure's lines, the logo and menu, the exit button, the screen's edge). Then two
// figures WRITTEN in real time (Aries; Leo and the final line), recorded and cut into strips.
//   node b7.mjs [--only all,write]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, hex, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { only: { type: 'string', default: 'all,write' }, sizes: { type: 'string', default: 'desk,phone' } } });
const sizes = values.sizes.split(',');
const only = new Set(values.only.split(','));
const dir = outDir('b7');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
let fails = 0;
const tally = [];
const farTotal = {};
const all = CONSTELLATIONS.flatMap((c) => c.stars.map((s) => s.slot).filter(Boolean)).map((slot) => ({ slot, ask: 'A site for my bakery' }));
const seed = { fn: (list) => { sessionStorage.setItem('cellestial:round', '1'); localStorage.setItem('cellestial:claims', JSON.stringify(list)); }, arg: all };
const ready = async (o) => {
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.meaning && window.__cellestial?.claims);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await sleep(1500);
};
const segHitsRect = (a, b, r) => {
	// Liang-Barsky
	let t0 = 0, t1 = 1;
	const dx = b.x - a.x, dy = b.y - a.y;
	for (const [p, q] of [[-dx, a.x - r.x], [dx, r.x + r.w - a.x], [-dy, a.y - r.y], [dy, r.y + r.h - a.y]]) {
		if (p === 0) { if (q < 0) return false; } else { const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
	}
	return true;
};
async function colour(png, clip, dpr) {
	const { data, info } = await sharp(png).extract({ left: Math.max(0, Math.round(clip.x * dpr)), top: Math.max(0, Math.round(clip.y * dpr)), width: Math.round(clip.w * dpr), height: Math.round(clip.h * dpr) }).raw().toBuffer({ resolveWithObject: true });
	let r = 0, g = 0, b = 0, n = 0, blue = 0;
	for (let i = 0; i < data.length; i += info.channels) {
		const R = data[i], G = data[i + 1], B = data[i + 2];
		if (Math.max(R, G, B) > 110) { r += R; g += G; b += B; n++; if (B > R + 25) blue++; }
	}
	return n ? { mean: hex(r / n, g / n, b / n), n, blue: (100 * blue) / n } : { mean: 'none', n: 0, blue: 0 };
}

if (only.has('all')) for (const size of sizes) {
	const dpr = SIZES[size].deviceScaleFactor;
	const o = await open(browser, size, { init: seed });
	await ready(o);
	const cells = [];
	const crops = [];
	say(`B7 at every figure, ${size} (${all.length} claims seeded)`);
	for (let k = 0; k < CONSTELLATIONS.length; k++) {
		const c = CONSTELLATIONS[k];
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(k === 11 ? 7000 : 4500);
		const png = await o.page.screenshot({ type: 'png' });
		const m = await o.page.evaluate(([name, slots, further]) => {
			const el = document.querySelector(`.sky-meaning[data-meaning="${name}"]`);
			if (!el || el.hidden) return null;
			const lines = [...el.querySelectorAll('.sky-meaning__line')].map((l) => { const q = l.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height, text: l.textContent.trim().replace(/\s+/g, ' ') }; });
			const r = el.getBoundingClientRect();
			const hooks = window.__cellestial.sky.hooks;
			const core = window.__cellestial.sky.coreCircle?.();
			const circles = slots.map((s) => (s ? hooks.starCircle(s) : core));
			const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; };
			const cs = getComputedStyle(el);
			// Round 2, piece 4: the stars of the figures further on, where the sky shows them now.
			const far = further.flatMap((list, n) => list.map((s) => (s ? hooks.starCircle(s) : null)).filter(Boolean).map((q) => ({ ...q, n: n + 1 })));
			return { text: el.textContent.trim().replace(/\s+/g, ' '), x: r.x, y: r.y, w: r.width, h: r.height, font: cs.fontSize, color: cs.color, lines, circles, far, b11: rect('[data-descend]'), logo: rect('.chrome-logo'), menu: rect('#chrome button[popovertarget]'), W: innerWidth, H: innerHeight };
		}, [c.name, c.stars.map((s) => s.slot), [1, 2, 3, 4].map((n) => CONSTELLATIONS[(k + n) % CONSTELLATIONS.length].stars.map((s) => s.slot))]);
		if (!m) { say(`${size} ${c.name}: NO MEANING SHOWN`); cells.push({ img: png, label: `${k + 1} ${c.name}: none` }); continue; }
		const boxes = m.lines.length ? m.lines : [m];
		const cs = m.circles.filter(Boolean);
		const figTop = Math.min(...cs.map((q) => q.y - q.r)), figBottom = Math.max(...cs.map((q) => q.y + q.r)), figLeft = Math.min(...cs.map((q) => q.x - q.r)), figRight = Math.max(...cs.map((q) => q.x + q.r));
		let starGap = Infinity, hitsStar = 0, hitsLine = 0;
		for (const b of boxes) {
			for (const q of cs) { const d = Math.hypot(Math.max(b.x - q.x, 0, q.x - (b.x + b.w)), Math.max(b.y - q.y, 0, q.y - (b.y + b.h))) - q.r; if (d < starGap) starGap = d; if (d < 0) hitsStar++; }
			for (const [i, j] of c.lines) { const A = m.circles[i], B = m.circles[j]; if (A && B && segHitsRect(A, B, b)) hitsLine++; }
		}
		// Far points on the words: a point of one of the next four figures whose disc lies in or on a line's box.
		const gapTo = (b, q) => Math.hypot(Math.max(b.x - q.x, 0, q.x - (b.x + b.w)), Math.max(b.y - q.y, 0, q.y - (b.y + b.h))) - q.r;
		const farOn = m.far.filter((q) => boxes.some((b) => gapTo(b, q) < 0));
		const farGap = m.far.length ? Math.min(...m.far.map((q) => Math.min(...boxes.map((b) => gapTo(b, q))))) : Infinity;
		const over = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
		const touch = [];
		if (hitsStar) touch.push(`${hitsStar} STAR(S)`);
		if (hitsLine) touch.push(`${hitsLine} LINE(S) of the figure`);
		if (boxes.some((b) => over(b, m.b11))) touch.push('THE EXIT BUTTON');
		if (boxes.some((b) => over(b, m.logo) || over(b, m.menu))) touch.push('THE LOGO OR MENU');
		if (m.x < 0 || m.y < 0 || m.x + m.w > m.W || m.y + m.h > m.H) touch.push('THE SCREEN EDGE');
		const where = m.y >= figBottom ? 'under the figure' : m.y + m.h <= figTop ? 'above the figure' : m.x >= figRight ? 'right of the figure' : m.x + m.w <= figLeft ? 'left of the figure' : 'within the figure\'s bounds';
		const col = await colour(png, m, dpr);
		const toB11 = m.b11 ? Math.round(m.b11.y - (m.y + m.h)) : null;
		const edge = Math.round(Math.min(m.x, m.y, m.W - m.x - m.w));
		say(`${size} ${String(k + 1).padStart(2)} ${c.name.padEnd(12)} "${m.text}" ${Math.round(m.w)}x${Math.round(m.h)} at ${Math.round(m.x)},${Math.round(m.y)}; type ${m.font}; ${where} (figure x ${Math.round(figLeft)}..${Math.round(figRight)}, y ${Math.round(figTop)}..${Math.round(figBottom)}); nearest star's edge ${Math.round(starGap)} px; ${toB11} px above B11; ${edge} px from the nearest side/top; touches: ${touch.length ? touch.join(', ') : 'nothing'}; letters' mean colour ${col.mean} (${col.n} px, ${col.blue.toFixed(0)}% bluish); css colour ${m.color}; points of the next four figures shown ${m.far.length}, ON THE WORDS ${farOn.length}${farOn.length ? ` (${farOn.map((q) => `+${q.n} at ${Math.round(q.x)},${Math.round(q.y)} r ${q.r.toFixed(1)}`).join('; ')})` : ''}, the nearest ${Number.isFinite(farGap) ? `${Math.round(farGap)} px from the words' box` : 'none'}`);
		farTotal[size] = (farTotal[size] ?? 0) + farOn.length;
		cells.push({ img: png, label: `${k + 1} ${c.name}: "${m.text}"` });
		// The third look: the words and what lies round and under them, at the screen's own pixels.
		{
			const pad = size === 'desk' ? 70 : 40;
			const left = Math.max(0, Math.round((m.x - pad) * dpr)), top = Math.max(0, Math.round((m.y - pad) * dpr));
			const width = Math.min(Math.round(m.W * dpr) - left, Math.round((m.w + 2 * pad) * dpr)), height = Math.min(Math.round(m.H * dpr) - top, Math.round((m.h + 2 * pad) * dpr));
			crops.push({ img: await sharp(png).extract({ left, top, width, height }).png().toBuffer(), label: `${k + 1} ${c.name}: the words as drawn (${Math.round(m.w)}x${Math.round(m.h)} css px, ${pad} px round them); far points shown ${m.far.length}, on the words ${farOn.length}`, enlarge: size === 'desk' });
		}
		// Round 2, piece 3: the phone's verdict. Nothing touched; and 40 px above the exit button
		// unless the words stand in the figure's own room (inside its bounds).
		// Round 2, piece 4: the desktop's verdict. Large type, nothing touched, and no point of a figure further on on the words.
		if (size === 'desk') {
			const ok = touch.length === 0 && farOn.length === 0 && m.font === '54px';
			if (!ok) fails++;
			tally.push(`${ok ? 'PASS' : 'FAIL'}  ${size} ${c.name}: touches ${touch.length ? touch.join(', ') : 'nothing'}; type ${m.font}; far points on the words ${farOn.length}, the nearest ${Number.isFinite(farGap) ? `${Math.round(farGap)} px away` : 'none shown'}; ${Math.round(starGap)} px from the nearest star's edge; ${toB11} px above the exit button`);
		}
		if (size !== 'desk') {
			const ok = touch.length === 0 && (toB11 === null || toB11 >= 40 || where === 'within the figure\'s bounds');
			if (!ok) fails++;
			tally.push(`${ok ? 'PASS' : 'FAIL'}  ${size} ${c.name}: touches ${touch.length ? touch.join(', ') : 'nothing'}; ${toB11} px above the exit button; ${where}; type ${m.font}; ${Math.round(starGap)} px from the nearest star's edge`);
		}
	}
	for (const t of tally.splice(0)) say(t);
	say(`${size}: points of the figures further on that lie on the words, all twelve figures together: ${farTotal[size] ?? 0}`);
	const studio = await o.page.evaluate(() => { const e = document.querySelector('.chrome-studio'); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, color: getComputedStyle(e).color }; });
	const sc = await colour(await o.page.screenshot({ type: 'png' }), studio, dpr);
	say(`${size} for comparison, the logo's "studio": letters' mean ${sc.mean}; css ${studio.color}`);
	if (size === 'desk') {
		await sheet(join(dir, 'all-desk-1.jpg'), cells.slice(0, 6), { cols: 3, cellW: 520, cellH: 325 });
		await sheet(join(dir, 'all-desk-2.jpg'), cells.slice(6), { cols: 3, cellW: 520, cellH: 325 });
	} else if (SIZES[size].viewport.width > SIZES[size].viewport.height) await sheet(join(dir, `all-${size}.jpg`), cells, { cols: 3, cellW: 525, cellH: Math.round((525 * SIZES[size].viewport.height) / SIZES[size].viewport.width) }); /* the fourth look: a phone on its side, large enough to judge */
	else await sheet(join(dir, `all-${size}.jpg`), cells, { cols: 6, cellW: 258, cellH: Math.round((258 * SIZES[size].viewport.height) / SIZES[size].viewport.width) });
	if (size === 'desk') for (let i = 0, n = 1; i < crops.length; i += 6, n++) await sheet(join(dir, `words-desk-${n}.jpg`), crops.slice(i, i + 6), { cols: 2, cellW: 780, cellH: 240 });
	else await sheet(join(dir, `words-${size}.jpg`), crops, { cols: 4, cellW: 390, cellH: 300 });
	await o.context.close();
}

if (only.has('write')) for (const size of sizes) for (const k of [7, 11]) {
	const c = CONSTELLATIONS[k];
	const o = await open(browser, size, { init: seed });
	await ready(o);
	const rec = await recorder(o, { quality: 88 });
	await sleep(200);
	const t0 = Date.now();
	await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
	await sleep(k === 11 ? 8500 : 6000);
	await rec.stop();
	const m = await o.page.evaluate((name) => { const r = document.querySelector(`.sky-meaning[data-meaning="${name}"]`).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, c.name);
	// when does the writing begin? the first frame in which the words' box is no longer dark
	const f0 = rec.frames.filter((f) => f.ts >= t0);
	const meta = await sharp(f0[0].img).metadata();
	const sx = meta.width / o.W;
	const pad = size === 'desk' ? 90 : 50;
	const crop = { left: Math.max(0, Math.round((m.x - pad) * sx)), top: Math.max(0, Math.round((m.y - pad) * sx)), width: 0, height: 0 };
	crop.width = Math.min(meta.width - crop.left, Math.round((m.w + 2 * pad) * sx));
	crop.height = Math.min(meta.height - crop.top, Math.round((m.h + 2 * pad) * sx));
	const cells = [];
	const end = k === 11 ? 8200 : 5600;
	const n = 24;
	for (let i = 0; i < n; i++) {
		const t = t0 + (end * i) / (n - 1);
		const f = rec.at(t);
		if (f) cells.push({ img: await sharp(f.img).extract(crop).toBuffer(), label: `${c.name} +${Math.round(t - t0)} ms`, enlarge: true });
	}
	await sheet(join(dir, `write-${c.name.toLowerCase()}-${size}.jpg`), cells, { cols: 4, cellW: 390, cellH: Math.round((390 * crop.height) / crop.width) });
	say(`${size} ${c.name}: the writing recorded (${rec.frames.length} frames); console errors ${o.errors.length ? o.errors.join(' | ').slice(0, 200) : 'none'}`);
	await o.context.close();
}
writeFileSync(join(dir, `b7${only.has('all') ? '' : '-write'}${values.sizes === 'desk,phone' ? '' : `-${sizes.join('-')}`}.txt`), `${log.join('\n')}\n`);
await browser.close();
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
