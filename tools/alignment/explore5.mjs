import { createRequire } from 'node:module';
const require = createRequire('/home/poe/cellestial-wt/loader/package.json');
const sharp = require('sharp');
const px = await import('/home/poe/cellestial-wt/loader/scripts/assets/lib/px.mjs');
const { ASSETS } = await import('/home/poe/cellestial-wt/loader/src/experience/assets.ts');
const W = '/home/poe/cellestial-wt/loader/public/cellestial/loader/';
const wm = await px.load(sharp, W + 'wordmark.webp');
const { w, h } = wm;
const red = wm.r; // brass level; the groove (dark or blue) is low in red
const N = 48;
const cs = [], sn = [];
for (let k = 0; k < N; k++) { cs.push(Math.cos((k / N) * 2 * Math.PI)); sn.push(Math.sin((k / N) * 2 * Math.PI)); }
const ring = (cx, cy, r) => { let s = 0; for (let k = 0; k < N; k++) s += px.sample(red, w, h, cx + cs[k] * r, cy + sn[k] * r); return s / N; };
for (const L of ASSETS.loader.wordmark.letters) {
	const found = [];
	for (let cy = L.y + 10; cy < L.y + L.h - 10; cy++) for (let cx = L.x + 10; cx < L.x + L.w - 10; cx++) {
		if (red[cy * w + cx] < 110) continue;
		let best = 0, bestR = 0;
		for (let r = 11; r <= 17; r += 0.5) {
			const g = ring(cx, cy, r);
			const a = (ring(cx, cy, r - 4) + ring(cx, cy, r + 4)) / 2;
			const s = 1 - g / (a + 1e-6);
			if (s > best) { best = s; bestR = r; }
		}
		if (best > 0.28) found.push({ cx, cy, r: bestR, s: best });
	}
	found.sort((a, b) => b.s - a.s);
	const keep = [];
	for (const f of found) if (!keep.some((k) => Math.hypot(k.cx - f.cx, k.cy - f.cy) < 14)) keep.push(f);
	console.log(L.ch, keep.map((k) => `(${k.cx},${k.cy}) r${k.r} s${k.s.toFixed(2)}`).join('  '));
}
