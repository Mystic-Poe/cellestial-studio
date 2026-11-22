// The loader's lightning (loader/lightning.ts): every corner of a bolt has a
// place. Round 2, hunting the fault that blinked Cellestial's star out for a
// frame (a number a hair outside its range, then a root or a power of it):
// a bolt pinned at both ends took the square root of sin(pi * i / (n - 1)),
// and at its last corner that is the sine of pi give or take a rounding,
// which for about one length in twenty is a hair UNDER zero. Its root is not
// a number, the canvas drops a corner that has no place, and the bolt stopped
// one corner short of the end it is pinned to.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crackle } from './loader/lightning.ts';

test('a bolt pinned at both ends has a place for every corner, whatever its length', () => {
	let bolts = 0;
	for (let length = 8; length <= 3000; length += 1) {
		for (const detail of [3, 6]) {
			const path = [10, 20, 10 + length, 20];
			const bolt = crackle(path, { seed: length * 7 + detail, reach: 9, detail, pin: 'both' });
			for (let i = 0; i < bolt.length; i++) {
				assert.ok(
					Number.isFinite(bolt[i]),
					`length ${length}, detail ${detail}: corner ${i >> 1} of ${bolt.length >> 1} is ${bolt[i]}`,
				);
			}
			// Pinned: it starts on the path's start and its last corner is on the path.
			assert.ok(Math.abs(bolt[0] - 10) < 1e-6 && Math.abs(bolt[1] - 20) < 1e-6);
			assert.ok(
				Math.abs(bolt[bolt.length - 1] - 20) < 1e-6,
				`length ${length}: the end is off the path`,
			);
			bolts++;
		}
	}
	assert.ok(bolts > 5000);
});

test('the other pins too, and a path with a bend', () => {
	for (let length = 8; length <= 600; length += 1) {
		for (const pin of ['start', 'none', 'both'] as const) {
			const bolt = crackle([0, 0, length, 0, length, length / 2], { seed: length, reach: 5, pin });
			for (const v of bolt) assert.ok(Number.isFinite(v), `length ${length}, pin ${pin}: ${v}`);
		}
	}
});
