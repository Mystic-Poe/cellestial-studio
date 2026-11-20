// C4, the teleport flash: the emblem's circuits seen very close up.
//
// A printed circuit is laid out on a grid by a seeded router: runs along the
// direction of travel with 45° jogs and the odd right-angle step, in ribbons
// of one to three parallel lines, each line ending in a small ring node, as
// the lines of A1 do. The frame goes black behind them as they grow, the
// middle blooms blue-white, and then the traces fade and the black clears.
//
// The picture is a function of the seed, the frame size and the time.

import { BLUE_RGB, BLUE_WHITE_RGB, rgba } from '../tokens.ts';
import {
	BLACK_INK,
	BLUE_INK,
	type Ctx,
	clamp,
	easeOut,
	lightStops,
	mix,
	PALE_INK,
	smooth,
	spot,
} from './light.ts';
import { hash, noise, type Rng, rng } from './rng.ts';

export type FlashDir = 'up' | 'down' | 'none';

/** The whole flash, not counting a wait for swap(). */
export const FLASH_MS = 400;
/** Where in it the section swaps, and where a wait for swap() is held. */
export const FLASH_PEAK = 0.5;
/** Between these the frame is solid black from edge to edge, whatever else is drawn. */
export const FLASH_SOLID_FROM = 0.34;
export const FLASH_SOLID_TO = 0.62;
/** Reduced motion: this long to black, and this long back. */
export const FADE_MS = 200;

export interface Flash {
	/** Lay the circuit out again for a frame of this size, in CSS pixels. */
	resize(w: number, h: number): void;
	/** The frame at `u` (0 to 1 of the flash), `held` ms into a wait at the peak. */
	draw(g: Ctx, u: number, held: number): void;
	/** Give back the memory of its off-screen layers. */
	dispose(): void;
}

// ─────────────────────────────────────────────────────────── the layout ──

// The eight ways across the grid: N, NE, E, SE, S, SW, W, NW.
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const UNIT = DX.map((dx, d) => {
	const l = Math.hypot(dx, DY[d]);
	return [dx / l, DY[d] / l] as const;
});
const SOUTH = 4;

interface Grid {
	pitch: number;
	cols: number;
	rows: number;
	ox: number;
	oy: number;
	/** A line passes through this point. */
	used: Uint8Array;
	/** A diagonal crosses this cell: 1 for "\", 2 for "/". */
	cut: Uint8Array;
}

interface Line {
	/** A polyline in CSS pixels, corners already rounded: x0, y0, x1, y1, … */
	pts: Float32Array;
	/** The length along it at each point. */
	cum: Float32Array;
	len: number;
	/** Ring node at its end, and at its start; 0 where it runs off the frame. */
	endNode: number;
	startNode: number;
	/** When it starts to grow and for how long, in u. */
	grow: number;
	growFor: number;
	/** A bead of light runs along it from this offset at this speed (px per ms); speed 0 for none. */
	bead: number;
	beadSpeed: number;
	/** 0 a far line (thin and dim), 1 a near one, 2 one of the hub's rings. */
	near: 0 | 1 | 2;
	id: number;
}

interface Layout {
	lines: Line[];
	pitch: number;
}

function makeGrid(w: number, h: number, pitch: number): Grid {
	// Two cells of overscan on every side, and a point exactly on the middle.
	const half = (span: number) => Math.ceil(span / 2 / pitch) + 2;
	const cols = half(w) * 2 + 1;
	const rows = half(h) * 2 + 1;
	return {
		pitch,
		cols,
		rows,
		ox: w / 2 - half(w) * pitch,
		oy: h / 2 - half(h) * pitch,
		used: new Uint8Array(cols * rows),
		cut: new Uint8Array(cols * rows),
	};
}

interface Walk {
	/** i0, j0, i1, j1, … */
	cells: number[];
	/** It ran off the edge of the grid: no node where it ends. */
	open: boolean;
}

/**
 * Route one line from (i, j). It keeps its heading for long runs, turns 45°
 * at a time, never touches a point another line owns and never crosses a
 * diagonal. `along(d, i, j)` says how well heading `d` follows the flow there
 * (1 with it, 0 across it, negative against it); off the flow it goes `jog`
 * steps at most before it turns back.
 */
function walk(
	grid: Grid,
	rand: Rng,
	i0: number,
	j0: number,
	d0: number,
	budget: number,
	jog: number,
	along: (d: number, i: number, j: number) => number,
): Walk | null {
	const { cols, rows, used, cut } = grid;
	if (used[j0 * cols + i0]) return null;
	const cells = [i0, j0];
	const marks: number[] = [j0 * cols + i0];
	const cuts: number[] = [];
	used[j0 * cols + i0] = 1;
	let i = i0;
	let j = j0;
	let d = d0;
	// Steps since the last turn. A line starts with a run.
	let run = 0;
	let open = false;
	for (let step = 0; step < budget; step++) {
		let pick = -1;
		let total = 0;
		const weights = [0, 0, 0];
		// A run is at least two steps square to the grid, one on a diagonal.
		const mayTurn = run >= (d % 2 === 0 ? 2 : 1);
		for (let o = 0; o < 3; o++) {
			const turn = o === 0 ? 0 : o === 1 ? -1 : 1;
			if (turn !== 0 && !mayTurn) continue;
			const nd = (d + turn + 8) % 8;
			const ni = i + DX[nd];
			const nj = j + DY[nd];
			if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) {
				// Straight off the grid: the line leaves the frame.
				if (turn === 0) weights[o] = 4;
				continue;
			}
			if (used[nj * cols + ni]) continue;
			if (nd % 2 === 1) {
				const cell = Math.min(j, nj) * cols + Math.min(i, ni);
				const kind = DX[nd] * DY[nd] > 0 ? 1 : 2;
				if (cut[cell] && cut[cell] !== kind) continue;
			}
			const a = along(nd, ni, nj);
			if (a < -0.05) continue;
			// A run that does not follow the flow is a jog, and a jog is short.
			if (turn === 0 && a < 0.86 && run >= jog) continue;
			weights[o] = (turn === 0 ? 3.2 + 4.5 * Math.max(0, a) ** 3 : 1) * (0.22 + a) ** 1.6;
		}
		total = weights[0] + weights[1] + weights[2];
		if (total <= 0) break;
		let r = rand() * total;
		for (let o = 0; o < 3; o++) {
			r -= weights[o];
			if (r < 0) {
				pick = o;
				break;
			}
		}
		if (pick < 0) pick = 0;
		const turn = pick === 0 ? 0 : pick === 1 ? -1 : 1;
		const nd = (d + turn + 8) % 8;
		const ni = i + DX[nd];
		const nj = j + DY[nd];
		if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) {
			open = true;
			break;
		}
		if (nd % 2 === 1) {
			const cell = Math.min(j, nj) * cols + Math.min(i, ni);
			if (!cut[cell]) {
				cut[cell] = DX[nd] * DY[nd] > 0 ? 1 : 2;
				cuts.push(cell);
			}
		}
		used[nj * cols + ni] = 1;
		marks.push(nj * cols + ni);
		cells.push(ni, nj);
		run = turn === 0 ? run + 1 : 1;
		i = ni;
		j = nj;
		d = nd;
	}
	if (cells.length < 8) {
		// Too short to read as a trace: give its points back.
		for (const m of marks) used[m] = 0;
		for (const c of cuts) cut[c] = 0;
		return null;
	}
	return { cells, open };
}

/** The corners of a walk, in CSS pixels: its first point, every bend, its last. */
function corners(grid: Grid, cells: number[]): number[] {
	const { pitch, ox, oy } = grid;
	const out: number[] = [];
	const n = cells.length / 2;
	for (let k = 0; k < n; k++) {
		if (k > 0 && k < n - 1) {
			const ax = cells[2 * k] - cells[2 * k - 2];
			const ay = cells[2 * k + 1] - cells[2 * k - 1];
			const bx = cells[2 * k + 2] - cells[2 * k];
			const by = cells[2 * k + 3] - cells[2 * k + 1];
			if (ax === bx && ay === by) continue;
		}
		out.push(ox + cells[2 * k] * pitch, oy + cells[2 * k + 1] * pitch);
	}
	return out;
}

/**
 * A line parallel to the corners `v`, `d` pixels to the right of the way it
 * runs, its bends rounded on a shared centre so a ribbon stays evenly spaced
 * through a turn.
 */
function ribbon(v: number[], d: number, radius: number): number[] {
	const n = v.length / 2;
	const ux: number[] = [];
	const uy: number[] = [];
	for (let k = 0; k < n - 1; k++) {
		const dx = v[2 * k + 2] - v[2 * k];
		const dy = v[2 * k + 3] - v[2 * k + 1];
		const l = Math.hypot(dx, dy) || 1;
		ux.push(dx / l);
		uy.push(dy / l);
	}
	// The mitred corners of the parallel line. The right of (ux, uy) is (−uy, ux).
	const q: number[] = [];
	for (let k = 0; k < n; k++) {
		const a = Math.max(0, k - 1);
		const b = Math.min(n - 2, k);
		const nx = -uy[a] - uy[b];
		const ny = ux[a] + ux[b];
		const m = d / (1 + ux[a] * ux[b] + uy[a] * uy[b]);
		q.push(v[2 * k] + nx * m, v[2 * k + 1] + ny * m);
	}
	const out: number[] = [q[0], q[1]];
	for (let k = 1; k < n - 1; k++) {
		const ax = ux[k - 1];
		const ay = uy[k - 1];
		const bx = ux[k];
		const by = uy[k];
		const cos = clamp(ax * bx + ay * by, -1, 1);
		const turn = ax * by - ay * bx;
		const r = Math.max(1.5, radius - d * Math.sign(turn));
		const before = Math.hypot(q[2 * k] - q[2 * k - 2], q[2 * k + 1] - q[2 * k - 1]);
		const after = Math.hypot(q[2 * k + 2] - q[2 * k], q[2 * k + 3] - q[2 * k + 1]);
		const reach = Math.min(
			r * Math.sqrt((1 - cos) / (1 + cos + 1e-6)),
			0.46 * before,
			0.46 * after,
		);
		const px = q[2 * k];
		const py = q[2 * k + 1];
		const x1 = px - ax * reach;
		const y1 = py - ay * reach;
		const x2 = px + bx * reach;
		const y2 = py + by * reach;
		const steps = cos < 0.5 ? 6 : 4;
		for (let s = 0; s <= steps; s++) {
			const t = s / steps;
			const e = 1 - t;
			out.push(e * e * x1 + 2 * e * t * px + t * t * x2, e * e * y1 + 2 * e * t * py + t * t * y2);
		}
	}
	out.push(q[2 * n - 2], q[2 * n - 1]);
	return out;
}

/** The part of a polyline between two lengths along it, with its running length. */
function cutLine(
	poly: number[],
	from: number,
	to: number,
): { pts: Float32Array; cum: Float32Array } {
	const out: number[] = [];
	let at = 0;
	for (let k = 0; k < poly.length / 2 - 1; k++) {
		const x0 = poly[2 * k];
		const y0 = poly[2 * k + 1];
		const x1 = poly[2 * k + 2];
		const y1 = poly[2 * k + 3];
		const l = Math.hypot(x1 - x0, y1 - y0);
		const end = at + l;
		if (l > 0 && end > from && at < to) {
			const a = clamp((from - at) / l);
			const b = clamp((to - at) / l);
			if (out.length === 0) out.push(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a);
			out.push(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
		}
		at = end;
	}
	const pts = Float32Array.from(out);
	const cum = new Float32Array(pts.length / 2);
	for (let k = 1; k < cum.length; k++) {
		cum[k] = cum[k - 1] + Math.hypot(pts[2 * k] - pts[2 * k - 2], pts[2 * k + 1] - pts[2 * k - 1]);
	}
	return { pts, cum };
}

function lengthOf(poly: number[]): number {
	let l = 0;
	for (let k = 0; k < poly.length / 2 - 1; k++) {
		l += Math.hypot(poly[2 * k + 2] - poly[2 * k], poly[2 * k + 3] - poly[2 * k + 1]);
	}
	return l;
}

interface LayerSpec {
	pitch: number;
	near: 0 | 1;
	/** How much of the grid to fill before stopping, 0 to 1. */
	fill: number;
	/** Chance that a line is a ribbon of two, and of three. */
	two: number;
	three: number;
	node: number;
	gap: number;
	/** Nothing is routed within this many pixels of the middle: the hub's ground. */
	hub: number;
}

/** One layer of circuitry, routed for travel downward or outward from the middle. */
function route(
	seed: number,
	radial: boolean,
	w: number,
	h: number,
	spec: LayerSpec,
	out: Line[],
): void {
	const rand = rng(seed);
	const grid = makeGrid(w, h, spec.pitch);
	const { cols, rows, pitch, used } = grid;
	const ci = (cols - 1) / 2;
	const cj = (rows - 1) / 2;
	const reach = Math.hypot(w, h) / 2;

	const along = radial
		? (d: number, i: number, j: number) => {
				const rx = i - ci;
				const ry = j - cj;
				const l = Math.hypot(rx, ry) || 1;
				return (UNIT[d][0] * rx + UNIT[d][1] * ry) / l;
			}
		: (d: number) => UNIT[d][1];

	/** The grid heading nearest the flow at a point, nudged now and then. */
	const heading = (i: number, j: number): number => {
		if (!radial) return rand() < 0.16 ? (rand() < 0.5 ? 3 : 5) : SOUTH;
		const a = Math.atan2(j - cj, i - ci);
		// atan2 is 0 at east and grows clockwise on screen; heading 2 is east.
		return (Math.round(a / (Math.PI / 4)) + 2 + 8) % 8;
	};

	const walks: Walk[] = [];
	const want = spec.fill * cols * rows;
	let filled = 0;
	const keep = (wk: Walk | null) => {
		if (!wk) return;
		walks.push(wk);
		filled += wk.cells.length / 2;
	};

	// The hub's ground: no line is routed through the middle.
	const clear = Math.ceil(spec.hub / pitch);
	for (let dj = -clear; dj <= clear; dj++) {
		for (let di = -clear; di <= clear; di++) {
			if (Math.hypot(di, dj) * pitch <= spec.hub) used[(cj + dj) * cols + ci + di] = 1;
		}
	}
	if (radial) {
		// Lines leave the hub all round.
		const ring: [number, number][] = [];
		const at = clear + 1;
		for (let dj = -at; dj <= at; dj++) {
			for (let di = -at; di <= at; di++) {
				if (Math.max(Math.abs(di), Math.abs(dj)) === at) ring.push([ci + di, cj + dj]);
			}
		}
		for (let k = ring.length - 1; k > 0; k--) {
			const s = Math.floor(rand() * (k + 1));
			[ring[k], ring[s]] = [ring[s], ring[k]];
		}
		for (const [i, j] of ring) {
			if (rand() < 0.8)
				keep(walk(grid, rand, i, j, heading(i, j), cols + rows, 1 + Math.floor(rand() * 3), along));
		}
	} else {
		// Lines that come in over the leading edge. Some run the whole frame.
		const order: number[] = [];
		for (let i = 0; i < cols; i++) order.push(i);
		for (let k = order.length - 1; k > 0; k--) {
			const s = Math.floor(rand() * (k + 1));
			[order[k], order[s]] = [order[s], order[k]];
		}
		for (const i of order) {
			if (rand() > 0.62) continue;
			const far = rand() < 0.42;
			const budget = far ? rows * 2 : Math.round(rows * (0.25 + rand() * 0.5));
			keep(walk(grid, rand, i, 0, SOUTH, budget, 1 + Math.floor(rand() * 3), along));
		}
	}
	// Lines that start inside the frame, until the frame is full enough. Each
	// starts in the emptiest of a few places tried, so no part is left bare.
	const room = (i: number, j: number): number => {
		let free = 0;
		for (let dj = -2; dj <= 2; dj++) {
			for (let di = -2; di <= 2; di++) {
				const ni = i + di;
				const nj = j + dj;
				if (ni >= 0 && nj >= 0 && ni < cols && nj < rows && !used[nj * cols + ni]) free++;
			}
		}
		return free;
	};
	for (let tries = 0; tries < cols * rows && filled < want; tries++) {
		let bi = -1;
		let bj = -1;
		let best = 0;
		for (let c = 0; c < 5; c++) {
			const i = Math.floor(rand() * cols);
			const j = Math.floor(rand() * (radial ? rows : rows - 3));
			if (used[j * cols + i]) continue;
			const free = room(i, j) + rand();
			if (free > best) {
				best = free;
				bi = i;
				bj = j;
			}
		}
		if (bi < 0) continue;
		const budget = 4 + Math.floor(rand() ** 1.6 * (radial ? 14 : 18));
		keep(walk(grid, rand, bi, bj, heading(bi, bj), budget, 1 + Math.floor(rand() * 3), along));
	}

	const inFrame = (x: number, y: number, m: number) => x > -m && y > -m && x < w + m && y < h + m;
	for (const wk of walks) {
		const v = corners(grid, wk.cells);
		const x0 = v[0];
		const y0 = v[1];
		const x1 = v[v.length - 2];
		const y1 = v[v.length - 1];
		const roll = rand();
		const count = roll < spec.three ? 3 : roll < spec.three + spec.two ? 2 : 1;
		// Where along the flow it starts: orders the wave.
		const lead = radial
			? clamp(Math.hypot(x0 - w / 2, y0 - h / 2) / reach)
			: clamp((y0 + pitch) / (h + 2 * pitch));
		const starts = inFrame(x0, y0, 0);
		const ends = !wk.open && inFrame(x1, y1, 0);
		// A ribbon's lines stop one after another, so its nodes sit in a row.
		const comb = pitch * (0.42 + rand() * 0.3);
		const flipStart = rand() < 0.5;
		const flipEnd = rand() < 0.5;
		for (let k = 0; k < count; k++) {
			const d = (k - (count - 1) / 2) * spec.gap;
			const poly = ribbon(v, d, pitch * 0.36);
			const full = lengthOf(poly);
			const node = spec.node * (count === 1 && rand() < 0.3 ? 1.35 : 1);
			const a = (flipStart ? count - 1 - k : k) * comb;
			const b = (flipEnd ? count - 1 - k : k) * comb;
			const from = starts ? a + node : 0;
			const to = ends ? full - b - node : full;
			if (to - from < pitch * 1.2) continue;
			const { pts, cum } = cutLine(poly, from, to);
			if (cum.length < 2) continue;
			const len = cum[cum.length - 1];
			const span = clamp(len / (h * 0.9));
			out.push({
				pts,
				cum,
				len,
				startNode: starts ? node : 0,
				endNode: ends ? node : 0,
				grow: lead * 0.18 + rand() * 0.03,
				growFor: 0.13 + 0.1 * span + rand() * 0.02,
				bead: rand() * (len + 260),
				beadSpeed: rand() < (spec.near ? 0.62 : 0.2) ? 1.5 + rand() * 1.4 : 0,
				near: spec.near,
				id: out.length,
			});
		}
	}
}

/**
 * The hub in the middle of the frame, drawn like the emblem's main node: a
 * ring round the light, and broken rings round that, each ending in a node.
 */
function hub(seed: number, w: number, h: number, pitch: number, out: Line[]): void {
	const rand = rng(seed ^ 0x2f6b);
	const node = clamp(pitch * 0.12, 3.2, 5.5);
	const arc = (r: number, a0: number, a1: number, nodes: boolean, order: number): void => {
		const poly: number[] = [];
		const steps = Math.max(8, Math.ceil(((a1 - a0) * r) / 4));
		for (let k = 0; k <= steps; k++) {
			const a = a0 + ((a1 - a0) * k) / steps;
			poly.push(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
		}
		const { pts, cum } = cutLine(poly, 0, lengthOf(poly));
		out.push({
			pts,
			cum,
			len: cum[cum.length - 1],
			startNode: nodes ? node : 0,
			endNode: nodes ? node : 0,
			grow: 0.02 + 0.04 * order,
			growFor: 0.2,
			bead: 0,
			beadSpeed: 0,
			near: 2,
			id: out.length,
		});
	};
	arc(pitch * 0.56, 0, Math.PI * 2, false, 0);
	const turn = rand() * Math.PI * 2;
	const gap = 0.42;
	arc(pitch * 0.94, turn + gap, turn + Math.PI - gap, true, 1);
	arc(pitch * 0.94, turn + Math.PI + gap, turn + Math.PI * 2 - gap, true, 1);
	const turn2 = rand() * Math.PI * 2;
	for (let k = 0; k < 3; k++) {
		const a = turn2 + (k * Math.PI * 2) / 3;
		arc(pitch * 1.32, a + 0.34, a + (Math.PI * 2) / 3 - 0.34, true, 2);
	}
}

function layout(seed: number, dir: FlashDir, w: number, h: number): Layout {
	const lines: Line[] = [];
	// "Very close up": about fourteen lanes across a phone, thirty-four across a desktop.
	const pitch = clamp(Math.sqrt(w * h) / 26, 27, 42);
	const radial = dir === 'none';
	const keepClear = pitch * 1.5;
	route(
		seed ^ 0x51ed,
		radial,
		w,
		h,
		{
			pitch: pitch * 0.5,
			near: 0,
			fill: 0.2,
			two: 0.2,
			three: 0,
			node: pitch * 0.07,
			gap: pitch * 0.17,
			hub: keepClear,
		},
		lines,
	);
	route(
		seed,
		radial,
		w,
		h,
		{
			pitch,
			near: 1,
			fill: 0.5,
			two: 0.3,
			three: 0.26,
			node: clamp(pitch * 0.17, 4.5, 7.5),
			gap: clamp(pitch * 0.27, 7, 11),
			hub: keepClear,
		},
		lines,
	);
	hub(seed, w, h, pitch, lines);
	if (dir === 'up') {
		for (const l of lines) for (let k = 1; k < l.pts.length; k += 2) l.pts[k] = h - l.pts[k];
	}
	return { lines, pitch };
}

// ───────────────────────────────────────────────────────────── drawing ──
//
// Stroking the whole circuit costs more than a frame allows, so it is inked
// once, a little more each frame as the lines grow, onto an off-screen layer
// the size of the frame. A frame is then that layer laid over the black (and
// again, for heat, at the peak), with the few things that move drawn on top:
// the white-hot heads, the beads, the flares.

/** Add the part of a line between two lengths along it to the current path. */
function addSpan(g: Ctx, l: Line, from: number, to: number): void {
	if (to - from < 0.25) return;
	const { pts, cum } = l;
	const n = cum.length;
	let k = 1;
	while (k < n - 1 && cum[k] <= from) k++;
	let seg = cum[k] - cum[k - 1] || 1;
	let t = (from - cum[k - 1]) / seg;
	g.moveTo(
		pts[2 * k - 2] + (pts[2 * k] - pts[2 * k - 2]) * t,
		pts[2 * k - 1] + (pts[2 * k + 1] - pts[2 * k - 1]) * t,
	);
	while (k < n - 1 && cum[k] < to) {
		g.lineTo(pts[2 * k], pts[2 * k + 1]);
		k++;
	}
	seg = cum[k] - cum[k - 1] || 1;
	t = clamp((to - cum[k - 1]) / seg);
	g.lineTo(
		pts[2 * k - 2] + (pts[2 * k] - pts[2 * k - 2]) * t,
		pts[2 * k - 1] + (pts[2 * k + 1] - pts[2 * k - 1]) * t,
	);
}

const at: [number, number] = [0, 0];
/** The point a given length along a line, left in `at`. */
function pointAt(l: Line, s: number): void {
	const { pts, cum } = l;
	const n = cum.length;
	let k = 1;
	while (k < n - 1 && cum[k] < s) k++;
	const seg = cum[k] - cum[k - 1] || 1;
	const t = clamp((s - cum[k - 1]) / seg);
	at[0] = pts[2 * k - 2] + (pts[2 * k] - pts[2 * k - 2]) * t;
	at[1] = pts[2 * k - 1] + (pts[2 * k + 1] - pts[2 * k - 1]) * t;
}

/** How far the circuit drifts the way of travel over the whole flash, as a share of the height. */
const DRIFT = 0.07;
/** The black comes and goes in this many strips. */
const STRIPS = 36;

/** The blue with the blue-white added at strength `t`: the colour of a line's core. */
function hot(t: number): string {
	return rgba([
		Math.min(1, BLUE_RGB[0] + BLUE_WHITE_RGB[0] * t),
		Math.min(1, BLUE_RGB[1] + BLUE_WHITE_RGB[1] * t),
		Math.min(1, BLUE_RGB[2] + BLUE_WHITE_RGB[2] * t),
	]);
}

/** Add the ring node at the start or the end of a line to the current path. */
function addNode(g: Ctx, l: Line, atEnd: boolean): void {
	const p = l.pts;
	const e = p.length;
	const r = atEnd ? l.endNode : l.startNode;
	// One radius out from the line's last point, straight on.
	const x = atEnd ? p[e - 2] : p[0];
	const y = atEnd ? p[e - 1] : p[1];
	const dx = atEnd ? x - p[e - 4] : x - p[2];
	const dy = atEnd ? y - p[e - 3] : y - p[3];
	const m = r / (Math.hypot(dx, dy) || 1);
	g.moveTo(x + dx * m + r, y + dy * m);
	g.arc(x + dx * m, y + dy * m, r, 0, Math.PI * 2);
}

/** The black behind the circuit. It leads from where the travel starts. */
function cover(g: Ctx, dir: FlashDir, u: number): void {
	if (u <= 0 || u >= 1) return;
	const { width, height } = g.canvas;
	g.save();
	// In device pixels, so that the strips meet on whole pixels and leave no seams.
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.fillStyle = BLACK_INK;
	if (u >= FLASH_SOLID_FROM && u <= FLASH_SOLID_TO) {
		g.fillRect(0, 0, width, height);
		g.restore();
		return;
	}
	// Alpha at the edge the travel starts from, and at the edge it ends on.
	let a0: number;
	let a1: number;
	if (u < FLASH_SOLID_FROM) {
		a0 = smooth(0, 0.2, u);
		a1 = smooth(0.1, FLASH_SOLID_FROM, u);
	} else {
		a0 = 1 - smooth(FLASH_SOLID_TO, 0.88, u);
		a1 = 1 - smooth(0.74, 1, u);
	}
	if (dir === 'none') {
		g.globalAlpha = (a0 + a1) / 2;
		g.fillRect(0, 0, width, height);
	} else {
		// Flat strips, not a gradient: a gradient this size costs many times as much.
		for (let i = 0; i < STRIPS; i++) {
			const p = (i + 0.5) / STRIPS;
			const y0 = Math.round((i * height) / STRIPS);
			const y1 = Math.round(((i + 1) * height) / STRIPS);
			g.globalAlpha = mix(a0, a1, dir === 'down' ? p : 1 - p);
			g.fillRect(0, y0, width, y1 - y0);
		}
	}
	g.restore();
}

/** Reduced motion: black at this strength and nothing else. */
export function drawFade(g: Ctx, w: number, h: number, alpha: number): void {
	if (alpha <= 0) return;
	g.globalAlpha = clamp(alpha);
	g.fillStyle = BLACK_INK;
	g.fillRect(-2, -2, w + 4, h + 4);
	g.globalAlpha = 1;
}

export function createFlash(seed: number, dir: FlashDir, width: number, height: number): Flash {
	let w = width;
	let h = height;
	let art = layout(seed, dir, w, h);
	/** How far along each line its head is now. */
	let heads = new Float32Array(art.lines.length);

	// The layer, and how much of each line is inked on it so far.
	const ink = document.createElement('canvas');
	const pen = ink.getContext('2d');
	let inked = new Float32Array(0);
	/** Bit 1: the node at its start is inked. Bit 2: the node at its end. */
	let nodes = new Uint8Array(0);
	let core: CanvasGradient | null = null;
	/** The bloom of the peak, drawn once. */
	let halo: HTMLCanvasElement | null = null;
	/** The frame, in device pixels, that the layer was made for; its spare rows above and below. */
	let fw = 0;
	let fh = 0;
	let margin = 0;
	let lastU = 0;

	/** A clean layer for a frame of `pw` by `ph` device pixels. */
	const prepare = (pw: number, ph: number): void => {
		fw = pw;
		fh = ph;
		margin = dir === 'none' ? 0 : Math.ceil((DRIFT / 2) * ph) + 2;
		// Setting its size wipes it.
		ink.width = pw;
		ink.height = ph + 2 * margin;
		halo = null;
		inked = new Float32Array(art.lines.length);
		nodes = new Uint8Array(art.lines.length);
		if (!pen) return;
		// Inked in CSS pixels, as the frame is drawn.
		pen.setTransform(pw / w, 0, 0, ph / h, 0, margin);
		pen.lineJoin = 'round';
		// The cores are white-hot in the middle of the frame and bluer towards its edges.
		core = pen.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
		core.addColorStop(0, hot(1));
		core.addColorStop(0.22, hot(0.8));
		core.addColorStop(0.5, hot(0.46));
		core.addColorStop(0.8, hot(0.26));
		core.addColorStop(1, hot(0.18));
	};

	const makeHalo = (pw: number, ph: number): HTMLCanvasElement => {
		const c = document.createElement('canvas');
		c.width = pw;
		c.height = ph;
		const g = c.getContext('2d');
		if (g) {
			// A blue-white heart and a wide blue skirt, out past the corners.
			const grad = g.createRadialGradient(
				pw / 2,
				ph / 2,
				0,
				pw / 2,
				ph / 2,
				Math.hypot(pw, ph) * 0.7,
			);
			lightStops(
				grad,
				(p) => 0.95 * (1 - p) ** 2.1 + 0.7 * Math.max(0, 1 - p / 0.3) ** 2,
				(p) => 1.15 * Math.max(0, 1 - p / 0.34) ** 1.2,
				18,
			);
			g.fillStyle = grad;
			g.fillRect(0, 0, pw, ph);
		}
		return c;
	};

	/** Ink onto the layer what has grown since the last frame. */
	const advance = (): void => {
		if (!pen || !core) return;
		const { lines, pitch } = art;
		const body = clamp(pitch * 0.085, 2.4, 3.4);
		const thread = clamp(pitch * 0.03, 0.95, 1.3);
		const grew = (k: number): boolean => heads[k] - inked[k] >= 0.25;

		// The far lines: thin and dim. Where one passes under a near line the brighter ink stays.
		pen.globalCompositeOperation = 'lighten';
		pen.lineCap = 'butt';
		pen.strokeStyle = BLUE_INK;
		pen.beginPath();
		for (let k = 0; k < lines.length; k++) {
			if (lines[k].near === 0 && grew(k)) addSpan(pen, lines[k], inked[k], heads[k]);
		}
		pen.globalAlpha = 0.55;
		pen.lineWidth = 1.1;
		pen.stroke();
		pen.globalCompositeOperation = 'source-over';

		// The near lines. Their glow is see-through, so each new stretch of it
		// starts exactly where the last one stopped ...
		pen.beginPath();
		for (let k = 0; k < lines.length; k++) {
			if (lines[k].near !== 0 && grew(k)) addSpan(pen, lines[k], inked[k], heads[k]);
		}
		pen.globalAlpha = 0.09;
		pen.lineWidth = pitch * 0.52;
		pen.stroke();
		pen.globalAlpha = 0.22;
		pen.lineWidth = pitch * 0.22;
		pen.stroke();
		// ... and the line itself is solid, so it overlaps the last and shows no join.
		pen.lineCap = 'round';
		pen.beginPath();
		for (let k = 0; k < lines.length; k++) {
			if (lines[k].near !== 0 && grew(k)) {
				addSpan(pen, lines[k], Math.max(0, inked[k] - 1.5), heads[k]);
			}
		}
		pen.globalAlpha = 1;
		pen.lineWidth = body;
		pen.stroke();
		pen.strokeStyle = core;
		pen.lineWidth = thread;
		pen.stroke();

		// The ring nodes: one where a line starts, one where its head has arrived.
		for (let near = 0; near <= 1; near++) {
			let any = false;
			pen.beginPath();
			for (let k = 0; k < lines.length; k++) {
				const l = lines[k];
				if ((l.near === 0) === (near === 1)) continue;
				if (l.startNode && !(nodes[k] & 1) && heads[k] > 0) {
					nodes[k] |= 1;
					addNode(pen, l, false);
					any = true;
				}
				if (l.endNode && !(nodes[k] & 2) && heads[k] >= l.len - 0.5) {
					nodes[k] |= 2;
					addNode(pen, l, true);
					any = true;
				}
			}
			if (!any) continue;
			pen.fillStyle = BLUE_INK;
			pen.strokeStyle = BLUE_INK;
			if (near) {
				pen.globalAlpha = 0.36;
				pen.fill();
				pen.globalAlpha = 0.24;
				pen.lineWidth = pitch * 0.2;
				pen.stroke();
				pen.globalAlpha = 1;
				pen.lineWidth = body;
				pen.stroke();
				pen.strokeStyle = core;
				pen.lineWidth = thread;
				pen.stroke();
			} else {
				pen.globalAlpha = 0.6;
				pen.fill();
			}
		}
		for (let k = 0; k < lines.length; k++) if (grew(k)) inked[k] = heads[k];
	};

	const draw = (g: Ctx, u: number, held: number): void => {
		cover(g, dir, u);
		if (u <= 0 || u >= 1 || !pen) return;
		const pw = g.canvas.width;
		const ph = g.canvas.height;
		// A new frame size, or time run backwards: start the layer again.
		if (pw !== fw || ph !== fh || u < lastU) prepare(pw, ph);
		lastU = u;
		const { lines, pitch } = art;
		/** Milliseconds of life so far: beads and flicker run on it, through a wait as well. */
		const life = u * FLASH_MS + held;
		const flicker = 0.88 + 0.24 * noise(life / 46, seed & 0xffff);
		// The traces brighten into the peak, and fade away after it.
		const lit = u < FLASH_PEAK ? mix(0.55, 1, smooth(0.04, 0.44, u)) : 1;
		const fade = 1 - smooth(FLASH_SOLID_TO - 0.04, 0.97, u);
		const bloom = Math.exp(-(((u - FLASH_PEAK) / 0.16) ** 2)) * flicker;
		const live = lit * fade;

		for (let k = 0; k < lines.length; k++) {
			const l = lines[k];
			heads[k] = l.len * easeOut(clamp((u - l.grow) / l.growFor));
		}
		advance();

		// The circuit drifts the way of travel: by whole device pixels, so the
		// layer is copied onto the frame and never resampled.
		const sign = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
		const shift = Math.round(sign * DRIFT * ph * (u - FLASH_PEAK));
		g.save();
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.globalCompositeOperation = 'lighter';
		g.globalAlpha = clamp(live);
		g.drawImage(ink, 0, margin - shift, pw, ph, 0, 0, pw, ph);
		// And again at the peak: the lines burn hotter and their cores go white.
		const heat = 0.55 * clamp(bloom) * fade;
		if (heat > 0.02) {
			g.globalAlpha = heat;
			g.drawImage(ink, 0, margin - shift, pw, ph, 0, 0, pw, ph);
		}
		g.restore();

		// What moves, drawn fresh each frame.
		g.save();
		g.globalCompositeOperation = 'lighter';
		g.lineCap = 'round';
		g.lineJoin = 'round';
		g.translate(0, (shift * h) / ph);
		if (live > 0.02) {
			const beat = Math.floor(life / 70);
			g.beginPath();
			for (let k = 0; k < lines.length; k++) {
				const l = lines[k];
				if (l.near !== 1) continue;
				const grown = (u - l.grow) / l.growFor;
				// The wake behind a growing head.
				if (grown > 0 && grown < 1) addSpan(g, l, Math.max(0, heads[k] - pitch * 2.2), heads[k]);
				if (l.beadSpeed > 0) {
					// A bead of light running the line.
					const s = ((l.bead + l.beadSpeed * life) % (l.len + 260)) - 60;
					addSpan(g, l, Math.max(0, s - pitch * 1.7), Math.min(s, heads[k]));
				} else if (grown >= 1 && hash(l.id, beat + (seed & 0xfff)) > 0.84) {
					// Now and then a whole line surges: the circuit is live, not a drawing.
					addSpan(g, l, 0, l.len);
				}
			}
			g.strokeStyle = PALE_INK;
			g.globalAlpha = 0.8 * live;
			g.lineWidth = clamp(pitch * 0.065, 1.8, 2.6);
			g.stroke();
		}
		for (let k = 0; k < lines.length; k++) {
			const l = lines[k];
			if (l.near !== 1) continue;
			const grown = (u - l.grow) / l.growFor;
			if (grown > 0 && grown < 1) {
				// The white-hot head of a growing line.
				pointAt(l, heads[k]);
				g.globalAlpha = 0.95;
				spot(g, 'pale', at[0], at[1], pitch * 1.05);
			} else if (grown >= 1 && l.endNode) {
				// The flare as its node is reached.
				const flare = Math.exp((-(u - l.grow - l.growFor) * FLASH_MS) / 55) * fade;
				if (flare > 0.03) {
					pointAt(l, l.len);
					g.globalAlpha = flare;
					spot(g, 'pale', at[0], at[1], pitch * (1.1 + 1.5 * flare));
				}
			}
			if (l.beadSpeed > 0 && live > 0.02) {
				const s = ((l.bead + l.beadSpeed * life) % (l.len + 260)) - 60;
				if (s > 0 && s < heads[k]) {
					pointAt(l, s);
					g.globalAlpha = 0.85 * live;
					spot(g, 'pale', at[0], at[1], pitch * 0.8);
				}
			}
		}
		// The light in the hub: there from the start, white-hot at the peak.
		g.globalAlpha = clamp(smooth(0.02, 0.3, u) * (1 - smooth(0.66, 0.95, u)) * flicker);
		spot(g, 'pale', w / 2, h / 2, pitch * (1.5 + 1.9 * bloom));
		g.restore();

		// The middle blooms blue-white at the peak and washes the lines near it white.
		if (bloom > 0.01) {
			halo ??= makeHalo(pw, ph);
			g.save();
			g.setTransform(1, 0, 0, 1, 0, 0);
			g.globalCompositeOperation = 'lighter';
			g.globalAlpha = clamp(bloom);
			g.drawImage(halo, 0, 0);
			g.restore();
		}
	};

	return {
		resize(nw, nh) {
			if (nw === w && nh === h) return;
			w = nw;
			h = nh;
			art = layout(seed, dir, w, h);
			heads = new Float32Array(art.lines.length);
			// The layer is made again on the next frame.
			fw = 0;
		},
		draw,
		dispose() {
			ink.width = 0;
			ink.height = 0;
			if (halo) halo.width = 0;
			halo = null;
			fw = 0;
		},
	};
}
