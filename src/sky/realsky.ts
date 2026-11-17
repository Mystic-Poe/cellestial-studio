// Places the catalog sky for a moment and a screen. Pure: index.ts draws the result.

import {
	bvToRgb,
	DENVER,
	galacticToEquatorial,
	localSiderealDeg,
	magToAlpha,
	magToRadius,
	milkyWayBrightness,
	project,
	toHorizontal,
	type View,
} from './astro.ts';
import { mulberry32 } from './field.ts';

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
	mag: number;
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
		centreAlt: phone ? 60 : 56,
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
			mag,
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

export interface Glow {
	x: number;
	y: number;
	/** Blob radius in px. */
	r: number;
	/** Brightness 0–1, already faded toward the horizon. */
	a: number;
}

/**
 * The Milky Way as soft blobs sampled along the galactic plane. Recomputed
 * with the stars (once a minute), then painted to an offscreen layer.
 */
export function placeMilkyWay(ms: number, view: View, step = 3): Glow[] {
	const lst = localSiderealDeg(ms, DENVER.lon);
	const scale = view.width / 2 / (2 * Math.tan((view.fov * Math.PI) / 720));
	const r = ((step * Math.PI) / 180) * scale * 1.6;
	const out: Glow[] = [];
	for (let l = 0; l < 360; l += step) {
		for (let b = -18; b <= 18; b += step) {
			const a = milkyWayBrightness(l, b);
			if (a < 0.04) continue;
			const eq = galacticToEquatorial(l, b);
			const h = toHorizontal(eq.ra, eq.dec, DENVER.lat, lst);
			if (h.alt < -2) continue;
			const p = project(h, view);
			if (!p || p.x < -r || p.x > view.width + r || p.y < -r || p.y > view.height * 1.6 + r)
				continue;
			const ext = h.alt >= 15 ? 1 : Math.max(0, (h.alt + 2) / 17);
			out.push({ x: p.x, y: p.y, r, a: a * ext });
		}
	}
	return out;
}

export interface FaintStar {
	ra: number;
	dec: number;
	/** 0–1 brightness. */
	a: number;
}

/**
 * The unresolved background a dark sky shows beyond the catalog's limit:
 * deterministic, fixed in sky coordinates (so it turns with the real sky),
 * and crowded toward the Milky Way the way the real faint stars are.
 */
export function makeFaintField(count: number, seed = 20261116): FaintStar[] {
	const rand = mulberry32(seed);
	const out: FaintStar[] = [];
	while (out.length < count) {
		const l = rand() * 360;
		// 55% spread over the sphere, 45% hugging the galactic plane.
		const b =
			rand() < 0.55
				? (Math.asin(rand() * 2 - 1) * 180) / Math.PI
				: (rand() - 0.5) * 2 * 12 * Math.sqrt(-Math.log(Math.max(1e-6, rand())));
		if (Math.abs(b) > 90) continue;
		const eq = galacticToEquatorial(l, b);
		out.push({ ra: eq.ra, dec: eq.dec, a: 0.25 + rand() * 0.75 });
	}
	return out;
}

/** Faint stars on screen for a moment, faded toward the horizon. */
export function placeFaintField(field: FaintStar[], ms: number, view: View): Glow[] {
	const lst = localSiderealDeg(ms, DENVER.lon);
	const out: Glow[] = [];
	for (const f of field) {
		const h = toHorizontal(f.ra, f.dec, DENVER.lat, lst);
		if (h.alt < 1) continue;
		const p = project(h, view);
		if (!p || p.x < 0 || p.x > view.width || p.y < 0 || p.y > view.height * 1.6) continue;
		const ext = h.alt >= 15 ? 1 : h.alt / 15;
		out.push({ x: p.x, y: p.y, r: 0.5 + f.a * 0.4, a: f.a * ext });
	}
	return out;
}
