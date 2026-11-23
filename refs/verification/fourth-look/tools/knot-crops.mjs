#!/usr/bin/env node
// Round 3, piece 1: the desktop's knot before and after, from sky-same.mjs's captures (same/desk-before,
// same/desk-after): Taurus whole, its closest pair (slot-77 and slot-64) enlarged, and the same pair where it shows
// small behind Aries (station 8). Writes fourth-look/desk-sky/knot-before-after.jpg.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { outDir, sharp, sheet } from './lib.mjs';
const dir = outDir('desk-sky');
const same = outDir('same');
const cells = [];
const cut = async (mode, file, box, label) => cells.push({ img: await sharp(readFileSync(join(same, `desk-${mode}`, file))).extract(box).png().toBuffer(), label: `${label}, ${mode}` });
for (const mode of ['before', 'after']) {
	await cut(mode, 'empty-station-9.png', { left: 320, top: 80, width: 800, height: 720 }, 'Taurus at its station, 1440x900');
	await cut(mode, 'empty-station-9.png', { left: 963, top: 472, width: 200, height: 160 }, 'the closest pair, slot-77 and slot-64 (200x160 px, enlarged)');
	await cut(mode, 'empty-station-8.png', { left: 800, top: 446, width: 80, height: 80 }, 'the same pair behind Aries, station 8 (80x80 px, enlarged)');
}
await sheet(join(dir, 'knot-before-after.jpg'), cells, { cols: 3, cellW: 520, cellH: 468 });
