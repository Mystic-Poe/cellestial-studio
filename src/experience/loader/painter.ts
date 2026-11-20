// Draws the loading scene: any frame of it, from nothing but the time.
//
// `intro(t)` is A1 to A4 at second `t` of the script, `handoff(u, sky)` is A5
// at `u` seconds in. Neither keeps anything from the frame before, and every
// random number is seeded from the time, so a frame can be drawn in any
// order and the same time is always the same picture.
//
// What is a picture and what is light:
//   - the brass is always the pack's own pixels: c-unlit, c-lit, and the A4
//     wordmark, shown through masks that grow along the circuit lines;
//   - everything that glows is drawn in code, additively: neon along the
//     measured lines (geometry.ts), bolts from lightning.ts, round glow
//     sprites, and a soft halo made by drawing the same lines small and
//     letting the canvas scale them up.

import { ASSETS } from '../assets';
import type { ScreenCircle, SkyScene } from '../contracts';
import { CIRCUIT, EMBLEM_ON_WORDMARK as E, LETTER_WEIGHT, LETTERS, type Line } from './geometry';
import { type Camera, camera, type Layout } from './layout';
import {
	bolt,
	crackle,
	flickerFrame,
	mix,
	type Polyline,
	seeded,
	strokeBolt,
	trace,
} from './lightning';
import {
	context,
	cutWordmark,
	discSprite,
	hazeSprite,
	hotSprite,
	makeCanvas,
	type Pieces,
} from './sprites';
import {
	cameraAt,
	clamp01,
	HANDOFF,
	keyed,
	lerp,
	type Script,
	smoothstep,
	smoothstepAt,
} from './timeline';

export interface Images {
	readonly unlit: HTMLImageElement;
	readonly lit: HTMLImageElement;
	readonly wordmark: HTMLImageElement;
	readonly matte: HTMLImageElement;
}

export interface Painter {
	/** The overlay changed size (or the canvas has to get coarser). */
	resize(layout: Layout): void;
	/** A1 to A4 at second `t`. Past the end of the script: the finished wordmark, its node alive. */
	intro(t: number): void;
	/**
	 * A5 at `u` seconds in. Drives the sky with it. Returns how black the
	 * backdrop still is, 1 to 0.
	 */
	handoff(u: number, sky: SkyScene): number;
	/** Where the star above the i is on screen in the finished wordmark. */
	star(): ScreenCircle;
	/** The frame on the canvas now, on black, to dissolve out of. */
	snapshot(): HTMLCanvasElement;
	/** Lay a snapshot over the frame just drawn, `amount` of the way gone. */
	dissolve(from: HTMLCanvasElement, amount: number): void;
	/** Let go of every canvas. */
	release(): void;
}

type Space = 'sprite' | 'word' | 'screen';

const SPRITE = ASSETS.loader.cLit;
const WORD = ASSETS.loader.wordmark;
/** The main node and the light in its lens, in C-sprite pixels. */
const NODE = SPRITE.node;
const LENS = SPRITE.core;
/** The same light in wordmark pixels. */
const LENS_W = { x: E.x + E.scale * LENS.x, y: E.y + E.scale * LENS.y };
const TAU = Math.PI * 2;
/** How hot a letter stays once it has been written, against the moment of writing. */
const SETTLED = 0.72;

/** The part of some lines whose value is at most `upTo`. `heads` collects where each was cut. */
function prefix(lines: readonly Line[], upTo: number, heads?: number[]): Path2D {
	const path = new Path2D();
	for (const line of lines) {
		if (line[2] > upTo) continue;
		path.moveTo(line[0], line[1]);
		for (let i = 3; i < line.length; i += 3) {
			if (line[i + 2] <= upTo) {
				path.lineTo(line[i], line[i + 1]);
				continue;
			}
			const f = (upTo - line[i - 1]) / (line[i + 2] - line[i - 1]);
			const x = lerp(line[i - 3], line[i], f);
			const y = lerp(line[i - 2], line[i + 1], f);
			path.lineTo(x, y);
			heads?.push(x, y);
			break;
		}
	}
	return path;
}

function whole(lines: readonly Line[]): Path2D {
	return prefix(lines, Number.POSITIVE_INFINITY);
}

/** The stretch of a line between two values, as flat x, y pairs. */
function stretch(line: Line, from: number, to: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < line.length; i += 3) {
		const v = line[i + 2];
		if (i > 0) {
			const pv = line[i - 1];
			const at = (value: number) => {
				const f = (value - pv) / (v - pv);
				out.push(lerp(line[i - 3], line[i], f), lerp(line[i - 2], line[i + 1], f));
			};
			if (pv < from && v > from) at(from);
			if (pv < to && v > to) {
				at(to);
				break;
			}
		}
		if (v >= from && v <= to) out.push(line[i], line[i + 1]);
	}
	return out;
}

/**
 * The stretch of a line from `behind` before to `ahead` beyond the point
 * where its value is `at`, both measured along the line. Flat x, y pairs.
 */
function around(line: Line, at: number, behind: number, ahead: number): number[] {
	const n = line.length / 3;
	const along = [0];
	for (let i = 1; i < n; i++)
		along.push(
			along[i - 1] + Math.hypot(line[3 * i] - line[3 * i - 3], line[3 * i + 1] - line[3 * i - 2]),
		);
	let cut = at <= line[2] ? 0 : along[n - 1];
	for (let i = 1; i < n; i++) {
		const v0 = line[3 * i - 1];
		const v1 = line[3 * i + 2];
		if (v0 <= at && v1 >= at) {
			cut = lerp(along[i - 1], along[i], v1 > v0 ? (at - v0) / (v1 - v0) : 0);
			break;
		}
	}
	const from = Math.max(0, cut - behind);
	const to = Math.min(along[n - 1], cut + ahead);
	const out: number[] = [];
	if (to - from < 0.5) return out;
	const point = (d: number) => {
		let i = 1;
		while (i < n - 1 && along[i] < d) i++;
		const f = (d - along[i - 1]) / (along[i] - along[i - 1] || 1);
		out.push(lerp(line[3 * i - 3], line[3 * i], f), lerp(line[3 * i - 2], line[3 * i + 1], f));
	};
	point(from);
	for (let i = 0; i < n; i++)
		if (along[i] > from && along[i] < to) out.push(line[3 * i], line[3 * i + 1]);
	point(to);
	return out;
}

const smoother = (x: number) => {
	const t = clamp01(x);
	return t * t * t * (t * (t * 6 - 15) + 10);
};

export function createPainter(canvas: HTMLCanvasElement, images: Images, script: Script): Painter {
	const main = context(canvas);
	const hot = hotSprite();
	const haze = hazeSprite();
	const disc = discSprite();
	const pieces: Pieces = cutWordmark(images.wordmark, images.matte);

	let layout: Layout;
	let cam: Camera = { k: 1, x: 0, y: 0 };
	let dpr = 1;

	// The halo. Three small canvases, each a quarter of the one before; what
	// glows is stroked into them fat and blue, and they are scaled back up
	// into each other and then over the frame. `texel` is CSS px per pixel.
	const TEXELS = [3, 12, 48];
	const levels = TEXELS.map((texel) => {
		const c = makeCanvas(1, 1);
		return { canvas: c, ctx: context(c), texel, colour: '' };
	});
	levels[0].colour = 'rgb(70 108 255)';
	levels[1].colour = 'rgb(46 90 255)';
	levels[2].colour = 'rgb(30 64 228)';
	let glowing = false;
	const FALLOFF: readonly (readonly [number, number])[] = [
		[1, 0.24],
		[0.6, 0.33],
		[0.27, 0.43],
	];

	// The lit C, shown only along the circuits the light has reached.
	const reveal = makeCanvas(1, 1);
	const revealCtx = context(reveal);
	let revealKey = Number.NaN;
	// One letter, shown only along the stroke written so far.
	const scrap = makeCanvas(260, 360);
	const scrapCtx = context(scrap);
	let wash: HTMLCanvasElement | null = null;
	let washReach = 0;

	const circuitPath = whole(CIRCUIT);
	/** The A4 picture as paint: a stroke in wordmark pixels lays down the picture's own pixels. */
	const brass = main.createPattern(images.wordmark, 'no-repeat');
	const letterPaths = LETTERS.map((l) => whole(l.lines));
	const letterRings = LETTERS.map((l) => {
		const p = new Path2D();
		for (const r of l.rings) {
			p.moveTo(r.x + r.r, r.y);
			p.arc(r.x, r.y, r.r, 0, TAU);
		}
		return p;
	});
	/** Where the writing of each letter ends. */
	const letterEnds = LETTERS.map((l) => {
		let end = l.start;
		let most = -1;
		for (const line of l.lines) {
			const v = line[line.length - 1];
			if (v > most) {
				most = v;
				end = { x: line[line.length - 3], y: line[line.length - 2] };
			}
		}
		return end;
	});
	/**
	 * How fast each line of a letter is written against the letter as a whole
	 * (1 where a letter is written at one speed, as most are). The lightning
	 * that plays along a line keeps its length whatever the line's speed.
	 */
	const lineRates = LETTERS.map((l) =>
		l.lines.map((line) => {
			let length = 0;
			for (let i = 3; i < line.length; i += 3)
				length += Math.hypot(line[i] - line[i - 3], line[i + 1] - line[i - 2]);
			const rate = ((line[line.length - 1] - line[2]) * l.reach) / (length || 1);
			return Math.abs(rate - 1) < 0.1 ? 1 : rate;
		}),
	);
	/** The middle of each letter's lines, and which of them run round it at a distance (a bowl, not a bar). */
	const letterMiddles = LETTERS.map((l) => {
		let x0 = Number.POSITIVE_INFINITY;
		let x1 = Number.NEGATIVE_INFINITY;
		let y0 = Number.POSITIVE_INFINITY;
		let y1 = Number.NEGATIVE_INFINITY;
		for (const line of l.lines) {
			for (let i = 0; i < line.length; i += 3) {
				x0 = Math.min(x0, line[i]);
				x1 = Math.max(x1, line[i]);
				y0 = Math.min(y0, line[i + 1]);
				y1 = Math.max(y1, line[i + 1]);
			}
		}
		const x = (x0 + x1) / 2;
		const y = (y0 + y1) / 2;
		const round = l.lines.map((line) => {
			let sum = 0;
			for (let i = 0; i < line.length; i += 3) sum += Math.hypot(line[i] - x, line[i + 1] - y);
			return sum / (line.length / 3) > 0.3 * (y1 - y0);
		});
		return { x, y, round };
	});
	/** Points (flat x, y pairs) pushed away from a middle by `by`: lightning that runs outside a tube, not in it. */
	function outward(points: number[], middle: { x: number; y: number }, by: number): number[] {
		const out: number[] = [];
		for (let i = 0; i < points.length; i += 2) {
			const dx = points[i] - middle.x;
			const dy = points[i + 1] - middle.y;
			const d = Math.hypot(dx, dy) || 1;
			out.push(points[i] + (dx / d) * by, points[i + 1] + (dy / d) * by);
		}
		return out;
	}
	/** The longest line of each letter. */
	const longest = LETTERS.map((l) => {
		let best = 0;
		let most = 0;
		l.lines.forEach((line, n) => {
			let length = 0;
			for (let i = 3; i < line.length; i += 3)
				length += Math.hypot(line[i] - line[i - 3], line[i + 1] - line[i - 2]);
			if (length > most) {
				most = length;
				best = n;
			}
		});
		return best;
	});
	/** The point of what is written of some lines (up to `upTo`) that lies nearest to (x, y). */
	function nearestWritten(
		lines: readonly Line[],
		upTo: number,
		x: number,
		y: number,
	): { x: number; y: number } {
		let best = Number.POSITIVE_INFINITY;
		const at = { x, y };
		const consider = (px: number, py: number) => {
			const d = (px - x) ** 2 + (py - y) ** 2;
			if (d < best) {
				best = d;
				at.x = px;
				at.y = py;
			}
		};
		for (const line of lines) {
			for (let i = 0; i < line.length && line[i + 2] <= upTo; i += 3) {
				consider(line[i], line[i + 1]);
				if (i + 5 < line.length && line[i + 5] > upTo) {
					const f = (upTo - line[i + 2]) / (line[i + 5] - line[i + 2]);
					consider(lerp(line[i], line[i + 3], f), lerp(line[i + 1], line[i + 4], f));
				}
			}
		}
		return at;
	}
	/** The node's light in the last intro frame, so A5 can let it down gently. */
	let breath = 0;

	// ─────────────────────────────────────────────────────── spaces ──

	function into(c: CanvasRenderingContext2D, space: Space, unit: number): void {
		if (space === 'screen') c.setTransform(unit, 0, 0, unit, 0, 0);
		else if (space === 'word')
			c.setTransform(unit * cam.k, 0, 0, unit * cam.k, unit * cam.x, unit * cam.y);
		else {
			const s = cam.k * E.scale;
			c.setTransform(
				unit * s,
				0,
				0,
				unit * s,
				unit * (cam.x + E.x * cam.k),
				unit * (cam.y + E.y * cam.k),
			);
		}
	}
	/** CSS pixels per unit of a space. */
	const scaleOf = (space: Space) =>
		space === 'screen' ? 1 : space === 'word' ? cam.k : cam.k * E.scale;

	function clear(): void {
		main.setTransform(1, 0, 0, 1, 0, 0);
		main.globalAlpha = 1;
		main.globalCompositeOperation = 'source-over';
		main.clearRect(0, 0, canvas.width, canvas.height);
		if (glowing) {
			for (const level of levels) {
				level.ctx.setTransform(1, 0, 0, 1, 0, 0);
				level.ctx.clearRect(0, 0, level.canvas.width, level.canvas.height);
			}
			glowing = false;
		}
	}

	/**
	 * Add something to the halo: a path, or lines laid by a callback, stroked
	 * `widths[i]` wide (in units of `space`) into level i at strength `gains[i]`.
	 */
	function glow(
		space: Space,
		widths: readonly number[],
		gains: readonly number[],
		shape: Path2D | readonly (readonly number[])[],
	): void {
		const scale = scaleOf(space);
		for (let i = 0; i < levels.length; i++) {
			const gain = gains[i] ?? 0;
			if (gain <= 0.004) continue;
			const { ctx: c, texel, colour } = levels[i];
			into(c, space, 1 / texel);
			c.globalCompositeOperation = 'lighter';
			c.strokeStyle = colour;
			c.lineCap = 'round';
			c.lineJoin = 'round';
			const path = shape instanceof Path2D ? shape : null;
			if (!path) trace(c, shape as readonly (readonly number[])[]);
			// Three strokes, each narrower and on top of the last: light that
			// falls off with distance, not a band with an edge.
			for (const [part, share] of FALLOFF) {
				c.globalAlpha = Math.min(1, gain * share);
				c.lineWidth = Math.max(widths[i] * part, (1.7 * texel) / scale);
				if (path) c.stroke(path);
				else c.stroke();
			}
			glowing = true;
		}
	}

	/** Scale the halo up, level into level, and add it to the frame. */
	function shine(): void {
		if (!glowing) return;
		for (let i = levels.length - 1; i > 0; i--) {
			const from = levels[i];
			const to = levels[i - 1];
			to.ctx.setTransform(1, 0, 0, 1, 0, 0);
			to.ctx.globalCompositeOperation = 'lighter';
			to.ctx.globalAlpha = 1;
			to.ctx.imageSmoothingEnabled = true;
			to.ctx.imageSmoothingQuality = 'high';
			to.ctx.drawImage(from.canvas, 0, 0, from.canvas.width * 4, from.canvas.height * 4);
		}
		const top = levels[0];
		into(main, 'screen', dpr);
		main.globalCompositeOperation = 'lighter';
		main.globalAlpha = 1;
		main.drawImage(top.canvas, 0, 0, top.canvas.width * top.texel, top.canvas.height * top.texel);
		main.globalCompositeOperation = 'source-over';
	}

	/** A round glow sprite, centred, additive. */
	function spot(
		sprite: HTMLCanvasElement,
		space: Space,
		x: number,
		y: number,
		rx: number,
		alpha: number,
		ry = rx,
	): void {
		if (alpha <= 0.004 || rx <= 0) return;
		into(main, space, dpr);
		main.globalCompositeOperation = 'lighter';
		main.globalAlpha = Math.min(1, alpha);
		main.drawImage(sprite, x - rx, y - ry, rx * 2, ry * 2);
		main.globalAlpha = 1;
		main.globalCompositeOperation = 'source-over';
	}

	/** Never thinner on screen than `px` CSS pixels. */
	const atLeast = (width: number, space: Space, px = 0.9) => Math.max(width, px / scaleOf(space));

	// ───────────────────────────────────────────────── A1, A2: the C ──

	function updateReveal(t: number): void {
		const r = script.reveal;
		if (!r) return;
		const key = t >= r.end ? Number.POSITIVE_INFINITY : t;
		if (key === revealKey) return;
		revealKey = key;
		const c = revealCtx;
		c.setTransform(1, 0, 0, 1, 0, 0);
		c.globalCompositeOperation = 'source-over';
		c.globalAlpha = 1;
		c.clearRect(0, 0, reveal.width, reveal.height);
		const s = reveal.width / SPRITE.w;
		c.setTransform(s, 0, 0, s, 0, 0);
		const path = t >= r.end ? circuitPath : prefix(CIRCUIT, t);
		c.lineCap = 'round';
		c.lineJoin = 'round';
		c.strokeStyle = '#000';
		// A soft-edged mask: wide and half there, then narrower and whole.
		c.globalAlpha = 0.5;
		c.lineWidth = 17;
		c.stroke(path);
		c.globalAlpha = 1;
		c.lineWidth = 11.5;
		c.stroke(path);
		c.globalCompositeOperation = 'source-in';
		c.drawImage(images.lit, 0, 0);
	}

	function emblem(t: number): void {
		const r = script.reveal;
		const lit = script.lit;
		into(main, 'sprite', dpr);
		if (!r || !lit || t >= lit[1]) {
			main.drawImage(images.lit, 0, 0);
			return;
		}
		main.drawImage(images.unlit, 0, 0);
		if (t >= r.start) {
			updateReveal(t);
			main.drawImage(reveal, 0, 0, reveal.width, reveal.height, 0, 0, SPRITE.w, SPRITE.h);
		}
		if (t > lit[0]) {
			main.globalAlpha = smoothstep(lit[0], lit[1], t);
			main.drawImage(images.lit, 0, 0);
			main.globalAlpha = 1;
		}
	}

	/** The light running through the circuits: hot behind its head, cooling to the lit picture's blue. */
	function circuitNeon(t: number): void {
		const r = script.reveal;
		if (!r || t < r.start || t >= r.gone) return;
		const heat = t <= r.hold ? 1 : (1 - (t - r.hold) / (r.gone - r.hold)) ** 1.6;
		const heads: number[] = [];
		const path = t >= r.end ? circuitPath : prefix(CIRCUIT, t, heads);
		// A thin white wire with a close blue glow, as the reference draws it:
		// the brass stays brass beside it.
		into(main, 'sprite', dpr);
		main.globalCompositeOperation = 'lighter';
		main.lineCap = 'round';
		main.lineJoin = 'round';
		main.strokeStyle = `rgb(44 76 255 / ${0.34 * heat})`;
		main.lineWidth = 18;
		main.stroke(path);
		main.strokeStyle = `rgb(96 126 255 / ${0.34 * heat})`;
		main.lineWidth = atLeast(7, 'sprite', 1.7);
		main.stroke(path);
		main.strokeStyle = `rgb(240 244 255 / ${heat ** 0.7})`;
		main.lineWidth = atLeast(lerp(1.8, 3.8, heat), 'sprite', 1);
		main.stroke(path);
		main.globalCompositeOperation = 'source-over';
		glow('sprite', [34, 120, 0], [0.32 * heat, 0.24 * heat, 0], path);
		// The node the light set out from glows for as long as the lines are hot.
		const woke = smoothstep(r.start, r.start + 0.2, t);
		spot(haze, 'sprite', NODE.x, NODE.y, NODE.r * 2.5, 0.6 * heat * woke);
		const flick = seeded(mix(5, flickerFrame(t)));
		for (let i = 0; i < heads.length; i += 2)
			spot(hot, 'sprite', heads[i], heads[i + 1], 26 + 8 * flick(), 0.9);
	}

	// ───────────────────────────────────── the main node: charge, arcs ──

	function nodeLight(t: number): void {
		const level = keyed(script.energy, t);
		if (level <= 0) return;
		const frame = flickerFrame(t, 42);
		const random = seeded(mix(21, frame));
		const calm = level > 1.2 ? 0.08 : 0.3;
		const energy = level * (1 - calm / 2 + calm * random());
		const r = NODE.r;
		spot(haze, 'sprite', LENS.x, LENS.y, r * (1.5 + 1.3 * energy), Math.min(0.75, 0.55 * energy));
		spot(hot, 'sprite', LENS.x, LENS.y, r * (0.4 + 0.42 * Math.min(energy, 1.2)), energy);
		if (energy > 1.15) {
			// Overload: the node is lost in a white disc about its own size.
			const over = Math.min(1, (energy - 1.15) / 1.1);
			spot(disc, 'sprite', LENS.x, LENS.y, r * (0.8 + 0.3 * over), Math.min(0.82, over * 1.2));
			spot(hot, 'sprite', LENS.x, LENS.y, r * (1.4 + 0.9 * over), 0.45 * over);
		}
		const [from, to] = script.arcs;
		if (t < from || t > to) return;
		const reachLevel = Math.min(1.25, level);
		const count = Math.max(1, Math.round((1 + 4.6 * random()) * Math.min(1, level * 1.3)));
		const all: Polyline[] = [];
		into(main, 'sprite', dpr);
		for (let i = 0; i < count; i++) {
			const a = random() * TAU;
			const reach = r * (0.3 + (0.35 + 0.95 * random() ** 2) * reachLevel);
			const lines = bolt(
				LENS.x,
				LENS.y,
				LENS.x + Math.cos(a) * reach,
				LENS.y + Math.sin(a) * reach,
				{
					seed: mix(22, frame, i),
					sway: 0.27,
					roughness: 0.62,
					detail: 7,
					branches: random() < 0.5 ? 1 : 0,
					branchLength: 0.45,
				},
			);
			strokeBolt(main, lines, {
				width: atLeast(2.3, 'sprite'),
				alpha: 0.7 + 0.3 * random(),
				forks: 0.7,
			});
			all.push(...lines);
		}
		glow('sprite', [18, 56, 0], [0.5, 0.3, 0], all);
	}

	// ───────────────────────────────────────────── the overload bolt ──

	function strike(t: number): void {
		const k = script.strike;
		if (!k || t < k.hit || t > k.gone + 0.3) return;
		const frame = flickerFrame(t, 42);
		const random = seeded(mix(11, frame));
		const s = scaleOf('sprite');
		const nx = cam.x + LENS_W.x * cam.k;
		const ny = cam.y + LENS_W.y * cam.k;
		const nr = NODE.r * s;
		const power = keyed(
			[
				[k.hit - 0.001, 0],
				[k.hit, 1],
				[k.hit + 0.2, 1],
				[k.hold, 0.75],
				[k.thin, 0.42],
				[k.thin + 0.08, 0.13],
				[k.gone, 0],
			],
			t,
		);
		if (power > 0) {
			// It comes down from the top edge, leaning in from the right as the reference's does.
			const lean = Math.max(0.03 * layout.w, Math.min(0.2 * ny, 0.86 * layout.w - nx));
			const top = nx + lean + (random() - 0.5) * 0.2 * nr;
			// One strand, thin and white-hot, ragged at every scale, with a short fork or two.
			const lines = bolt(top, -0.25 * nr, nx, ny - 0.1 * nr, {
				seed: mix(12, frame),
				shape: mix(13, flickerFrame(t, 125)),
				sway: 0.07,
				roughness: 0.64,
				detail: Math.max(2.5, nr * 0.04),
				branches: 2,
				branchLength: 0.09,
			});
			const light = power * (0.88 + 0.24 * random());
			into(main, 'screen', dpr);
			strokeBolt(main, lines, {
				width: Math.max(1.3, nr * 0.062 * (0.35 + 0.65 * power)),
				alpha: Math.min(1, light * 1.5),
				forks: 0.4,
			});
			glow('screen', [nr * 0.36, nr * 1.0, 0], [0.5 * light, 0.26 * light, 0], lines);

			// The blue wash: a column of light along the bolt, across the frame.
			const flood =
				keyed(
					[
						[k.hit - 0.001, 0],
						[k.hit, 0.8],
						[k.hit + 0.045, 1],
						[k.hit + 0.2, 1],
						[k.hold, 0.62],
						[k.thin + 0.03, 0.22],
						[k.gone - 0.02, 0],
					],
					t,
				) *
				(0.93 + 0.14 * random());
			if (wash && flood > 0) {
				main.setTransform(dpr, 0, (-dpr * lean) / ny, dpr, 0, 0);
				main.globalCompositeOperation = 'lighter';
				main.globalAlpha = Math.min(1, flood);
				main.drawImage(wash, top - washReach, 0, washReach * 2, layout.h);
				main.globalAlpha = 1;
				main.globalCompositeOperation = 'source-over';
			}
		}

		// Sparks: a dust of them thrown off the node, slowed by the air, falling.
		const first = k.hit + 0.04;
		if (t < first) return;
		const sets = [new Path2D(), new Path2D(), new Path2D()];
		const r = NODE.r;
		let any = false;
		for (let i = 0; i < 420; i++) {
			const spark = seeded(mix(31, i));
			const born = first + 0.36 * spark() ** 1.8;
			const life = 0.18 + 0.3 * spark() ** 2;
			let a = spark() * TAU;
			// Most of them go down and out.
			if (Math.sin(a) < -0.2 && spark() < 0.6) a = -a;
			const speed = r * (1.6 + 10 * spark() ** 1.3);
			const age = t - born;
			if (age <= 0 || age >= life) continue;
			const where = (time: number): [number, number] => {
				const d = 0.7 * r + (speed * (1 - Math.exp(-3.4 * time))) / 3.4;
				return [LENS.x + Math.cos(a) * d, LENS.y + Math.sin(a) * d + 6 * r * time * time];
			};
			const [x1, y1] = where(age);
			const [x0, y0] = where(Math.max(0, age - 0.009));
			const bright = 1 - age / life;
			const set = sets[bright > 0.6 ? 0 : bright > 0.3 ? 1 : 2];
			set.moveTo(x0, y0);
			set.lineTo(x1, y1);
			any = true;
		}
		if (!any) return;
		into(main, 'sprite', dpr);
		main.globalCompositeOperation = 'lighter';
		main.lineCap = 'round';
		main.lineWidth = atLeast(2.6, 'sprite', 1.3);
		main.strokeStyle = 'rgb(232 241 255)';
		main.stroke(sets[0]);
		main.strokeStyle = 'rgb(150 186 255 / 0.8)';
		main.stroke(sets[1]);
		main.strokeStyle = 'rgb(84 124 255 / 0.55)';
		main.stroke(sets[2]);
		main.globalCompositeOperation = 'source-over';
	}

	// ─────────────────────────────────────────────── A3: the writing ──

	/** How far each letter is written at `t`: below 0 not begun, 1 and over done. */
	const written = (j: number, t: number) => {
		const [a, b] = script.letters[j];
		return (t - a) / (b - a);
	};

	interface Stroke {
		w: number;
		path: Path2D;
		heads: number[];
	}

	/** The brass of the letters, each shown as far as it is written; and the star. */
	function letterBrass(t: number, strokes: (Stroke | null)[]): void {
		for (let j = 0; j < LETTERS.length; j++) {
			const w = written(j, t);
			if (w <= 0) continue;
			const box = WORD.letters[j];
			const x = box.x - 5;
			const y = box.y - 5;
			const bw = box.w + 10;
			const bh = box.h + 10;
			into(main, 'word', dpr);
			if (w >= 1) {
				if (j === 0) {
					// The first e's box takes in a corner of the main node, which is the C's.
					main.save();
					main.beginPath();
					main.rect(x, y, bw, bh);
					main.arc(WORD.node.x, WORD.node.y, WORD.node.r + 7, 0, TAU);
					main.clip('evenodd');
					main.drawImage(images.wordmark, x, y, bw, bh, x, y, bw, bh);
					main.restore();
				} else main.drawImage(images.wordmark, x, y, bw, bh, x, y, bw, bh);
				continue;
			}
			const heads: number[] = [];
			const path = prefix(LETTERS[j].lines, w, heads);
			strokes[j] = { w, path, heads };
			const c = scrapCtx;
			c.setTransform(1, 0, 0, 1, 0, 0);
			c.globalCompositeOperation = 'source-over';
			c.clearRect(0, 0, scrap.width, scrap.height);
			c.setTransform(1, 0, 0, 1, -x, -y);
			c.lineCap = 'round';
			c.lineJoin = 'round';
			c.lineWidth = 40;
			c.strokeStyle = '#000';
			c.fillStyle = '#000';
			c.stroke(path);
			for (const ring of LETTERS[j].rings) {
				if (ring.at > w) continue;
				c.beginPath();
				c.arc(ring.x, ring.y, 31, 0, TAU);
				c.fill();
			}
			c.globalCompositeOperation = 'source-in';
			c.drawImage(images.wordmark, x, y, bw, bh, x, y, bw, bh);
			main.drawImage(scrap, 0, 0, bw, bh, x, y, bw, bh);
		}
		const seen = smoothstep(script.star - 0.13, script.star - 0.03, t);
		if (seen > 0) {
			const s = pieces.star;
			into(main, 'word', dpr);
			main.globalAlpha = seen;
			main.drawImage(images.wordmark, s.x, s.y, s.w, s.h, s.x, s.y, s.w, s.h);
			main.globalAlpha = 1;
		}
	}

	/**
	 * The neon in the letters. In the reference a lit letter is a glass tube:
	 * its skin white-hot, its brass still showing down the middle, a white
	 * filament along the circuit line, ring nodes at the stroke ends, and blue
	 * air around it. `heat` 1 is that; 0 is the plain brass.
	 */
	function letterNeon(t: number, strokes: (Stroke | null)[], heat: number): void {
		if (heat <= 0) return;
		let any = false;
		let right = WORD.letters[0].x;
		let newest = 0;
		// The halo goes first as the word cools.
		const air = heat <= 0.4 ? 0 : ((heat - 0.4) / 0.6) ** 1.5;
		into(main, 'word', dpr);
		main.lineCap = 'round';
		main.lineJoin = 'round';
		for (let j = 0; j < LETTERS.length; j++) {
			const w = written(j, t);
			if (w <= 0) continue;
			any = true;
			newest = j;
			const box = WORD.letters[j];
			right = Math.max(right, box.x + box.w * Math.min(1, w));
			const tube = w >= 1 ? letterPaths[j] : strokes[j]?.path;
			if (!tube) continue;
			let rings = letterRings[j];
			if (w < 1) {
				rings = new Path2D();
				for (const r of LETTERS[j].rings) {
					if (r.at > w) continue;
					rings.moveTo(r.x + r.r, r.y);
					rings.arc(r.x, r.y, r.r, 0, TAU);
				}
			}
			// White-hot as it is written, then it settles to a steady glow.
			const h = heat * lerp(1, SETTLED, smoothstep(0.04, 0.55, t - script.letters[j][1]));
			main.globalCompositeOperation = 'lighter';
			// The air right against the glass.
			main.strokeStyle = `rgb(66 100 255 / ${0.13 * h ** 1.3})`;
			main.lineWidth = LETTER_WEIGHT + 26;
			main.stroke(tube);
			main.strokeStyle = `rgb(130 150 255 / ${0.1 * h ** 1.2})`;
			main.lineWidth = LETTER_WEIGHT + 9;
			main.stroke(tube);
			// The skin: the whole width of the letter, white with a breath of violet…
			main.strokeStyle = `rgb(234 233 255 / ${0.8 * h})`;
			main.lineWidth = LETTER_WEIGHT + 3;
			main.stroke(tube);
			// …and the letter's own brass laid back down the middle of it.
			if (brass) {
				main.globalCompositeOperation = 'source-over';
				main.globalAlpha = lerp(0.97, 0.78, h);
				main.strokeStyle = brass;
				main.lineWidth = LETTER_WEIGHT - 6.5;
				main.stroke(tube);
				main.globalAlpha = 1;
				main.globalCompositeOperation = 'lighter';
			}
			// The filament, and the ring nodes.
			main.strokeStyle = `rgb(244 247 255 / ${Math.min(1, h * 1.5)})`;
			main.lineWidth = atLeast(lerp(1.8, 3.2, h), 'word', 0.9);
			main.stroke(tube);
			main.lineWidth = atLeast(lerp(2, 4, h), 'word', 0.8);
			main.stroke(rings);
			const shine = air * clamp01((h / heat - 0.2) / 0.8) ** 1.5;
			glow('word', [46, 120, 320], [0.3 * shine, 0.3 * shine, 0.22 * shine], tube);
			into(main, 'word', dpr);
		}
		main.globalCompositeOperation = 'source-over';
		const lit = t >= script.star;
		if (!any && !lit) return;
		if (any) {
			// Blue air: over the whole of what is lit, wide and soft, and deeper
			// round the letter that has just been written.
			const left = WORD.letters[0].x;
			const middle = WORD.letters[0].y + WORD.letters[0].h / 2;
			spot(haze, 'word', (left + right) / 2, middle, (right - left) / 2 + 560, 0.5 * air, 520);
			const fresh = WORD.letters[newest];
			const young = 1 - smoothstep(0.1, 0.7, t - script.letters[newest][1]);
			spot(haze, 'word', fresh.x + fresh.w / 2, middle, 460, 0.8 * air * young);
		}
		if (lit) {
			// The star lights with the word: its brass warmed white, a small glow.
			const s = pieces.star;
			const flash = 1 + 0.8 * (1 - smoothstep(script.star, script.star + 0.14, t));
			into(main, 'word', dpr);
			main.globalCompositeOperation = 'lighter';
			main.globalAlpha = Math.min(1, 0.3 * heat * flash);
			main.drawImage(s.light, s.x, s.y);
			main.globalAlpha = 1;
			main.globalCompositeOperation = 'source-over';
			spot(hot, 'word', WORD.star.x, WORD.star.y, WORD.star.r * 1.5 * flash, 0.3 * heat * flash);
			spot(haze, 'word', WORD.star.x, WORD.star.y, WORD.star.r * 3.4, 0.4 * air);
		}
	}

	/** The lightning that does the writing: arcs from letter to letter, and a crackling head. */
	function writing(t: number, strokes: (Stroke | null)[]): void {
		const frame = flickerFrame(t);
		const short = script.mode === 'short';
		const lead = short ? 0.05 : 0.075;
		const arcs: Polyline[] = [];
		into(main, 'word', dpr);
		const thin = (w: number) => atLeast(w, 'word');
		for (let j = 0; j < LETTERS.length; j++) {
			const [a, b] = script.letters[j];
			if (t < a - lead || t > b + 0.13) continue;
			const letter = LETTERS[j];
			const stroke = strokes[j];
			const from = j === 0 ? LENS_W : letterEnds[j - 1];
			// The first letter of the full version is thrown from the main node: one
			// tall, open arc that leaps up to where the letter begins and then stands
			// between the node and the letter for as long as it is being written.
			const first = j === 0 && !short;
			// The arc that jumps to where this letter begins.
			const rise = first ? 0.045 : lead;
			const jump = keyed(
				[
					[a - rise, 0],
					[a - rise * (first ? 0.8 : 0.4), 1],
					[a + 0.02, 1],
					[a + 0.05, 0],
				],
				t,
			);
			if (jump > 0 && !(short && j > 0)) {
				const grow = clamp01((t - (a - rise)) / (rise * (first ? 0.9 : 0.6)));
				const tipX = lerp(from.x, letter.start.x, grow);
				const tipY = lerp(from.y, letter.start.y, grow);
				const lines = bolt(from.x, from.y, tipX, tipY, {
					seed: mix(41, j, frame),
					shape: first ? mix(51, flickerFrame(t, 84)) : undefined,
					sway: first ? 0.27 : 0.2,
					roughness: 0.6,
					detail: 7,
					branches: first ? 2 : 1,
					branchLength: 0.3,
				});
				strokeBolt(main, lines, { width: thin(first ? 3.6 : 2.6), alpha: jump });
				arcs.push(...lines);
				if (first) {
					spot(hot, 'word', tipX, tipY, 20, jump);
					into(main, 'word', dpr);
				}
			}
			// The leader: before the tube, a jagged arc throws itself out along the way
			// the letter will go, and the tube then follows it.
			const lead0 = j === 0 ? a - 0.1 : a - 0.03;
			const leader = keyed(
				[
					[lead0, 0],
					[lead0 + 0.03, 1],
					[lerp(a, b, 0.35), 1],
					[lerp(a, b, 0.6), 0],
				],
				t,
			);
			if (leader > 0 && !short && !first) {
				const ahead: number[] = [];
				prefix(letter.lines, clamp01(written(j, t)) * 0.5 + 0.42, ahead);
				const tail = stroke?.heads.length ? stroke.heads : j === 0 ? [LENS_W.x, LENS_W.y] : [];
				if (ahead.length && tail.length) {
					const lines = bolt(tail[0], tail[1], ahead[0], ahead[1], {
						seed: mix(49, j, frame),
						shape: mix(50, j, flickerFrame(t, 84)),
						sway: 0.22,
						roughness: 0.6,
						detail: 7,
						branches: 1,
						branchLength: 0.25,
					});
					strokeBolt(main, lines, { width: thin(j === 0 ? 3.4 : 2.4), alpha: 0.95 * leader });
					arcs.push(...lines);
					spot(hot, 'word', ahead[0], ahead[1], 13, 0.8 * leader);
					into(main, 'word', dpr);
				}
			}
			if (stroke) {
				const random = seeded(mix(43, j, frame));
				// The bolt that feeds the head: from the node for the first letter
				// (and, in the short version, for every letter: one bolt writes the word).
				if (first) {
					// It lands on whatever of the letter lies nearest the node: the
					// place the writing began, then down the letter's left side.
					const foot = nearestWritten(letter.lines, stroke.w, LENS_W.x, LENS_W.y);
					const lines = bolt(LENS_W.x, LENS_W.y, foot.x, foot.y, {
						seed: mix(44, j, frame),
						shape: mix(51, flickerFrame(t, 84)),
						sway: 0.27,
						roughness: 0.6,
						detail: 7,
						branches: 2,
						branchLength: 0.3,
					});
					strokeBolt(main, lines, { width: thin(3.6), alpha: 0.95 });
					arcs.push(...lines);
				} else if (short && stroke.heads.length) {
					const lines = bolt(LENS_W.x, LENS_W.y, stroke.heads[0], stroke.heads[1], {
						seed: mix(44, j, frame),
						shape: mix(45, j, flickerFrame(t, 90)),
						sway: 0.13,
						roughness: 0.6,
						detail: 7,
						branches: 2,
						branchLength: 0.22,
					});
					strokeBolt(main, lines, { width: thin(2.8), alpha: 0.9 });
					arcs.push(...lines);
				}
				// Lightning along the stroke, around the head: what resolves into the tube.
				letter.lines.forEach((line, n) => {
					// A line written at a speed of its own (the strokes of an e) is not
					// there before its time, and its lightning is measured in length.
					const paced = lineRates[j][n] !== 1;
					if (paced && (stroke.w < line[2] - 0.02 || stroke.w > line[line.length - 1] + 0.1))
						return;
					let part = paced
						? around(line, stroke.w, first ? 130 : 48, 62)
						: stretch(line, stroke.w - 0.2, stroke.w + 0.34);
					if (part.length < 4) return;
					// Round the first letter the lightning hugs the tube from outside.
					if (first && letterMiddles[j].round[n]) part = outward(part, letterMiddles[j], 15);
					const jag = crackle(part, {
						seed: mix(42, j, n, frame),
						reach: first ? 12 : 8,
						detail: 6,
						pin: 'start',
					});
					strokeBolt(main, [jag], { width: thin(2.6), alpha: 0.9 });
					arcs.push(jag);
				});
				for (let i = 0; i < stroke.heads.length; i += 2) {
					const hx = stroke.heads[i];
					const hy = stroke.heads[i + 1];
					spot(hot, 'word', hx, hy, 17 + 6 * random(), 0.85);
					into(main, 'word', dpr);
					for (let n = 0; n < (leader > 0.5 ? 1 : 2); n++) {
						const angle = random() * TAU;
						const reach = 28 + 50 * random();
						const lines = bolt(hx, hy, hx + Math.cos(angle) * reach, hy + Math.sin(angle) * reach, {
							seed: mix(46, j, i, n, frame),
							sway: 0.3,
							roughness: 0.62,
							detail: 6,
						});
						strokeBolt(main, lines, { width: thin(2.1), alpha: 0.8 });
						arcs.push(...lines);
					}
				}
			} else if (t >= b) {
				// A last crackle where the stroke ended.
				const fade = 1 - (t - b) / 0.13;
				const random = seeded(mix(47, j, frame));
				const end = letterEnds[j];
				for (let n = 0; n < 2; n++) {
					const angle = random() * TAU;
					const reach = 22 + 40 * random();
					const lines = bolt(
						end.x,
						end.y,
						end.x + Math.cos(angle) * reach,
						end.y + Math.sin(angle) * reach,
						{
							seed: mix(48, j, n, frame),
							sway: 0.32,
							roughness: 0.62,
							detail: 6,
						},
					);
					strokeBolt(main, lines, { width: thin(2), alpha: 0.85 * fade });
					arcs.push(...lines);
				}
				spot(hot, 'word', end.x, end.y, 22, 0.7 * fade);
				into(main, 'word', dpr);
				if (first) {
					// The arc from the node lets go last.
					const foot = nearestWritten(letter.lines, 1, LENS_W.x, LENS_W.y);
					const lines = bolt(LENS_W.x, LENS_W.y, foot.x, foot.y, {
						seed: mix(44, j, frame),
						shape: mix(51, flickerFrame(t, 84)),
						sway: 0.27,
						roughness: 0.6,
						detail: 7,
						branches: 1,
						branchLength: 0.3,
					});
					strokeBolt(main, lines, { width: thin(3), alpha: 0.9 * fade });
					arcs.push(...lines);
					// And a last run of lightning down the letter's far side.
					const far = outward(around(letter.lines[longest[j]], 2, 130, 0), letterMiddles[j], 20);
					const side = crackle(far, {
						seed: mix(52, frame),
						reach: 13,
						detail: 6,
						pin: 'none',
					});
					strokeBolt(main, [side], { width: thin(2.4), alpha: 0.85 * fade });
					arcs.push(side);
				}
			}
		}
		if (arcs.length) glow('word', [16, 50, 0], [0.3, 0.16, 0], arcs);
	}

	// ─────────────────────────────────────────────────────── frames ──

	function intro(t: number): void {
		cam = camera(layout, cameraAt(script, t, layout.hurry));
		clear();
		const [coolFrom, coolTo] = script.cool;
		if (t >= coolTo) {
			// A4: the picture itself, untouched, and a light that breathes in its node.
			into(main, 'word', dpr);
			main.drawImage(images.wordmark, 0, 0);
			const since = Math.max(0, t - script.end);
			breath = 0.62 + 0.38 * (0.5 - 0.5 * Math.cos((TAU * since) / 2.6));
			spot(haze, 'word', WORD.node.x, WORD.node.y, WORD.node.r * 3, 0.55 * breath);
			spot(hot, 'word', WORD.node.x, WORD.node.y, WORD.node.r * 0.6, 0.42 * breath);
			return;
		}
		breath = 0;
		const cool = clamp01((t - coolFrom) / (coolTo - coolFrom));
		const strokes: (Stroke | null)[] = LETTERS.map(() => null);
		emblem(t);
		letterBrass(t, strokes);
		// The picture comes in once the last letter is written, not before.
		const lastWritten = script.letters[script.letters.length - 1][1] + 0.03;
		const settled = clamp01((t - lastWritten) / (coolTo - lastWritten));
		if (settled > 0) {
			// The sprite and the nine cut-outs give way to the one picture they came from.
			into(main, 'word', dpr);
			main.globalAlpha = smoothstep(0, 0.6, settled);
			main.drawImage(images.wordmark, 0, 0);
			main.globalAlpha = 1;
		}
		circuitNeon(t);
		letterNeon(t, strokes, (1 - cool) ** 1.7);
		nodeLight(t);
		strike(t);
		writing(t, strokes);
		shine();
	}

	const finalCamera = () => camera(layout, { shrink: 1, travel: 1 });

	function star(): ScreenCircle {
		const c = finalCamera();
		return { x: c.x + WORD.star.x * c.k, y: c.y + WORD.star.y * c.k, r: WORD.star.r * c.k };
	}

	// The order the letters let go in: nearest the star first.
	const falling = [pieces.emblem, ...pieces.letters]
		.map((piece, i) => ({
			piece,
			far: Math.hypot(piece.cx - WORD.star.x, piece.cy - WORD.star.y) / WORD.box.w,
			sway: seeded(mix(61, i)),
		}))
		.sort((p, q) => p.far - q.far)
		.map((entry, rank) => ({
			piece: entry.piece,
			far: entry.far,
			rank,
			tilt: (entry.sway() - 0.5) * 0.09,
			drift: (entry.sway() - 0.5) * 16,
		}));

	const BREAK = 0.14;
	const fragments = pieces.shards.map((shard, i) => {
		const random = seeded(mix(71, i));
		return {
			shard,
			/** When it reaches the ring, as the sky's own progress: 0.44 to 0.85, in a shuffled order. */
			arrive: 0.44 + 0.41 * (((i * 5) % pieces.shards.length) / (pieces.shards.length - 1)),
			throwFar: 0.75 + 0.8 * random(),
			side: (random() < 0.5 ? -1 : 1) * (0.35 + 0.4 * random()),
			place: (i / pieces.shards.length) * TAU + (random() - 0.5) * 0.5,
			wind: (random() < 0.5 ? -1 : 1) * (0.8 + 0.8 * random()),
			ring: 2.0 + 0.55 * random(),
			turn: random() * TAU,
			spin: (random() < 0.5 ? -1 : 1) * (5 + 6 * random()),
			face: random() * TAU,
			flip: 7 + 7 * random(),
		};
	});

	function handoff(u: number, sky: SkyScene): number {
		const T = clamp01(u / HANDOFF);
		const s = smoothstep(0, 1, T);
		cam = finalCamera();
		clear();
		sky.introProgress(s);
		const core = sky.coreCircle();
		const veil = 1 - clamp01(u / 0.25);

		// The picture's own black (and the glow round its node) goes with the backdrop.
		into(main, 'word', dpr);
		if (veil > 0) {
			main.globalAlpha = veil;
			main.drawImage(images.wordmark, 0, 0);
			main.globalAlpha = 1;
		}
		const ease = 1 - smoothstep(0, 0.3, u);
		spot(haze, 'word', WORD.node.x, WORD.node.y, WORD.node.r * 3, 0.55 * breath * ease);
		spot(hot, 'word', WORD.node.x, WORD.node.y, WORD.node.r * 0.6, 0.42 * breath * ease);

		// The C and the letters: bleached by the light that spreads from the star,
		// then sinking, one after another, and gone.
		const fall = (0.11 * layout.h) / cam.k;
		for (const { piece, far, rank, tilt, drift } of falling) {
			const from = 0.04 + 0.018 * rank;
			const f = clamp01((s - from) / 0.38);
			const alpha = 1 - smoothstep(0.3, 1, f);
			if (alpha <= 0) continue;
			const bleach = smoothstep(0.02 + 0.3 * far, 0.2 + 0.3 * far, s);
			into(main, 'word', dpr);
			main.translate(piece.cx + drift * f, piece.cy + fall * f ** 1.7);
			main.rotate(tilt * f);
			main.translate(-piece.cx, -piece.cy);
			main.globalAlpha = alpha;
			main.drawImage(piece.canvas, piece.x, piece.y);
			if (bleach > 0) {
				main.globalAlpha = alpha * bleach;
				main.drawImage(piece.light, piece.x, piece.y);
			}
			main.globalAlpha = 1;
		}

		// The star: a blue-white flash, then it is in pieces.
		const s0 = star();
		const sw = WORD.star;
		if (u < BREAK) {
			const p = pieces.star;
			into(main, 'word', dpr);
			main.drawImage(p.canvas, p.x, p.y);
			main.globalAlpha = smoothstep(0, BREAK * 0.8, u);
			main.drawImage(p.light, p.x, p.y);
			main.globalAlpha = 1;
		} else {
			const T0 = BREAK / HANDOFF;
			const since = u - BREAK;
			const base = Math.max(s0.r * 4.2, 0.1 * Math.min(layout.w, layout.h));
			const shardSize = Math.max(15, Math.min(34, 0.036 * Math.min(layout.w, layout.h)));
			for (const f of fragments) {
				const q = clamp01((T - T0) / (smoothstepAt(f.arrive) - T0));
				if (q >= 1) continue;
				const { shard } = f;
				// Thrown outwards on a bend…
				const out = 1 - (1 - Math.min(1, q / 0.42)) ** 3;
				const far = base * f.throwFar * out;
				const bend = base * f.side * Math.sin(Math.PI * Math.min(1, q / 0.85));
				const ca = Math.cos(shard.angle);
				const sa = Math.sin(shard.angle);
				const bx = s0.x + (shard.x - sw.x) * cam.k + ca * far - sa * bend;
				const by = s0.y + (shard.y - sw.y) * cam.k + sa * far + ca * bend;
				// …then drawn in, winding, to its place on a ring round the sky's core.
				const home = smoother((q - 0.3) / 0.7);
				const place = f.place + f.wind * (1 - q) * 1.5;
				const tx = core.x + Math.cos(place) * core.r * f.ring;
				const ty = core.y + Math.sin(place) * core.r * f.ring * 0.92;
				const x = lerp(bx, tx, home);
				const y = lerp(by, ty, home);
				const alpha = 1 - smoothstep(0.8, 1, q);
				const size = shard.size * cam.k;
				// They leave at the star's own size and grow to pieces of a ring: big
				// enough to read on any screen as brass turning in the light.
				const grow = lerp(1, Math.max(1.3, shardSize / size), smoothstep(0, 0.5, q));
				const face = Math.cos(f.face + f.flip * since);
				const unit = (grow * cam.k) / shard.scale;
				main.setTransform(dpr, 0, 0, dpr, dpr * x, dpr * y);
				main.rotate(f.turn + f.spin * since);
				main.scale(unit * Math.max(0.2, Math.abs(face)), unit);
				main.globalAlpha = alpha;
				main.drawImage(shard.canvas, -shard.px, -shard.py);
				// Lit by the star they came from: the brass again, as light.
				const glint = Math.max(0, face) ** 6;
				main.globalCompositeOperation = 'lighter';
				main.globalAlpha = alpha * (0.55 + 0.45 * glint);
				main.drawImage(shard.canvas, -shard.px, -shard.py);
				main.globalCompositeOperation = 'source-over';
				main.globalAlpha = 1;
				// A glint as it turns to face the light.
				spot(hot, 'screen', x, y, size * grow * (0.7 + 1.1 * glint), alpha * (0.16 + 0.7 * glint));
			}
		}
		const flash = u < BREAK ? u / BREAK : 1 - smoothstep(BREAK, 0.55, u);
		spot(hot, 'word', sw.x, sw.y, sw.r * (1.3 + 3.4 * smoothstep(0, 0.22, u)), flash);
		// The light that drowns the word: it swells from the star as the sky's core
		// ignites there, follows the core, and is spent by the time the letters are gone.
		const flood = smoothstep(0.02, 0.3, s) * (1 - smoothstep(0.34, 0.72, s));
		if (flood > 0) {
			const reach = Math.max(layout.w, layout.h) * lerp(0.2, 0.62, smoothstep(0, 0.5, s));
			spot(haze, 'screen', core.x, core.y, reach, 0.85 * flood);
			spot(hot, 'screen', core.x, core.y, reach * 0.3, 0.5 * flood);
		}
		return veil;
	}

	// ───────────────────────────────────────────────────── plumbing ──

	function resize(next: Layout): void {
		layout = next;
		dpr = next.dpr;
		canvas.width = Math.max(1, Math.round(next.w * dpr));
		canvas.height = Math.max(1, Math.round(next.h * dpr));
		// The halo's grain follows the screen: on a phone the word is small, and
		// a halo as coarse as the desktop's would swallow it.
		const grain = Math.max(0.42, Math.min(1, Math.min(next.w, next.h) / 900));
		levels.forEach((level, i) => {
			level.texel = TEXELS[i] * grain;
		});
		let w = next.w / levels[0].texel;
		let h = next.h / levels[0].texel;
		for (const level of levels) {
			level.canvas.width = Math.max(1, Math.ceil(w));
			level.canvas.height = Math.max(1, Math.ceil(h));
			w = level.canvas.width / 4;
			h = level.canvas.height / 4;
		}
		glowing = true;
		// The lit C at the size framing A shows it (never past the picture's own).
		const size = Math.min(SPRITE.w, Math.ceil(SPRITE.w * next.kA * E.scale * dpr));
		reveal.width = reveal.height = Math.max(1, size);
		revealKey = Number.NaN;

		// The overload's wash: light that falls off as 1 / (1 + d / w0) either
		// side of the bolt (measured on the reference), and dims below the node.
		if (script.strike) {
			const w0 = 0.085 * Math.sqrt(next.w * next.h);
			washReach = 8 * w0;
			wash = makeCanvas(256, 64);
			const c = context(wash);
			const across = c.createLinearGradient(0, 0, 256, 0);
			for (let i = 0; i <= 64; i++) {
				const f = Math.abs(i / 32 - 1);
				// Flat across the bolt itself, so the column has no bright seam down its middle.
				const d = Math.max(f, 0.035);
				across.addColorStop(i / 64, `rgb(46 117 255 / ${(0.78 / (1 + 8 * d)) * (1 - f * f)})`);
			}
			c.fillStyle = across;
			c.fillRect(0, 0, 256, 64);
			const at = clamp01(
				(next.cy + (LENS_W.y - (E.y + E.scale * (SPRITE.c.y + SPRITE.c.h / 2))) * next.kA) / next.h,
			);
			const down = c.createLinearGradient(0, 0, 0, 64);
			down.addColorStop(0, 'rgb(0 0 0 / 0.9)');
			down.addColorStop(Math.max(0.01, at - 0.2), 'rgb(0 0 0)');
			down.addColorStop(at, 'rgb(0 0 0)');
			down.addColorStop(Math.min(0.99, at + 0.14), 'rgb(0 0 0 / 0.5)');
			down.addColorStop(1, 'rgb(0 0 0 / 0.28)');
			c.globalCompositeOperation = 'destination-in';
			c.fillStyle = down;
			c.fillRect(0, 0, 256, 64);
		}
	}

	function snapshot(): HTMLCanvasElement {
		const copy = makeCanvas(canvas.width, canvas.height);
		const c = context(copy);
		c.fillStyle = '#000';
		c.fillRect(0, 0, copy.width, copy.height);
		c.drawImage(canvas, 0, 0);
		return copy;
	}

	function dissolve(from: HTMLCanvasElement, amount: number): void {
		if (amount >= 1) return;
		main.setTransform(1, 0, 0, 1, 0, 0);
		main.globalCompositeOperation = 'source-over';
		main.globalAlpha = 1 - clamp01(amount);
		main.drawImage(from, 0, 0, canvas.width, canvas.height);
		main.globalAlpha = 1;
	}

	function release(): void {
		const all = [
			canvas,
			reveal,
			scrap,
			hot,
			haze,
			disc,
			...levels.map((l) => l.canvas),
			pieces.emblem.canvas,
			pieces.emblem.light,
			pieces.star.canvas,
			pieces.star.light,
			...pieces.letters.flatMap((p) => [p.canvas, p.light]),
			...pieces.shards.map((s) => s.canvas),
		];
		if (wash) all.push(wash);
		for (const c of all) c.width = c.height = 0;
	}

	return { resize, intro, handoff, star, snapshot, dissolve, release };
}
