// Track the C emblem's bounding box through the reference frames.
import { createRequire } from 'node:module';
const require = createRequire('/home/poe/cellestial-wt/loader/package.json');
const sharp = require('sharp');
const dir = '/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad/loader/ref24';
const out = [];
for (let n = 0; n < 193; n++) {
	const f = `${dir}/r_${String(n).padStart(3, '0')}.jpg`;
	const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
	const { width: w, height: h, channels: c } = info;
	// brass: warm and reasonably bright
	const col = new Int32Array(w);
	const row = new Int32Array(h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * c;
			const r = data[i], g = data[i + 1], b = data[i + 2];
			if (r > 90 && r > b + 25 && g > b) { col[x]++; row[y]++; }
		}
	}
	const first = (a, min) => { for (let i = 0; i < a.length; i++) if (a[i] >= min) return i; return -1; };
	const last = (a, min) => { for (let i = a.length - 1; i >= 0; i--) if (a[i] >= min) return i; return -1; };
	const top = first(row, 6), bottom = last(row, 6), left = first(col, 6);
	out.push({ n, t: +(n / 24).toFixed(3), top, bottom, left, hgt: bottom - top });
}
for (const o of out) console.log(`${o.n}\t${o.t}\t${o.left}\t${o.top}\t${o.bottom}\t${o.hgt}`);
