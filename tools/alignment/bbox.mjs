import { createRequire } from 'node:module';
const require = createRequire('/home/poe/cellestial-wt/loader/package.json');
const sharp = require('sharp');
async function bbox(f, xmax = Infinity) {
	const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
	const { width: w, height: h, channels: c } = info;
	const col = new Int32Array(w), row = new Int32Array(h);
	for (let y = 0; y < h; y++) for (let x = 0; x < Math.min(w, xmax); x++) {
		const i = (y * w + x) * c; const r = data[i], g = data[i + 1], b = data[i + 2];
		if (r > 90 && r > b + 25 && g > b) { col[x]++; row[y]++; }
	}
	const first = (a, min) => { for (let i = 0; i < a.length; i++) if (a[i] >= min) return i; return -1; };
	const last = (a, min) => { for (let i = a.length - 1; i >= 0; i--) if (a[i] >= min) return i; return -1; };
	return { w, h, left: first(col, 6), right: last(col, 6), top: first(row, 6), bottom: last(row, 6) };
}
const W = '/home/poe/cellestial-wt/loader/';
console.log('c-unlit', await bbox(W + 'public/cellestial/loader/c-unlit.webp'));
console.log('c-lit', await bbox(W + 'public/cellestial/loader/c-lit.webp'));
console.log('wordmark', await bbox(W + 'public/cellestial/loader/wordmark.webp'));
console.log('wordmark emblem only', await bbox(W + 'public/cellestial/loader/wordmark.webp', 640));
const R = '/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad/loader/ref24/';
console.log('ref 0', await bbox(R + 'r_000.jpg'));
console.log('ref 192', await bbox(R + 'r_192.jpg'));
console.log('ref 192 emblem', await bbox(R + 'r_192.jpg', 600));
console.log('A4 src', await bbox(W + 'cellestial-assets/images/a-loading/A4_wordmark_cellestial.jpg'));
console.log('A1 unlit src', await bbox(W + 'cellestial-assets/images/a-loading/A1_c-emblem_unlit.jpg'));
