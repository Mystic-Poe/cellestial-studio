import { createRequire } from 'node:module';
const require = createRequire('/home/poe/cellestial-wt/loader/package.json');
const sharp = require('sharp');
const dir = '/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad/loader/ref24';
async function load(n) {
	const { data, info } = await sharp(`${dir}/r_${String(n).padStart(3, '0')}.jpg`).raw().toBuffer({ resolveWithObject: true });
	return { data, w: info.width, h: info.height, c: info.channels };
}
function px(img, x, y, rad = 2) {
	let r = 0, g = 0, b = 0, n = 0;
	for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) {
		const k = ((y + j) * img.w + (x + i)) * img.c; r += img.data[k]; g += img.data[k + 1]; b += img.data[k + 2]; n++;
	}
	return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}
function row(img, y, x0, x1, step) { const out = []; for (let x = x0; x <= x1; x += step) out.push(`${x}:${px(img, x, y).join(',')}`); return out.join('  '); }
function col(img, x, y0, y1, step) { const out = []; for (let y = y0; y <= y1; y += step) out.push(`${y}:${px(img, x, y).join(',')}`); return out.join('  '); }
// frame 72 (3.0 s): wash profile across a row above the node (y=300) and below (y=950)
const f72 = await load(72);
console.log('f72 row y=300:', row(f72, 300, 100, 1900, 100));
console.log('f72 row y=600:', row(f72, 600, 100, 1900, 100));
console.log('f72 row y=1000:', row(f72, 1000, 100, 1900, 100));
console.log('f72 fine row y=300 around bolt:', row(f72, 300, 1150, 1500, 25));
const f70 = await load(70);
console.log('f70 row y=300:', row(f70, 300, 100, 1900, 100));
const f76 = await load(76);
console.log('f76 row y=300:', row(f76, 300, 100, 1900, 100));
const f80 = await load(80);
console.log('f80 row y=300:', row(f80, 300, 100, 1900, 100));
const f82 = await load(82);
console.log('f82 row y=300:', row(f82, 300, 100, 1900, 100));
// frame 24 (1.0 s): halo across the lower strut. find the line near (1000,800)?
const f24 = await load(24);
console.log('f24 col x=760:', col(f24, 760, 700, 900, 8));
const f32 = await load(32);
console.log('f32 col x=900 top strut:', col(f32, 900, 60, 220, 8));
// frame 120 (5.0 s): haze behind letters
const f120 = await load(120);
console.log('f120 row y=250:', row(f120, 250, 100, 1900, 100));
console.log('f120 row y=700:', row(f120, 700, 100, 1900, 100));
console.log('f120 col x=1000:', col(f120, 1000, 100, 1000, 60));
const f132 = await load(132);
console.log('f132 row y=760:', row(f132, 760, 100, 1900, 100));
console.log('f132 col x=1000:', col(f132, 1000, 100, 1000, 60));
const f136 = await load(136);
console.log('f136 col x=1000:', col(f136, 1000, 100, 1000, 60));
const f140 = await load(140);
console.log('f140 col x=1000:', col(f140, 1000, 100, 1000, 60));
const f192 = await load(192);
console.log('f192 col x=1000:', col(f192, 1000, 100, 1000, 60));
console.log('f192 row y=900:', row(f192, 900, 100, 1900, 100));
