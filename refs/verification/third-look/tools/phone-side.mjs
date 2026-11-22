#!/usr/bin/env node
// The third look's own: a phone turned on its side and back (390x844 -> 844x390 -> 390x844) at two
// stations, with NOTHING hidden (phone-turn.mjs hides the logo and the meanings to compare pixels):
// Virgo with the sky empty, and Leo with every star lit (so B7 and "Jesus is King." are written).
// At each of the three: a screenshot, and where the logo, the menu button, the exit button, the
// meaning's words and every star of the figure are; what touches what; and, on its side, a real touch
// on three stars. Production build, real GPU.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, launch, open, outDir, sheet, sleep } from './lib.mjs';
const dir = outDir('phone-sky');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const all = CONSTELLATIONS.flatMap((c) => c.stars.map((s) => s.slot).filter(Boolean)).map((slot) => ({ slot, ask: 'A site for my bakery' }));
const cells = [];
for (const [k, lit] of [[0, false], [11, true], [5, true]]) {
	const c = CONSTELLATIONS[k];
	const o = await open(browser, 'phone', { init: { fn: (list) => { sessionStorage.setItem('cellestial:round', '1'); if (list) localStorage.setItem('cellestial:claims', JSON.stringify(list)); }, arg: lit ? all : null } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => { window.__picked = []; window.__cellestial.sky.hooks.on('star-pick', (e) => window.__picked.push(e.slot)); });
	await sleep(1200);
	for (const [w, h, name] of [[390, 844, 'upright'], [844, 390, 'on its side'], [390, 844, 'upright again']]) {
		await o.page.setViewportSize({ width: w, height: h });
		await sleep(700);
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(lit ? (k === 11 ? 7500 : 5000) : 2800);
		const m = await o.page.evaluate(([nm, slots]) => {
			const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); const cs = getComputedStyle(e); return q.width && cs.visibility !== 'hidden' && !e.hidden ? { x: q.x, y: q.y, w: q.width, h: q.height } : null; };
			const sky = window.__cellestial.sky;
			const el = document.querySelector(`.sky-meaning[data-meaning="${nm}"]`);
			const lines = el && !el.hidden ? [...el.querySelectorAll('.sky-meaning__line')].map((l) => { const q = l.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }) : [];
			return { W: innerWidth, H: innerHeight, logo: rect('.chrome-logo'), menu: rect('#chrome button[popovertarget]'), b11: rect('[data-descend]'), lines, font: el ? getComputedStyle(el).fontSize : null, circles: slots.map((s) => (s ? sky.hooks.starCircle(s) : sky.coreCircle())), turned: sky.debug.stats().stations.filter((s) => s.turned).map((s) => s.figure) };
		}, [c.name, c.stars.map((s) => s.slot)]);
		const cs = m.circles.filter(Boolean);
		const gap = (q, r) => Math.hypot(Math.max(r.x - q.x, 0, q.x - (r.x + r.w)), Math.max(r.y - q.y, 0, q.y - (r.y + r.h))) - q.r;
		const off = cs.filter((q) => q.x - q.r < 0 || q.y - q.r < 0 || q.x + q.r > m.W || q.y + q.r > m.H).length;
		const least = (r) => (r ? Math.round(Math.min(...cs.map((q) => gap(q, r)))) : null);
		const over = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
		const touch = [];
		for (const b of m.lines) {
			if (cs.some((q) => gap(q, b) < 0)) touch.push('a star');
			if (over(b, m.b11)) touch.push('the exit button');
			if (over(b, m.logo) || over(b, m.menu)) touch.push('the logo or menu');
			if (b.x < 0 || b.y < 0 || b.x + b.w > m.W || b.y + b.h > m.H) touch.push('the screen edge');
		}
		let taps = '';
		if (name === 'on its side') {
			const pick = cs.filter((q) => q.slot !== undefined || true).filter((q, i) => c.stars[m.circles.indexOf(q)].slot).slice(0, 3);
			const res = [];
			for (const q of pick) {
				const slot = c.stars[m.circles.indexOf(q)].slot;
				await o.page.evaluate(() => { window.__picked.length = 0; });
				await o.page.touchscreen.tap(q.x, q.y);
				await sleep(500);
				res.push(`${slot}:${(await o.page.evaluate(() => window.__picked[0] ?? null)) === slot ? 'taken' : 'NOT TAKEN'}`);
				await o.page.keyboard.press('Escape');
				await sleep(300);
			}
			await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
			await sleep(600);
			taps = `; taps on three stars: ${res.join(', ')}`;
		}
		say(`${c.name}${lit ? ' (every star lit)' : ' (empty)'} ${w}x${h} ${name}: turned figures ${m.turned.length}; ${cs.length} of ${c.stars.length} stars placed, ${off} off the screen; the figure x ${Math.round(Math.min(...cs.map((q) => q.x - q.r)))}..${Math.round(Math.max(...cs.map((q) => q.x + q.r)))}, y ${Math.round(Math.min(...cs.map((q) => q.y - q.r)))}..${Math.round(Math.max(...cs.map((q) => q.y + q.r)))}; logo ${m.logo ? `${Math.round(m.logo.x)},${Math.round(m.logo.y)} ${Math.round(m.logo.w)}x${Math.round(m.logo.h)}` : 'NOT SHOWN'}, menu ${m.menu ? `${Math.round(m.menu.x)},${Math.round(m.menu.y)}` : 'NOT SHOWN'}, exit button ${m.b11 ? `${Math.round(m.b11.x)},${Math.round(m.b11.y)} ${Math.round(m.b11.w)}x${Math.round(m.b11.h)} (${Math.round(m.H - m.b11.y - m.b11.h)} px above the bottom)` : 'NOT SHOWN'}; nearest star to the logo ${least(m.logo)} px, to the menu ${least(m.menu)} px, to the exit button ${least(m.b11)} px${m.lines.length ? `; the meaning ${m.lines.map((b) => `${Math.round(b.w)}x${Math.round(b.h)} at ${Math.round(b.x)},${Math.round(b.y)}`).join(' and ')} (type ${m.font}), touching ${touch.length ? [...new Set(touch)].join(', ').toUpperCase() : 'nothing'}` : ''}${taps}`);
		cells.push({ img: await o.page.screenshot({ type: 'png' }), label: `${c.name}${lit ? ', lit' : ''} ${w}x${h} ${name}` });
	}
	say(`   console errors: ${o.errors.join(' | ').slice(0, 200) || 'none'}`);
	await o.context.close();
}
await sheet(join(dir, 'on-its-side.jpg'), cells, { cols: 3, cellW: 520, cellH: 520 });
writeFileSync(join(dir, 'phone-side.txt'), `${log.join('\n')}\n`);
await browser.close();
