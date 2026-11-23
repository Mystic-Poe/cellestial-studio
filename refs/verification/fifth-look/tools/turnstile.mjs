#!/usr/bin/env node
// Finding 12: does the Turnstile box show white for a frame as a dialog opens? Production build. The message
// box (F2) and the build request (F1) are each opened five times at each size; every frame is recorded for
// 2.5 s and measured: the share of the frame that is near-white (every channel over 235).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';
const dir = outDir('chrome');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const size of ['desk', 'phone']) {
	const o = await open(browser, size);
	await o.page.goto(`${PROD}/?scene=roots&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.roots?.debug?.state().grown === true, null, { timeout: 20000 });
	await o.page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
	await sleep(1200);
	const keep = [];
	for (const [sel, name] of [['[data-open-contact]', 'the message box'], ['[data-open-claim]', 'the build request']]) {
		const peaks = [];
		for (let run = 0; run < 5; run++) {
			const rec = await recorder(o, { quality: 85 });
			const t0 = Date.now();
			await o.press(sel);
			await sleep(2500);
			await rec.stop();
			let worst = { w: 0 };
			for (const f of rec.frames.filter((x) => x.ts >= t0)) {
				const { data, info } = await sharp(f.img).raw().toBuffer({ resolveWithObject: true });
				let w = 0;
				for (let i = 0; i < data.length; i += info.channels) if (Math.min(data[i], data[i + 1], data[i + 2]) > 235) w++;
				const share = (100 * w) / (info.width * info.height);
				if (share > worst.w) worst = { w: share, t: Math.round(f.ts - t0), img: f.img };
			}
			peaks.push(worst);
			const widget = await o.page.evaluate(() => { const d = document.querySelector('dialog[open]'); const f = d?.querySelector('.cf-turnstile iframe, .cf-turnstile'); const r = f?.getBoundingClientRect(); return r ? `${Math.round(r.width)}x${Math.round(r.height)}` : 'none'; });
			if (run === 0) say(`${size} ${name}: the spam check's box ${widget}`);
			await o.page.keyboard.press('Escape');
			await sleep(700);
		}
		const top = peaks.reduce((a, b) => (b.w > a.w ? b : a));
		say(`${size} ${name}, five openings: the most near-white in any frame ${peaks.map((p) => `${p.w.toFixed(2)}% at +${p.t} ms`).join(', ')}`);
		keep.push({ img: top.img, label: `${size} ${name}: the whitest frame of five openings (+${top.t} ms, ${top.w.toFixed(2)}%)` });
	}
	await sheet(join(dir, `turnstile-${size}.jpg`), keep, size === 'desk' ? { cols: 2, cellW: 760, cellH: 475 } : { cols: 2, cellW: 390, cellH: 844 });
	say(`${size} console errors: ${[...new Set(o.errors)].join(' | ').slice(0, 300) || 'none'}`);
	await o.context.close();
}
writeFileSync(join(dir, 'turnstile.txt'), `${log.join('\n')}\n`);
await browser.close();
