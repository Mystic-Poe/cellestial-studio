import assert from 'node:assert/strict';
import { test } from 'node:test';
import { approach, createTiltGate, pickLight, tiltToLight, wanderLight } from './input.ts';

test('tiltToLight maps a held phone into the unit square and clamps', () => {
	assert.equal(tiltToLight(null, 10), null);
	assert.equal(tiltToLight(40, null), null);
	assert.deepEqual(tiltToLight(40, 0), { x: 0.5, y: 0.5 });
	assert.deepEqual(tiltToLight(15, -30), { x: 0, y: 0 });
	assert.deepEqual(tiltToLight(65, 30), { x: 1, y: 1 });
	assert.deepEqual(tiltToLight(120, 90), { x: 1, y: 1 });
	assert.deepEqual(tiltToLight(-50, -90), { x: 0, y: 0 });
});

test('wanderLight stays on screen and moves', () => {
	let moved = false;
	const first = wanderLight(0);
	for (let t = 0; t < 120; t += 0.5) {
		const p = wanderLight(t);
		assert.ok(p.x > 0.1 && p.x < 0.9 && p.y > 0.1 && p.y < 0.9);
		if (Math.abs(p.x - first.x) > 0.05) moved = true;
	}
	assert.ok(moved);
});

test('approach eases toward the target, halving the gap per half-life', () => {
	assert.equal(approach(0, 1, 0), 0);
	assert.ok(Math.abs(approach(0, 1, 120, 120) - 0.5) < 1e-9);
	assert.ok(Math.abs(approach(0, 1, 240, 120) - 0.75) < 1e-9);
	assert.equal(approach(5, 5, 16), 5);
});

const WANDER = { x: 0.5, y: 0.5 };
const P = { x: 0.2, y: 0.3 };
const T = { x: 0.9, y: 0.9 };

test('pickLight: a fresh mouse beats tilt', () => {
	const r = pickLight({
		pointer: P,
		pointerType: 'mouse',
		fresh: true,
		touching: false,
		tilt: T,
		wander: WANDER,
	});
	assert.deepEqual(r, { x: 0.2, y: 0.3, active: true });
});

test('pickLight: a touch while touching beats tilt', () => {
	const r = pickLight({
		pointer: P,
		pointerType: 'touch',
		fresh: true,
		touching: true,
		tilt: T,
		wander: WANDER,
	});
	assert.deepEqual(r, { x: 0.2, y: 0.3, active: true });
});

test('pickLight: after the touch lifts, tilt beats the old touch point', () => {
	const r = pickLight({
		pointer: P,
		pointerType: 'touch',
		fresh: true,
		touching: false,
		tilt: T,
		wander: WANDER,
	});
	assert.deepEqual(r, { x: 0.9, y: 0.9, active: true });
});

test('pickLight: a lingering touch with no tilt uses the pointer', () => {
	const r = pickLight({
		pointer: P,
		pointerType: 'touch',
		fresh: true,
		touching: false,
		tilt: null,
		wander: WANDER,
	});
	assert.deepEqual(r, { x: 0.2, y: 0.3, active: true });
});

test('pickLight: a stale mouse with no tilt wanders and is inactive', () => {
	const r = pickLight({
		pointer: P,
		pointerType: 'mouse',
		fresh: false,
		touching: false,
		tilt: null,
		wander: WANDER,
	});
	assert.deepEqual(r, { x: 0.5, y: 0.5, active: false });
});

test('createTiltGate: no requestPermission listens once', () => {
	let listens = 0;
	const g = createTiltGate(undefined, () => listens++);
	g.ask();
	g.ask();
	assert.equal(listens, 1);
});

test('createTiltGate: retries after a rejection, stops after granted or denied', async () => {
	let listens = 0;
	let calls = 0;
	const answers: Array<() => Promise<string>> = [
		() => Promise.reject(new Error('not a gesture')),
		() => Promise.resolve('granted'),
	];
	const g = createTiltGate(
		() => answers[calls++](),
		() => listens++,
	);
	g.ask();
	await new Promise((r) => setTimeout(r, 0));
	assert.equal(listens, 0);
	g.ask();
	await new Promise((r) => setTimeout(r, 0));
	assert.equal(listens, 1);
	g.ask();
	assert.equal(calls, 2);

	let dCalls = 0;
	const d = createTiltGate(
		() => (dCalls++, Promise.resolve('denied')),
		() => listens++,
	);
	d.ask();
	await new Promise((r) => setTimeout(r, 0));
	d.ask();
	assert.equal(dCalls, 1);
	assert.equal(listens, 1);
});

test('createTiltGate: does not stack asks while one is in flight', async () => {
	let calls = 0;
	const g = createTiltGate(
		() => (calls++, new Promise(() => {})),
		() => {},
	);
	g.ask();
	g.ask();
	assert.equal(calls, 1);
});
