// The hand-off from the loader (A5): where Cellestial's star stands on screen
// at each moment of it. Plain arithmetic and nothing else, so it can be swept
// in a test (../sky-intro.test.ts).
//
// The rule this file exists for: an eased value is a number from 0 to 1, and
// stays one. The quintic below, worked out in floating point, comes to a hair
// MORE than 1 for an argument a hair under 1 (0.9999999952 gave
// 1.000000000000001); one minus that is negative, a negative number to the
// power 1.3 is not a number, and for that one frame the star had no place and
// was not drawn. So the ease is capped where it is made, and the pose never
// raises anything below zero to a power.

import type { ScreenCircle } from '../contracts.ts';

const unit = (v: number) => Math.min(1, Math.max(0, v));

/** 0 to 1 with no speed and no acceleration at either end. Never under 0, never over 1. */
export const smoother = (t: number): number => {
	const c = unit(t);
	return unit(c * c * c * (c * (c * 6 - 15) + 10));
};

/** 0 to 1, eased. Never under 0, never over 1. */
const smooth = (t: number): number => {
	const c = unit(t);
	return unit(c * c * (3 - 2 * c));
};

/**
 * The star at `t` (0 to 1) of the hand-off: from `from`, where the loader's
 * little star stood, to `to`, its place in the sky. Across first, then down:
 * the arc of something let go. It swells by `swell` in mid-flight.
 * At 0 it is `from` (no smaller than half a pixel); at 1 it is `to`, exactly.
 * Every number it returns is finite for every `t`.
 */
export function introPose(
	t: number,
	from: ScreenCircle,
	to: ScreenCircle,
	swell: number,
): ScreenCircle {
	const c = unit(Number.isFinite(t) ? t : 1);
	const e = smoother(c);
	const ex = 1 - (1 - e) ** 1.3;
	const ey = e ** 1.3;
	const r0 = Math.max(from.r, 0.5);
	const r1 = Math.max(to.r, 0);
	if (c >= 1) return { x: to.x, y: to.y, r: r1 };
	return {
		x: from.x + (to.x - from.x) * ex,
		y: from.y + (to.y - from.y) * ey,
		r: r0 * (r1 / r0) ** smooth(c) * (1 + swell * Math.sin(Math.PI * c)),
	};
}
