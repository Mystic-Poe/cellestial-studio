import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGovernor, QUALITY_LEVELS } from './quality.ts';

/** Feed `seconds` of frames at `frameMs` each, starting at `start` ms. */
function feed(
	g: ReturnType<typeof createGovernor>,
	frameMs: number,
	seconds: number,
	start: number,
) {
	let now = start;
	const end = start + seconds * 1000;
	while (now <= end) {
		g.sample(frameMs, now);
		now += frameMs;
	}
	return now;
}

test('levels go from full to lightest', () => {
	assert.equal(QUALITY_LEVELS.length, 4);
	assert.deepEqual(QUALITY_LEVELS[0], { threads: true, dustScale: 1, maxDpr: 2 });
	assert.deepEqual(QUALITY_LEVELS[3], { threads: false, dustScale: 0.5, maxDpr: 1 });
});

test('a smooth device stays at full quality', () => {
	const g = createGovernor();
	feed(g, 16, 5, 0);
	assert.equal(g.level, 0);
});

test('a slow device steps down one level per bad second, stopping at 3', () => {
	const g = createGovernor();
	let t = feed(g, 33, 1.05, 0);
	assert.equal(g.level, 1);
	t = feed(g, 33, 1.05, t);
	assert.equal(g.level, 2);
	feed(g, 33, 5, t);
	assert.equal(g.level, 3);
});

test('steps back up once after 3 good seconds, and never again', () => {
	const g = createGovernor();
	let t = feed(g, 33, 2.1, 0);
	assert.equal(g.level, 2);
	t = feed(g, 8, 3.2, t);
	assert.equal(g.level, 1);
	t = feed(g, 8, 6, t);
	assert.equal(g.level, 1, 'no second step-up');
	feed(g, 33, 2.1, t); // 2s so at least one window is entirely slow frames
	assert.equal(g.level, 2, 'can still step down');
});

test('a mid-range average (between upMs and budget) holds the level', () => {
	const g = createGovernor();
	const t = feed(g, 33, 1.05, 0);
	assert.equal(g.level, 1);
	feed(g, 16, 6, t);
	assert.equal(g.level, 1);
});
