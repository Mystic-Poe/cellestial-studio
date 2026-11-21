// A contact sheet: node sheet.mjs out.jpg cellHeight file1.png file2.png ...  (1600 px wide at most)
import path from 'node:path';
import sharp from 'sharp';
const [out, h, ...files] = process.argv.slice(2);
const H = Number(h);
const cells = [];
for (const f of files) {
	const img = sharp(f).resize({ height: H });
	const buf = await img.png().toBuffer();
	const meta = await sharp(buf).metadata();
	const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="18"><rect width="100%" height="100%" fill="#222"/><text x="4" y="13" font-family="sans-serif" font-size="11" fill="#fff">${path.basename(f).replace(/\.png$/, '')}</text></svg>`);
	cells.push({ buf, w: meta.width, h: meta.height, label });
}
const MAX = 1600;
const rows = [[]];
let x = 0;
for (const c of cells) {
	if (x + c.w > MAX && rows.at(-1).length) { rows.push([]); x = 0; }
	rows.at(-1).push({ ...c, x });
	x += c.w + 6;
}
const rowH = H + 18 + 6;
const width = Math.min(MAX, Math.max(...rows.map((r) => r.at(-1).x + r.at(-1).w)));
const comp = [];
rows.forEach((r, i) => r.forEach((c) => { comp.push({ input: c.label, left: c.x, top: i * rowH }); comp.push({ input: c.buf, left: c.x, top: i * rowH + 18 }); }));
await sharp({ create: { width, height: rows.length * rowH, channels: 3, background: '#444' } }).composite(comp).jpeg({ quality: 82 }).toFile(out);
console.log(out, width, rows.length * rowH);
