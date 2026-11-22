#!/usr/bin/env node
// Part 5: the tab icon. public/favicon.png and the two pictures inside public/favicon.ico, at their real
// size on a dark and on a light tab, enlarged, beside the pack's emblem; and how much of the 16 px icon is
// anything but black.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, outDir, sharp, sheet } from './lib.mjs';
const dir = outDir('owner-list');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const png = readFileSync(join(ROOT, 'public/favicon.png'));
const ico = readFileSync(join(ROOT, 'public/favicon.ico'));
const n = ico.readUInt16LE(4);
const entries = [];
for (let i = 0; i < n; i++) { const at = 6 + 16 * i; entries.push({ size: ico.readUInt8(at), data: ico.subarray(ico.readUInt32LE(at + 12), ico.readUInt32LE(at + 12) + ico.readUInt32LE(at + 8)) }); }
const m = await sharp(png).metadata();
say(`public/favicon.png: ${m.width}x${m.height} ${m.format}, ${png.length} bytes. public/favicon.ico: ${n} pictures, ${entries.map((e) => `${e.size} px (${e.data.subarray(1, 4).toString()} ${e.data.length} bytes)`).join(', ')}`);
const tab = async (img, size, bg) => sharp({ create: { width: 220, height: 40, channels: 3, background: bg } }).composite([{ input: await sharp(img).resize(size, size).png().toBuffer(), left: 12, top: Math.round((40 - size) / 2) }, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="170" height="40"><text x="0" y="25" font-family="sans-serif" font-size="13" fill="${bg === '#202124' ? '#e8eaed' : '#202124'}">Cellestial Studio</text></svg>`), left: 38, top: 0 }]).png().toBuffer();
const cells = [];
const e16 = entries.find((e) => e.size === 16), e32 = entries.find((e) => e.size === 32);
for (const [e, name] of [[e16, '16 px'], [e32, '32 px']]) {
	const { data, info } = await sharp(e.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	let lit = 0, brass = 0, blue = 0, maxL = 0, transparent = 0;
	for (let i = 0; i < data.length; i += 4) { const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]; const L = 0.2126 * r + 0.7152 * g + 0.0722 * b; if (a < 128) transparent++; if (L > 40) lit++; if (L > maxL) maxL = L; if (r > b + 15 && L > 40) brass++; if (b > r + 15 && L > 40) blue++; }
	const px = info.width * info.height;
	say(`${name}: ${info.width}x${info.height}; ${(100 * lit / px).toFixed(0)}% of its pixels brighter than L 40 (brass-toned ${(100 * brass / px).toFixed(0)}%, blue-toned ${(100 * blue / px).toFixed(0)}%), brightest L ${maxL.toFixed(0)}; transparent pixels ${transparent}`);
	cells.push({ img: await tab(e.data, e.size, '#202124'), label: `${name} on a dark tab, real size`, enlarge: false });
	cells.push({ img: await tab(e.data, e.size, '#dee1e6'), label: `${name} on a light tab, real size` });
	cells.push({ img: await sharp(e.data).resize({ width: 256, kernel: 'nearest' }).png().toBuffer(), label: `${name}, enlarged`, enlarge: true });
}
cells.push({ img: await sharp(png).png().toBuffer(), label: 'favicon.png, 180 px' });
cells.push({ img: await sharp(join(ROOT, 'public/cellestial/chrome/c-logo.webp')).resize({ height: 256 }).flatten({ background: '#000' }).png().toBuffer(), label: 'the logo\'s picture (c-logo.webp)' });
cells.push({ img: await sharp(join(ROOT, 'cellestial-assets/images/a-loading/A1_c-emblem_lit.jpg')).resize({ width: 256 }).png().toBuffer(), label: 'the pack: A1_c-emblem_lit.jpg' });
await sheet(join(dir, 'favicon.jpg'), cells, { cols: 3, cellW: 300, cellH: 260 });
writeFileSync(join(dir, 'favicon.txt'), `${log.join('\n')}\n`);
