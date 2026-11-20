// Seeded numbers. Everything the effects layer draws at random is drawn from
// here, so a given seed and a given time always make the same frame.

export type Rng = () => number;

/** mulberry32: 0 ≤ n < 1, the same run for the same seed. */
export function rng(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** One number from two integers, 0 ≤ n < 1, with no state. */
export function hash(a: number, b = 0): number {
	let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
	h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
	h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
	return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** The seed that follows this one. */
export function nextSeed(seed: number): number {
	return (seed + 0x9e3779b9) >>> 0;
}

/**
 * Smooth noise along one axis, 0 to 1: a different value at every whole `x`,
 * eased between them. `lane` picks an unrelated strand of it.
 */
export function noise(x: number, lane = 0): number {
	const i = Math.floor(x);
	const f = x - i;
	const s = f * f * (3 - 2 * f);
	return hash(i, lane) * (1 - s) + hash(i + 1, lane) * s;
}
