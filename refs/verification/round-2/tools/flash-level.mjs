#!/usr/bin/env node
// Round 2, piece 2b: from flash.mjs's own log (flash/flash.txt, every recorded frame of all sixteen
// teleports), how level is each flash through its peak? The share of the frame brighter than L 110, per
// frame; between the first and last frames at 90% of the peak, the lowest frame. Under 80% of the peak is
// a DIP; so is a second rise (a frame under 80% of the peak followed by one a quarter of the peak
// brighter and at least half the peak, that falls away again: light that comes up and stays is the place
// arrived at). The same rule as flash-dip.mjs. Writes flash/flash-level.txt.
//   node flash-level.mjs [path to flash.txt]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { outDir } from './lib.mjs';
const dir = outDir('flash');
const src = process.argv[2] ?? join(dir, 'flash.txt');
const lines = readFileSync(src, 'utf8').split('\n');
const out = [`The flash's light through its peak, from ${src.split('refs/verification/')[1] ?? src} (the share of the frame brighter than L 110, per recorded frame). Between the first and last frames at 90% of the peak, the lowest frame; under 80% of the peak is a DIP, and so is a fall under 80% followed by a rise of a quarter of the peak to at least half of it that falls away again (light that comes up and stays is the place arrived at).`];
let dips = 0, n = 0;
for (let i = 0; i < lines.length; i++) {
	const head = lines[i].match(/^(\w+ \w+ -> "[^"]+"): lands/);
	if (!head) continue;
	const row = lines.slice(i + 1, i + 4).find((l) => l.includes('frame by frame'));
	if (!row) continue;
	const rows = row.split('): ')[1].trim().split(/\s+/).map((c) => { const p = c.split(':'); return { t: Number(p[0]), lit: Number(p[2]) }; });
	const peak = rows.reduce((a, c) => (c.t > 30 && c.lit > a.lit ? c : a), rows[0]);
	const high = rows.filter((x) => x.t > 30 && x.lit >= 0.9 * peak.lit);
	const a = high[0].t, z = high[high.length - 1].t;
	const level = rows.filter((x) => x.t >= a && x.t <= z);
	const low = level.reduce((m, c) => (c.lit < m.lit ? c : m), level[0]);
	// Only where the place arrived at is dark beside the flash (its last recorded frames under 40% of the
	// peak): on the phone the sky and the Close are themselves 57 to 89% as lit as the flash, and their
	// coming up as the flash goes is the arrival, not a second flash.
	const settled = Math.max(...rows.slice(-5).map((x) => x.lit));
	const dark = settled < 0.4 * peak.lit;
	let again = null;
	for (let k = rows.indexOf(high[0]); dark && k < rows.length && !again; k++) {
		if (rows[k].lit >= 0.8 * peak.lit) continue;
		const back = rows.slice(k + 1).find((x) => x.lit >= rows[k].lit + 0.25 * peak.lit && x.lit >= 0.5 * peak.lit);
		// ...and falls away again: light that comes up and STAYS is the place arrived at (on the phone the sky
		// and the Close are themselves half as lit as the flash), not a second flash.
		if (back && rows.slice(rows.indexOf(back) + 1).some((x) => x.lit <= back.lit - 0.25 * peak.lit)) again = { from: rows[k], to: back };
	}
	const dip = low.lit / peak.lit < 0.8 || !!again;
	n++;
	if (dip) dips++;
	out.push(`${head[1]}: peak ${peak.lit.toFixed(1)}% lit at +${peak.t} ms; level stretch +${a}..+${z} ms (${level.length} frames), its lowest frame ${low.lit.toFixed(1)}% at +${low.t} ms: ${Math.round((100 * low.lit) / peak.lit)}% of the peak; ${again ? `falls to ${again.from.lit.toFixed(1)}% at +${again.from.t} ms and RISES AGAIN to ${again.to.lit.toFixed(1)}% at +${again.to.t} ms` : dark ? 'no second rise' : `a second rise not looked for (the place arrived at is itself ${Math.round((100 * settled) / peak.lit)}% as lit as the peak)`}${dip ? '  <-- DIP' : ''}`);
}
out.push(`A dip in ${dips} of ${n} flashes.`);
console.log(out.join('\n'));
writeFileSync(join(dir, process.argv[2] ? 'flash-level-of-given.txt' : 'flash-level.txt'), `${out.join('\n')}\n`);
