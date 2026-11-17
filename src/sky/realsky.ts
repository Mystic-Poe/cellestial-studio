// Places the catalog sky for a moment and a screen. Pure: index.ts draws the result.

import {
	bvToRgb,
	DENVER,
	localSiderealDeg,
	magToAlpha,
	magToRadius,
	project,
	toHorizontal,
	type View,
} from './astro.ts';

export interface SkyData {
	/** [ra, dec, mag, bv] × 100, brightest first. */
	stars: number[][];
	/** Constellation name and polylines [ra, dec, ra, dec, …] × 100. */
	lines: { n: string; p: number[][] }[];
}

export interface PlacedStar {
	x: number;
	y: number;
	r: number;
	alpha: number;
	color: string;
	phase: number;
}

export interface PlacedConstellation {
	name: string;
	/** Polylines in screen px. Segments touching the ground are dropped. */
	polys: { x: number; y: number }[][];
	/** Every vertex above the horizon, for wake tests. */
	verts: { x: number; y: number }[];
	label: { x: number; y: number };
}

export interface PlacedSky {
	stars: PlacedStar[];
	constellations: PlacedConstellation[];
}

/** Field of view and tilt per screen shape: wide screens see more sky. */
export function viewFor(width: number, height: number): View {
	const phone = width < 768;
	return {
		centreAlt: phone ? 52 : 44,
		fov: phone ? 80 : width < 1200 ? 100 : 115,
		width,
		height,
	};
}

export function placeSky(data: SkyData, ms: number, view: View, magLimit: number): PlacedSky {
	const lst = localSiderealDeg(ms, DENVER.lon);
	const pad = 40;
	const onScreen = (p: { x: number; y: number }) =>
		p.x > -pad && p.x < view.width + pad && p.y > -pad && p.y < view.height * 1.6;

	const stars: PlacedStar[] = [];
	for (let i = 0; i < data.stars.length; i++) {
		const [ra, dec, mag100, bv] = data.stars[i];
		const mag = mag100 / 100;
		if (mag > magLimit) break; // brightest first
		const h = toHorizontal(ra / 100, dec / 100, DENVER.lat, lst);
		if (h.alt < 0) continue;
		const p = project(h, view);
		if (!p || !onScreen(p)) continue;
		stars.push({
			x: p.x,
			y: p.y,
			r: magToRadius(mag),
			alpha: magToAlpha(mag, h.alt),
			color: bvToRgb(bv / 100),
			phase: (i * 2.399) % (Math.PI * 2),
		});
	}

	const constellations: PlacedConstellation[] = [];
	for (const c of data.lines) {
		const polys: { x: number; y: number }[][] = [];
		const verts: { x: number; y: number }[] = [];
		for (const flat of c.p) {
			let run: { x: number; y: number }[] = [];
			for (let k = 0; k < flat.length; k += 2) {
				const h = toHorizontal(flat[k] / 100, flat[k + 1] / 100, DENVER.lat, lst);
				const p = h.alt >= 0 ? project(h, view) : null;
				if (p) {
					run.push(p);
					verts.push(p);
				} else {
					if (run.length > 1) polys.push(run);
					run = [];
				}
			}
			if (run.length > 1) polys.push(run);
		}
		if (polys.length === 0 || !verts.some(onScreen)) continue;
		const label = verts.reduce(
			(a, v) => ({ x: a.x + v.x / verts.length, y: a.y + v.y / verts.length }),
			{
				x: 0,
				y: 0,
			},
		);
		constellations.push({ name: c.n, polys, verts, label });
	}
	return { stars, constellations };
}

/**
 * How awake a constellation is, 0–1: its nearest star to the light decides.
 * `wake` maps a distance to 0–1 (the same falloff the stars use).
 */
export function constellationWake(
	c: PlacedConstellation,
	lx: number,
	ly: number,
	wake: (d: number) => number,
): number {
	let best = 0;
	for (const v of c.verts) best = Math.max(best, wake(Math.hypot(v.x - lx, v.y - ly)));
	return Math.min(1, best * 1.8);
}
