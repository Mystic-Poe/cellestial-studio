import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mulberry32, wakeLevel } from './field.ts';

test('mulberry32 is deterministic and stays in [0, 1)', () => {
	const a = mulberry32(42);
	const b = mulberry32(42);
	for (let i = 0; i < 1000; i++) {
		const v = a();
		assert.equal(v, b());
		assert.ok(v >= 0 && v < 1);
	}
});

test('wakeLevel: full at the light, zero at reach and beyond, smooth between', () => {
	assert.equal(wakeLevel(0, 100), 1);
	assert.equal(wakeLevel(100, 100), 0);
	assert.equal(wakeLevel(250, 100), 0);
	assert.equal(wakeLevel(50, 100), 0.5);
	assert.equal(wakeLevel(10, 0), 0);
	let prev = 1;
	for (let d = 0; d <= 100; d += 5) {
		const w = wakeLevel(d, 100);
		assert.ok(w <= prev, 'monotonic non-increasing');
		prev = w;
	}
});
