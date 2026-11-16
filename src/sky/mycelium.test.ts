import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mulberry32 } from './field.ts';
import { growMycelium } from './mycelium.ts';

const targets = [
	{ x: 200, y: 400 },
	{ x: 600, y: 420 },
	{ x: 1000, y: 400 },
];

test('one main root per target plus side branches', () => {
	const b = growMycelium({ width: 1200, targets, rand: mulberry32(7), sidesPerRoot: 3 });
	assert.equal(b.filter((x) => x.main).length, 3);
	assert.equal(b.filter((x) => !x.main).length, 9);
});

test('main roots start on the horizon and land exactly on their target', () => {
	const mains = growMycelium({ width: 1200, targets, rand: mulberry32(7) }).filter((x) => x.main);
	mains.forEach((m, i) => {
		assert.equal(m.points[0].y, 0);
		assert.ok(Math.abs(m.points[0].x - targets[i].x) <= 150); // ±120 start + ±30 jitter
		assert.deepEqual(m.points.at(-1), targets[i]);
		for (let k = 1; k < m.points.length; k++)
			assert.ok(m.points[k].y >= m.points[k - 1].y, 'never climbs');
	});
});

test('everything stays inside the region', () => {
	for (const br of growMycelium({ width: 1200, targets, rand: mulberry32(3), sidesPerRoot: 4 }))
		for (const p of br.points) {
			assert.ok(p.x >= 0 && p.x <= 1200, `x ${p.x}`);
			assert.ok(p.y >= 0 && p.y <= 420, `y ${p.y}`);
		}
});

test('same seed, same roots', () => {
	const a = growMycelium({ width: 1200, targets, rand: mulberry32(9) });
	const b = growMycelium({ width: 1200, targets, rand: mulberry32(9) });
	assert.deepEqual(a, b);
});
