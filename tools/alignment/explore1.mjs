import { createRequire } from 'node:module';
const require = createRequire('/home/poe/cellestial-wt/loader/package.json');
const sharp = require('sharp');
const px = await import('/home/poe/cellestial-wt/loader/scripts/assets/lib/px.mjs');
const W = '/home/poe/cellestial-wt/loader/public/cellestial/loader/';
const O = '/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad/loader/look/';
const lit = await px.load(sharp, W + 'c-lit.webp');
const unlit = await px.load(sharp, W + 'c-unlit.webp');
const n = lit.w * lit.h;
// blueness of lit, and difference
const blue = new Float32Array(n), diff = new Float32Array(n);
let hist = new Array(26).fill(0);
for (let i = 0; i < n; i++) {
	blue[i] = Math.max(0, lit.b[i] - lit.r[i]);
	diff[i] = Math.max(0, (lit.b[i] - unlit.b[i]) - (lit.r[i] - unlit.r[i]));
	hist[Math.min(25, Math.floor(blue[i] / 10))]++;
}
console.log('blue hist', hist.join(' '));
const save = async (plane, name, k = 1) => {
	const buf = Buffer.alloc(n);
	for (let i = 0; i < n; i++) buf[i] = Math.max(0, Math.min(255, plane[i] * k));
	await sharp(buf, { raw: { width: lit.w, height: lit.h, channels: 1 } }).jpeg({ quality: 90 }).toFile(O + name);
};
await save(blue, 'c_blue.jpg', 2);
await save(diff, 'c_diff.jpg', 2);
// also overall difference magnitude (to see the non-line differences)
const mag = new Float32Array(n);
for (let i = 0; i < n; i++) mag[i] = (Math.abs(lit.r[i] - unlit.r[i]) + Math.abs(lit.g[i] - unlit.g[i]) + Math.abs(lit.b[i] - unlit.b[i])) / 3;
await save(mag, 'c_mag.jpg', 3);
