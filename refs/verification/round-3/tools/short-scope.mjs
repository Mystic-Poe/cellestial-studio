#!/usr/bin/env node
// The third look's own (second run): how short must a screen be before a star reaches the exit button?
// The sky empty, the round done, all twelve stations, at a list of viewports (phones on their side and
// short desktop windows). For each: the nearest any star's disc comes to the exit button, and how many
// stars' discs reach it; the same for the logo and the menu button. Production build, real GPU.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, sleep } from './lib.mjs';
const dir = outDir('phone-sky');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const list = [[844, 390, true], [932, 430, true], [667, 375, true], [740, 360, true], [1024, 500, false], [1280, 560, false], [1280, 600, false], [1366, 650, false], [1280, 720, false], [1920, 1080, false], [768, 1024, true], [1024, 768, true]];
say('HOW SHORT BEFORE A STAR REACHES THE EXIT BUTTON (the sky empty, the exit button shown, all twelve stations)');
for (const [w, h, touch] of list) {
	const key = `v${w}x${h}`;
	SIZES[key] = { viewport: { width: w, height: h }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch };
	const o = await open(browser, key, { init: { fn: () => { sessionStorage.setItem('cellestial:round', '1'); } } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1200);
	let worst = 1e9, reach = 0, stations = [], logoLeast = 1e9, menuLeast = 1e9, off = 0, turned = null;
	for (let k = 0; k < 12; k++) {
		const c = CONSTELLATIONS[k];
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(1500);
		const m = await o.page.evaluate((slots) => {
			const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return q.width ? { x: q.x, y: q.y, w: q.width, h: q.height } : null; };
			const sky = window.__cellestial.sky;
			return { W: innerWidth, H: innerHeight, b11: rect('[data-descend]'), logo: rect('.chrome-logo'), menu: rect('#chrome button[popovertarget]'), circles: slots.filter(Boolean).map((s) => sky.hooks.starCircle(s)), turned: sky.debug.stats().stations.filter((s) => s.turned).length };
		}, c.stars.map((s) => s.slot));
		turned = m.turned;
		const gap = (q, r) => Math.hypot(Math.max(r.x - q.x, 0, q.x - (r.x + r.w)), Math.max(r.y - q.y, 0, q.y - (r.y + r.h))) - q.r;
		const cs = m.circles.filter((q) => q && Number.isFinite(q.x));
		off += cs.filter((q) => q.x - q.r < 0 || q.y - q.r < 0 || q.x + q.r > m.W || q.y + q.r > m.H).length;
		const g = Math.min(...cs.map((q) => gap(q, m.b11)));
		const n = cs.filter((q) => gap(q, m.b11) < 0).length;
		if (n) stations.push(`${c.name} ${Math.round(g)}`);
		reach += n;
		worst = Math.min(worst, g);
		logoLeast = Math.min(logoLeast, ...cs.map((q) => gap(q, m.logo)));
		menuLeast = Math.min(menuLeast, ...cs.map((q) => gap(q, m.menu)));
	}
	say(`${String(w).padStart(4)}x${String(h).padEnd(4)} ${touch ? 'touch' : 'mouse'}: figures turned ${turned}; nearest disc to the exit button ${Math.round(worst)} px; stars reaching it ${reach}${stations.length ? ` (${stations.join(', ')})` : ''}; nearest to the logo ${Math.round(logoLeast)} px, to the menu ${Math.round(menuLeast)} px; stars off the screen ${off}; console errors ${o.errors.length}`);
	await o.context.close();
}
writeFileSync(join(dir, 'short-scope.txt'), `${log.join('\n')}\n`);
await browser.close();
