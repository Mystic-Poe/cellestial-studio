// Pure star-field math. No DOM: unit-tested with node --test.

export type Rand = () => number;

/** Small, fast, seedable PRNG so the sky is the same on every visit. */
export function mulberry32(seed: number): Rand {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export const STAR_COLORS = {
	site: '94,242,214',
	systems: '139,233,255',
	app: '195,166,255',
	companion: '255,210,122',
	slot: '163,184,194',
	white: '220,235,240',
} as const;

/** 1 at the light, 0 at `reach`, smoothstep in between (no hard edge). */
export function wakeLevel(distance: number, reach: number): number {
	if (reach <= 0 || distance >= reach) return 0;
	const u = 1 - distance / reach;
	return u * u * (3 - 2 * u);
}
