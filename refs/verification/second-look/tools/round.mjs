#!/usr/bin/env node
// "See what holds up the sky" appears only after one full round: a first visit (the loader skipped by a
// key, which is itself a check of the skip), then a real flight by wheel / swipe. The exit button's state
// at each station the flight reports, until it shows. Also flying BACK first: does going backwards count?
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const dir = outDir('owner-list');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const size of ['desk', 'phone']) {
	const o = await open(browser, size);
	const t0 = Date.now();
	await o.page.goto(`${PROD}/?debug`, { waitUntil: 'commit' });
	await sleep(1000);
	if (o.phone) await o.page.touchscreen.tap(200, 400); else await o.page.keyboard.press('a');
	const tSkip = Date.now();
	await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 30000 });
	say(`${size}: the loader skipped by a ${o.phone ? 'tap' : 'key'} 1 s in: the sky ${Date.now() - tSkip} ms after the skip (${Date.now() - t0} ms after navigation)`);
	await o.page.waitForFunction(() => window.__cellestial?.sky?.hooks);
	await sleep(1200);
	await o.page.evaluate(() => { window.__st = []; const h = window.__cellestial.sky.hooks; h.on('station', (e) => window.__st.push({ ...e, hidden: document.querySelector('[data-descend]').hidden, t: Math.round(performance.now()) })); h.on('round-complete', (e) => window.__st.push({ round: e.figures, t: Math.round(performance.now()) })); });
	const hidden0 = await o.page.evaluate(() => document.querySelector('[data-descend]').hidden);
	const touch = (type, x, y) => o.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
	const swipe = async (y0, y1) => { await touch('touchStart', 200, y0); for (let i = 1; i <= 12; i++) { await touch('touchMove', 200, y0 + ((y1 - y0) * i) / 12); await sleep(20); } await touch('touchEnd', 200, y1); };
	if (!o.phone) await o.page.mouse.move(o.W / 2, o.H / 2);
	const end = Date.now() + 70000;
	let shownAt = null;
	while (Date.now() < end) {
		if (o.phone) { await swipe(640, 300); await sleep(120); } else { await o.page.mouse.wheel(0, 100); await sleep(50); }
		if (!(await o.page.evaluate(() => document.querySelector('[data-descend]').hidden))) { shownAt = Date.now(); break; }
	}
	await sleep(1500);
	const st = await o.page.evaluate(() => window.__st);
	const figs = st.filter((s) => s.figure !== undefined);
	say(`   exit button hidden on arriving in the sky: ${hidden0}. Stations reported while flying forward: ${figs.map((s) => `${s.figure}${s.hidden ? '' : '(button shown)'}`).join(' ')}; round-complete fired ${st.filter((s) => s.round).length} time(s); the button showed ${shownAt ? 'after ' + new Set(figs.map((s) => s.figure)).size + ' different figures' : 'NEVER in 70 s'}; console errors ${[...new Set(o.errors)].join(' | ').slice(0, 160) || 'none'}`);
	await o.context.close();
}
writeFileSync(join(dir, 'round.txt'), `${log.join('\n')}\n`);
await browser.close();
