#!/usr/bin/env node
// The same in-page probe as a5-probe.mjs (the sky canvas's middle read back every frame), for the SHORT
// loader of a same-session return (a reload) and for a SKIPPED loader (a key one second in).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const dir = outDir('a5');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const probe = () => {
	window.__probe = [];
	const pad = document.createElement('canvas');
	pad.width = pad.height = 96;
	const g = pad.getContext('2d', { willReadFrequently: true });
	const tick = (t) => {
		const cv = document.getElementById('sky-canvas');
		let L = -1;
		if (cv) { try { const r = cv.getBoundingClientRect(); const sx = cv.width / (r.width || 1), sy = cv.height / (r.height || 1); g.clearRect(0, 0, 96, 96); g.drawImage(cv, (innerWidth / 2 - r.left - 48) * sx, (innerHeight / 2 - r.top - 48) * sy, 96 * sx, 96 * sy, 0, 0, 96, 96); const d = g.getImageData(0, 0, 96, 96).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * (d[i + 3] / 255); L = s / 9216; } catch { L = -2; } }
		window.__probe.push({ t, scene: document.documentElement.dataset.scene, L: Math.round(L * 10) / 10 });
		setTimeout(() => requestAnimationFrame(tick), 0);
	};
	addEventListener('DOMContentLoaded', () => requestAnimationFrame(tick));
};
const dips = (rows) => { const k = rows.findIndex((r) => r.scene === 'sky'); const near = rows.slice(Math.max(0, k - 10), k + 10); const top = Math.max(...near.map((r) => r.L)); return near.filter((r) => r.L < 0.5 * top && r.L >= 0).map((r) => `${Math.round(r.t - rows[k].t)} ms: ${r.L} (otherwise ${top})`); };
const browser = await launch({ gpu: true });
for (const size of ['desk', 'phone']) {
	let short = 0, skip = 0;
	const N = Number(process.argv[2] ?? 12); // the third look: 12, as the second look ran it
	for (let run = 0; run < N; run++) {
		const o = await open(browser, size, { init: { fn: probe } });
		await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
		await sleep(1000);
		if (o.phone) await o.page.touchscreen.tap(200, 400); else await o.page.keyboard.press('a');
		await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 30000 });
		await sleep(500);
		const d1 = dips(await o.page.evaluate(() => window.__probe));
		if (d1.length) skip++;
		await o.page.reload({ waitUntil: 'commit' });
		await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 30000 });
		await sleep(500);
		const d2 = dips(await o.page.evaluate(() => window.__probe));
		if (d2.length) short++;
		say(`${size} run ${run + 1}: skipped loader: ${d1.length ? `DIP ${d1.join(', ')}` : 'no dip'}; short loader (reload): ${d2.length ? `DIP ${d2.join(', ')}` : 'no dip'}`);
		await o.context.close();
	}
	say(`${size}: a frame without the star at the scene change in ${skip} of ${N} skipped loaders and ${short} of ${N} short loaders`);
}
writeFileSync(join(dir, 'blink-probe-return.txt'), `${log.join('\n')}\n`);
await browser.close();
