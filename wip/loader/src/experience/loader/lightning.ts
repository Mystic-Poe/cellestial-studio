// Lightning for a 2D canvas.
//
// Bolts are jagged lines made by midpoint displacement, with a few short
// forks. They are drawn as light: three strokes on top of each other with
// additive blending, a wide soft blue, a brighter blue, a thin white core.
// A bolt flickers by being made again from a new seed every 30 to 50 ms
// (`flickerFrame`), and every number comes from a seeded generator, so the
// same seed always draws the same bolt.
//
// This file depends on nothing but a CanvasRenderingContext2D and plain
// numbers, so it can write anything, anywhere: `crackle` turns any path (the
// stroke of a letter, say) into lightning that runs along it.

/** A line as flat pairs: x, y, x, y, … */
export type Polyline = number[];

/** A small, fast seeded generator (mulberry32): the same seed gives the same numbers, 0 to 1. */
export function seeded(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** One seed out of several whole numbers (which bolt, which flicker frame, …). */
export function mix(...parts: number[]): number {
	let h = 0x811c9dc5;
	for (const part of parts) {
		h ^= Math.round(part) | 0;
		h = Math.imul(h, 0x01000193);
		h ^= h >>> 15;
		h = Math.imul(h, 0x2c1b3c6d);
		h ^= h >>> 12;
	}
	return h >>> 0;
}

/** The flicker frame a moment falls in: a bolt keeps one shape for `ms`, then jumps. */
export function flickerFrame(seconds: number, ms = 40): number {
	return Math.floor((seconds * 1000) / ms + 1e-6);
}

export interface BoltOptions {
	/** Everything about the bolt follows from this. */
	seed: number;
	/** How far the first split may throw the middle sideways, as a fraction of the length. */
	sway?: number;
	/** How much of that each finer split keeps: near 0.5 is smooth, near 0.7 is ragged. */
	roughness?: number;
	/** Splitting stops when the pieces are shorter than this, in the context's units. */
	detail?: number;
	/** Short forks grown off the bolt. */
	branches?: number;
	/** The longest a fork may be, as a fraction of the bolt. */
	branchLength?: number;
	/**
	 * A second seed for the two coarsest splits only. Keep it while `seed`
	 * changes and the bolt stays where it is and only its detail flickers.
	 */
	shape?: number;
}

function displace(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	sway: number,
	roughness: number,
	detail: number,
	fine: () => number,
	coarse: () => number,
): Polyline {
	const length = Math.hypot(x1 - x0, y1 - y0);
	let points: number[] = [x0, y0, x1, y1];
	let reach = length * sway;
	let piece = length;
	let level = 0;
	while (piece > detail && points.length < 1024) {
		const random = level < 2 ? coarse : fine;
		const next: number[] = [];
		for (let i = 0; i + 3 < points.length; i += 2) {
			const ax = points[i];
			const ay = points[i + 1];
			const dx = points[i + 2] - ax;
			const dy = points[i + 3] - ay;
			const d = Math.hypot(dx, dy) || 1;
			const off = (random() * 2 - 1) * reach;
			next.push(ax, ay, ax + dx / 2 - (dy / d) * off, ay + dy / 2 + (dx / d) * off);
		}
		next.push(points[points.length - 2], points[points.length - 1]);
		points = next;
		reach *= roughness;
		piece /= 2;
		level++;
	}
	return points;
}

/**
 * A bolt from (x0, y0) to (x1, y1). The first line is the bolt itself, end
 * to end; the others are its forks.
 */
export function bolt(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	options: BoltOptions,
): Polyline[] {
	const {
		seed,
		sway = 0.16,
		roughness = 0.58,
		detail = 6,
		branches = 0,
		branchLength = 0.25,
	} = options;
	const fine = seeded(seed);
	const coarse = options.shape === undefined ? fine : seeded(options.shape);
	const main = displace(x0, y0, x1, y1, sway, roughness, detail, fine, coarse);
	const lines = [main];
	const length = Math.hypot(x1 - x0, y1 - y0);
	const count = main.length / 2;
	for (let b = 0; b < branches && count > 4; b++) {
		const at = Math.floor(count * (0.15 + 0.65 * fine()));
		const ahead = Math.min(count - 1, at + Math.max(1, Math.floor(count / 8)));
		const px = main[at * 2];
		const py = main[at * 2 + 1];
		const along = Math.atan2(main[ahead * 2 + 1] - py, main[ahead * 2] - px);
		const turn = (0.3 + 0.6 * fine()) * (fine() < 0.5 ? -1 : 1);
		const reach = length * branchLength * (0.35 + 0.65 * fine());
		lines.push(
			displace(
				px,
				py,
				px + Math.cos(along + turn) * reach,
				py + Math.sin(along + turn) * reach,
				sway * 1.3,
				roughness,
				detail,
				fine,
				fine,
			),
		);
	}
	return lines;
}

export interface CrackleOptions {
	seed: number;
	/** How far the lightning strays from the path. */
	reach: number;
	/** The spacing of its corners along the path. */
	detail?: number;
	/** Hold the lightning on the path at its start, at both ends, or nowhere. */
	pin?: 'start' | 'both' | 'none';
}

/** Lightning that runs along a path (flat x, y pairs): the path, made jagged. */
export function crackle(path: readonly number[], options: CrackleOptions): Polyline {
	const { seed, reach, detail = 6, pin = 'both' } = options;
	const random = seeded(seed);
	// Walk the path in steps of `detail`, keeping the direction at each step.
	const steps: number[] = [];
	let carry = 0;
	for (let i = 0; i + 3 < path.length; i += 2) {
		const ax = path[i];
		const ay = path[i + 1];
		const dx = path[i + 2] - ax;
		const dy = path[i + 3] - ay;
		const d = Math.hypot(dx, dy);
		if (d === 0) continue;
		let s = carry;
		for (; s <= d; s += detail) steps.push(ax + (dx / d) * s, ay + (dy / d) * s, dx / d, dy / d);
		carry = s - d;
	}
	const n = steps.length / 4;
	if (n < 2) return path.slice(0, 4) as Polyline;
	// A slow wander and a fast jitter, both sideways.
	const knots: number[] = [];
	for (let k = 0; k <= Math.ceil(n / 4) + 1; k++) knots.push(random() * 2 - 1);
	const out: number[] = [];
	for (let i = 0; i < n; i++) {
		const k = i / 4;
		const f = k - Math.floor(k);
		const ease = f * f * (3 - 2 * f);
		const slow = knots[Math.floor(k)] * (1 - ease) + knots[Math.floor(k) + 1] * ease;
		let hold = 1;
		if (pin === 'both') hold = Math.sqrt(Math.sin((Math.PI * i) / (n - 1)));
		else if (pin === 'start') hold = Math.min(1, i / 3);
		const off = reach * hold * (0.7 * slow + 0.45 * (random() * 2 - 1));
		out.push(steps[i * 4] - steps[i * 4 + 3] * off, steps[i * 4 + 1] + steps[i * 4 + 2] * off);
	}
	return out;
}

/** Start a path on the context and lay these lines into it. Stroke it however you like. */
export function trace(ctx: CanvasRenderingContext2D, lines: readonly (readonly number[])[]): void {
	ctx.beginPath();
	for (const line of lines) {
		if (line.length < 4) continue;
		ctx.moveTo(line[0], line[1]);
		for (let i = 2; i + 1 < line.length; i += 2) ctx.lineTo(line[i], line[i + 1]);
	}
}

export interface BoltStyle {
	/** The width of the white core, in the context's units. The glow is drawn from it. */
	width: number;
	/** The strength of the whole bolt, 0 to 1. */
	alpha?: number;
	/** How thin the forks are against the bolt itself (default 0.55). */
	forks?: number;
	core?: string;
	inner?: string;
	outer?: string;
}

const CORE = 'rgb(238 245 255)';
const INNER = 'rgb(104 152 255 / 0.5)';
const OUTER = 'rgb(48 96 255 / 0.17)';

/**
 * Draw lines as lightning: additive, in three layers. The first line is
 * drawn at full width and the rest (the forks) thinner. The context's
 * transform and clip are respected; its other state is put back.
 */
export function strokeBolt(
	ctx: CanvasRenderingContext2D,
	lines: readonly (readonly number[])[],
	style: BoltStyle,
): void {
	const alpha = style.alpha ?? 1;
	if (alpha <= 0 || !lines.length) return;
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	ctx.globalAlpha = Math.min(1, alpha);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	const sets: [readonly (readonly number[])[], number][] = [
		[lines.slice(0, 1), style.width],
		[lines.slice(1), style.width * (style.forks ?? 0.55)],
	];
	for (const [set, width] of sets) {
		if (!set.length) continue;
		trace(ctx, set);
		ctx.strokeStyle = style.outer ?? OUTER;
		ctx.lineWidth = width * 5.5;
		ctx.stroke();
		ctx.strokeStyle = style.inner ?? INNER;
		ctx.lineWidth = width * 2.4;
		ctx.stroke();
		ctx.strokeStyle = style.core ?? CORE;
		ctx.lineWidth = width;
		ctx.stroke();
	}
	ctx.restore();
}
