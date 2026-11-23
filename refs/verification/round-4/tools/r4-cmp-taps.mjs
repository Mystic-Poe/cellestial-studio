// Round 4's own: two runs of r4-taps.mjs compared tap for tap: the star each tap offers, a label before and none now.
//   node r4-cmp-taps.mjs <before.json> <after.json>
import { readFileSync } from 'node:fs';
const [fa, fb] = process.argv.slice(2);
const A = JSON.parse(readFileSync(fa)), B = JSON.parse(readFileSync(fb));
for (const size of Object.keys(A)) {
	const a = A[size], b = B[size];
	let both = 0, sameStar = 0, other = [], lost = [], gained = 0, ctl = 0;
	for (let k = 0; k < 12; k++) for (let i = 0; i < a[k].taps.length; i++) {
		const x = a[k].taps[i], y = b[k].taps[i];
		if (x.hit !== 'sky' || y.hit !== 'sky') { if (x.hit !== y.hit) { ctl++; console.log(`  ${size} ${a[k].name} ${x.pt.map(Math.round)}: under the finger before: ${x.hit}${x.slot ? ' ' + x.slot : ''}; after: ${y.hit}${y.slot ? ' ' + y.slot + ' ' + y.side : ''}`); } continue; }
		if (x.slot && y.slot) { both++; if (x.slot === y.slot) sameStar++; else other.push(`${a[k].name} ${x.pt.map(Math.round)}: ${x.slot} -> ${y.slot}`); }
		else if (x.slot && !y.slot) lost.push(`${a[k].name} ${x.pt.map(Math.round)} (${x.slot})`);
		else if (!x.slot && y.slot) gained++;
	}
	const cnt = (d) => d.flatMap((s) => s.taps).filter((t) => t.hit === 'sky');
	console.log(`${size}: taps on the sky before ${cnt(a).length}, after ${cnt(b).length}; a label before ${cnt(a).filter((t) => t.slot).length}, after ${cnt(b).filter((t) => t.slot).length}; none before ${cnt(a).filter((t) => !t.slot).length}, after ${cnt(b).filter((t) => !t.slot).length}`);
	console.log(`  a label on both builds ${both}: for the same star ${sameStar}, another star ${other.length} ${other.join(' | ')}`);
	console.log(`  a label before and none now ${lost.length} ${lost.join(' | ')}; none before and a label now ${gained}; what was under the finger differs ${ctl}`);
}
