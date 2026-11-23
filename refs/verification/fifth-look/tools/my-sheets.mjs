#!/usr/bin/env node
// The fifth look's own: sheets of EVERY distinct label my-labels.mjs cropped, large enough to judge.
// The labels that are not under their star at 1.5x (4 across, 20 to a sheet); the labels under their
// star at the screen's own size (6 across, 48 to a sheet).
//   node my-sheets.mjs --size desk --crops <dir> [--complete] [--old]     writes labels/<size>...-moved-N.jpg, -under-N.jpg
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, sheet } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'desk' }, crops: { type: 'string' }, complete: { type: 'boolean', default: false }, suffix: { type: 'string' }, old: { type: 'boolean', default: false }, which: { type: 'string', default: 'moved,under' } } });
const name = `${values.size}${values.complete ? '-complete' : values.suffix ? `-${values.suffix}` : ''}`;
const base = join(ROOT, 'refs/verification/fifth-look', values.old ? 'old' : '');
const taps = JSON.parse(readFileSync(join(base, 'labels', `${name}.json`))).filter((t) => t.what === 'label' && t.crop);
const cell = (t) => ({ img: readFileSync(join(values.crops, t.crop)), label: `${t.k + 1} ${t.fig} ${t.slot.replace('slot-', '#')} ${t.side}${t.slide ? ` slid ${t.slide}` : ''}`, enlarge: true });
const moved = taps.filter((t) => t.side !== 'under' || t.slide);
const under = taps.filter((t) => t.side === 'under' && !t.slide);
console.log(`${name}: ${moved.length} not under their star, ${under.length} under`);
if (values.which.includes('moved')) for (let i = 0, n = 1; i < moved.length; i += 20, n++) await sheet(join(base, 'labels', `${name}-moved-${n}.jpg`), moved.slice(i, i + 20).map(cell), { cols: 4, cellW: 390, cellH: 285 });
if (values.which.includes('under')) for (let i = 0, n = 1; i < under.length; i += 48, n++) await sheet(join(base, 'labels', `${name}-under-${n}.jpg`), under.slice(i, i + 48).map(cell), { cols: 6, cellW: 260, cellH: 190 });
