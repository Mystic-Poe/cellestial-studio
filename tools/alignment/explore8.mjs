import { createRequire } from 'node:module';
const require = createRequire('/home/poe/cellestial-wt/loader/package.json');
const sharp = require('sharp');
const px = await import('/home/poe/cellestial-wt/loader/scripts/assets/lib/px.mjs');
const W = '/home/poe/cellestial-wt/loader/public/cellestial/loader/';
const lit = await px.load(sharp, W + 'c-lit.webp');
const { CIRCUIT } = await import('/home/poe/cellestial-wt/loader/src/experience/loader/geometry.ts');
// per line: mean blue & red of lit at its points, bbox
CIRCUIT.forEach((l, k) => {
	let b = 0, r = 0, n = 0, x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0, maxB = 0;
	for (let i = 0; i < l.length; i += 3) {
		const x = Math.round(l[i] - 0.5), y = Math.round(l[i + 1] - 0.5);
		let mb = 0, mr = 0;
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const p = (y + dy) * lit.w + x + dx; if (lit.b[p] > mb) { mb = lit.b[p]; mr = lit.r[p]; } }
		b += mb; r += mr; n++; maxB = Math.max(maxB, mb);
		x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
	}
	console.log(k, 'pts', n, 't', l[2], '→', l[l.length - 1], `bbox ${x0},${y0}–${x1},${y1}`, 'meanB', (b / n).toFixed(0), 'meanR', (r / n).toFixed(0));
});
