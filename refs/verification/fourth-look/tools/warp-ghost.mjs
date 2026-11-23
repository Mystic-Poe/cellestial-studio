#!/usr/bin/env node
// The third look's own (second run): the middle of the screen in the half second BEFORE the warp's swap,
// enlarged, from the top of the Roots, production build, real GPU. The whole-screen strips show a faint
// round shape in the middle of the frame before the page says it is the sky; this cuts that region out
// of every recorded frame so it can be seen what it is. Also the mean light of the crop's darker half.
//   node warp-ghost.mjs [--sizes desk,phone] [--throttle 1,4]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'desk,phone' }, throttle: { type: 'string', default: '1,4' } } });
const dir = outDir('warp');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const size of values.sizes.split(',')) for (const throttle of values.throttle.split(',').map(Number)) {
	const o = await open(browser, size, { throttle, init: { fn: () => {
		sessionStorage.setItem('cellestial:round', '1');
		window.__sc = [];
		document.addEventListener('cellestial:scene', (e) => window.__sc.push({ to: e.detail.to, wall: Date.now(), p: performance.now() }));
	} } });
	await o.page.goto(`${PROD}/?scene=roots&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.roots && window.__cellestial?.fx);
	await o.page.evaluate(async () => { await window.__cellestial.sky.ready; await document.fonts.ready; });
	await sleep(1500);
	const rec = await recorder(o, { quality: 92 });
	await sleep(250);
	await o.press('[data-ascend]');
	await o.page.waitForFunction(() => window.__sc.some((s) => s.to === 'sky'), null, { timeout: 30000 });
	await sleep(1200);
	await rec.stop();
	const sc = await o.page.evaluate(() => window.__sc);
	const skyAt = sc.find((s) => s.to === 'sky');
	const frames = rec.frames.filter((f) => f.ts >= skyAt.wall - 520 && f.ts <= skyAt.wall + 60);
	const cells = [];
	const nums = [];
	for (const f of frames) {
		const meta = await sharp(f.img).metadata();
		const cw = Math.round(meta.width * (o.phone ? 0.9 : 0.36)), ch = Math.round(meta.height * (o.phone ? 0.42 : 0.5));
		const left = Math.round((meta.width - cw) / 2), top = Math.round((meta.height - ch) / 2);
		const crop = await sharp(f.img).extract({ left, top, width: cw, height: ch }).png().toBuffer();
		const { data, info } = await sharp(crop).raw().toBuffer({ resolveWithObject: true });
		const hist = new Uint32Array(256);
		for (let i = 0; i < data.length; i += info.channels) hist[Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2])]++;
		let left2 = (info.width * info.height) / 2, dark = 0;
		for (let v = 0; v < 256 && left2 > 0; v++) { const k = Math.min(left2, hist[v]); dark += k * v; left2 -= k; }
		const t = Math.round(f.ts - skyAt.wall);
		nums.push(`${t}:${(dark / ((info.width * info.height) / 2)).toFixed(1)}`);
		cells.push({ img: crop, label: `${t} ms`, enlarge: true });
	}
	const tag = `${size}${throttle > 1 ? `-cpu${throttle}x` : ''}`;
	say(`${tag}: ${frames.length} recorded frames from -520 to +60 ms of the change; the middle's darker half, mean light (ms : L): ${nums.join('  ')}; console errors ${o.errors.join(' | ').slice(0, 200) || 'none'}`);
	const pick = cells.filter((_, i) => i % 2 === 0).slice(0, 18);
	await sheet(join(dir, `ghost-${tag}.jpg`), pick, { cols: 6, cellW: 258, cellH: o.phone ? 300 : 220 });
	await o.context.close();
}
await browser.close();
writeFileSync(join(dir, 'warp-ghost.txt'), `${log.join('\n')}\n`);
