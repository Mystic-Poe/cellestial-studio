// D2, the instant a falling star meets the ground: a blue-white flash at the
// point, jagged rays thrown down into the soil, a shock of light running both
// ways along the ground line, and sparks kicked up that arc and fall back.
// The Roots grow their mycelium from here; this is what sets it off.
//
// draw() is a pure function of the seed, the point and the time.
//
// A WHOLE SKY LANDS. Every star of the figure in front strikes like this
// (createImpact). The stars of the figures further on land as glints
// (createGlint): a point of light on the ground line and two or three sparks,
// nothing driven into the soil. Dozens play at once, drawn additively, so
// what is soft in each (the flash, the light in the soil, the haze round the
// rays) is drawn at the share the list gives it (`gain`, impacts.ts): a crowd
// glows about as much as one or two alone and never clips to a flat white
// shape, while every ray and spark stays as crisp as it is alone. And the
// sparks of all of them go down together (createSparks): hundreds of short
// streaks a frame as a few dozen strokes.

import type { Strike } from './impacts.ts';
import { BLUE_INK, type Ctx, clamp, easeOut, glow, PALE_INK, smooth, spot } from './light.ts';
import { hash, rng } from './rng.ts';

export const IMPACT_MS = 760;
/** A glint is over sooner. */
export const GLINT_MS = 420;

export interface Impact extends Strike {
	/**
	 * The frame at `u`, 0 to 1 of its length, without its sparks. `gain` is
	 * the share of its soft light it may give, 0 to 1 (1 when it is alone),
	 * and `wide` the share of the light it spreads along the ground.
	 */
	draw(g: Ctx, u: number, gain?: number, wide?: number): void;
	/** Its sparks at `u`, added to the frame's batch. */
	sparks(batch: Sparks, u: number): void;
}

/** The sparks of every strike in a frame, gathered by width and strength and stroked once each. */
export interface Sparks {
	/** A streak from (x0, y0) to (x1, y1): `width` is its scale (1 is a full burst's on a wide screen), `life` its strength. */
	streak(x0: number, y0: number, x1: number, y1: number, width: number, life: number): void;
	/** A round glint, `size` across. */
	glint(x: number, y: number, size: number, alpha: number): void;
	/** Draw them all, additively, and empty the batch. */
	flush(g: Ctx): void;
}

/** Streaks are gathered by width, each step this much wider than the last, and in this many steps of strength. */
const SPARK_WIDTH_RATIO = 1.15;
const SPARK_WIDTH_ZERO = 24;
const SPARK_LIFE_STEPS = 8;

export function createSparks(): Sparks {
	/** By width step and strength step: x0, y0, x1, y1, … */
	const streaks = new Map<number, number[]>();
	/** x, y, size, alpha, … */
	const glints: number[] = [];
	return {
		streak(x0, y0, x1, y1, width, life) {
			if (!(width > 0)) return;
			const wq = clamp(
				Math.round(Math.log(width) / Math.log(SPARK_WIDTH_RATIO)) + SPARK_WIDTH_ZERO,
				0,
				2 * SPARK_WIDTH_ZERO,
			);
			const lq = Math.max(1, Math.round(clamp(life) * SPARK_LIFE_STEPS));
			const key = wq * 16 + lq;
			let list = streaks.get(key);
			if (!list) {
				list = [];
				streaks.set(key, list);
			}
			list.push(x0, y0, x1, y1);
		},
		glint(x, y, size, alpha) {
			if (alpha > 0.01 && size > 0.5) glints.push(x, y, size, alpha);
		},
		flush(g) {
			g.save();
			g.globalCompositeOperation = 'lighter';
			g.lineCap = 'round';
			for (const [key, list] of streaks) {
				if (list.length === 0) continue;
				const width = SPARK_WIDTH_RATIO ** (Math.floor(key / 16) - SPARK_WIDTH_ZERO);
				const life = (key % 16) / SPARK_LIFE_STEPS;
				g.beginPath();
				for (let p = 0; p < list.length; p += 4) {
					g.moveTo(list[p], list[p + 1]);
					g.lineTo(list[p + 2], list[p + 3]);
				}
				g.strokeStyle = BLUE_INK;
				g.globalAlpha = 0.55 * life;
				g.lineWidth = 5 * width;
				g.stroke();
				g.strokeStyle = PALE_INK;
				g.globalAlpha = life;
				g.lineWidth = 1.9 * width;
				g.stroke();
				list.length = 0;
			}
			const pale = glow('pale');
			for (let p = 0; p < glints.length; p += 4) {
				const size = glints[p + 2];
				g.globalAlpha = glints[p + 3];
				g.drawImage(pale, glints[p] - size / 2, glints[p + 1] - size / 2, size, size);
			}
			glints.length = 0;
			g.restore();
		},
	};
}

/** How much soft light a burst has left at `u`, against its brightest. */
export const burstHeat = (u: number): number => (u < 0 || u >= 1 ? 0 : 1 - smooth(0.05, 0.9, u));
/** The same for a glint. */
export const glintHeat = (u: number): number => (u < 0 || u >= 1 ? 0 : Math.exp(-u / 0.22));

interface Ray {
	/** A jagged polyline, relative to the point of impact: x0, y0, x1, y1, … */
	pts: number[];
	cum: number[];
	len: number;
	/** When it starts to grow, in u. */
	delay: number;
	id: number;
}

interface Spark {
	/** Velocity as it leaves, px per second; up is negative. */
	vx: number;
	vy: number;
	/** When it leaves, in seconds. */
	delay: number;
	size: number;
}

/** A crooked line from (0, 0) at `angle`, `len` long; `kink` is how far it strays, as a share of `len`. */
function jag(rand: () => number, angle: number, len: number, kink: number): number[] {
	const steps = Math.max(4, Math.round(len / 34) + Math.floor(rand() * 2));
	const ux = Math.cos(angle);
	const uy = Math.sin(angle);
	const pts = [0, 0];
	for (let k = 1; k <= steps; k++) {
		const along = (len * (k - 0.25 + rand() * 0.5)) / steps;
		const off = (rand() - 0.5) * 2 * kink * len * (k === steps ? 0.4 : 1);
		pts.push(ux * along - uy * off, uy * along + ux * off);
	}
	return pts;
}

function measure(pts: number[], id: number, delay: number): Ray {
	// Nothing a ray does may rise above the ground.
	for (let p = 3; p < pts.length; p += 2) pts[p] = Math.max(1.5, pts[p]);
	const cum = [0];
	for (let k = 1; k < pts.length / 2; k++) {
		cum.push(cum[k - 1] + Math.hypot(pts[2 * k] - pts[2 * k - 2], pts[2 * k + 1] - pts[2 * k - 1]));
	}
	return { pts, cum, len: cum[cum.length - 1], delay, id };
}

/** Add a ray, from its root out to `to` along it, to the current path. */
function addRay(g: Ctx, x: number, y: number, r: Ray, to: number): void {
	if (to <= 0.5) return;
	const { pts, cum } = r;
	g.moveTo(x + pts[0], y + pts[1]);
	let k = 1;
	while (k < cum.length - 1 && cum[k] < to) {
		g.lineTo(x + pts[2 * k], y + pts[2 * k + 1]);
		k++;
	}
	const t = clamp((to - cum[k - 1]) / (cum[k] - cum[k - 1] || 1));
	g.lineTo(
		x + pts[2 * k - 2] + (pts[2 * k] - pts[2 * k - 2]) * t,
		y + pts[2 * k - 1] + (pts[2 * k + 1] - pts[2 * k - 1]) * t,
	);
}

/**
 * Every star that falls strikes the ground, so a sky's worth of these play at
 * once: each is this share of the one great burst the effect was first drawn
 * as, with fewer rays and sparks to match. All of them are alike.
 */
export const IMPACT_SIZE = 0.56;

export function createImpact(
	seed: number,
	x: number,
	y: number,
	w: number,
	h: number,
	size = IMPACT_SIZE,
): Impact {
	const rand = rng(seed);
	/** A phone's burst is nearly as big as a desktop's: it is felt, not measured. */
	const s = clamp(Math.sqrt(w * h) / 700, 0.9, 1.6) * size;
	const gravity = 2500 * s;
	/** How many rays and sparks, against the great burst's. */
	const few = clamp(0.25 + 0.75 * size, 0.5, 1);

	// Rays into the ground: every way below the horizon, longest straight down.
	const rays: Ray[] = [];
	const count = Math.round((11 + Math.floor(rand() * 4)) * few);
	for (let k = 0; k < count; k++) {
		const a = 0.12 + ((k + 0.15 + rand() * 0.7) / count) * (Math.PI - 0.24);
		const len = s * (80 + 150 * Math.sin(a) ** 1.3 * (0.5 + rand() * 0.6) + rand() * 45);
		const pts = jag(rand, a, len, 0.1);
		const ray = measure(pts, rays.length, rand() * 0.025);
		rays.push(ray);
		// Most fork on the way, some twice.
		const forks = rand() < 0.65 ? (rand() < 0.3 ? 2 : 1) : 0;
		for (let f = 0; f < forks; f++) {
			const at = 1 + Math.floor(rand() * (pts.length / 2 - 2));
			const side = rand() < 0.5 ? -1 : 1;
			const fork = jag(rand, a + side * (0.3 + rand() * 0.5), len * (0.3 + rand() * 0.3), 0.14);
			for (let p = 0; p < fork.length; p += 2) {
				fork[p] += pts[2 * at];
				fork[p + 1] += pts[2 * at + 1];
			}
			rays.push(measure(fork, rays.length, ray.delay + (0.1 * ray.cum[at]) / ray.len));
		}
	}

	// Sparks: thrown up and outward, pulled back down to the ground line.
	const sparks: Spark[] = [];
	const thrown = Math.round((18 + Math.floor(rand() * 8)) * few);
	for (let k = 0; k < thrown; k++) {
		const side = k % 2 === 0 ? 1 : -1;
		const lean = (0.1 + rand() ** 0.8 * 1.15) * side;
		const speed = s * (300 + rand() * 640);
		sparks.push({
			vx: Math.sin(lean) * speed,
			// None is thrown so high that it is still in the air at the end.
			vy: -Math.min(Math.cos(lean) * speed, 0.33 * gravity),
			delay: rand() * 0.04,
			size: 0.65 + rand() ** 2 * 0.9,
		});
	}

	/** How far the shock runs each way along the ground. */
	const run = Math.min(0.5 * w + 120, s * 620);

	const draw = (g: Ctx, u: number, gain = 1, wide = 1): void => {
		if (u < 0 || u >= 1) return;
		const ms = u * IMPACT_MS;
		const beat = Math.floor(ms / 34);
		/** The whole strike stutters like lightning as it dies. */
		const strobe = u < 0.12 ? 1 : 0.72 + 0.28 * hash(beat, seed);
		g.save();
		g.globalCompositeOperation = 'lighter';
		g.lineCap = 'round';
		g.lineJoin = 'round';

		const reach = run * easeOut(clamp(u / 0.55));
		const shock = (1 - smooth(0.28, 0.82, u)) * smooth(0, 0.03, u);
		const blue = glow('blue');
		const hot = glow('pale');

		// Everything below is in the ground: nothing of it shows above the line.
		g.save();
		g.beginPath();
		// (Wider and deeper than any frame, so a resize mid-burst cannot cut it short.)
		g.rect(-1e4, y, 2e4, 2e4);
		g.clip();

		// Light soaking into the soil under the point, wide and deep.
		const soak = (1 - smooth(0.08, 0.94, u)) * smooth(0, 0.03, u);
		if (soak > 0.01) {
			const spread = easeOut(clamp(u / 0.4));
			const rx = s * (230 + 250 * spread);
			const ry = s * (150 + 160 * spread);
			g.globalAlpha = 0.85 * soak * strobe * wide;
			g.drawImage(blue, x - rx, y - ry, rx * 2, ry * 2);
			g.globalAlpha = 0.9 * (1 - smooth(0.02, 0.5, u)) * gain;
			g.drawImage(hot, x - s * 150, y - s * 95, s * 300, s * 190);
		}
		// And running out under the shock.
		if (shock > 0.01) {
			g.globalAlpha = 0.7 * shock * wide;
			for (const side of [-1, 1]) {
				const hx = x + side * reach;
				g.drawImage(blue, hx - s * 190, y - s * 46, s * 380, s * 92);
			}
		}

		// The rays: out in an instant, white-hot, thick at the root, flickering as they die.
		const fade = (1 - smooth(0.3, 0.84, u)) * strobe;
		if (fade > 0.01) {
			for (let pass = 0; pass < 5; pass++) {
				g.beginPath();
				for (const r of rays) {
					const grown = easeOut(clamp((u - r.delay) / 0.14));
					// A ray that has flickered out for this beat is left out of the core.
					if (pass >= 3 && u > 0.22 && hash(r.id, beat + seed) < 0.28) continue;
					// The last pass is the root only: the first part of each ray, drawn thicker.
					addRay(g, x, y, r, r.len * grown * (pass === 4 ? 0.42 : 1));
				}
				// (The first two passes are the haze round the rays: soft light, shared in a crowd.)
				if (pass === 0) {
					g.strokeStyle = BLUE_INK;
					g.globalAlpha = 0.1 * fade * gain;
					g.lineWidth = 16 * s;
				} else if (pass === 1) {
					g.strokeStyle = BLUE_INK;
					g.globalAlpha = 0.3 * fade * gain;
					g.lineWidth = 7 * s;
				} else if (pass === 2) {
					g.strokeStyle = BLUE_INK;
					g.globalAlpha = 0.9 * fade;
					g.lineWidth = 3.2 * s;
				} else if (pass === 3) {
					g.strokeStyle = PALE_INK;
					g.globalAlpha = fade;
					g.lineWidth = 1.5 * s;
				} else {
					// (White-hot at the root: in a crowd the roots lie side by side, and this is shared too.)
					g.strokeStyle = PALE_INK;
					g.globalAlpha = 0.85 * fade * (0.2 + 0.8 * gain);
					g.lineWidth = 3 * s;
				}
				g.stroke();
			}
		}
		g.restore();

		// The shock along the ground line: a bright head each way, the line lit behind it.
		if (shock > 0.01) {
			for (const side of [-1, 1]) {
				const hx = x + side * reach;
				const tail = x + side * reach * smooth(0.1, 0.7, u);
				if (Math.abs(hx - tail) < 1) continue;
				const core = g.createLinearGradient(tail, 0, hx, 0);
				core.addColorStop(0, 'rgb(0 0 0 / 0)');
				core.addColorStop(1, PALE_INK);
				const skirt = g.createLinearGradient(tail, 0, hx, 0);
				skirt.addColorStop(0, 'rgb(0 0 0 / 0)');
				skirt.addColorStop(1, BLUE_INK);
				g.beginPath();
				g.moveTo(tail, y);
				g.lineTo(hx, y);
				g.strokeStyle = skirt;
				g.globalAlpha = 0.55 * shock * wide;
				g.lineWidth = 10 * s;
				g.stroke();
				g.strokeStyle = core;
				g.globalAlpha = shock;
				g.lineWidth = 2.4 * s;
				g.stroke();
				g.globalAlpha = shock * gain;
				g.drawImage(hot, hx - 60 * s, y - 13 * s, 120 * s, 26 * s);
			}
		}

		// The flash itself: white-hot, wide along the ground, over in a few frames.
		const flash = Math.exp(-u / 0.1);
		if (flash > 0.02) {
			const grow = easeOut(clamp(u / 0.2));
			g.globalAlpha = clamp(flash * 1.3) * gain;
			spot(g, 'pale', x, y, s * (250 + 270 * grow));
			g.globalAlpha = clamp(flash * 1.7) * gain;
			spot(g, 'pale', x, y, s * 150);
			// A hard glint along the ground: a strike, not a bulb.
			const gw = s * (420 + 520 * grow);
			g.globalAlpha = clamp(flash * 1.4) * gain;
			g.drawImage(hot, x - gw / 2, y - 9 * s, gw, 18 * s);
		}
		g.restore();
	};

	// The sparks: each a short streak along its own arc, gone where it lands.
	const throwSparks = (batch: Sparks, u: number): void => {
		if (u < 0 || u >= 1) return;
		const ms = u * IMPACT_MS;
		for (const sp of sparks) {
			const t = ms / 1000 - sp.delay;
			if (t <= 0) continue;
			const land = (-2 * sp.vy) / gravity;
			if (t >= land) {
				// A glint on the ground where it came down.
				const since = (t - land) * 1000;
				if (since < 110)
					batch.glint(x + sp.vx * land, y, 22 * s * sp.size, 0.8 * (1 - since / 110));
				continue;
			}
			const t0 = Math.max(0, t - 0.034);
			const px = x + sp.vx * t;
			const py = y + sp.vy * t + 0.5 * gravity * t * t;
			const life = 1 - 0.5 * (t / land) ** 2;
			batch.streak(
				x + sp.vx * t0,
				y + sp.vy * t0 + 0.5 * gravity * t0 * t0,
				px,
				py,
				s * sp.size,
				life,
			);
			batch.glint(px, py, 20 * s * sp.size, life);
		}
	};

	return {
		x,
		ms: IMPACT_MS,
		// Two bursts share their soft light when their white-hot middles would meet.
		reach: 100 * s,
		heat: burstHeat,
		draw,
		sparks: throwSparks,
	};
}

/**
 * A star of a figure further on meets the ground: a glint on the ground line
 * and two or three sparks, and nothing in the soil. `scale` is the screen's
 * (a phone's are smaller), `far` how near the star was, 0 to 1 of the nearest.
 */
export function createGlint(
	seed: number,
	x: number,
	y: number,
	w: number,
	h: number,
	scale = 1,
	far = 0.3,
): Impact {
	const rand = rng(seed);
	const s = clamp(Math.sqrt(w * h) / 700, 0.9, 1.6) * scale * (0.5 + clamp(far));
	const gravity = 1900 * s;
	const size = s * 46;
	const sparks: Spark[] = [];
	const thrown = far > 0.2 ? 3 : 2;
	for (let k = 0; k < thrown; k++) {
		const side = (k + (seed & 1)) % 2 === 0 ? 1 : -1;
		const lean = (0.15 + rand() * 0.9) * side;
		const speed = s * (150 + rand() * 230);
		sparks.push({
			vx: Math.sin(lean) * speed,
			// Down again well before the glint is over.
			vy: -Math.min(Math.cos(lean) * speed, 0.15 * gravity),
			delay: rand() * 0.03,
			size: 0.5 + rand() * 0.35,
		});
	}

	const draw = (g: Ctx, u: number, gain = 1): void => {
		if (u < 0 || u >= 1) return;
		const fade = glintHeat(u) * smooth(0, 0.04, u) * gain;
		if (fade < 0.01) return;
		const hot = glow('pale');
		g.save();
		g.globalCompositeOperation = 'lighter';
		g.globalAlpha = clamp(fade);
		g.drawImage(hot, x - size / 2, y - size / 2, size, size);
		// The same hard glint along the ground as a burst's, a fifth as wide.
		const gw = size * (1.6 + 1.4 * easeOut(clamp(u / 0.3)));
		g.globalAlpha = clamp(fade * 0.9);
		g.drawImage(hot, x - gw / 2, y - size * 0.07, gw, size * 0.14);
		g.restore();
	};

	const throwSparks = (batch: Sparks, u: number): void => {
		if (u < 0 || u >= 1) return;
		const ms = u * GLINT_MS;
		for (const sp of sparks) {
			const t = ms / 1000 - sp.delay;
			if (t <= 0) continue;
			const land = (-2 * sp.vy) / gravity;
			if (t >= land) continue;
			const t0 = Math.max(0, t - 0.034);
			const px = x + sp.vx * t;
			const py = y + sp.vy * t + 0.5 * gravity * t * t;
			const life = 1 - 0.5 * (t / land) ** 2;
			batch.streak(
				x + sp.vx * t0,
				y + sp.vy * t0 + 0.5 * gravity * t0 * t0,
				px,
				py,
				s * sp.size,
				life,
			);
			batch.glint(px, py, 14 * s * sp.size, life);
		}
	};

	return {
		x,
		ms: GLINT_MS,
		// Two glints share their light when they overlap.
		reach: size / 2,
		heat: glintHeat,
		draw,
		sparks: throwSparks,
	};
}
