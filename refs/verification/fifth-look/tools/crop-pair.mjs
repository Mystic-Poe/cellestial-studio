#!/usr/bin/env node
// The fourth look's own: the same box cut out of two pictures and set one above the other (A above B),
// enlarged to fit, for looking at a difference cmp-sheets.mjs has found.
//   node crop-pair.mjs <A> <B> <x0> <y0> <x1> <y1> <out.jpg> [margin=30]
import { sharp } from './lib.mjs';
const [A, B, x0, y0, x1, y1, out, m = '30'] = process.argv.slice(2);
const meta = await sharp(A).metadata();
const M = Number(m);
const left = Math.max(0, Number(x0) - M), top = Math.max(0, Number(y0) - M);
const width = Math.min(meta.width - left, Number(x1) - left + M), height = Math.min(meta.height - top, Number(y1) - top + M);
const scale = Math.min(4, 1560 / width, 760 / height);
const w = Math.round(width * scale), h = Math.round(height * scale);
const cut = (f) => sharp(f).extract({ left, top, width, height }).resize(w, h, { kernel: 'nearest' }).toBuffer();
const [a, b] = [await cut(A), await cut(B)];
await sharp({ create: { width: w, height: h * 2 + 12, channels: 3, background: '#c03030' } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: 0, top: h + 12 }]).jpeg({ quality: 88 }).toFile(out);
console.log(`${out}: ${w}x${h * 2 + 12} (box ${left},${top} ${width}x${height}, x${scale.toFixed(2)}); A above, B below the red line`);
