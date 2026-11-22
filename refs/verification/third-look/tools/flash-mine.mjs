#!/usr/bin/env node
// The third look's own reading of the flash's recorded frames (from flash.txt and flash-dip*.txt as the
// scripts print them: ms and the share of the frame brighter than L 110). My rule, stricter than the
// fixers': take the peak; take every frame from the FIRST at 80% of the peak to the LAST at 80% of the
// peak (after the last the fade has begun and does not come back). Any frame between those two under 80%
// of the peak is a dip: light that went down and came up again. The stretch is taken back from the peak only while the
// light holds (the open menu is lit too, before the flash). Also a dip: a frame back at 70% of the peak
// after the light has fallen under half of it (a second flash).
import { readFileSync } from 'node:fs';
const files = process.argv.slice(2);
let dips = 0, n = 0;
for (const f of files) {
	const lines = readFileSync(f, 'utf8').split('\n');
	for (let i = 0; i < lines.length; i++) {
		let name = null, rows = null;
		let m = lines[i].match(/^(\S+ .*?-> "[^"]+"(?: run \d+)?): lands scene (\w+), scrollY (\d+), dialog (\w+)/);
		if (!m) continue;
		name = m[1];
		const next = lines.slice(i + 1, i + 4).find((l) => /frame by frame/.test(l));
		if (!next) continue;
		const body = next.slice(next.indexOf('):') + 2).trim();
		if (/mean light/.test(next)) rows = body.split(/\s+/).map((x) => x.split(':').map(Number)).map((a) => ({ t: a[0], lit: a[2] }));
		else rows = body.split(/\s+/).map((x) => x.split(':').map(Number)).map((a) => ({ t: a[0], lit: a[1] }));
		rows = rows.filter((r) => r.t > 30 && Number.isFinite(r.lit));
		const peak = rows.reduce((a, b) => (b.lit > a.lit ? b : a));
		// the stretch at 80% of the peak: back from the peak while the light holds (what is lit before that
		// is the open menu, not the flash), forward from the peak to the LAST frame at 80%
		const pi = rows.indexOf(peak);
		let ai = pi;
		while (ai > 0 && rows[ai - 1].lit >= 0.8 * peak.lit) ai--;
		let zi = pi;
		for (let k = pi; k < rows.length; k++) if (rows[k].lit >= 0.8 * peak.lit) zi = k;
		const a = rows[ai].t, z = rows[zi].t;
		const span = rows.slice(ai, zi + 1);
		const low = span.reduce((p, q) => (q.lit < p.lit ? q : p));
		// a second flash: after the light has fallen under half the peak, a frame back at 70% of it
		const fell = rows.findIndex((r, k) => k > pi && r.lit < 0.5 * peak.lit);
		const again = fell >= 0 && rows.slice(fell).some((r) => r.lit >= 0.7 * peak.lit);
		const settled = Math.max(...rows.slice(-4).map((r) => r.lit));
		// ...which can only be told from the ARRIVAL where the place arrived at is dark beside the flash (on the phone
		// the Close and the sky are themselves 45 to 74% as lit as the flash's peak: their coming up is the place).
		const dip = low.lit < 0.8 * peak.lit || (again && settled < 0.4 * peak.lit);
		n++; if (dip) dips++;
		console.log(`${name.padEnd(46)} lands ${m[2]} ${m[3]}${m[4] === 'true' ? ' dialog' : ''} | peak ${peak.lit.toFixed(1)}% at +${peak.t} | at 80% of the peak from +${a} to +${z} ms (${span.length} frames), the lowest of them ${low.lit.toFixed(1)}% at +${low.t} = ${(100 * low.lit / peak.lit).toFixed(0)}%${dip ? '  <== DIP' : ''} | back at 70% of the peak after falling under half: ${again ? 'YES' : 'no'} (the place arrived at is ${(100 * settled / peak.lit).toFixed(0)}% as lit as the peak)`);
	}
}
console.log(`${n} flashes read; a dip (a frame under 80% of the peak between two at 80% or more) in ${dips}.`);
