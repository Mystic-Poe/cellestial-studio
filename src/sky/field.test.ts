import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeDust, mulberry32, selectThreads, wakeLevel } from './field.ts';

test('mulberry32 is deterministic and stays in [0, 1)', () => {
	const a = mulberry32(42);
	const b = mulberry32(42);
	for (let i = 0; i < 1000; i++) {
		const v = a();
		assert.equal(v, b());
		assert.ok(v >= 0 && v < 1);
	}
});

test('makeDust returns count stars inside their ranges', () => {
	const dust = makeDust(160, mulberry32(1));
	assert.equal(dust.length, 160);
	for (const s of dust) {
		assert.ok(s.x >= 0 && s.x < 1 && s.y >= 0 && s.y < 1);
		assert.ok(s.r >= 0.5 && s.r <= 1.8);
		assert.ok(s.depth >= 0.3 && s.depth <= 1);
		assert.match(s.color, /^\d{1,3},\d{1,3},\d{1,3}$/);
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

test('selectThreads joins only close, awake pairs', () => {
	const pts = [
		{ x: 0, y: 0, wake: 1 },
		{ x: 10, y: 0, wake: 1 },
		{ x: 500, y: 0, wake: 1 }, // too far from both
		{ x: 5, y: 5, wake: 0.1 }, // too sleepy
	];
	const threads = selectThreads(pts, 50);
	assert.equal(threads.length, 1);
	assert.deepEqual([threads[0].a, threads[0].b], [0, 1]);
	assert.ok(threads[0].alpha > 0 && threads[0].alpha <= 1);
});

test('selectThreads alpha falls with distance and wake, and is capped in count', () => {
	const near = selectThreads(
		[
			{ x: 0, y: 0, wake: 1 },
			{ x: 5, y: 0, wake: 1 },
		],
		50,
	)[0].alpha;
	const far = selectThreads(
		[
			{ x: 0, y: 0, wake: 1 },
			{ x: 45, y: 0, wake: 1 },
		],
		50,
	)[0].alpha;
	const dim = selectThreads(
		[
			{ x: 0, y: 0, wake: 0.4 },
			{ x: 5, y: 0, wake: 1 },
		],
		50,
	)[0].alpha;
	assert.ok(near > far);
	assert.ok(near > dim);

	const many = Array.from({ length: 30 }, (_, i) => ({ x: i, y: 0, wake: 1 }));
	const capped = selectThreads(many, 100, 0.25, 12);
	assert.equal(capped.length, 12);
	for (let i = 1; i < capped.length; i++) assert.ok(capped[i - 1].alpha >= capped[i].alpha);
});
