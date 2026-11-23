#!/usr/bin/env node
// Round 3, piece 1: what hangs on the sky's layout, on a phone held on its side. Production build,
// real GPU, 844x390 (--size side667 for 667x375).
//   1. THE BUTTON OR NOT: every star's place at every station with the exit button not yet shown (a
//      first visit, no round flown) and with it shown: the largest difference, px. Nothing may jump.
//   2. TURNED: a phone loaded upright and turned on its side: every star's place against a fresh load
//      at that size; and the picture (the clock held, the logo hidden) against the fresh load's, pixel
//      for pixel, at four stations.
//   3. THE FALL: the exit button pressed at two stations: every star's place on every frame from the
//      press; each must leave from where it stood (no jump at the first frame, x unchanged), and a
//      strip of the first second and a half.
//   4. REDUCED MOTION: the still sky, the exit button there, every star clear of it.
//   node side-scenes.mjs [--size side] [--only button,turned,fall,rm]
// Writes fifth-look/side/side-scenes[-<size>].txt, fall-<size>.jpg, reduced-motion-<size>.jpg.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { size: { type: 'string', default: 'side' }, only: { type: 'string', default: 'button,turned,fall,rm' } } });
const size = values.size;
const only = new Set(values.only.split(','));
const { width: W, height: H } = SIZES[size].viewport;
SIZES.upright = { ...SIZES[size], viewport: { width: H, height: W } };
const dir = outDir('side');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
let fails = 0;
const verdict = (ok, what) => { if (!ok) fails++; say(`${ok ? 'PASS' : 'FAIL'}  ${what}`); };
const browser = await launch({ gpu: true });
const SLOTS = CONSTELLATIONS.map((c) => c.stars.map((s) => s.slot));

const ready = async (o, query = '?scene=sky&debug') => {
	await o.page.goto(`${PROD}/${query}`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => window.__cellestial.sky.debug.setLevel(0));
	await sleep(1500);
};
/** Every star's circle at every station, the clock held. */
const places = async (o) => {
	const out = [];
	for (let k = 0; k < 12; k++) {
		out.push(await o.page.evaluate(([i, slots]) => new Promise((done) => {
			const sky = window.__cellestial.sky;
			sky.debug.setCoord(i);
			sky.debug.setClock(2);
			requestAnimationFrame(() => requestAnimationFrame(() => done(slots.map((s) => (s ? sky.hooks.starCircle(s) : sky.coreCircle())))));
		}), [k, SLOTS[k]]));
	}
	return out;
};
const worstOf = (a, b) => {
	let worst = 0, missing = 0, n = 0;
	for (let k = 0; k < 12; k++) for (let i = 0; i < a[k].length; i++) {
		const p = a[k][i], q = b[k][i];
		if (!p || !q) { if (p || q) missing++; continue; }
		n++;
		worst = Math.max(worst, Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.r - q.r));
	}
	return { worst, missing, n };
};
const exitRect = (o) => o.page.evaluate(() => { const e = document.querySelector('[data-descend]'); const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height, hidden: e.hidden }; });
const shot = async (o, k) => {
	await o.page.evaluate((i) => new Promise((done) => { const { debug } = window.__cellestial.sky; debug.setCoord(i); debug.setClock(2); requestAnimationFrame(() => requestAnimationFrame(done)); }), k);
	await sleep(300);
	return o.page.screenshot({ type: 'png' });
};
const HIDE = '.chrome-logo { visibility: hidden !important; }';

say(`WHAT HANGS ON THE SKY'S LAYOUT, ON A PHONE ON ITS SIDE: ${W}x${H} (${size}), production build`);
let fresh = null;
const freshShots = {};
if (only.has('button') || only.has('turned')) {
	const o = await open(browser, size, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
	await ready(o);
	await o.page.addStyleTag({ content: HIDE });
	fresh = await places(o);
	const b = await exitRect(o);
	say(`a fresh load, the round flown: the exit button shown (${!b.hidden}) at ${b.x.toFixed(0)},${b.y.toFixed(0)} ${b.w.toFixed(0)}x${b.h.toFixed(0)}`);
	let least = Infinity, on = 0;
	for (let k = 0; k < 12; k++) for (const q of fresh[k]) if (q) { on++; least = Math.min(least, Math.hypot(Math.max(b.x - q.x, 0, q.x - (b.x + b.w)), Math.max(b.y - q.y, 0, q.y - (b.y + b.h))) - q.r); }
	verdict(least >= 12 - 0.01, `every star's disc is 12 px or more from the exit button at every station (${on} stars and Cellestial's core; nearest ${least.toFixed(2)} px)`);
	if (only.has('turned')) for (const k of [0, 2, 8, 11]) freshShots[k] = await shot(o, k);
	await o.context.close();
}
if (only.has('button')) {
	const o = await open(browser, size);
	await ready(o);
	const b = await exitRect(o);
	const first = await places(o);
	const d = worstOf(first, fresh);
	verdict(b.hidden === true, `a first visit, no round flown: the exit button is not shown (hidden ${b.hidden})`);
	verdict(d.worst < 0.01 && d.missing === 0, `THE BUTTON OR NOT: ${d.n} stars at twelve stations stand in the same place with the button not shown and shown (largest difference ${d.worst.toFixed(4)} px; ${d.missing} missing in one of the two)`);
	// And the moment it appears: the round is flown in the page, the button comes up, nothing moves.
	await o.page.evaluate(() => window.__cellestial.sky.debug.setCoord(1));
	await sleep(600);
	const before = await o.page.evaluate((slots) => slots.map((s) => window.__cellestial.sky.hooks.starCircle(s)), SLOTS[1].filter(Boolean));
	await o.page.evaluate(() => { sessionStorage.setItem('cellestial:round', '1'); const e = document.querySelector('[data-descend]'); e.hidden = false; });
	await sleep(1200);
	const after = await o.page.evaluate((slots) => slots.map((s) => window.__cellestial.sky.hooks.starCircle(s)), SLOTS[1].filter(Boolean));
	const moved = Math.max(...before.map((p, i) => Math.hypot(p.x - after[i].x, p.y - after[i].y)));
	verdict(moved < 0.01, `Libra's stars when the button is put on the page: moved ${moved.toFixed(4)} px`);
	await o.context.close();
}
if (only.has('turned')) {
	const o = await open(browser, 'upright', { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
	await ready(o);
	await o.page.addStyleTag({ content: HIDE });
	const up = {};
	for (const k of [0, 2, 8, 11]) up[k] = await shot(o, k);
	await o.page.setViewportSize({ width: W, height: H });
	await sleep(900);
	const turned = await places(o);
	const d = worstOf(turned, fresh);
	verdict(d.worst < 0.01 && d.missing === 0, `TURNED: loaded at ${H}x${W} and turned to ${W}x${H}: ${d.n} stars at twelve stations stand where a fresh load at ${W}x${H} puts them (largest difference ${d.worst.toFixed(4)} px; ${d.missing} missing)`);
	const count = async (a, b) => { const A = await sharp(a).removeAlpha().raw().toBuffer(), B = await sharp(b).removeAlpha().raw().toBuffer(); let n = 0; for (let i = 0; i < A.length; i += 3) if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) n++; return [n, A.length / 3]; };
	for (const k of [0, 2, 8, 11]) {
		const [n, of] = await count(await shot(o, k), freshShots[k]);
		verdict(n === 0, `   ${CONSTELLATIONS[k].name} turned on its side: ${n} of ${of} pixels differ from the fresh load's picture`);
	}
	await o.page.setViewportSize({ width: H, height: W });
	await sleep(900);
	for (const k of [0, 2, 8, 11]) {
		const [n, of] = await count(await shot(o, k), up[k]);
		verdict(n === 0, `   ${CONSTELLATIONS[k].name} upright again: ${n} of ${of} pixels differ from the first picture`);
	}
	await o.context.close();
}
if (only.has('fall')) {
	const cells = [];
	for (const k of [1, 3]) {
		const c = CONSTELLATIONS[k];
		const o = await open(browser, size, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
		await ready(o);
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(2600);
		const slots = SLOTS[k].filter(Boolean);
		const stood = await o.page.evaluate((s) => s.map((q) => window.__cellestial.sky.hooks.starCircle(q)), slots);
		await o.page.evaluate((s) => {
			window.__fall = [];
			const sky = window.__cellestial.sky;
			const tick = (t) => {
				window.__fall.push({ t, scene: document.documentElement.dataset.scene, c: s.map((q) => { const p = sky.hooks.starCircle(q); return p ? [p.x, p.y] : null; }) });
				if (window.__fall.length < 240) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		}, slots);
		const rec = await recorder(o);
		await sleep(250);
		const t0 = Date.now() / 1000;
		const p0 = await o.page.evaluate(() => performance.now());
		await o.press('[data-descend]');
		await sleep(2600);
		await rec.stop();
		const rows = await o.page.evaluate(() => window.__fall);
		// Before the press: where they stood. After: each star's first place that differs.
		const still = rows.filter((r) => r.t < p0);
		const drift = Math.max(...still.map((r) => Math.max(...r.c.map((p, i) => (p ? Math.hypot(p[0] - stood[i].x, p[1] - stood[i].y) : 0)))));
		let worstX = 0, worstStep = 0, up = 0, left = 0;
		for (let i = 0; i < slots.length; i++) {
			let last = [stood[i].x, stood[i].y], moved = false;
			for (const r of rows) {
				if (r.t < p0) continue;
				// The fall is over for this star when the page no longer gives it a place, or the scene
				// has changed to the ground: after that the sky is put back as it was, unseen.
				if (!r.c[i] || (r.scene !== 'sky' && r.scene !== 'fall')) { if (moved) break; continue; }
				const [x, y] = r.c[i];
				if (!moved && Math.abs(y - last[1]) > 0.01) {
					moved = true;
					left++;
					// the first step off its place: a few px, not a jump
					worstStep = Math.max(worstStep, Math.abs(y - stood[i].y));
				}
				if (y < last[1] - 0.5) up++;
				worstX = Math.max(worstX, Math.abs(x - stood[i].x));
				last = [x, y];
			}
		}
		say(`THE FALL from ${c.name} at ${W}x${H}: ${slots.length} stars; before the press they stand still (largest drift ${drift.toFixed(3)} px over ${still.length} frames); scene after ${rows.at(-1)?.scene}`);
		verdict(left === slots.length && worstStep < 30 && up === 0, `   every star leaves from where it stood: ${left} of ${slots.length} fall; the first step off its place is at most ${worstStep.toFixed(1)} px; steps upward ${up}; sideways at most ${worstX.toFixed(2)} px`);
		const t = t0 * 1000;
		for (const f of rec.cut(c.name, t, t + 1500, 150)) cells.push(f);
		await o.context.close();
	}
	await sheet(join(dir, `fall-${size}.jpg`), cells, { cols: 6, cellW: 266, cellH: Math.round((266 * H) / W) });
}
if (only.has('rm')) {
	const o = await open(browser, size, { reducedMotion: true });
	const t0 = Date.now();
	await o.page.goto(`${PROD}/`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 15000 });
	await sleep(2500);
	const m = await o.page.evaluate((slots) => {
		const e = document.querySelector('[data-descend]');
		const q = e.getBoundingClientRect();
		const sky = window.__cellestial?.sky;
		return { scene: document.documentElement.dataset.scene, motion: document.documentElement.dataset.motion, hidden: e.hidden, b: { x: q.x, y: q.y, w: q.width, h: q.height }, loader: !!document.querySelector('#loader:not([hidden])') };
	}, SLOTS[0]);
	const a = await o.page.screenshot({ type: 'png' });
	await sleep(1500);
	const b = await o.page.screenshot({ type: 'png' });
	const A = await sharp(a).removeAlpha().raw().toBuffer(), B = await sharp(b).removeAlpha().raw().toBuffer();
	let n = 0;
	for (let i = 0; i < A.length; i += 3) if (Math.abs(A[i] - B[i]) > 2 || Math.abs(A[i + 1] - B[i + 1]) > 2 || Math.abs(A[i + 2] - B[i + 2]) > 2) n++;
	say(`REDUCED MOTION at ${W}x${H}: scene ${m.scene}, data-motion ${m.motion}; the exit button ${m.hidden ? 'HIDDEN' : 'shown'} at ${m.b.x.toFixed(0)},${m.b.y.toFixed(0)} ${m.b.w.toFixed(0)}x${m.b.h.toFixed(0)}`);
	verdict(m.scene === 'sky' && m.motion === 'off' && !m.hidden && m.b.w > 0, '   the still sky with the exit button there');
	verdict(n === 0, `   nothing moves: ${n} pixels change in 1.5 s`);
	writeFileSync(join(dir, `reduced-motion-${size}.jpg`), await sharp(a).resize({ width: 1266 }).jpeg({ quality: 88 }).toBuffer());
	// With ?debug the page gives the stars' places: the same still sky, the stars against the button.
	const d = await open(browser, size, { reducedMotion: true });
	await d.page.goto(`${PROD}/?debug`, { waitUntil: 'load' });
	await d.page.waitForFunction(() => window.__cellestial?.sky?.ready, null, { timeout: 15000 });
	await sleep(1500);
	const cs = await d.page.evaluate((slots) => slots.map((s) => (s ? window.__cellestial.sky.hooks.starCircle(s) : window.__cellestial.sky.coreCircle())), SLOTS[0]);
	const bb = await exitRect(d);
	const least = Math.min(...cs.filter(Boolean).map((q) => Math.hypot(Math.max(bb.x - q.x, 0, q.x - (bb.x + bb.w)), Math.max(bb.y - q.y, 0, q.y - (bb.y + bb.h))) - q.r));
	verdict(cs.every(Boolean) && least >= 12, `   Virgo's ${cs.length} stars are all on screen, the nearest ${least.toFixed(1)} px from the exit button`);
	say(`   console errors: ${[...o.errors, ...d.errors].join(' | ').slice(0, 300) || 'none'}`);
	await o.context.close();
	await d.context.close();
}
say(fails ? `${fails} FAILED` : 'ALL PASS');
writeFileSync(join(dir, `side-scenes${size === 'side' ? '' : `-${size}`}${only.size === 4 ? '' : `-${[...only].join('-')}`}.txt`), `${log.join('\n')}\n`);
await browser.close();
process.exit(fails ? 1 : 0);
