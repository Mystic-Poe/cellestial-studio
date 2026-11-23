#!/usr/bin/env node
// The fifth look's own: the grid taps that opened a PANEL (my-labels.mjs): was each a touch on a star (within its
// touch target), or a touch on the words still standing from the tap before, or neither (a touch on empty
// sky that picked a star by itself: the fault the fixer's "pressed" guard is for)?
//   node my-panels.mjs --size phone [--old]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'phone' }, old: { type: 'boolean', default: false } } });
const taps = JSON.parse(readFileSync(join(ROOT, 'refs/verification/fifth-look', values.old ? 'old' : '', 'labels', `${values.size}.json`)));
// Every star's disc at each station, from the labels of that station (each label lists all the others and its own).
const discs = new Map();
for (const t of taps) if (t.what === 'label') { const m = discs.get(t.k) ?? new Map(); m.set(t.slot, t.star); for (const s of t.others) m.set(s.slot, s); discs.set(t.k, m); }
const tally = {};
const lines = [];
for (const t of taps) {
	if (t.what !== 'panel') continue;
	const [x, y] = t.pt;
	let near = null;
	for (const [slot, s] of discs.get(t.k) ?? []) { if (s.r <= 6) continue; const d = Math.hypot(s.x - x, s.y - y) - s.r; if (!near || d < near.d) near = { slot, d }; }
	const wb = t.wordsBefore;
	const toWords = wb ? Math.hypot(Math.max(wb.box.x - x, 0, x - (wb.box.x + wb.box.w)), Math.max(wb.box.y - y, 0, y - (wb.box.y + wb.box.h))) : null;
	const what = near && near.d <= 18 ? 'on a star (within 18 px of its disc: its touch target)' : wb && toWords <= 16 ? 'on or by the words still standing (within 16 px)' : wb ? 'words were standing, the touch not near them' : 'EMPTY SKY, no words standing: the touch picked a star by itself';
	tally[what] = (tally[what] ?? 0) + 1;
	lines.push(`  ${t.fig} ${t.pt.map(Math.round)}: ${what}; nearest star ${near ? `${near.slot} ${near.d.toFixed(0)} px` : '?'}${wb ? `; words of ${wb.slot} ${toWords.toFixed(0)} px from the touch` : ''}`);
}
console.log(`${values.old ? 'OLD' : 'NEW'} build, ${values.size}: ${lines.length} taps opened a panel: ${JSON.stringify(tally)}`);
const wbAll = taps.filter((t) => t.what === 'label' || t.what === 'panel');
console.log(`  taps made with the words of the tap before still standing: ${wbAll.filter((t) => t.wordsBefore).length} of ${wbAll.length}`);
for (const l of lines) if (!/on a star/.test(l)) console.log(l);
