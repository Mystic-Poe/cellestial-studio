#!/usr/bin/env node
// The fourth look's own: two folders of the builders' sheets set beside each other, file by file.
// For each file of A that B has too: the same to the byte, or not; and if not, for pictures of the same
// size, how many pixels differ by more than a JPEG's own noise (any channel by more than 24 of 255), their
// share of the picture, and the box that holds them. Text files: the number of lines that differ.
//   node cmp-sheets.mjs <folder A> <folder B> [label]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { sharp } from './lib.mjs';
const [A, B, label = ''] = process.argv.slice(2);
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
let same = 0, differ = 0, missing = 0;
console.log(`${label || 'SHEETS'}: ${A}  beside  ${B}`);
for (const fa of walk(A).sort()) {
	const rel = relative(A, fa);
	const fb = join(B, rel);
	if (!existsSync(fb)) { missing++; console.log(`  only in A   ${rel}`); continue; }
	const a = readFileSync(fa), b = readFileSync(fb);
	if (a.equals(b)) { same++; console.log(`  SAME BYTES  ${rel}`); continue; }
	differ++;
	if (!/\.(jpe?g|png|webp)$/i.test(rel)) {
		const la = a.toString().split('\n'), lb = b.toString().split('\n');
		let n = 0; for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) n++;
		console.log(`  DIFFERS     ${rel}: ${n} of ${Math.max(la.length, lb.length)} lines`);
		continue;
	}
	const ra = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true });
	const rb = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true });
	if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) { console.log(`  DIFFERS     ${rel}: sizes ${ra.info.width}x${ra.info.height} and ${rb.info.width}x${rb.info.height}`); continue; }
	const { width: w, height: h } = ra.info;
	let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1, worst = 0;
	for (let i = 0, p = 0; i < ra.data.length; i += 3, p++) {
		const d = Math.max(Math.abs(ra.data[i] - rb.data[i]), Math.abs(ra.data[i + 1] - rb.data[i + 1]), Math.abs(ra.data[i + 2] - rb.data[i + 2]));
		if (d > worst) worst = d;
		if (d > 24) { n++; const x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
	}
	console.log(`  DIFFERS     ${rel}: ${n} px over the noise (${((100 * n) / (w * h)).toFixed(3)}% of ${w}x${h}), largest difference ${worst} of 255${n ? `, in the box x ${x0}..${x1}, y ${y0}..${y1}` : ''}`);
}
console.log(`  ${same} the same to the byte, ${differ} differ, ${missing} only in A`);
