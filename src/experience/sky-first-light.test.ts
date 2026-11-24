// The first light (sky/answer.ts): the owner, 24 Nov. When the loader hands the sky over,
// Cellestial's star pulses three times, and each pulse sends beads to the stars of the first
// page, which then do the "claim yours" pulse.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIRST_LIGHT, firstLightPulse, firstLightWaves } from './sky/answer.ts';

test('three pulses: the star brightens three times and is dark before, between and after', () => {
	const peaks: number[] = [];
	let prev = 0;
	let rising = false;
	for (let t = 0; t <= 6; t += 0.005) {
		const v = firstLightPulse(t);
		if (v > prev) rising = true;
		else if (rising && v < prev) {
			peaks.push(t - 0.005);
			rising = false;
		}
		prev = v;
	}
	assert.equal(peaks.length, FIRST_LIGHT.pulses, `peaks at ${peaks.map((p) => p.toFixed(2))}`);
	for (const [i, p] of peaks.entries()) {
		assert.ok(Math.abs(p - (i * FIRST_LIGHT.every + FIRST_LIGHT.rise)) < 0.02);
		assert.ok(firstLightPulse(p) > 0.99, 'each reaches full light');
	}
	assert.equal(firstLightPulse(-0.1), 0);
	assert.ok(firstLightPulse(i0(1) - 0.01) < 0.25, 'it dies down between two pulses');
	assert.ok(firstLightPulse(6) < 0.01, 'and is gone after the third');
});
const i0 = (i: number) => i * FIRST_LIGHT.every;

test('the waves: every empty star once, nearest the centre first, in three', () => {
	const stars = [9, 2, 7, 1, 5, 3, 11, 4, 8, 6, 10, 12].map((d) => ({ d, id: `s${d}` }));
	const waves = firstLightWaves(stars);
	assert.equal(waves.length, 3);
	assert.deepEqual(
		waves.map((w) => w.map((s) => s.d)),
		[
			[1, 2, 3, 4],
			[5, 6, 7, 8],
			[9, 10, 11, 12],
		],
	);
	assert.deepEqual(firstLightWaves([]), [[], [], []], 'a figure all lit: the pulses, and no beads');
	const two = firstLightWaves([{ d: 2 }, { d: 1 }]);
	assert.deepEqual(
		two.flat().map((s) => s.d),
		[1, 2],
	);
});
