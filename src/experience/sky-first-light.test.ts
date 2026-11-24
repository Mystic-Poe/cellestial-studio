// The first light (sky/answer.ts): the owner, 24 Nov. When the loader hands the sky over,
// Cellestial's star pulses three times, and each pulse sends beads to the stars of the first
// page, which then do the "claim yours" pulse.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	FIRST_LIGHT,
	firstLightPulse,
	firstLightWaves,
	firstLightWordTimes,
} from './sky/answer.ts';

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

test('the words: one star after another, never two at once, none before its beads arrive', () => {
	const { every } = FIRST_LIGHT.words;
	// As measured on 24 Nov at 1440 x 900: the three waves of four stars, as their beads arrive.
	const arrivals = [0.5, 0.5, 0.74, 0.85, 1.95, 2.02, 2.2, 2.36, 3.4, 3.62, 3.88, 3.92];
	const times = firstLightWordTimes(arrivals);
	assert.equal(times.length, arrivals.length);
	for (const [i, t] of times.entries()) {
		assert.ok(t >= (arrivals[i] as number) - 1e-9, `the words of star ${i} wait for its beads`);
		if (i > 0)
			assert.ok(t - (times[i - 1] as number) >= every - 1e-9, `${i}: ${every} s apart at least`);
	}
	// Spread out, and not by much more than the beads already are.
	assert.ok((times.at(-1) as number) - (times[0] as number) >= 11 * every - 1e-9);
	assert.ok((times.at(-1) as number) < 4.6, `the last at ${(times.at(-1) as number).toFixed(2)} s`);
	// Words that each last `life` and come `every` apart: never more than four showing at once.
	const most = Math.max(
		...times.map((t) => times.filter((u) => u <= t && u + FIRST_LIGHT.words.life > t).length),
	);
	assert.ok(most <= 4, `${most} at once`);
	assert.deepEqual(firstLightWordTimes([]), []);
	assert.deepEqual(firstLightWordTimes([1.1, 1]), [1, 1 + every], 'in the order the beads arrive');
});
