// The teleport flash's clock (fx/flash-time.ts). Once the flash is at its
// peak it is AT the peak when swap() returns, and from there it only goes on:
// never under the peak again, never backwards. Round 2 found a swap() that
// blocks (about 100 ms on the desktop, from the sky to the ground) setting the
// clock back to a quarter of the flash before its peak, so that it rose to
// the peak a second time and read as two flashes.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FLASH_MS, FLASH_PEAK, FLASH_SOLID_FROM } from './fx/flash.ts';
import {
	advanceFlash,
	beginFlash,
	type FlashTime,
	flashTime,
	HOLD_MAX_MS,
	SWAP_FRAME_MS,
	swapped,
} from './fx/flash-time.ts';

interface Tick {
	now: number;
	u: number;
	held: number;
	/** swap() was called on this tick. */
	swap: boolean;
}

interface Play {
	/** Ms between frames when nothing blocks. */
	frame?: number;
	/** swap() blocks the page for this long. */
	blocks?: number;
	/** swap() leaves a promise that settles this long after it was called (after the block, at the soonest). */
	settles?: number;
	/** The frame after the swap comes this late, the browser laying the new section out. */
	layout?: number;
	/** A frame of this length just before the peak (a stall that jumps the solid stretch). */
	stallBeforePeak?: number;
	t0?: number;
}

/**
 * Play one flash as the layer does: a tick a frame; each tick is drawn after
 * it is advanced (so a tick at or past the solid stretch marks it drawn); a
 * swap() that blocks keeps the next frame away for as long as it blocks.
 */
function play(opts: Play = {}): { ticks: Tick[]; run: FlashTime } {
	const frame = opts.frame ?? 1000 / 60;
	const run = flashTime(FLASH_MS);
	let now = opts.t0 ?? 5000.123;
	beginFlash(run, now);
	const ticks: Tick[] = [];
	let settleAt = Number.POSITIVE_INFINITY;
	let stalled = false;
	for (let i = 0; i < 2000; i++) {
		let called = false;
		let blocked = 0;
		if (now >= settleAt) run.settled = true;
		const on = advanceFlash(run, now, FLASH_PEAK, (at) => {
			called = true;
			blocked = opts.blocks ?? 0;
			const pending = opts.settles !== undefined;
			if (pending) settleAt = at + Math.max(opts.settles ?? 0, blocked);
			swapped(run, at, pending);
		});
		ticks.push({ now, u: run.u, held: run.held, swap: called });
		if (!on) return { ticks, run };
		// The draw: a solid frame has now been on screen.
		if (run.stage === 'in' && run.u >= FLASH_SOLID_FROM) run.solidDrawn = true;
		let next = frame;
		if (called) next = blocked + frame + (opts.layout ?? 0);
		if (opts.stallBeforePeak && !stalled && run.u < FLASH_SOLID_FROM && run.u > 0.2) {
			stalled = true;
			next = opts.stallBeforePeak;
		}
		now += next;
	}
	throw new Error('the flash never ended');
}

/** What must hold of every flash, whatever swap() does. */
function sound(ticks: Tick[], label: string): { at: number } {
	const at = ticks.findIndex((t) => t.swap);
	assert.ok(at > 0, `${label}: swap() was never called`);
	assert.equal(ticks.filter((t) => t.swap).length, 1, `${label}: swap() was called more than once`);
	// Up to the swap it has not passed the peak.
	for (let i = 0; i < at; i++) {
		assert.ok(ticks[i].u <= FLASH_PEAK + 1e-9, `${label}: past the peak before the swap`);
	}
	// The tick that calls swap() is drawn at the peak, exactly.
	assert.ok(
		Math.abs(ticks[at].u - FLASH_PEAK) < 1e-9,
		`${label}: at the swap the flash stands at ${ticks[at].u}, not at its peak`,
	);
	// From the swap on: never under the peak, never backwards.
	for (let i = at + 1; i < ticks.length; i++) {
		assert.ok(
			ticks[i].u >= FLASH_PEAK - 1e-9,
			`${label}: ${Math.round(ticks[i].now - ticks[at].now)} ms after the swap the flash is under its peak again (${ticks[i].u})`,
		);
		assert.ok(
			ticks[i].u >= ticks[i - 1].u - 1e-9,
			`${label}: ${Math.round(ticks[i].now - ticks[at].now)} ms after the swap the flash goes backwards (${ticks[i - 1].u} to ${ticks[i].u})`,
		);
	}
	// And at no time at all does it go backwards.
	for (let i = 1; i < ticks.length; i++) {
		assert.ok(ticks[i].u >= ticks[i - 1].u - 1e-9, `${label}: backwards at tick ${i}`);
	}
	return { at };
}

test('a swap that takes no time: the flash is its own length', () => {
	const { ticks } = play();
	sound(ticks, 'instant');
	const length = ticks[ticks.length - 1].now - ticks[0].now;
	assert.ok(Math.abs(length - FLASH_MS) <= 2 * (1000 / 60), `it took ${length} ms`);
});

test('a swap that blocks 100 ms: at the peak when it returns, never under it, never backwards', () => {
	for (const frame of [1000 / 60, 1000 / 120, 1000 / 30]) {
		for (const blocks of [100, 117, 35, 20, 250, 600]) {
			for (const layout of [0, 30, 80]) {
				const label = `frames ${frame.toFixed(1)} ms, swap ${blocks} ms, layout ${layout} ms`;
				const { ticks } = play({ frame, blocks, layout });
				const { at } = sound(ticks, label);
				// The first tick after the swap goes on by a frame's worth at most: the block is not played through.
				const step = (ticks[at + 1].u - ticks[at].u) * FLASH_MS;
				assert.ok(
					step <= SWAP_FRAME_MS + 1e-6,
					`${label}: the flash jumped ${step} ms over the swap`,
				);
				assert.ok(step > 0, `${label}: the flash did not move on after the swap`);
				// The fade is then played whole: what is left of the flash takes what is left of its length.
				const rest = ticks[ticks.length - 1].now - ticks[at + 1].now;
				const due = (1 - ticks[at + 1].u) * FLASH_MS;
				assert.ok(
					Math.abs(rest - due) <= frame + 1e-6,
					`${label}: the fade took ${rest} ms of ${due}`,
				);
			}
		}
	}
});

test('whenever the flash begins against the frames, the same holds', () => {
	for (let k = 0; k < 400; k++) {
		const { ticks } = play({ blocks: 100, t0: 1000 + k * 0.0417 });
		sound(ticks, `start ${k}`);
	}
});

test('a swap that leaves a promise: held at the peak until it settles, then on from the peak', () => {
	for (const blocks of [0, 60, 100]) {
		for (const settles of [0, 150, 400]) {
			const label = `swap blocks ${blocks} ms, settles after ${settles} ms`;
			const { ticks } = play({ blocks, settles, layout: 40 });
			const { at } = sound(ticks, label);
			const wait = Math.max(blocks, settles);
			for (let i = at; i < ticks.length && ticks[i].now - ticks[at].now <= wait; i++) {
				assert.ok(
					Math.abs(ticks[i].u - FLASH_PEAK) < 1e-9,
					`${label}: it left the peak while waiting`,
				);
			}
			const length = ticks[ticks.length - 1].now - ticks[0].now;
			assert.ok(
				length >= FLASH_MS + wait - 1,
				`${label}: the wait was played through (${length} ms)`,
			);
		}
	}
});

test('a promise that never settles is waited for only so long', () => {
	const { ticks } = play({ settles: 1e9 });
	const { at } = sound(ticks, 'never');
	const length = ticks[ticks.length - 1].now - ticks[at].now;
	assert.ok(
		length >= HOLD_MAX_MS && length <= HOLD_MAX_MS + FLASH_MS,
		`it went on ${length} ms after the swap`,
	);
});

test('a stall that jumps the solid stretch: the peak is shown first, the swap comes a tick later', () => {
	const { ticks } = play({ stallBeforePeak: 300, blocks: 100 });
	const { at } = sound(ticks, 'stall');
	assert.ok(
		Math.abs(ticks[at - 1].u - FLASH_PEAK) < 1e-9,
		'the tick before the swap was not drawn at the peak',
	);
});
