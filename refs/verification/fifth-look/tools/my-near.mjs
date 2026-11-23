#!/usr/bin/env node
// The fifth look's own: WHOSE LABEL DOES IT READ AS? For every distinct label of a build: every other star
// (r > 3 px) whose disc stands as near the words' box as the words' own star does (within 6 px more), and
// on which side of the words it lies. A label level with a neighbour and as near to it as to its own star
// can be read as the neighbour's: these are the ones to look at.
//   node my-near.mjs --size phone [--complete] [--old]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'desk' }, complete: { type: 'boolean', default: false }, old: { type: 'boolean', default: false } } });
const taps = JSON.parse(readFileSync(join(ROOT, 'refs/verification/fifth-look', values.old ? 'old' : '', 'labels', `${values.size}${values.complete ? '-complete' : ''}.json`))).filter((t) => t.what === 'label' && t.first);
const gap = (b, s) => Math.hypot(Math.max(b.x - s.x, 0, s.x - (b.x + b.w)), Math.max(b.y - s.y, 0, s.y - (b.y + b.h))) - s.r;
let n = 0;
for (const t of taps) {
	const own = gap(t.box, t.star);
	const near = t.others.filter((s) => s.r > 3 && gap(t.box, s) < own + 6).map((s) => {
		const cy = t.box.y + t.box.h / 2, cx = t.box.x + t.box.w / 2;
		const level = Math.abs(s.y - cy) < 12 ? (s.x < cx ? 'LEVEL, on its left' : 'LEVEL, on its right') : Math.abs(s.x - cx) < 48 ? (s.y < cy ? 'over it' : 'under it') : 'at a corner';
		return `${s.slot} r ${s.r.toFixed(1)} ${gap(t.box, s).toFixed(1)} px ${level}`;
	});
	if (near.length) { n++; console.log(`${t.fig} ${t.slot} ${t.side}${t.slide ? ` slid ${t.slide}` : ''} (own star r ${t.star.r.toFixed(1)}, ${own.toFixed(1)} px): ${near.join('; ')}`); }
}
console.log(`${values.size}: ${n} of ${taps.length} labels have another star as near as their own (within 6 px more)`);
