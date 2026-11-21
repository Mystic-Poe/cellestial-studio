// G2, the launch back to the sky. The visitor goes UP, so the light comes
// DOWN: streaks pour past from a vanishing point high in the frame, few and
// slow, then longer, faster and thicker, until the frame is black, dense with
// streaks, under the flare of the light ahead. The page swaps the Roots for
// the sky under that cover (it is the black that covers: the flare is a light
// in it, strongest at the vanishing point and gone before the frame's far
// corners, not a pale sheet over everything). Then the streaks thin out, slow
// and are gone.
//
// draw() is a pure function of the seed, the frame size and the time.

import {
	BLACK_INK,
	BLUE_INK,
	BRASS_INK,
	type Ctx,
	clamp,
	glow,
	lightStops,
	PALE_INK,
	smooth,
} from './light.ts';
import { rng } from './rng.ts';

/** Where in the warp the frame is covered: the page swaps at this fraction of its length. */
export const WARP_COVER = 0.7;

/** The cover is solid, edge to edge, for this stretch of u. */
export function coverWindow(ms: number): [from: number, to: number] {
	// 140 ms at least, so that a dropped frame still leaves well over 80.
	const width = clamp(0.12 * ms, 140, 260) / Math.max(ms, 1);
	const half = Math.min(width / 2, 0.28);
	return [WARP_COVER - half, WARP_COVER + half];
}

export interface Warp {
	resize(w: number, h: number): void;
	/** The frame at `u`, 0 to 1 of the warp. */
	draw(g: Ctx, u: number): void;
}

interface Streak {
	cos: number;
	sin: number;
	/** Where on its way out from the vanishing point it starts, 0 to 1. */
	phase: number;
	/** 0 blue, 1 blue-white, 2 brass. */
	tint: 0 | 1 | 2;
	/** Its place in the queue: the first are there from the start, the last only at full speed. */
	rank: number;
}

// Speed, in trips from the vanishing point to the edge of the frame per unit
// of u: a drift at the start, a steep ramp into the cover, braking to a stop.
const SPEED_START = 0.5;
const SPEED_PEAK = 12;
const RAMP = 2.6;
/** At full speed one exposure smears a streak over this much of its trip. */
const SMEAR = 0.27;

function speed(u: number): number {
	if (u <= WARP_COVER) {
		return SPEED_START + (SPEED_PEAK - SPEED_START) * (Math.max(u, 0) / WARP_COVER) ** RAMP;
	}
	return SPEED_PEAK * (1 - clamp((u - WARP_COVER) / (1 - WARP_COVER))) ** 2;
}

/** The integral of speed(): how far the visitor has come, in trips. */
function travelled(u: number): number {
	const ramp = (p: number) =>
		SPEED_START * WARP_COVER * p +
		((SPEED_PEAK - SPEED_START) * WARP_COVER * p ** (RAMP + 1)) / (RAMP + 1);
	if (u <= WARP_COVER) return ramp(Math.max(u, 0) / WARP_COVER);
	const rest = 1 - WARP_COVER;
	const q = clamp((u - WARP_COVER) / rest);
	return ramp(1) + ((SPEED_PEAK * rest) / 3) * (1 - (1 - q) ** 3);
}

// A streak's trip is cut in three: thin and faint as it leaves the vanishing
// point, thick and bright as it passes the visitor.
const MID = 0.4;
const OUTER = 0.72;
/** Line width in CSS pixels for [trip part][pass], and its strength. */
const WIDTH = [
	[1, 1, 1],
	[1.9, 1.6, 1.3],
	[3.3, 2.5, 1.9],
] as const;
const STRENGTH = [
	[0.24, 0.42, 0.7],
	[0.32, 0.52, 0.88],
	[0.38, 0.62, 1],
] as const;
/** Each pass covers this much of the streak, measured back from its head. */
const PART = [1, 0.46, 0.15] as const;

export function createWarp(seed: number, ms: number, width: number, height: number): Warp {
	let w = width;
	let h = height;
	let streaks: Streak[] = [];

	const scatter = (): void => {
		const rand = rng(seed);
		const count = Math.round(clamp((w * h) / 3600, 150, 340));
		const vx = w / 2;
		const vy = h * 0.16;
		streaks = [];
		for (let k = 0; k < count; k++) {
			// Aimed at a point anywhere in the frame, so the streaks fill it whatever
			// its shape: on a phone nearly all of them pour down.
			const a = Math.atan2((rand() * 1.2 - 0.1) * h - vy, (rand() * 1.2 - 0.1) * w - vx);
			const roll = rand();
			streaks.push({
				cos: Math.cos(a),
				sin: Math.sin(a),
				phase: rand(),
				tint: roll < 0.07 ? 2 : roll < 0.4 ? 1 : 0,
				rank: (k + rand()) / count,
			});
		}
	};
	scatter();

	const [from, to] = coverWindow(ms);

	const draw = (g: Ctx, u: number): void => {
		if (u <= 0 || u >= 1) return;
		const vx = w / 2;
		const vy = h * 0.16;
		const far = Math.hypot(Math.max(vx, w - vx), h - vy);
		const scale = Math.min(w, h);
		const solid = u >= from && u <= to;

		// The ground darkens as the speed builds, and is gone under the cover.
		const dark = solid
			? 1
			: u < from
				? 0.85 * smooth(0.06, from * 0.82, u) + 0.15 * smooth(from * 0.8, from, u)
				: 1 - smooth(to, to + 0.14, u);
		if (dark > 0) {
			g.globalAlpha = clamp(dark);
			g.fillStyle = BLACK_INK;
			g.fillRect(-2, -2, w + 4, h + 4);
			g.globalAlpha = 1;
		}

		g.save();
		g.globalCompositeOperation = 'lighter';
		g.lineCap = 'round';

		// A streak at `s` of its trip is `near * reach ** s` from the vanishing
		// point: it gathers speed all the way out, as a thing passing close does.
		const near = 0.05 * scale;
		const reach = (far * 1.08) / near;
		const here = travelled(u);
		const smear = Math.max(0.004, (SMEAR * speed(u)) / SPEED_PEAK);
		const density =
			u < WARP_COVER ? 0.1 + 0.9 * smooth(0.04, from, u) ** 1.25 : 1 - 0.96 * smooth(to, 0.97, u);
		const shown = smooth(0, 0.05, u) * (1 - smooth(0.9, 1, u));

		for (let tint = 0; tint < 3; tint++) {
			for (let part = 0; part < 3; part++) {
				const lo = part === 0 ? 0 : part === 1 ? MID : OUTER;
				const hi = part === 0 ? MID : part === 1 ? OUTER : 2;
				// The passes run from the whole streak to its head alone, each
				// brighter than the last: the head burns white, the tail falls away.
				for (let pass = 0; pass < 3; pass++) {
					g.beginPath();
					let any = false;
					for (const s of streaks) {
						if (s.tint !== tint) continue;
						const seen = clamp((density - s.rank) / 0.05);
						if (seen <= 0) continue;
						const at = (((s.phase + here) % 1) + 1) % 1;
						if (at < lo || at >= hi) continue;
						const r1 = near * reach ** at;
						const r0 = near * reach ** Math.max(0, at - smear * seen * PART[pass]);
						if (r0 > far) continue;
						const tip = Math.max(r1, r0 + 2.5);
						g.moveTo(vx + s.cos * r0, vy + s.sin * r0);
						g.lineTo(vx + s.cos * tip, vy + s.sin * tip);
						any = true;
					}
					if (!any) continue;
					g.strokeStyle = tint === 2 ? BRASS_INK : tint === 1 || pass === 2 ? PALE_INK : BLUE_INK;
					g.globalAlpha = STRENGTH[part][pass] * shown;
					g.lineWidth = WIDTH[part][pass];
					g.stroke();
					// The near ones glow.
					if (part === 2 && pass === 0 && tint !== 2) {
						g.strokeStyle = BLUE_INK;
						g.globalAlpha = 0.1 * shown;
						g.lineWidth = 11;
						g.stroke();
					}
				}
			}
		}

		// The light ahead: a star at the vanishing point that swells into a flare.
		const flare =
			u < from
				? smooth(from - 0.13, from, u) ** 1.6
				: u <= to
					? 1
					: (1 - smooth(to, to + 0.15, u)) ** 1.5;
		const ahead = smooth(0, 0.2, u) * (1 - smooth(0.86, 1, u));
		if (ahead > 0.01) {
			const star = scale * (0.1 + 0.07 * smooth(0, from, u) + 0.3 * flare);
			g.globalAlpha = clamp(ahead * (0.75 + 0.25 * flare));
			g.drawImage(glow('pale'), vx - star / 2, vy - star / 2, star, star);
		}
		if (flare > 0.004) {
			const f = clamp(flare);
			const r = far * (0.22 + 0.68 * f);
			const grad = g.createRadialGradient(vx, vy, 0, vx, vy, r);
			lightStops(
				grad,
				// It falls away fast: the edges of the frame stay dark, and the streaks show in it.
				(p) => f * 1.1 * (1 - p) ** 2.3,
				(p) => 1.25 * f * Math.max(0, 1 - p / (0.2 + 0.2 * f)) ** 1.4,
				18,
			);
			g.globalAlpha = 1;
			g.fillStyle = grad;
			g.fillRect(0, 0, w, h);
		}
		g.restore();
	};

	return {
		resize(nw, nh) {
			if (nw === w && nh === h) return;
			w = nw;
			h = nh;
			scatter();
		},
		draw,
	};
}

/** Reduced motion: to black, black across the cover, and back. */
export function drawWarpFade(g: Ctx, w: number, h: number, u: number, ms: number): void {
	if (u <= 0 || u >= 1) return;
	const [from, to] = coverWindow(ms);
	const alpha = u < from ? smooth(0, from, u) : u <= to ? 1 : 1 - smooth(to, 1, u);
	if (alpha <= 0) return;
	g.globalAlpha = alpha;
	g.fillStyle = BLACK_INK;
	g.fillRect(-2, -2, w + 4, h + 4);
	g.globalAlpha = 1;
}
