// The beads of light (sky/beads.ts) when the sky is touched again before the first
// beads have arrived. The owner, 23 Nov: a second tap must not start the light
// over. It sends more beads, and the beads already on their way finish their course.
// These tests fail on the build before that, where a run in progress was replaced.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SlotId } from './contracts.ts';
import { BEADS, createBeads, planRoute } from './sky/beads.ts';
import { LATTICE } from './sky/config.ts';
import type { SkyHooks } from './sky/hooks.ts';
import { createHoneycomb } from './sky/lattice.ts';

const comb = createHoneycomb(LATTICE);

/** Just enough of the sky for the beads to run in node: a clock, a frame, a flat camera. */
function world() {
	let now = 0;
	let awake = 0;
	const frames: ((e: { time: number }) => void)[] = [];
	const pulsed: number[] = [];
	const hooks = {
		three: { scene: { add() {} }, layerOrder: () => 0 },
		on(name: string, fn: (e: { time: number }) => void) {
			if (name === 'frame') frames.push(fn);
		},
		time: () => now,
		requestFrame() {},
		keepAwake() {
			awake++;
			return () => {
				awake--;
			};
		},
		quality: () => ({ dpr: 1 }),
		layout: () => ({ fits: Array.from({ length: 12 }, () => ({ dist: 3, scale: 300 })) }),
		camera: () => ({ x: 0, y: 0, z: 3 }),
		project: (x: number, y: number) => ({ x: 200 + x * 300, y: 400 - y * 300, scale: 1 }),
		lattice: {
			pulseEdge: (_layer: number, edge: number) => pulsed.push(edge),
			pulseStrut() {},
		},
	} as unknown as SkyHooks;
	const beads = createBeads(hooks);
	return {
		beads,
		pulsed,
		awake: () => awake,
		/** Let the clock run to `t`, a frame every 1/60 s. */
		runTo(t: number) {
			while (now < t - 1e-9) {
				now = Math.min(t, now + 1 / 60);
				for (const f of frames) f({ time: now });
			}
		},
	};
}

const route = (slot: string, from: [number, number], to: [number, number]) => {
	const r = planRoute(
		comb,
		slot as SlotId,
		{ x: from[0], y: from[1] },
		0,
		{ x: to[0], y: to[1] },
		0,
	);
	assert.ok(r, 'a route over the honeycomb');
	return r;
};

test('a second touch sends more beads: the first beads are still on their way', () => {
	const w = world();
	const first = w.beads.start(route('slot-1', [-0.9, -0.6], [0.8, 0.7]), () => {});
	w.runTo(first.arriveAfter * 0.4);
	assert.equal(w.beads.runs().length, 1);
	const second = w.beads.start(route('slot-2', [0.6, -0.8], [-0.7, 0.5]), () => {});
	assert.equal(w.beads.runs().length, 2, 'the first run was not put out');
	assert.equal(w.beads.run(), second, 'run() is the newest run');
	assert.equal(w.beads.runs()[0], first);
	// One frame on: beads of both runs are alight.
	w.runTo(first.arriveAfter * 0.4 + 0.1);
	const lit = w.beads.screenAll();
	assert.ok(lit.length > BEADS.count, `beads of both runs are drawn (${lit.length})`);
});

test('each run arrives at its own star, in its own time', () => {
	const w = world();
	const arrived: string[] = [];
	const first = w.beads.start(route('slot-1', [-0.9, -0.6], [0.8, 0.7]), (r) =>
		arrived.push(r.route.slot),
	);
	w.runTo(0.15);
	const second = w.beads.start(route('slot-2', [0.6, -0.8], [-0.7, 0.5]), (r) =>
		arrived.push(r.route.slot),
	);
	w.runTo(first.arriveAfter + 0.02);
	assert.deepEqual(arrived, ['slot-1'], 'the first beads finished their course');
	w.runTo(0.15 + second.arriveAfter + 0.02);
	assert.deepEqual(arrived, ['slot-1', 'slot-2']);
	// When the last bead of each is home, nothing is left running and the frame loop is let go.
	w.runTo(0.15 + second.endAfter + BEADS.sparkTime + 0.1);
	assert.equal(w.beads.runs().length, 0);
	assert.equal(w.beads.run(), null);
	assert.equal(w.awake(), 0, 'the sky is not kept awake by beads that have gone');
	assert.equal(w.beads.screenAll().length, 0);
});

test('the first run lights every edge of its way, though a second was started', () => {
	const alone = world();
	const r1 = route('slot-1', [-0.9, -0.6], [0.8, 0.7]);
	const a = alone.beads.start(r1, () => {});
	alone.runTo(a.endAfter + 1);
	const both = world();
	const b = both.beads.start(r1, () => {});
	both.runTo(b.arriveAfter * 0.3);
	both.beads.start(route('slot-2', [0.6, -0.8], [-0.7, 0.5]), () => {});
	both.runTo(b.endAfter + 2);
	for (const e of alone.pulsed)
		assert.ok(both.pulsed.includes(e), `edge ${e} of the first way was lit`);
	assert.ok(both.pulsed.length > alone.pulsed.length, 'and the second way too');
});

test('a tap, a tap, a tap: no more runs than there is room for, the oldest gives way', () => {
	const w = world();
	const all = [];
	for (let i = 0; i < BEADS.runs + 3; i++) {
		all.push(
			w.beads.start(route(`slot-${i + 1}`, [-0.9 + i * 0.1, -0.6], [0.8, 0.7 - i * 0.1]), () => {}),
		);
		w.runTo((i + 1) * 0.03);
	}
	assert.equal(w.beads.runs().length, BEADS.runs);
	assert.equal(w.beads.run(), all[all.length - 1]);
	assert.ok(!w.beads.runs().includes(all[0] as (typeof all)[number]), 'the oldest was let go');
});

test('stop() puts everything out; stopFor() only the beads bound for one star', () => {
	const w = world();
	w.beads.start(route('slot-1', [-0.9, -0.6], [0.8, 0.7]), () => {});
	w.runTo(0.1);
	const second = w.beads.start(route('slot-2', [0.6, -0.8], [-0.7, 0.5]), () => {});
	w.beads.stopFor('slot-1' as SlotId);
	assert.deepEqual(w.beads.runs(), [second]);
	w.beads.stop();
	assert.equal(w.beads.runs().length, 0);
	assert.equal(w.awake(), 0);
});
