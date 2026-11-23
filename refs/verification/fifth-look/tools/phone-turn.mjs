#!/usr/bin/env node
// Round 2, piece 3: the turn must be one fact. (1) A phone turned on its side and back at a station
// (390x844 -> 844x390 -> 390x844), every star lit so that each is a bright disc: at each of the
// three, every star's button is on its star as the layout has it, the picture has a lit star under
// every button, and nothing is turned on the phone's side; the third picture is the first again.
// (2) Reduced motion on the phone: the still sky, the exit button there, Cellestial's star clear.
// Production build, real GPU. Writes fifth-look/phone-sky/turn-and-back.jpg, reduced-motion.jpg,
// phone-turn.txt.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { ASSETS } from '../../../../src/experience/assets.ts';
import { PROD, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';

const dir = outDir('phone-sky');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
let fails = 0;
const verdict = (ok, what) => { if (!ok) fails++; say(`${ok ? 'PASS' : 'FAIL'}  ${what}`); };
const browser = await launch({ gpu: true });
const all = CONSTELLATIONS.flatMap((c) => c.stars.map((s) => s.slot).filter(Boolean)).map((slot) => ({ slot, ask: 'A site for my bakery' }));
const DPR = 2;

/** The stars as the layout has them, the buttons as the page has them, and the picture. */
async function look(o, k) {
	const c = CONSTELLATIONS[k];
	await o.page.evaluate((i) => new Promise((done) => { const { debug } = window.__cellestial.sky; debug.setCoord(i); debug.setClock(2); requestAnimationFrame(() => requestAnimationFrame(done)); }), k);
	await sleep(400);
	const png = await o.page.screenshot({ type: 'png' });
	const info = await o.page.evaluate((slots) => {
		const sky = window.__cellestial.sky;
		return {
			W: innerWidth, H: innerHeight,
			circles: slots.map((s) => (s ? sky.hooks.starCircle(s) : null)),
			buttons: Object.fromEntries([...document.querySelectorAll('button.sky-star:not([hidden])')].map((b) => { const r = b.getBoundingClientRect(); return [b.dataset.slot, { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }]; })),
			turned: sky.debug.stats().stations.filter((s) => s.turned).map((s) => s.figure),
		};
	}, c.stars.map((s) => s.slot));
	const { data, info: meta } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
	const lightAt = (x, y) => {
		let sum = 0, n = 0;
		for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
			const px = Math.round(x * DPR) + dx, py = Math.round(y * DPR) + dy;
			if (px < 0 || py < 0 || px >= meta.width || py >= meta.height) continue;
			const i = (py * meta.width + px) * meta.channels;
			sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
			n++;
		}
		return n ? sum / n : 0;
	};
	let off = 0, worst = 0, dark = 0, missing = 0, count = 0;
	for (const [i, q] of info.circles.entries()) {
		const slot = c.stars[i].slot;
		if (!slot) continue;
		count++;
		if (!q) { missing++; continue; }
		const b = info.buttons[slot];
		if (!b) { missing++; continue; }
		const d = Math.hypot(b.x - q.x, b.y - q.y);
		worst = Math.max(worst, d);
		if (d > 1) off++;
		if (lightAt(q.x, q.y) < 70) dark++;
	}
	return { png, info, count, off, worst, dark, missing };
}

{
	const o = await open(browser, 'phone', { init: { fn: (list) => { sessionStorage.setItem('cellestial:round', '1'); localStorage.setItem('cellestial:claims', JSON.stringify(list)); }, arg: all } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => window.__cellestial.sky.debug.setLevel(0));
	// The picture compared is the sky's: the logo's own light and the meanings' writing run on the
	// page's clock and are hidden here (B7 after a turn is looked at in b7.mjs's sheets).
	await o.page.addStyleTag({ content: '.chrome-logo, .sky-meaning { visibility: hidden !important; }' });
	await sleep(4500);
	const cells = [];
	say('A PHONE TURNED ON ITS SIDE AND BACK at a station (every star lit; the clock held)');
	for (const k of [0, 5, 8, 11]) {
		const c = CONSTELLATIONS[k];
		const shots = [];
		for (const [w, h, name] of [[390, 844, 'upright'], [844, 390, 'on its side'], [390, 844, 'upright again']]) {
			await o.page.setViewportSize({ width: w, height: h });
			await sleep(700);
			const r = await look(o, k);
			shots.push(r);
			const wantTurned = w < h ? 6 : 0;
			verdict(r.missing === 0 && r.off === 0 && r.dark === 0 && r.info.turned.length === wantTurned && r.info.W === w, `${c.name} ${w}x${h} (${name}): ${r.count} stars; buttons off their star by more than 1 px ${r.off} (worst ${r.worst.toFixed(2)} px); stars with no light under their button ${r.dark}; stars or buttons missing ${r.missing}; figures turned ${r.info.turned.length} (want ${wantTurned})`);
			cells.push({ img: r.png, label: `${c.name} ${w}x${h} ${name}` });
		}
		const a = await sharp(shots[0].png).raw().toBuffer(), b = await sharp(shots[2].png).raw().toBuffer();
		let n = 0;
		for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) > 2 || Math.abs(a[i + 1] - b[i + 1]) > 2 || Math.abs(a[i + 2] - b[i + 2]) > 2) n++;
		const same = shots[0].info.circles.every((q, i) => { const p = shots[2].info.circles[i]; return (!q && !p) || (q && p && Math.hypot(q.x - p.x, q.y - p.y) < 0.01 && Math.abs(q.r - p.r) < 0.01); });
		if (n > 0) {
			let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
			for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) > 2 || Math.abs(a[i + 1] - b[i + 1]) > 2 || Math.abs(a[i + 2] - b[i + 2]) > 2) { const p = i / 3, x = p % 780, y = (p - x) / 780; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
			say(`   the pixels that differ lie in x ${x0 / 2}..${x1 / 2}, y ${y0 / 2}..${y1 / 2} (css px)`);
		}
		verdict(same && n < 200, `${c.name}: back upright, every star is where and as large as it was (${same ? 'yes' : 'NO'}), and the picture is the first again (${n} of ${a.length / 3} pixels differ by more than 2 levels)`);
	}
	verdict(o.errors.length === 0, `no console error through the turns (${o.errors.length ? o.errors.join(' | ').slice(0, 300) : 'none'})`);
	await sheet(join(dir, 'turn-and-back.jpg'), cells, { cols: 6, cellW: 258, cellH: 300 });
	await o.context.close();
}

{
	say('');
	say('REDUCED MOTION on the phone (a first visit to "/", prefers-reduced-motion: reduce)');
	const o = await open(browser, 'phone', { reducedMotion: true });
	await o.page.goto(`${PROD}/?debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky' && window.__cellestial?.sky?.ready, null, { timeout: 30000 });
	await sleep(2500);
	const png = await o.page.screenshot({ type: 'png' });
	const info = await o.page.evaluate((slots) => {
		const sky = window.__cellestial.sky;
		const e = document.querySelector('[data-descend]');
		const r = e?.getBoundingClientRect();
		return { exit: r && r.width > 0 && getComputedStyle(e).visibility !== 'hidden' && Number(getComputedStyle(e).opacity) > 0.9 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null, rings: sky.introRings(), circles: slots.map((s) => (s ? sky.hooks.starCircle(s) : null)).filter(Boolean), turned: sky.debug.stats().stations.filter((s) => s.turned).map((s) => s.figure), flight: sky.hooks.flight() };
	}, CONSTELLATIONS[0].stars.map((s) => s.slot));
	const RING = ASSETS.sky.b3Ring;
	const reach = Math.max(...info.rings.map((g) => (g.a * RING.outer.rx) / ((RING.outer.rx + RING.inner.rx) / 2)));
	const gap = Math.min(...info.circles.map((s) => Math.hypot(s.x - info.rings[0].x, s.y - info.rings[0].y) - s.r)) - reach;
	const shot2 = await (async () => { await sleep(1500); return o.page.screenshot({ type: 'png' }); })();
	const a = await sharp(png).raw().toBuffer(), b = await sharp(shot2).raw().toBuffer();
	let moved = 0;
	for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) moved++;
	verdict(info.exit !== null, `the exit button is there (${info.exit ? `at ${Math.round(info.exit.x)},${Math.round(info.exit.y)}, ${Math.round(info.exit.w)}x${Math.round(info.exit.h)}` : 'NOT SHOWN'})`);
	verdict(info.turned.length === 6 && info.circles.length === 12, `the still sky is Virgo turned, all 12 of its claimable stars on screen (${info.circles.length}); figures turned: ${info.turned.join(', ')}`);
	verdict(gap >= 2 - 0.05, `Cellestial's star is clear: ${(2 * reach).toFixed(1)} px across, the nearest star's disc ${gap.toFixed(1)} px beyond its rings' full reach`);
	verdict(moved < 400, `it is still: ${moved} pixels change in 1.5 s (flight ${info.flight.mode}, speed ${info.flight.vel})`);
	verdict(o.errors.length === 0, `no console error (${o.errors.length ? o.errors.join(' | ').slice(0, 300) : 'none'})`);
	const q = info.rings[0];
	await sheet(join(dir, 'reduced-motion.jpg'), [{ img: png, label: 'reduced motion, 390x844: the still sky' }, { img: await sharp(png).extract({ left: Math.round((q.x - 110) * DPR), top: Math.round((q.y - 110) * DPR), width: 220 * DPR, height: 220 * DPR }).png().toBuffer(), label: "Cellestial's star, device pixels" }], { cols: 2, cellW: 440, cellH: 950 });
	await o.context.close();
}
say(fails ? `${fails} FAILED` : 'ALL PASS');
writeFileSync(join(dir, 'phone-turn.txt'), `${log.join('\n')}\n`);
await browser.close();
process.exit(fails ? 1 : 0);
