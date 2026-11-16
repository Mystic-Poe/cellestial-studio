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

const DUST_PALETTE = [
	STAR_COLORS.white,
	STAR_COLORS.white,
	STAR_COLORS.white,
	STAR_COLORS.site,
	STAR_COLORS.systems,
	STAR_COLORS.app,
];

export interface DustStar {
	x: number;
	y: number;
	r: number;
	phase: number;
	color: string;
	depth: number;
}

export function makeDust(count: number, rand: Rand): DustStar[] {
	return Array.from({ length: count }, () => ({
		x: rand(),
		y: rand(),
		r: 0.5 + rand() * 1.3,
		phase: rand() * Math.PI * 2,
		color: DUST_PALETTE[Math.floor(rand() * DUST_PALETTE.length)],
		depth: 0.3 + rand() * 0.7,
	}));
}

/** 1 at the light, 0 at `reach`, smoothstep in between (no hard edge). */
export function wakeLevel(distance: number, reach: number): number {
	if (reach <= 0 || distance >= reach) return 0;
	const u = 1 - distance / reach;
	return u * u * (3 - 2 * u);
}

export interface LitPoint {
	x: number;
	y: number;
	wake: number;
}

export interface Thread {
	a: number;
	b: number;
	alpha: number;
}

/**
 * Threads of light between awake stars that sit close together. Brightest
 * first, capped so a dense cluster can't cost a frame.
 */
export function selectThreads(
	points: LitPoint[],
	maxDist: number,
	minWake = 0.25,
	maxThreads = 60,
): Thread[] {
	const out: Thread[] = [];
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		if (p.wake < minWake) continue;
		for (let j = i + 1; j < points.length; j++) {
			const q = points[j];
			if (q.wake < minWake) continue;
			const d = Math.hypot(p.x - q.x, p.y - q.y);
			if (d >= maxDist) continue;
			out.push({ a: i, b: j, alpha: Math.min(p.wake, q.wake) * (1 - d / maxDist) });
		}
	}
	out.sort((m, n) => n.alpha - m.alpha);
	return out.slice(0, maxThreads);
}
