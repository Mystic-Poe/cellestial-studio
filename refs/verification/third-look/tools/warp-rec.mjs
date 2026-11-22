#!/usr/bin/env node
// The third look's own: the warp back to the sky, recorded in real time on the production build (real
// GPU) at both sizes, unslowed and with the CPU slowed 4x, started three ways:
//   top     E6 pressed (a real press) at the top of the Roots
//   send    far down the page, the visitor's own way there: "Claim your star" at the Close, the build
//           request filled in and sent (/api/contact answered 200 from here); the warp follows
//   far     the page scrolled 1800 px down and E6 clicked from script (the builders' check does this;
//           no visitor can, E6 is at the top of the ground)
// For each run: the moment the page says its scene became "sky" (the page's own clock, set against the
// recording's), and EVERY recorded frame within 200 ms of it, with for each frame the share of its
// pixels that are SOIL (the Roots' ground: warm and not dark, R > B + 8 and light over 22) and the share
// that are lit at all (light over 22). If the page shows through the cover, soil shows; if the sky
// comes under a cover that is not whole, the frame after the change is not black-and-streaks.
//   node warp-rec.mjs [--sizes desk,phone] [--throttle 1,4] [--ways top,send,far] [--runs 2]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, frameTimes, launch, open, outDir, pnow, recorder, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'desk,phone' }, throttle: { type: 'string', default: '1,4' }, ways: { type: 'string', default: 'top,send,far' }, runs: { type: 'string', default: '2' } } });
const dir = outDir('warp');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const measure = async (img) => {
	const { data, info } = await sharp(img).raw().toBuffer({ resolveWithObject: true });
	let soil = 0, lit = 0, sum = 0;
	const n = info.width * info.height;
	for (let i = 0; i < data.length; i += info.channels) {
		const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
		sum += L;
		if (L > 22) { lit++; if (data[i] > data[i + 2] + 8) soil++; }
	}
	return { soil: (100 * soil) / n, lit: (100 * lit) / n, L: sum / n };
};
for (const size of values.sizes.split(',')) for (const throttle of values.throttle.split(',').map(Number)) for (const way of values.ways.split(',')) for (let run = 1; run <= Number(values.runs); run++) {
	const o = await open(browser, size, { throttle, init: { fn: () => {
		sessionStorage.setItem('cellestial:round', '1');
		window.__sc = [];
		document.addEventListener('cellestial:scene', (e) => window.__sc.push({ to: e.detail.to, from: e.detail.from, wall: Date.now(), p: performance.now() }));
	} } });
	await o.context.route('**/api/contact', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
	await o.page.goto(`${PROD}/?scene=roots&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.roots && window.__cellestial?.fx);
	await o.page.evaluate(async () => { await window.__cellestial.sky.ready; await document.fonts.ready; });
	await sleep(1500);
	let y0 = 0;
	if (way === 'send') {
		await o.page.locator('[data-open-claim]').evaluate((el, h) => scrollTo({ top: scrollY + el.getBoundingClientRect().top - h * 0.55 }), o.H);
		await sleep(900);
		await o.press('[data-open-claim]');
		await sleep(1000);
		await o.page.fill('#claim-form-name', 'Test Visitor');
		await o.page.fill('#claim-form-email', 'visitor@example.com');
		await o.page.fill('#claim-form-message', 'A site for my bakery.');
		await sleep(throttle > 1 ? 5000 : 2500);
	} else if (way === 'far') {
		await o.page.evaluate(() => scrollTo(0, 1800));
		await sleep(600);
	}
	y0 = await o.page.evaluate(() => Math.round(scrollY));
	const rec = await recorder(o, { quality: 86 });
	await sleep(250);
	const p0 = await pnow(o.page);
	const t0 = Date.now();
	if (way === 'top') await o.press('[data-ascend]');
	else if (way === 'send') await o.press('#claim-form button[type="submit"]');
	else await o.page.evaluate(() => document.querySelector('[data-ascend]').click());
	await o.page.waitForFunction(() => window.__sc.some((s) => s.to === 'sky'), null, { timeout: 30000 }).catch(() => {});
	await sleep(throttle > 1 ? 2200 : 1600);
	await rec.stop();
	const sc = await o.page.evaluate(() => window.__sc);
	const warpAt = sc.find((s) => s.to === 'warp'), skyAt = sc.find((s) => s.to === 'sky');
	const tag = `${size}${throttle > 1 ? `-cpu${throttle}x` : ''}-${way}-${run}`;
	if (!warpAt || !skyAt) { say(`${tag}: NO WARP (scenes: ${JSON.stringify(sc.map((s) => s.to))}); console errors ${o.errors.join(' | ').slice(0, 200) || 'none'}`); await o.context.close(); continue; }
	const ft = await frameTimes(o.page, warpAt.p, skyAt.p + 700);
	const near = rec.frames.filter((f) => f.ts >= skyAt.wall - 200 && f.ts <= skyAt.wall + 200);
	const rows = [];
	for (const f of near) rows.push({ t: Math.round(f.ts - skyAt.wall), ...(await measure(f.img)), img: f.img });
	// before the warp, what the page (the Roots) measures as: the first recorded frame after the press
	const base = await measure((rec.frames.find((f) => f.ts >= t0 - 100) ?? rec.frames[0]).img);
	const all = [];
	for (const f of rec.frames.filter((f) => f.ts >= warpAt.wall && f.ts <= skyAt.wall + 900)) all.push({ t: Math.round(f.ts - skyAt.wall), ...(await measure(f.img)) });
	const lowSoil = all.filter((x) => x.t <= 0).reduce((a, b) => (b.soil < a.soil ? b : a), all[0]);
	const atSwap = rows.filter((x) => Math.abs(x.t) <= 40);
	say(`${tag}: from scrollY ${y0}; the warp starts +${Math.round(warpAt.wall - t0)} ms after the press, the scene becomes "sky" ${Math.round(skyAt.p - warpAt.p)} ms later; the Roots before the warp: soil ${base.soil.toFixed(1)}% of the frame, lit ${base.lit.toFixed(1)}%; frames from the warp's start to 0.7 s after the change: ${ft.text}; console errors ${o.errors.join(' | ').slice(0, 200) || 'none'}`);
	say(`   every recorded frame within 200 ms of the change (ms : soil % : lit % : mean light): ${rows.map((x) => `${x.t}:${x.soil.toFixed(1)}:${x.lit.toFixed(1)}:${x.L.toFixed(0)}`).join('  ')}`);
	say(`   within 40 ms of the change: most soil ${Math.max(0, ...atSwap.map((x) => x.soil)).toFixed(2)}%; the whole warp, every 6th frame (ms : soil % : lit %): ${all.filter((_, i) => i % 6 === 0).map((x) => `${x.t}:${x.soil.toFixed(1)}:${x.lit.toFixed(0)}`).join(' ')}`);
	if (run === 1) {
		const cells = rows.map((x) => ({ img: x.img, label: `${x.t >= 0 ? '+' : ''}${x.t} ms  soil ${x.soil.toFixed(1)}%  lit ${x.lit.toFixed(0)}%` }));
		const grid = size === 'desk' ? { cols: 5, cellW: 312, cellH: 195 } : { cols: 12, cellW: 125, cellH: 270 };
		await sheet(join(dir, `${tag}-swap.jpg`), cells.slice(0, size === 'desk' ? 25 : 36), grid);
		if (throttle === 1) await sheet(join(dir, `${tag}-whole.jpg`), rec.cut('', warpAt.wall - 100, skyAt.wall + 900, size === 'desk' ? 80 : 60), size === 'desk' ? { cols: 6, cellW: 258, cellH: 161 } : { cols: 12, cellW: 125, cellH: 270 });
	}
	await o.context.close();
}
writeFileSync(join(dir, 'warp-rec.txt'), `${log.join('\n')}\n`);
await browser.close();
