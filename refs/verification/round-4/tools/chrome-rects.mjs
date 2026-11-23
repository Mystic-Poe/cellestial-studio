#!/usr/bin/env node
// Round 3, piece 1: where the logo, the menu button and the exit button stand, at a list of sizes
// (production build). The node tests of the sky's layout (src/experience/sky-layout.test.ts) keep the
// stars clear of these boxes; this prints them so the numbers there can be checked against the page.
import { PROD, SIZES, launch, open, sleep } from './lib.mjs';
const browser = await launch({ gpu: true });
for (const [w, h, touch] of [[844, 390, true], [667, 375, true], [740, 360, true], [932, 430, true], [568, 320, true], [390, 844, true], [1440, 900, false], [1024, 768, true]]) {
	const key = `v${w}x${h}`;
	SIZES[key] = { viewport: { width: w, height: h }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch };
	const o = await open(browser, key, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await sleep(1200);
	const m = await o.page.evaluate(() => {
		const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return `${q.x},${q.y} ${q.width}x${q.height}`; };
		return { exit: rect('[data-descend]'), logo: rect('.chrome-logo'), menu: rect('#chrome button[popovertarget]') };
	});
	console.log(`${w}x${h}: logo ${m.logo}; menu ${m.menu}; exit ${m.exit} (its top ${h - Number(m.exit.split(' ')[0].split(',')[1])} px above the bottom)`);
	await o.context.close();
}
await browser.close();
