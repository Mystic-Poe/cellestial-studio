// The hand-off from the loader (sky/intro.ts): Cellestial's star has a place
// in every frame of it. Round 2 found the frame where it had none: the eased
// value came to a hair over 1 just under the end, and the pose raised a
// negative number to a power.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { smooth as lightSmooth } from './fx/light.ts';
import { HANDOFF, smoother as loaderSmoother, smoothstep } from './loader/timeline.ts';
import { introPose, smoother } from './sky/intro.ts';

const word = new DataView(new ArrayBuffer(8));
/** The next number below `x` (x > 0). */
const below = (x: number): number => {
	word.setFloat64(0, x);
	word.setBigUint64(0, word.getBigUint64(0) - 1n);
	return word.getFloat64(0);
};

// The loader's star on a desktop and on a phone, and its place in the sky.
const CASES = [
	{ from: { x: 842.3, y: 371.9, r: 3.1 }, to: { x: 720, y: 450, r: 27.029037399580318 } },
	{ from: { x: 251.7, y: 398.2, r: 1.4 }, to: { x: 195, y: 422, r: 17.55 } },
	{ from: { x: 100, y: 800, r: 0 }, to: { x: 195, y: 422, r: 17.55 } },
];
const SWELL = 0.12;

/** What the loader tells the sky at second `u` of the hand-off (painter.handoff). */
const told = (u: number) => smoothstep(0, 1, Math.min(1, Math.max(0, u / HANDOFF)));

function whole(t: number, label: string): void {
	for (const { from, to } of CASES) {
		const p = introPose(t, from, to, SWELL);
		assert.ok(
			Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.r),
			`${label}: the pose at t = ${t} is (${p.x}, ${p.y}, ${p.r})`,
		);
		const [x0, x1] = from.x < to.x ? [from.x, to.x] : [to.x, from.x];
		const [y0, y1] = from.y < to.y ? [from.y, to.y] : [to.y, from.y];
		assert.ok(
			p.x >= x0 - 1e-9 && p.x <= x1 + 1e-9,
			`${label}: x ${p.x} is off its path at t = ${t}`,
		);
		assert.ok(
			p.y >= y0 - 1e-9 && p.y <= y1 + 1e-9,
			`${label}: y ${p.y} is off its path at t = ${t}`,
		);
		assert.ok(p.r >= 0, `${label}: r ${p.r} at t = ${t}`);
	}
}

test('the eases never leave 0 to 1: one ulp at a time up to 1', () => {
	let t = 1;
	for (let i = 0; i < 2_000_000; i++) {
		t = below(t);
		for (const [name, ease] of [
			['sky', smoother],
			['loader', loaderSmoother],
		] as const) {
			const e = ease(t);
			assert.ok(e >= 0 && e <= 1, `${name}: smoother(${t}) = ${e}`);
		}
	}
});

test('the eases never leave 0 to 1: steps of 1e-9 over the last and the first 2 thousandths', () => {
	for (let d = 0; d < 2e-3; d += 1e-9) {
		for (const t of [1 - d, d]) {
			const e = smoother(t);
			assert.ok(e >= 0 && e <= 1, `smoother(${t}) = ${e}`);
			const l = loaderSmoother(t);
			assert.ok(l >= 0 && l <= 1, `the loader's smoother(${t}) = ${l}`);
		}
	}
	for (const t of [-1, 0, 1, 2, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
		const e = smoother(t);
		assert.ok(e >= 0 && e <= 1, `smoother(${t}) = ${e}`);
	}
});

test('the star has a place at every t up to 1: one ulp at a time', () => {
	let t = 1;
	for (let i = 0; i < 300_000; i++) {
		t = below(t);
		whole(t, 'ulp');
	}
});

test('the star has a place at every t up to 1: steps of 1e-9', () => {
	for (let d = 0; d < 2e-3; d += 1e-9) whole(1 - d, '1e-9');
	for (let t = 0; t <= 1; t += 1 / 4096) whole(t, 'coarse');
});

test('the star has a place at every moment the loader can name', () => {
	// The last frames of the hand-off, a nanosecond apart, as the loader passes them on.
	for (let d = 0; d < 3e-3; d += 1e-9) whole(told(HANDOFF * (1 - d)), 'hand-off');
	// And one ulp at a time under the end.
	let u = HANDOFF;
	for (let i = 0; i < 300_000; i++) {
		u = below(u);
		whole(told(u), 'hand-off, ulp');
	}
	// Whatever else it might be handed.
	for (const t of [Number.NaN, -1, 2, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
		whole(t, 'odd');
	}
});

test("the pose begins at the loader's star and ends on the sky's, exactly", () => {
	for (const { from, to } of CASES) {
		const a = introPose(0, from, to, SWELL);
		assert.equal(a.x, from.x);
		assert.equal(a.y, from.y);
		assert.equal(a.r, Math.max(from.r, 0.5));
		assert.deepEqual(introPose(1, from, to, SWELL), to);
		// The frame before the end is the end's picture to within a thousandth of a pixel.
		const near = introPose(told(HANDOFF - 1e-4), from, to, SWELL);
		assert.ok(
			Math.abs(near.x - to.x) < 1e-3 && Math.abs(near.y - to.y) < 1e-3,
			'the last frame is not at the end',
		);
		assert.ok(Math.abs(near.r - to.r) < 1e-3, `the last frame's size ${near.r} against ${to.r}`);
	}
});

test('the star never goes back along its path', () => {
	const { from, to } = CASES[0];
	let last = introPose(0, from, to, SWELL);
	for (let i = 1; i <= 20000; i++) {
		const p = introPose(i / 20000, from, to, SWELL);
		assert.ok(p.x <= last.x + 1e-9, `x turns back at ${i / 20000}`);
		assert.ok(p.y >= last.y - 1e-9, `y turns back at ${i / 20000}`);
		last = p;
	}
});

test('the cubic ease, which the warp, the flash and the loader raise to powers, never leaves 0 to 1', () => {
	// Unlike the quintic it does not overshoot; this keeps it so.
	const eases = [
		(t: number) => smoothstep(0, 1, t),
		(t: number) => lightSmooth(0, 1, t),
		(t: number) => smoothstep(0.86, 1, t),
		(t: number) => lightSmooth(0.9, 1, t),
	];
	let t = 1;
	for (let i = 0; i < 1_000_000; i++) {
		t = below(t);
		for (const ease of eases) {
			const e = ease(t);
			assert.ok(e >= 0 && e <= 1, `ease(${t}) = ${e}`);
		}
	}
	for (let d = 0; d < 2e-3; d += 1e-9) {
		for (const ease of eases) {
			for (const x of [1 - d, d, 0.86 + d, 0.9 + d]) {
				const e = ease(x);
				assert.ok(e >= 0 && e <= 1, `ease(${x}) = ${e}`);
			}
		}
	}
});
