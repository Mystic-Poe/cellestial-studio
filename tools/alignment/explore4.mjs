import { createRequire } from 'node:module';
const require = createRequire('/home/poe/cellestial-wt/loader/package.json');
const sharp = require('sharp');
const px = await import('/home/poe/cellestial-wt/loader/scripts/assets/lib/px.mjs');
const { ASSETS } = await import('/home/poe/cellestial-wt/loader/src/experience/assets.ts');
const W = '/home/poe/cellestial-wt/loader/public/cellestial/loader/';
const wm = await px.load(sharp, W + 'wordmark.webp');
const { w, h } = wm;
const bl = new Float32Array(w * h);
for (let i = 0; i < w * h; i++) bl[i] = wm.b[i] - wm.r[i];
const N = 64;
const cs = [], sn = [];
for (let k = 0; k < N; k++) { cs.push(Math.cos((k / N) * 2 * Math.PI)); sn.push(Math.sin((k / N) * 2 * Math.PI)); }
for (const L of ASSETS.loader.wordmark.letters) {
	const found = [];
	for (let cy = L.y + 8; cy < L.y + L.h - 8; cy++) for (let cx = L.x + 8; cx < L.x + L.w - 8; cx++) {
		// centre itself must be brass
		const ci = cy * w + cx; if (wm.r[ci] < 50 || bl[ci] > -10) continue;
		let bestS = 0, bestR = 0;
		for (let r = 12; r <= 20; r += 0.5) {
			let c = 0;
			for (let k = 0; k < N; k++) if (px.sample(bl, w, h, cx + cs[k] * r, cy + sn[k] * r) > 0) c++;
			if (c / N > bestS) { bestS = c / N; bestR = r; }
		}
		if (bestS >= 0.8) found.push({ cx, cy, r: bestR, s: bestS });
	}
	// non-max suppression
	found.sort((a, b) => b.s - a.s);
	const keep = [];
	for (const f of found) if (!keep.some((k) => Math.hypot(k.cx - f.cx, k.cy - f.cy) < 14)) keep.push(f);
	console.log(L.ch, keep.map((k) => `(${k.cx},${k.cy}) r${k.r} s${k.s.toFixed(2)}`).join('  '));
}
