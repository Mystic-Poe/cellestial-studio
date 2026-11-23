// The fifth look's own control for sky-same.mjs: the count must SEE a difference where there is one. The same
// station empty and seeded (stars lit) differ; and one capture is kept small to be looked at.
import { join } from 'node:path';
import { OUT, sharp } from './lib.mjs';
for (const size of ['desk', 'phone']) {
	const a = await sharp(join(OUT, `same/${size}-after/empty-station-1.png`)).raw().toBuffer();
	const b = await sharp(join(OUT, `same/${size}-after/lit-station-1.png`)).raw().toBuffer();
	const c = await sharp(join(OUT, `same/${size}-before/lit-station-1.png`)).raw().toBuffer();
	let d = 0, e = 0;
	for (let i = 0; i < a.length; i += 3) { if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) d++; if (c[i] !== b[i] || c[i + 1] !== b[i + 1] || c[i + 2] !== b[i + 2]) e++; }
	console.log(`${size}: empty against seeded at Virgo (the new build): ${d} pixels differ; seeded, the build as it stood against the new: ${e}`);
}
await sharp(join(OUT, 'same/desk-after/lit-station-1.png')).resize(900).jpeg({ quality: 80 }).toFile(join(OUT, 'same/control-desk-lit-1.jpg'));
