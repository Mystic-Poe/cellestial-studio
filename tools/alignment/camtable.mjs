import { readFileSync } from 'node:fs';
const rows = readFileSync('track.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t').map(Number));
// n t left top bottom hgt
const A = { h: 871, left: 558 }, B = { h: 538, left: 95.5 };
const F0 = 82, F1 = 140;
const raw = [];
for (let n = F0; n <= F1; n++) {
	const [, t, left, top, bottom, hgt] = rows[n];
	raw.push({ n, t, ps: (A.h - hgt) / (A.h - B.h), pl: (A.left - left) / (A.left - B.left), cy: (top + bottom) / 2 });
}
const smooth = (key) => {
	const v = raw.map((r) => r[key]);
	const out = v.map((_, i) => {
		let s = 0, w = 0;
		for (let k = -2; k <= 2; k++) { const j = Math.min(v.length - 1, Math.max(0, i + k)); const g = 3 - Math.abs(k); s += v[j] * g; w += g; }
		return s / w;
	});
	// pin ends and force monotone
	const lo = out[0], hi = out[out.length - 1];
	let prev = 0;
	return out.map((x) => { let y = (x - lo) / (hi - lo); y = Math.min(1, Math.max(prev, y)); prev = y; return +y.toFixed(4); });
};
const ps = smooth('ps'), pl = smooth('pl');
console.log('t0', raw[0].t, 't1', raw[raw.length - 1].t, 'n', raw.length);
console.log('scale', JSON.stringify(ps));
console.log('left', JSON.stringify(pl));
console.log('cy', raw.filter((_, i) => i % 6 === 0).map((r) => r.cy).join(' '));
