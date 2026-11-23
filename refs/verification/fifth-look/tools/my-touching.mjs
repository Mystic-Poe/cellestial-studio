#!/usr/bin/env node
// The fifth look's own: a sheet of every distinct label (my-labels.mjs --complete) whose box is on, or within 4 px
// of, any star's disc (r > 3 px) or lies over far points, apart from those already in the zoom sheet: 1.5x, 4 across.
//   node my-touching.mjs --size desk --crops <dir> [--skip a.png,b.png]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, sheet } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'desk' }, crops: { type: 'string' }, skip: { type: 'string', default: '' } } });
const base = join(ROOT, 'refs/verification/fifth-look');
const gap = (b, s) => Math.hypot(Math.max(b.x - s.x, 0, s.x - (b.x + b.w)), Math.max(b.y - s.y, 0, s.y - (b.y + b.h))) - s.r;
const skip = new Set(values.skip.split(','));
const taps = JSON.parse(readFileSync(join(base, 'labels', `${values.size}-complete.json`))).filter((t) => t.what === 'label' && t.crop && !skip.has(t.crop));
const cells = [];
for (const t of taps) {
	const stars = t.others.filter((s) => s.r > 3 && gap(t.box, s) < 4), points = t.others.filter((s) => s.r <= 3 && gap(t.box, s) < 0);
	if (!stars.length && !points.length) continue;
	cells.push({ img: readFileSync(join(values.crops, t.crop)), label: `${t.fig} #${t.slot.slice(5)} ${t.side}${t.slide ? ` ${t.slide}` : ''}: ${stars.length} stars${stars.some((s) => s.lit) ? ' (LIT)' : ''}, ${points.length} points`, enlarge: true });
}
console.log(`${values.size}: ${cells.length} labels touch something`);
for (let i = 0, n = 1; i < cells.length; i += 24, n++) await sheet(join(base, 'labels', `${values.size}-complete-touching-${n}.jpg`), cells.slice(i, i + 24), { cols: 4, cellW: 390, cellH: 285 });
