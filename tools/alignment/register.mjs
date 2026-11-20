// How does the C sprite (1400 frame) sit on the emblem inside the wordmark?
// Run from anywhere: node tools/alignment/register.mjs   (see PROGRESS.md, "The alignment harness")
// Only the five path lines below were changed from the original, so it runs from the repo.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(`${ROOT}package.json`);
const sharp = require('sharp');
const px = await import(`${ROOT}scripts/assets/lib/px.mjs`);
const W = `${ROOT}public/cellestial/loader/`;
const O = `${ROOT}refs/alignment/`;
const lit = await px.load(sharp, W + 'c-lit.webp');
const wm = await px.load(sharp, W + 'wordmark.webp');
const LEVEL = 40;
const maskOf = (img) => { const m = new Float32Array(img.w * img.h); for (let i = 0; i < m.length; i++) m[i] = img.r[i] > LEVEL ? 1 : 0; return m; };
const cm = px.keepLargest(maskOf(lit), lit.w, lit.h);
const sd = px.signedDistance(cm, lit.w, lit.h); // + inside
// emblem edge points in the wordmark
const wmMask = px.keepRegions(maskOf(wm), wm.w, wm.h, (r) => r.x < 400 && r.n > 5000);
const wsd = px.signedDistance(wmMask, wm.w, wm.h);
const pts = [];
for (let y = 260; y < 890; y++) for (let x = 100; x < 640; x++) {
	const i = y * wm.w + x;
	if (Math.abs(wsd[i]) <= 0.5 && wmMask[i]) pts.push([x + 0.5, y + 0.5]);
}
console.log('edge points', pts.length);
const cost = (p) => {
	// p = [a, b, tx, c, d, ty]: c-frame -> wordmark: X = a x + b y + tx; Y = c x + d y + ty
	const [a, b, tx, c, d, ty] = p; const det = a * d - b * c;
	let s = 0, n = 0; const errs = [];
	for (const [X, Y] of pts) {
		const u = X - tx, v = Y - ty;
		const x = (d * u - b * v) / det - 0.5, y = (-c * u + a * v) / det - 0.5;
		const e = Math.abs(px.sample(sd, lit.w, lit.h, x, y)) * Math.sqrt(Math.abs(det));
		const ee = Math.min(e, 6); s += ee * ee; n++; errs.push(e);
	}
	return { rms: Math.sqrt(s / n), errs };
};
const report = (name, p) => {
	const { rms, errs } = cost(p); errs.sort((x, y) => x - y);
	console.log(name, p.map((v) => +v.toFixed(5)).join(', '), 'rms', rms.toFixed(3), 'median', errs[errs.length >> 1].toFixed(3), 'p90', errs[Math.floor(errs.length * 0.9)].toFixed(3), 'max', errs[errs.length - 1].toFixed(2));
};
const sx0 = 512 / 1047, sy0 = 594 / 1211;
let p = [sx0, 0, 111 - 176 * sx0, 0, sy0, 275 - 95 * sy0];
report('box-to-box', p);
// pattern search; modes: similarity (a=d, b=c=0), aniso (a,d free), affine
function search(p0, free) {
	let p = p0.slice(); let step = [0.004, 0.004, 2, 0.004, 0.004, 2];
	let best = cost(p).rms;
	for (let it = 0; it < 200; it++) {
		let improved = false;
		for (const k of free) {
			for (const dir of [-1, 1]) {
				const q = p.slice();
				if (k === 'u') { q[0] += dir * step[0]; q[4] += dir * step[0]; }
				else q[k] += dir * step[k];
				const c = cost(q).rms;
				if (c < best - 1e-6) { best = c; p = q; improved = true; }
			}
		}
		if (!improved) { step = step.map((s) => s / 2); if (step[2] < 0.01) break; }
	}
	return p;
}
const sim0 = [(sx0 + sy0) / 2, 0, p[2], 0, (sx0 + sy0) / 2, p[5]];
const sim = search(sim0, ['u', 2, 5]);
report('similarity', sim);
const aniso = search(p, [0, 4, 2, 5]);
report('aniso', aniso);
const aff = search(aniso, [0, 1, 2, 3, 4, 5]);
report('affine', aff);
// overlay proof for the aniso map: wordmark emblem (red) vs mapped c-lit edge (cyan)
async function overlay(name, p) {
	const [a, b, tx, c, d, ty] = p; const det = a * d - b * c;
	const x0 = 90, y0 = 250, ww = 560, hh = 640, K = 2;
	const buf = Buffer.alloc(ww * K * hh * K * 3);
	for (let j = 0; j < hh * K; j++) for (let i = 0; i < ww * K; i++) {
		const X = x0 + (i + 0.5) / K, Y = y0 + (j + 0.5) / K;
		const u = X - tx, v = Y - ty;
		const x = (d * u - b * v) / det - 0.5, y = (-c * u + a * v) / det - 0.5;
		const cl = px.sample(lit.r, lit.w, lit.h, x, y);
		const wr = px.sample(wm.r, wm.w, wm.h, X - 0.5, Y - 0.5);
		const o = (j * ww * K + i) * 3;
		buf[o] = Math.min(255, wr * 1.6); buf[o + 1] = Math.min(255, cl * 1.6); buf[o + 2] = Math.min(255, cl * 1.6);
	}
	await sharp(buf, { raw: { width: ww * K, height: hh * K, channels: 3 } }).jpeg({ quality: 90 }).toFile(O + name);
}
await overlay('reg_similarity.jpg', sim);
await overlay('reg_affine.jpg', aff);
console.log(JSON.stringify({ sim, aniso, aff }));
