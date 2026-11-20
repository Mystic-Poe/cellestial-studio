import { createRequire } from 'node:module';
const require = createRequire('/home/poe/cellestial-wt/loader/package.json');
const sharp = require('sharp');
const px = await import('/home/poe/cellestial-wt/loader/scripts/assets/lib/px.mjs');
const W = '/home/poe/cellestial-wt/loader/public/cellestial/loader/';
const wm = await px.load(sharp, W + 'wordmark.webp');
const { w, h } = wm;
const red = wm.r;
const N = 48; const cs = [], sn = [];
for (let k = 0; k < N; k++) { cs.push(Math.cos((k / N) * 2 * Math.PI)); sn.push(Math.sin((k / N) * 2 * Math.PI)); }
const ring = (cx, cy, r) => { let s = 0; for (let k = 0; k < N; k++) s += px.sample(red, w, h, cx + cs[k] * r, cy + sn[k] * r); return s / N; };
const probes = { eTail: [756, 676], l1b: [842, 696], l2t: [928, 416], l2b: [928, 696], tb: [1495, 700], ib: [1572, 696], l3b: [1870, 696], l3t: [1874, 416] };
for (const [name, [x0, y0]] of Object.entries(probes)) {
	let best = { s: -1 };
	for (let cy = y0 - 10; cy <= y0 + 10; cy++) for (let cx = x0 - 10; cx <= x0 + 10; cx++) for (let r = 10; r <= 18; r += 0.5) {
		const g = ring(cx, cy, r); const a = (ring(cx, cy, r - 4) + ring(cx, cy, r + 4)) / 2; const s = 1 - g / (a + 1e-6);
		if (s > best.s) best = { s, cx, cy, r, g, a, c: red[cy * w + cx] };
	}
	console.log(name, JSON.stringify(best));
	// radial profile at best centre
	const prof = []; for (let r = 0; r <= 30; r += 2) prof.push(Math.round(ring(best.cx, best.cy, r)));
	console.log('   profile', prof.join(' '));
}
