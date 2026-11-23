#!/usr/bin/env node
// Round 3, piece 3b: THE FIRST THREE SECONDS, FRAME BY FRAME. A first visit is recorded (every frame the
// browser presents) from navigation until the loader's canvas has taken the picture over and half a
// second more, on a fast line and on slow 4G, at both sizes. Production build, real GPU. Asked of
// every recorded frame, by its light (the mean of the frame, and of its upper and lower halves):
//   - when is anything of the unlit C first seen, and is it WHOLE in that frame? (the share of the
//     frame's light that lies in its lower half, in that frame and in the settled picture: a C drawn
//     top first has its light in the upper half)
//   - once it has been shown, is there a frame WITHOUT it? (a frame with under 60% of the still C's
//     light: the hand-over from the server's picture to the canvas would show as one)
// Writes loader/first3-<line>-<size>.jpg (the frames, ms after navigation; every frame if they fit,
// else evenly thinned, the first-seen frame and the frames around the hand-over always kept) and
// loader/first3.txt.   node loader-first3.mjs [--lines fast,slow4g] [--sizes desk,phone] [--runs 2]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { GRID, PROD, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { lines: { type: 'string', default: 'fast,slow4g' }, sizes: { type: 'string', default: 'desk,phone' }, runs: { type: 'string', default: '2' } } });
const dir = outDir('loader');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const init = { fn: () => {
	window.__t = {};
	new MutationObserver(() => {
		const l = document.getElementById('loader');
		if (l?.classList.contains('is-live') && !window.__t.live) window.__t.live = performance.now();
		if (l?.classList.contains('is-drawn') && !window.__t.drawn) window.__t.drawn = performance.now();
	}).observe(document, { attributes: true, subtree: true, attributeFilter: ['class'] });
} };
const light = async (img) => {
	const { data, info } = await sharp(img).greyscale().raw().toBuffer({ resolveWithObject: true });
	const half = Math.floor(info.height / 2) * info.width;
	let top = 0, bottom = 0;
	for (let i = 0; i < half; i++) top += data[i];
	for (let i = half; i < half * 2; i++) bottom += data[i];
	return { L: (top + bottom) / (half * 2), low: bottom / (top + bottom || 1) };
};
let faults = 0;
for (const size of values.sizes.split(',')) for (const line of values.lines.split(',')) for (let run = 1; run <= Number(values.runs); run++) {
	const o = await open(browser, size, { init });
	if (line === 'slow4g') { await o.cdp.send('Network.enable'); await o.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); }
	const rec = await recorder(o, { quality: 80 });
	const t0 = Date.now();
	await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
	await o.page.waitForFunction(() => window.__t?.drawn, null, { timeout: 90000 });
	await sleep(600);
	await rec.stop();
	const t = await o.page.evaluate(() => ({ ...window.__t, origin: performance.timeOrigin, fcp: performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime ?? null, poster: window.__loaderEarly?.seenAt ?? null }));
	const rows = [];
	for (const f of rec.frames.filter((x) => x.ts >= t0 && x.ts <= t.origin + t.drawn + 500)) rows.push({ t: f.ts - t.origin, img: f.img, ...(await light(f.img)) });
	let start = 0;
	rows.forEach((r, i) => { if (r.L > 200) start = i + 1; }); // the blank page before the site is white
	// (or, on the phone, an even grey for a frame): the site begins with its black cover
	const black = rows.findIndex((r) => r.L < 0.4);
	if (black > start) start = black;
	const site = rows.slice(start);
	const k = site.findIndex((r) => r.L > 0.4);
	const seen = site[k];
	// the still C: the last frame before the canvas's first drawing
	const before = site.filter((r) => r.t <= t.drawn);
	const still = before[before.length - 1] ?? seen;
	const after = site.slice(k + 1);
	const lowest = after.reduce((a, r) => (r.L < a.L ? r : a), after[0] ?? seen);
	const gone = after.filter((r) => r.L < 0.6 * still.L);
	const whole = seen && Math.abs(seen.low - still.low) < 0.03 && seen.L >= 0.9 * still.L;
	if (gone.length || !whole) faults++;
	say(`${size}, ${line === 'fast' ? 'a fast line' : 'slow 4G'}, run ${run}: first paint ${Math.round(t.fcp)} ms, the page showed the C at ${t.poster === null ? '?' : Math.round(t.poster)}, the loader live ${Math.round(t.live)}, its canvas first drew at ${Math.round(t.drawn)}. RECORDED: ${site.length} frames of the site; anything of the C first seen in the frame at ${Math.round(seen?.t ?? -1)} ms: light ${seen?.L.toFixed(2)}, ${(100 * (seen?.low ?? 0)).toFixed(1)}% of it in the lower half (the still C: light ${still.L.toFixed(2)}, ${(100 * still.low).toFixed(1)}%): ${whole ? 'WHOLE in its first frame' : 'NOT WHOLE in its first frame'}. After it ${after.length} frames, the darkest at ${Math.round(lowest?.t ?? -1)} ms with light ${lowest?.L.toFixed(2)}: ${gone.length ? `${gone.length} FRAMES WITHOUT THE C (${gone.map((r) => Math.round(r.t)).join(', ')} ms)` : 'no frame without the C'}`);
	if (run === 1) {
		const from = Math.max(0, k - 2);
		let pick = site.slice(from);
		const cap = GRID[size].cols * (size === 'desk' ? 5 : 3);
		if (pick.length > cap) {
			const keep = new Set([0, 1, 2, 3]);
			const d = pick.findIndex((r) => r.t >= t.drawn);
			for (let i = Math.max(0, d - 3); i <= Math.min(pick.length - 1, d + 3); i++) keep.add(i);
			const rest = cap - keep.size;
			for (let i = 0; i < rest; i++) keep.add(Math.round((i * (pick.length - 1)) / (rest - 1)));
			pick = pick.filter((_, i) => keep.has(i));
		}
		await sheet(join(dir, `first3-${line}-${size}.jpg`), pick.map((r) => ({ img: r.img, label: `+${Math.round(r.t)}${Math.abs(r.t - (seen?.t ?? -1)) < 1 ? ' SEEN' : ''}${r.t >= t.drawn && r.t < t.drawn + 40 ? ' CANVAS' : ''}` })), GRID[size]);
	}
	await o.context.close();
}
say(`FAULTS (a C not whole in its first frame, or a frame without it afterwards): ${faults}`);
writeFileSync(join(dir, 'first3.txt'), `${log.join('\n')}\n`);
await browser.close();
