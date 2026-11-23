#!/usr/bin/env node
// "Flight is smooth on a phone — if frame rate drops, scale effects down automatically": the phone profile
// with the CPU slowed 4x and 6x, production build, real GPU: fourteen seconds of real swipes forward, frame
// times, and the governor's level at the end.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, frameTimes, launch, open, outDir, pnow, sleep } from './lib.mjs';
const dir = outDir('owner-list');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const [size, throttle] of [['phone', 1], ['phone', 4], ['phone', 6], ['desk', 4]]) {
	const o = await open(browser, size, { throttle });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(2000);
	const touch = (type, x, y) => o.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
	const p0 = await pnow(o.page);
	const end = Date.now() + 14000;
	if (!o.phone) await o.page.mouse.move(o.W / 2, o.H / 2);
	while (Date.now() < end) {
		if (o.phone) { await touch('touchStart', 200, 640); for (let i = 1; i <= 10; i++) { await touch('touchMove', 200, 640 - i * 34); await sleep(18); } await touch('touchEnd', 200, 300); await sleep(160); }
		else { await o.page.mouse.wheel(0, 100); await sleep(50); }
	}
	const p1 = await pnow(o.page);
	const ft = await frameTimes(o.page, p0, p1);
	const q = await o.page.evaluate(() => { const s = window.__cellestial.sky.debug.stats(); return { level: s.quality.level, dpr: s.quality.dpr, pos: Math.round(s.flight.pos * 10) / 10 }; });
	say(`${size}, CPU x${throttle}: 14 s of flying: ${ft.text}; the governor ends at level ${q.level} (pixel ratio ${q.dpr}); flown to ${q.pos}; console errors ${o.errors.length}`);
	await o.context.close();
}
writeFileSync(join(dir, 'flight-slow.txt'), `${log.join('\n')}\n`);
await browser.close();
