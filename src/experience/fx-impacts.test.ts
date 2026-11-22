// The strikes of the fall (fx/impacts.ts): none is taken off the screen before
// its own end, and a crowd of them shares its soft light.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { burstHeat, GLINT_MS, glintHeat, IMPACT_MS } from './fx/impact.ts';
import { createImpacts, GLOW_CAP, type Run, type Strike } from './fx/impacts.ts';

interface Mark extends Strike {
	id: number;
}

const burst = (id: number, x: number, reach = 90): Mark => ({
	id,
	x,
	ms: IMPACT_MS,
	reach,
	heat: burstHeat,
});
const glint = (id: number, x: number): Mark => ({
	id,
	x,
	ms: GLINT_MS,
	reach: 30,
	heat: glintHeat,
});

/** Play `landings` (ms after the press) through the list at `frameMs` a frame; `seen(now, runs)` every frame. */
function play(
	landings: { at: number; art: Mark }[],
	frameMs: number,
	seen: (now: number, runs: readonly Run<Mark>[]) => void,
	cap?: number,
) {
	const list = createImpacts<Mark>(cap);
	const queue = [...landings].sort((a, b) => a.at - b.at);
	const end = Math.max(...queue.map((l) => l.at + l.art.ms)) + 100;
	for (let now = 0; now <= end; now += frameMs) {
		// The sky's frame lands its stars, then the effects' frame draws.
		while (queue.length && queue[0].at <= now) {
			const l = queue.shift();
			if (l) list.add(l.art, l.at);
		}
		list.advance(now);
		seen(now, list.runs);
	}
	return list;
}

test('sixty strikes inside 200 ms: every one is drawn until its own 760 ms are over', () => {
	// The fall from Sagittarius and worse: 25 full bursts and 35 more, all inside 200 ms.
	const landings = Array.from({ length: 60 }, (_, i) => ({
		at: 400 + Math.floor((i * 200) / 60),
		art: burst(i, 500 + ((i * 37) % 400)),
	}));
	const frames = new Map<number, number[]>();
	const list = play(landings, 1000 / 60, (now, runs) => {
		for (const run of runs) {
			const at = frames.get(run.art.id) ?? [];
			at.push(now);
			frames.set(run.art.id, at);
		}
	});
	for (const l of landings) {
		const at = frames.get(l.art.id) ?? [];
		const want: number[] = [];
		for (let now = 0; now <= l.at + IMPACT_MS + 100; now += 1000 / 60) {
			if (now >= l.at && now < l.at + IMPACT_MS) want.push(now);
		}
		// On the list in every frame of its own length, and in no other.
		assert.deepEqual(at, want, `strike ${l.art.id}, landed at ${l.at} ms`);
		assert.ok(at.length >= 45, `strike ${l.art.id} was drawn in ${at.length} frames`);
	}
	assert.equal(list.runs.length, 0, 'the list is empty when the last one is over');
});

test('a strike is on the list from the moment it is added, at the start of its length', () => {
	const list = createImpacts<Mark>();
	const run = list.add(burst(0, 100), 1000);
	assert.equal(list.runs.length, 1);
	assert.equal(run.u, 0);
	assert.equal(run.gain, 1);
	list.advance(1000 + IMPACT_MS / 2);
	assert.ok(Math.abs(list.runs[0].u - 0.5) < 1e-9);
	list.advance(1000 + IMPACT_MS - 1);
	assert.equal(list.runs.length, 1, 'still there a millisecond before its end');
	list.advance(1000 + IMPACT_MS);
	assert.equal(list.runs.length, 0, 'gone at its end');
});

test('glints and bursts each run their own length on one list', () => {
	const seen = new Map<number, number>();
	play(
		[
			{ at: 0, art: burst(0, 100) },
			{ at: 0, art: glint(1, 100) },
		],
		10,
		(now, runs) => {
			for (const run of runs) seen.set(run.art.id, now);
		},
	);
	assert.equal(seen.get(0), IMPACT_MS - 10);
	assert.equal(seen.get(1), GLINT_MS - 10);
});

test('a strike with no neighbour gives all its light; far apart, each gives all of it', () => {
	play(
		[
			{ at: 0, art: burst(0, 100) },
			{ at: 40, art: burst(1, 700) },
			{ at: 80, art: burst(2, 1300) },
		],
		1000 / 60,
		(_now, runs) => {
			for (const run of runs) assert.equal(run.gain, 1);
		},
	);
});

test('a crowd shares its soft light: it never glows like more than the cap', () => {
	// Sagittarius on the desktop: 25 bursts within 350 px, inside 550 ms.
	const landings = Array.from({ length: 25 }, (_, i) => ({
		at: 350 + i * 22,
		art: burst(i, 540 + ((i * 97) % 350)),
	}));
	let dimmest = 1;
	play(landings, 1000 / 60, (_now, runs) => {
		for (const a of runs) {
			assert.ok(a.gain > 0 && a.gain <= 1);
			dimmest = Math.min(dimmest, a.gain);
			// The glow that reaches the place where `a` struck: its own, and its neighbours' by nearness.
			let glow = 0;
			for (const b of runs) {
				const near = Math.max(0, 1 - Math.abs(a.art.x - b.art.x) / (a.art.reach + b.art.reach));
				glow += b.gain * b.art.heat(b.u) * near;
			}
			// Each neighbour is held to the cap of its own crowd, which is not this one's:
			// the sum is near the cap, not exactly under it.
			assert.ok(glow <= GLOW_CAP * 1.6, `glow ${glow.toFixed(2)} where strike ${a.art.id} landed`);
		}
	});
	assert.ok(
		dimmest < 0.5,
		`the middle of the crowd is shared out (dimmest gain ${dimmest.toFixed(2)})`,
	);
});

test('forty glints at one place glow like one or two, and all forty are there', () => {
	const landings = Array.from({ length: 40 }, (_, i) => ({
		at: 900 + i * 4,
		art: glint(i, 700 + ((i * 13) % 60)),
	}));
	let most = 0;
	play(
		landings,
		1000 / 60,
		(_now, runs) => {
			most = Math.max(most, runs.length);
			let sum = 0;
			for (const run of runs) sum += run.gain * run.art.heat(run.u);
			assert.ok(sum <= 1.2 * 2.2, `the glints together glow like ${sum.toFixed(2)} of one`);
		},
		1.2,
	);
	assert.equal(most, 40);
});
