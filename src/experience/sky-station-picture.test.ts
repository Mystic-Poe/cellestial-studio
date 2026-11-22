// The picture an empty star is drawn from at its station
// (public/cellestial/sky/b4-station.webp, derived by scripts/assets/sky.mjs
// from the pack's B4). Round 2's second look found that on a 1x screen, a
// star 46 px across, its brass traces had closed up into blotches: "more
// marble than circuit". The traces are now filtered to the size they are seen
// at, so that strokes stay apart. These tests fail on the picture as it was.
//
// The picture is brought to the size of a star at its station (36 to 58
// screen pixels across) and the brass is read along every row of the disc: a
// line crossed by a row is a short run of brass, a blotch a long one.

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';

const FILE = join(import.meta.dirname, '../../public/cellestial/sky/b4-station.webp');
/** The disc in the picture's own frame: 256 px, the sphere 236 across (b4Empty's frame, halved). */
const FRAME = { size: 256, disc: 236 };

async function brassRuns(across: number) {
	const size = Math.round((FRAME.size * across) / FRAME.disc);
	const { data, info } = await sharp(FILE)
		.flatten({ background: '#000' })
		.resize({ width: size, height: size, kernel: 'linear' })
		.raw()
		.toBuffer({ resolveWithObject: true });
	let runs = 0;
	let brass = 0;
	let long = 0;
	let inside = 0;
	for (let y = 0; y < size; y++) {
		let run = 0;
		for (let x = 0; x <= size; x++) {
			const i = (y * size + x) * info.channels;
			const d = x < size ? Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (across / 2) : 9;
			const r = data[i] ?? 0;
			const b = data[i + 2] ?? 0;
			if (d < 0.8) inside++;
			if (d < 0.8 && r - b > 18 && r > 70) run++;
			else if (run) {
				runs++;
				brass += run;
				if (run >= 4) long++;
				run = 0;
			}
		}
	}
	return { mean: brass / runs, long: long / runs, cover: brass / inside };
}

for (const across of [36, 46, 58]) {
	test(`an empty star ${across} px across: its brass is strokes, not blotches`, async () => {
		const { mean, long, cover } = await brassRuns(across);
		// As it was: 2.7 to 3.2 px, and a quarter to a third of the runs 4 px or longer.
		assert.ok(mean < 2.5, `a row crosses ${mean.toFixed(2)} px of brass at a time`);
		assert.ok(long < 0.18, `${(100 * long).toFixed(0)}% of the runs are 4 px or longer`);
		// And the traces still show: a fifth of the disc is brass (a plain dark bead has none).
		assert.ok(cover > 0.15, `brass covers ${(100 * cover).toFixed(1)}% of the disc`);
	});
}
