#!/usr/bin/env node
// The fifth look's own: chosen crops from my-labels.mjs, large (520x380 a cell, three across).
//   node my-zoom.mjs <out.jpg> <crops dir> <file> [<file> ...]      (a file may be "dir2::file" to take it from another folder)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sheet } from './lib.mjs';
const [out, dir, ...files] = process.argv.slice(2);
const cells = files.map((f) => { const [d, n] = f.includes('::') ? f.split('::') : [dir, f]; return { img: readFileSync(join(d, n)), label: `${d.endsWith('old') ? 'BEFORE ' : ''}${n.replace('.png', '')}`, enlarge: true }; });
await sheet(out, cells, { cols: 3, cellW: 520, cellH: 380 });
