// E2, the mycelium, E3, the guided light, and D2, the growth from an impact:
// everything that is light in the ground. Drawn here, by code, into canvases
// laid over the soil. There is no picture of it.
//
// THE NETWORK is built from where the nodes actually are (index.ts measures
// them and hands over a Layout), so its trunk runs into each node's own
// threads at any screen size, and from a seeded generator, so it is the same
// network on every visit and after every resize. It is grown the way roots
// grow: a runner just under the surface; the trunk, a cord with fine strands
// winding round it, wandering from the surface through the five nodes to
// "Claim your star"; branches that leave it at uneven distances and angles,
// bend, thin to a hair and fork again; a small glowing joint at every fork.
//
// IN THE SOIL, NOT ON IT. Each line is drawn three times: as light falling on
// the soil round it (the soil picture itself, brightened and blued, let
// through a soft mask: the grains stay grains), as a bloom, and as the thread
// itself, white-blue at its heart. A line's brightness rises and falls along
// its length as if it dipped deeper and came back.
//
// WEIGHT. The ground is several screens tall. It is cut into bands, one
// canvas each, drawn once and left alone: scrolling moves finished bitmaps
// and runs no script. The growth redraws only the bands on screen, and only
// while it lasts. The guided light is one small canvas moved along the trunk;
// its loop runs only while the light is travelling and on screen.

import { BLUE_RGB, BLUE_WHITE_RGB } from '../tokens.ts';
import { EDGE, edgeY } from './edge.ts';

export interface Pt {
	x: number;
	y: number;
}

/** Where things are, in CSS pixels from the top-left corner of #roots. */
export interface Layout {
	width: number;
	height: number;
	/** Where, across the ground, the trunk leaves the surface. */
	surfaceX: number;
	nodes: {
		/** The top thread: where it enters the sprite's frame, and where it meets the bulb. */
		top: Pt;
		topNeck: Pt;
		/** The lower thread: where it leaves the bulb, and where the picture lets it fade. */
		bottomNeck: Pt;
		end: Pt;
		bulb: Pt & { r: number };
	}[];
	/** The top of "Claim your star", where the trunk ends. */
	close: Pt;
}

/** One line of the network. */
interface Strand {
	xs: number[];
	ys: number[];
	/** Length along the line at each point. */
	at: number[];
	/** Width and brightness at each point. */
	w: number[];
	lum: number[];
	len: number;
	top: number;
	bottom: number;
	/** How fast light runs along it when the network grows, px per ms. */
	speed: number;
	/** The line it leaves, and how far along that line. -1: the runner, lit from the impact. */
	parent: number;
	parentAt: number;
	/** A wait before it starts (the light crossing a bulb). */
	lag: number;
	/** When, in ms after the impact, its first point lights. Set by schedule(). */
	t0: number;
}

interface Joint {
	x: number;
	y: number;
	r: number;
	lum: number;
	strand: number;
}

export interface Net {
	/** New measurements: rebuild, and redraw if the network is showing. */
	layout(next: Layout): void;
	showGrown(): void;
	/**
	 * Grow from `x` on the surface (CSS px from the ground's left edge).
	 * `onNode(i)` fires as the light reaches node i. Resolves when it has
	 * passed the first node; the rest follows.
	 */
	growFrom(x: number, onNode: (i: number) => void): Promise<void>;
	/**
	 * Draw a few frames of a growth where nobody sees them, so that the first
	 * real one finds the browser ready (see rehearse() below). Does nothing
	 * while a growth is playing.
	 */
	rehearse(): void;
	/** Nothing showing (before the arrival). */
	hide(): void;
	readonly shown: boolean;
	setActive(on: boolean): void;
	/**
	 * E3. Run the guided light along the trunk from stop `from` (-1 is the
	 * surface) to stop `to` (5 is the Close), again and again. `atOnce`: set
	 * off this instant.
	 */
	guide(from: number, to: number, atOnce?: boolean): void;
	stopGuide(): void;
	/** For the tools: frozen states, and what was built. */
	debug: {
		stats(): { strands: number; points: number; joints: number; bands: number };
		/** A growth is playing. */
		busy(): boolean;
		/** The growth from x, frozen `ms` after the impact. Returns the nodes lit by then. */
		growAt(x: number, ms: number): number;
		/** The guided light frozen at `k` (0 → 1) of its way from `from` to `to`. */
		pulseAt(from: number, to: number, k: number): void;
		/** When each node lights, ms after an impact at x, and when all is grown. */
		times(x: number): { nodes: number[]; settled: number };
	};
}

const BAND = 800;
const MAX_DPR = 2;
/** The soft layers are drawn at a quarter of the size and stretched: that is their blur. */
const SOFT = 0.25;
/** How long a newly lit stretch stays hot, ms; and after how long it counts as cool. */
const HOT_MS = 170;
const COOL_MS = HOT_MS * 3.4;
/** The chrome's corner of the ground: the runner's light is `left` of itself up to `from` px across, whole from `to`. */
const CORNER = { from: 120, to: 190, left: 0.12 } as const;
/** The soil under the light: each channel of the picture times 1 / (1 - this). */
const DODGE = 'rgb(92 138 202)';
/**
 * The guided light: its canvas, the length of its tail, its pace and its rest,
 * and how far ahead of it, and by how much, the resting trunk is dimmed while
 * it travels (so that the light is the brightest thing on its stretch).
 */
const PULSE = { box: 620, tail: 300, speed: 0.4, rest: 800, ahead: 250, dim: 0.42 };

const rgba = (c: readonly [number, number, number], a: number): string =>
	`rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)} / ${a})`;
/** A thread's body: the blue, a third of the way to the blue-white. */
const MID_RGB = [
	BLUE_RGB[0] + (BLUE_WHITE_RGB[0] - BLUE_RGB[0]) * 0.36,
	BLUE_RGB[1] + (BLUE_WHITE_RGB[1] - BLUE_RGB[1]) * 0.36,
	BLUE_RGB[2] + (BLUE_WHITE_RGB[2] - BLUE_RGB[2]) * 0.36,
] as const;

/** A small seeded generator (mulberry32): the same numbers every visit. */
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

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** One pass of the brush: how wide and how strong for a given width and brightness. */
interface Pass {
	width: (w: number) => number;
	alpha: (lum: number) => number;
	colour: readonly [number, number, number];
	/** How much a hot stretch widens and brightens. */
	heat: number;
}
const WHITE = [1, 1, 1] as const;
/** The light on the soil, far and near. */
const HALO: Pass[] = [
	{ width: (w) => w * 8 + 15, alpha: (l) => 0.1 * l, colour: WHITE, heat: 1 },
	{ width: (w) => w * 3.6 + 6, alpha: (l) => 0.3 * l, colour: WHITE, heat: 1 },
];
/** The thread itself: its blue skin, its body, its white heart. */
const CORE: Pass[] = [
	{ width: (w) => w * 2.5 + 1.1, alpha: (l) => 0.26 * l, colour: BLUE_RGB, heat: 1.2 },
	{ width: (w) => w * 1.15 + 0.2, alpha: (l) => 0.85 * l, colour: MID_RGB, heat: 1 },
	{
		// The white heart is a pixel at most, however thick the thread: more reads as lightning.
		width: (w) => (w < 1.4 ? 0 : Math.min(1, (w - 1) * 0.5)),
		alpha: (l) => Math.min(1, l * 0.9),
		colour: BLUE_WHITE_RGB,
		heat: 1.4,
	},
];

export function createNet(host: HTMLElement, onArrive: (stop: number) => void = () => {}): Net {
	let lay: Layout | null = null;
	let strands: Strand[] = [];
	let joints: Joint[] = [];
	/** The trunk, in order: [to node 0, node 0's lower thread, to node 1, …, to the Close]. */
	let trunk: number[] = [];
	const bands: HTMLCanvasElement[] = [];
	let dpr = 1;
	let shown = false;
	let active = false;

	/** The growth: ms since the impact (Infinity when grown), and where it struck. */
	let now = Number.POSITIVE_INFINITY;
	let origin = 0;
	let impact: Pt | null = null;
	let nodeTimes: number[] = [];
	let raf = 0;
	let token = 0;
	let queue = 0;

	// The soft layers' scratch canvases, shared by every band.
	const mask = document.createElement('canvas');
	const lit = document.createElement('canvas');
	const soilScratch = document.createElement('canvas');
	/** While a growth lasts: each band's lit soil, its canvas of hot lines, and what has been painted cool. */
	const soilKept = new Map<number, HTMLCanvasElement>();
	const over: Record<number, HTMLCanvasElement> = {};
	const baked: Record<number, Uint8Array> = {};
	let picked = new Uint8Array(0);
	let runnerDone = 0;
	let sparks: { xs: number[]; ys: number[] }[] = [];
	let soil: HTMLImageElement | null = null;
	let soilUrl = '';

	// ─────────────────────────────────────────────────────── growing it ──

	function add(
		xs: number[],
		ys: number[],
		w: number[],
		lum: number[],
		speed: number,
		parent: number,
		parentAt: number,
		lag = 0,
	): number {
		const at = [0];
		let top = ys[0];
		let bottom = ys[0];
		for (let i = 1; i < xs.length; i++) {
			at.push(at[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
			if (ys[i] < top) top = ys[i];
			if (ys[i] > bottom) bottom = ys[i];
		}
		strands.push({
			xs,
			ys,
			at,
			w,
			lum,
			len: at[at.length - 1],
			top: top - 40,
			bottom: bottom + 40,
			speed,
			parent,
			parentAt,
			lag,
			t0: 0,
		});
		return strands.length - 1;
	}

	function build(): void {
		strands = [];
		joints = [];
		trunk = [];
		if (!lay) return;
		const L = lay;
		const rand = seeded(0xce11e57a);
		const phone = L.width < 768;
		const trunkW = phone ? 2.2 : 3.1;
		/** How far a branch may reach from the trunk. */
		const reach = clamp(L.width * (phone ? 0.5 : 0.42), 150, 600);
		/** Branches leave the trunk closer together on a small screen. */
		const apart = phone ? 0.72 : 1;
		/**
		 * On a narrow screen the trunk wanders less far and in longer bends, and its
		 * branches leave at a shallower angle: the same wander that is a gentle line
		 * across 1440 px is a row of kinks across 390, and reads as lightning.
		 */
		const wander = phone
			? { amp: 0.55, bends: 3.4, fork: [0.5, 0.5] }
			: { amp: 1, bends: 5.5, fork: [0.78, 0.7] };
		/** Slow, seeded unevenness: a few sines with their own phases. */
		const drift = () => {
			const p = [rand() * 7, rand() * 7, rand() * 7];
			const f = [0.6 + rand() * 0.6, 1.5 + rand(), 3.2 + rand() * 2];
			return (u: number) =>
				(Math.sin(u * f[0] + p[0]) +
					0.6 * Math.sin(u * f[1] + p[1]) +
					0.35 * Math.sin(u * f[2] + p[2])) /
				1.95;
		};

		/** Branches whose tips may reach across to a neighbour (see the end of build). */
		const tips: number[] = [];

		/**
		 * A branch: it leaves strand `parent` at point `pi`, heads off at
		 * `heading`, wanders, leans slowly downwards as roots do, thins to a
		 * hair, and forks on the way.
		 */
		function sprout(
			parent: number,
			pi: number,
			heading: number,
			length: number,
			w0: number,
			lum0: number,
			depth: number,
			speed: number,
		): void {
			const P = strands[parent];
			const step = 4;
			const n = Math.max(3, Math.round(length / step));
			let x = P.xs[pi];
			let y = P.ys[pi];
			let h = heading;
			let bend = (rand() - 0.5) * 0.03;
			const xs = [x];
			const ys = [y];
			const hs = [h];
			for (let i = 1; i <= n; i++) {
				bend = bend * 0.93 + (rand() - 0.5) * 0.052;
				h += bend + Math.sin(Math.PI / 2 - h) * (depth === 0 ? 0.0028 : 0.007);
				// Never out through the surface: turn down when near it.
				if (y < edgeY(x) + 10 && Math.sin(h) < 0.2) h += Math.cos(h) > 0 ? 0.25 : -0.25;
				x += Math.cos(h) * step;
				y += Math.sin(h) * step;
				xs.push(x);
				ys.push(y);
				hs.push(h);
			}
			const hair = 0.34 + rand() * 0.14;
			const dip = drift();
			const w: number[] = [];
			const lum: number[] = [];
			for (let i = 0; i <= n; i++) {
				const u = i / n;
				w.push(hair + Math.max(0, w0 - hair) * (1 - u) ** 1.25);
				lum.push(lum0 * (0.34 + 0.66 * (1 - u) ** 0.8) * (0.78 + 0.22 * dip((i * step) / 38)));
			}
			const me = add(xs, ys, w, lum, speed, parent, P.at[pi]);
			joints.push({ x: xs[0], y: ys[0], r: 0.9 + w0 * 0.95, lum: lum0, strand: me });
			if (depth >= 1) tips.push(me);
			if (depth >= 3) return;
			let a = length * (0.1 + rand() * 0.22);
			while (a < length * 0.9) {
				const i = Math.round(a / step);
				const child = (length - a) * (0.3 + rand() * 0.55);
				if (child > 11) {
					const side = rand() < 0.5 ? -1 : 1;
					sprout(
						me,
						i,
						hs[i] + side * (0.45 + rand() * 0.85),
						child,
						w[i] * (0.55 + rand() * 0.25),
						lum[i] * 0.92,
						depth + 1,
						speed * 0.85,
					);
				}
				a += (16 + rand() * 48) * (1 + depth * 0.25);
			}
		}

		// The runner: fine roots just under the surface, the whole width.
		{
			const xs: number[] = [];
			const ys: number[] = [];
			const w: number[] = [];
			const lum: number[] = [];
			const wave = drift();
			const dip = drift();
			// The logo and the menu button stand over the top-left corner of the ground: the
			// runner's light is all but out under them, so it does not run behind their brass.
			const clear = (x: number): number => {
				const t = clamp((x - CORNER.from) / (CORNER.to - CORNER.from), 0, 1);
				return CORNER.left + (1 - CORNER.left) * t * t * (3 - 2 * t);
			};
			for (let x = -24; x <= L.width + 24; x += 5) {
				xs.push(x);
				ys.push(edgeY(x) + 10 + 4.5 * wave(x / 60) + 2 * wave(x / 17));
				w.push(0.75 + 0.35 * (0.5 + 0.5 * dip(x / 45)));
				lum.push((0.36 + 0.16 * dip(x / 70)) * clear(x));
			}
			add(xs, ys, w, lum, 3.2, -1, 0);
			let i = 2 + Math.floor(rand() * 4);
			while (i < xs.length - 2) {
				const long = rand() < 0.16;
				sprout(
					0,
					i,
					Math.PI / 2 + (rand() - 0.5) * 1.9,
					long ? 50 + rand() * 90 : 10 + rand() * 38,
					0.5 + rand() * 0.5,
					0.42 * clear(xs[i]),
					long ? 1 : 2,
					1.1,
				);
				i += 3 + Math.floor(rand() * 8);
			}
		}

		// The trunk: from the runner, through each node's own threads, to the Close.
		const runner = strands[0];
		const startI = clamp(Math.round((L.surfaceX + 24) / 5), 0, runner.xs.length - 1);
		let from: Pt = { x: runner.xs[startI], y: runner.ys[startI] };
		let fromDir: Pt = { x: 0, y: 1 };
		let parent = 0;
		let parentAt = runner.at[startI];
		let lag = 0;

		/** A wandering stretch of trunk from `a` (leaving along `ta`) to `b` (arriving along `tb`). */
		const stretch = (a: Pt, ta: Pt, b: Pt, tb: Pt, taperEnd: boolean): number => {
			const len = Math.hypot(b.x - a.x, b.y - a.y);
			const pull = len * 0.36;
			const c1 = { x: a.x + ta.x * pull, y: a.y + ta.y * pull };
			const c2 = { x: b.x - tb.x * pull, y: b.y - tb.y * pull };
			const n = Math.max(8, Math.round(len / 4));
			const sway = drift();
			const fine = drift();
			const thick = drift();
			const dip = drift();
			const amp = len * (0.045 + rand() * 0.035) * wander.amp;
			const xs: number[] = [];
			const ys: number[] = [];
			const w: number[] = [];
			const lum: number[] = [];
			const nx: number[] = [];
			const ny: number[] = [];
			for (let i = 0; i <= n; i++) {
				const u = i / n;
				const v = 1 - u;
				const x = v * v * v * a.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * b.x;
				const y = v * v * v * a.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * b.y;
				const dx = 3 * v * v * (c1.x - a.x) + 6 * v * u * (c2.x - c1.x) + 3 * u * u * (b.x - c2.x);
				const dy = 3 * v * v * (c1.y - a.y) + 6 * v * u * (c2.y - c1.y) + 3 * u * u * (b.y - c2.y);
				const d = Math.hypot(dx, dy) || 1;
				const env = Math.sin(Math.PI * u) ** 1.3;
				const off = (amp * sway(u * wander.bends) + amp * 0.05 * fine(u * 14)) * env;
				nx.push(-dy / d);
				ny.push(dx / d);
				xs.push(x + (-dy / d) * off);
				ys.push(y + (dx / d) * off);
				const taper = taperEnd ? 1 - 0.6 * u ** 3 : 1;
				w.push(trunkW * (0.84 + 0.3 * thick(u * 9)) * taper);
				lum.push(0.66 + 0.16 * dip(u * 7));
			}
			const me = add(xs, ys, w, lum, 1.45, parent, parentAt, lag);
			trunk.push(me);
			const T = strands[me];

			// Two fine strands wind round it and rejoin: a cord, not a wire.
			for (let k = 0; k < 2; k++) {
				const turns = 1.4 + rand() * 2.4;
				const phase = rand() * Math.PI * 2;
				const wide = 3 + rand() * 4.5;
				const cx: number[] = [];
				const cy: number[] = [];
				const cw: number[] = [];
				const cl: number[] = [];
				const dip2 = drift();
				for (let i = 0; i <= n; i++) {
					const u = i / n;
					const off =
						wide * Math.sin(u * Math.PI * 2 * turns + phase) * Math.sin(Math.PI * u) ** 0.6;
					cx.push(xs[i] + nx[i] * off);
					cy.push(ys[i] + ny[i] * off);
					cw.push(0.55 + 0.25 * k);
					cl.push(0.5 + 0.2 * dip2(u * 11));
				}
				add(cx, cy, cw, cl, 1.45, me, 0);
			}

			// Branches, at uneven distances, mostly taking turns left and right.
			let side = rand() < 0.5 ? -1 : 1;
			let a2 = 26 + rand() * 50;
			/** Where the last long branch left on each side: neither side goes bare. */
			const lastLong = [-140, -140];
			while (a2 < T.len - 26) {
				const i = Math.round((a2 / T.len) * n);
				const heading = Math.atan2(
					T.ys[Math.min(n, i + 1)] - T.ys[i],
					T.xs[Math.min(n, i + 1)] - T.xs[i],
				);
				side = rand() < 0.7 ? -side : side;
				const sideI = side < 0 ? 0 : 1;
				const explorer = rand() < 0.14 || a2 - lastLong[sideI] > 250 * apart;
				if (explorer) lastLong[sideI] = a2;
				const length = explorer
					? Math.min(L.width * (phone ? 0.62 : 0.47), reach * (1.05 + rand() * 0.6))
					: reach * (0.14 + 0.86 * rand() ** 1.6);
				sprout(
					me,
					i,
					heading + side * (wander.fork[0] + rand() * wander.fork[1]),
					length,
					trunkW * (0.3 + 0.32 * Math.min(1, length / reach)),
					0.74,
					0,
					0.85,
				);
				a2 += (34 + rand() * 70) * apart;
			}
			return me;
		};

		for (const node of L.nodes) {
			const d = Math.hypot(node.topNeck.x - node.top.x, node.topNeck.y - node.top.y) || 1;
			const into = { x: (node.topNeck.x - node.top.x) / d, y: (node.topNeck.y - node.top.y) / d };
			const me = stretch(from, fromDir, node.top, into, false);
			// Down the sprite's own top thread to the bulb, thinning under it.
			const thread = (
				a: Pt,
				b: Pt,
				w0: number,
				w1: number,
				l0: number,
				l1: number,
				p: number,
				pAt: number,
				wait: number,
			) => {
				const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4));
				const xs: number[] = [];
				const ys: number[] = [];
				const w: number[] = [];
				const lum: number[] = [];
				for (let i = 0; i <= n; i++) {
					const u = i / n;
					xs.push(a.x + (b.x - a.x) * u);
					ys.push(a.y + (b.y - a.y) * u);
					w.push(w0 + (w1 - w0) * u);
					lum.push(l0 + (l1 - l0) * u);
				}
				const id = add(xs, ys, w, lum, 1.45, p, pAt, wait);
				trunk.push(id);
				return id;
			};
			const down = thread(
				node.top,
				node.topNeck,
				trunkW * 0.95,
				1.5,
				0.9,
				0.5,
				me,
				strands[me].len,
				0,
			);
			// A few hairs where the threads meet the bulb, carrying on the picture's own.
			for (let k = 0; k < 3; k++) {
				sprout(
					down,
					Math.round(strands[down].xs.length * (0.5 + rand() * 0.3)),
					-Math.PI / 2 + (rand() - 0.5) * 2.6,
					18 + rand() * 46,
					0.7,
					0.5,
					2,
					0.8,
				);
			}
			const cross = Math.hypot(
				node.bottomNeck.x - node.topNeck.x,
				node.bottomNeck.y - node.topNeck.y,
			);
			const out = thread(
				node.bottomNeck,
				node.end,
				1.5,
				trunkW * 0.9,
				0.5,
				0.9,
				down,
				strands[down].len,
				cross / 1.45,
			);
			for (let k = 0; k < 3; k++) {
				sprout(
					out,
					Math.round(strands[out].xs.length * (0.2 + rand() * 0.4)),
					Math.PI / 2 + (rand() - 0.5) * 2.4,
					18 + rand() * 50,
					0.7,
					0.5,
					2,
					0.8,
				);
			}
			const dd = Math.hypot(node.end.x - node.bottomNeck.x, node.end.y - node.bottomNeck.y) || 1;
			from = node.end;
			fromDir = {
				x: (node.end.x - node.bottomNeck.x) / dd,
				y: (node.end.y - node.bottomNeck.y) / dd,
			};
			parent = out;
			parentAt = strands[out].len;
			lag = 0;
		}
		const last = stretch(from, fromDir, L.close, { x: 0, y: 1 }, true);
		joints.push({ x: L.close.x, y: L.close.y, r: 3.2, lum: 1, strand: last });

		// Mycelium is a net, not a tree: here and there a tip reaches across and
		// fuses with a neighbouring thread.
		const cell = 48;
		const grid = new Map<number, number[]>(); // cell → [strand, point, strand, point, …]
		const keyOf = (x: number, y: number) => Math.floor(x / cell) * 8192 + Math.floor(y / cell);
		const grown = strands.length;
		for (let k = 1; k < grown; k++) {
			const s = strands[k];
			for (let i = 0; i < s.xs.length; i += 2) {
				const key = keyOf(s.xs[i], s.ys[i]);
				let list = grid.get(key);
				if (!list) {
					list = [];
					grid.set(key, list);
				}
				list.push(k, i);
			}
		}
		for (const me of tips) {
			if (rand() > 0.24) continue;
			const s = strands[me];
			const tx = s.xs[s.xs.length - 1];
			const ty = s.ys[s.ys.length - 1];
			let best = -1;
			let bestI = 0;
			let bestD = 58;
			for (let gx = -1; gx <= 1; gx++) {
				for (let gy = -1; gy <= 1; gy++) {
					const list = grid.get(keyOf(tx + gx * cell, ty + gy * cell));
					if (!list) continue;
					for (let q = 0; q < list.length; q += 2) {
						const k = list[q];
						if (k === me || k === s.parent || strands[k].parent === me) continue;
						const d = Math.hypot(strands[k].xs[list[q + 1]] - tx, strands[k].ys[list[q + 1]] - ty);
						if (d > 12 && d < bestD) {
							bestD = d;
							best = k;
							bestI = list[q + 1];
						}
					}
				}
			}
			if (best < 0) continue;
			const bx = strands[best].xs[bestI];
			const by = strands[best].ys[bestI];
			const bow = (rand() < 0.5 ? -1 : 1) * (0.25 + rand() * 0.3) * bestD;
			const mx = (tx + bx) / 2 - ((by - ty) / bestD) * bow;
			const my = (ty + by) / 2 + ((bx - tx) / bestD) * bow;
			const n = Math.max(3, Math.round(bestD / 4));
			const xs: number[] = [];
			const ys: number[] = [];
			const w: number[] = [];
			const lum: number[] = [];
			for (let i = 0; i <= n; i++) {
				const u = i / n;
				xs.push((1 - u) * (1 - u) * tx + 2 * (1 - u) * u * mx + u * u * bx);
				ys.push((1 - u) * (1 - u) * ty + 2 * (1 - u) * u * my + u * u * by);
				w.push(0.4);
				lum.push(0.3);
			}
			const link = add(xs, ys, w, lum, 0.7, me, s.len);
			joints.push({ x: bx, y: by, r: 1.1, lum: 0.45, strand: link });
		}
		picked = new Uint8Array(strands.length);
		schedule(runner.at[startI]);
	}

	/** When every line lights, for an impact `at` along the runner. */
	function schedule(at: number): void {
		origin = at;
		for (let k = 1; k < strands.length; k++) {
			const s = strands[k];
			const p = strands[s.parent];
			const tp =
				s.parent === 0 ? Math.abs(s.parentAt - origin) / p.speed : p.t0 + s.parentAt / p.speed;
			s.t0 = tp + s.lag;
		}
		const runner = strands[0];
		runnerDone = runner ? Math.max(origin, runner.len - origin) / runner.speed + COOL_MS : 0;
		// trunk is [stretch to node 0, its top thread, its lower thread, stretch to node 1, …,
		// stretch to the Close]. A node lights when the light has come down its top thread.
		nodeTimes = [];
		for (let i = 0; lay && i < lay.nodes.length; i++) {
			const thread = strands[trunk[3 * i + 1]];
			nodeTimes.push(thread ? thread.t0 + thread.len / thread.speed : 0);
		}
	}

	const settledAt = (): number => {
		let t = 0;
		for (let k = 1; k < strands.length; k++)
			t = Math.max(t, strands[k].t0 + strands[k].len / strands[k].speed);
		return t + COOL_MS;
	};

	const timeAt = (k: number, i: number): number => {
		const s = strands[k];
		return k === 0 ? Math.abs(s.at[i] - origin) / s.speed : s.t0 + s.at[i] / s.speed;
	};

	// ──────────────────────────────────────────────────────── drawing it ──

	function loadSoil(): void {
		// The same tile the stylesheet lays (Roots.astro): the woven one.
		const name = matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait';
		const a = {
			url: `/cellestial/roots/soil-${name}-woven.webp`,
			avif: `/cellestial/roots/soil-${name}-woven.avif`,
		};
		if (soilUrl === a.url) return;
		soilUrl = a.url;
		const img = new Image();
		img.decoding = 'async';
		img.onload = () => {
			if (soilUrl !== a.url) return;
			soil = img;
			if (shown) paintAll();
		};
		img.onerror = () => {
			if (img.src.endsWith('.avif')) img.src = a.url; // the WebP twin
		};
		img.src = a.avif;
	}

	function resize(): void {
		if (!lay) return;
		dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
		const count = Math.ceil(lay.height / BAND);
		while (bands.length > count) bands.pop()?.remove();
		for (let i = 0; i < count; i++) {
			let c = bands[i];
			if (!c) {
				c = document.createElement('canvas');
				bands[i] = c;
				host.append(c);
			}
			const h = Math.min(BAND, lay.height - i * BAND);
			const pw = Math.round(lay.width * dpr);
			const ph = Math.round(h * dpr);
			if (c.width !== pw || c.height !== ph) {
				c.width = pw;
				c.height = ph;
			}
			c.style.top = `${i * BAND}px`;
			c.style.width = `${lay.width}px`;
			c.style.height = `${h}px`;
		}
		mask.width = Math.ceil(lay.width * SOFT);
		mask.height = Math.ceil(BAND * SOFT);
		lit.width = Math.ceil(lay.width);
		lit.height = BAND;
	}

	/**
	 * While the growth is drawn, the stretches of one pass are not stroked one
	 * by one: a hot line changes width and strength every few points, and
	 * thousands of small strokes a frame is what the frame rate cannot carry.
	 * They are gathered here by width and strength (the key below), from every
	 * line of the pass, and each kind goes down as one stroke (flush). Within
	 * a pass every stroke is one colour, so the order they go down in does not
	 * show. Each entry is runs of points: NaN, then x, y, x, y, …
	 */
	const gathered = new Map<number, number[]>();

	/** Brush one line, or the part of it the light has reached, with one pass. */
	function brush(ctx: CanvasRenderingContext2D, k: number, pass: Pass, t: number): void {
		const s = strands[k];
		const n = s.xs.length;
		let i0 = 0;
		let i1 = n - 1;
		const growing = Number.isFinite(t);
		if (growing) {
			if (k === 0) {
				const span = t * s.speed;
				while (i0 < n && Math.abs(s.at[i0] - origin) > span) i0++;
				while (i1 >= 0 && Math.abs(s.at[i1] - origin) > span) i1--;
			} else {
				const span = (t - s.t0) * s.speed;
				if (span <= 0) return;
				while (i1 > 0 && s.at[i1] > span) i1--;
			}
			if (i1 - i0 < 1) return;
		}
		const [r, g, b] = pass.colour;
		const head = `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / `;
		let key = -1;
		let open = false;
		let heat = 0;
		/** The run being gathered, while the growth is drawn. */
		let run: number[] | null = null;
		const fine = k !== 0 && s.w[0] < 1;
		for (let i = i0; i <= i1; i++) {
			// (The heat is read every third point, and once for a whole hair: it
			// changes slowly, and every change is a stroke.)
			if (growing && (i === i0 || (!fine && (i - i0) % 3 === 0))) {
				heat = Math.exp(-(t - timeAt(k, fine ? (i0 + i1) >> 1 : i)) / HOT_MS) * pass.heat;
				if (heat < 0.03) heat = 0;
			}
			const width = pass.width(s.w[i]) * (1 + 0.7 * heat);
			const alpha = Math.min(1, pass.alpha(s.lum[i]) * (1 + 2.2 * heat));
			// Stretches of like width and strength go down as one stroke.
			const q = Math.round(width * 4) * 64 + Math.round(alpha * 28);
			if (growing) {
				if (q !== key) {
					run?.push(s.xs[i], s.ys[i]);
					key = q;
					run = null;
					if (width > 0.05 && alpha > 0.004) {
						run = gathered.get(q) ?? null;
						if (!run) {
							run = [];
							gathered.set(q, run);
						}
						run.push(Number.NaN, s.xs[i], s.ys[i]);
					}
				} else run?.push(s.xs[i], s.ys[i]);
				continue;
			}
			if (q !== key) {
				if (open) {
					ctx.lineTo(s.xs[i], s.ys[i]);
					ctx.stroke();
				}
				key = q;
				open = width > 0.05 && alpha > 0.004;
				if (open) {
					ctx.beginPath();
					ctx.lineWidth = width;
					ctx.strokeStyle = `${head}${alpha.toFixed(3)})`;
					ctx.moveTo(s.xs[i], s.ys[i]);
				}
			} else if (open) ctx.lineTo(s.xs[i], s.ys[i]);
		}
		if (open) ctx.stroke();
	}

	/** Stroke what brush() gathered for one pass of the growth, each width and strength once. */
	function flush(ctx: CanvasRenderingContext2D, pass: Pass): void {
		const [r, g, b] = pass.colour;
		ctx.strokeStyle = `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
		for (const [q, pts] of gathered) {
			if (pts.length === 0) continue;
			ctx.beginPath();
			for (let p = 0; p < pts.length; p += 2) {
				if (Number.isNaN(pts[p])) {
					p++;
					ctx.moveTo(pts[p], pts[p + 1]);
				} else ctx.lineTo(pts[p], pts[p + 1]);
			}
			// The key is the width in quarter pixels and the strength in 28ths.
			ctx.lineWidth = Math.floor(q / 64) / 4;
			ctx.globalAlpha = (q % 64) / 28;
			ctx.stroke();
			pts.length = 0;
		}
		ctx.globalAlpha = 1;
	}

	/** A round glow. */
	function glow(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		r: number,
		inner: string,
		outer: string,
	): void {
		const g = ctx.createRadialGradient(x, y, 0, x, y, r);
		g.addColorStop(0, inner);
		g.addColorStop(0.35, outer);
		g.addColorStop(1, 'rgb(0 0 0 / 0)');
		ctx.fillStyle = g;
		ctx.fillRect(x - r, y - r, r * 2, r * 2);
	}

	/**
	 * Paint part of the network into a band's canvas: the lines `ks` and the
	 * pools of light round the nodes `ns`, as they are `t` ms after the
	 * impact (Infinity: grown and cool). `clear` wipes the canvas first;
	 * without it the paint is added to what is there.
	 */
	function paint(
		c: HTMLCanvasElement,
		bi: number,
		ks: number[],
		ns: number[],
		t: number,
		clear: boolean,
		rows?: [number, number],
	): void {
		const ctx = c.getContext('2d');
		const m = mask.getContext('2d');
		const l = lit.getContext('2d');
		if (!ctx || !m || !l || !lay) return;
		const top = bi * BAND;
		const h = Math.min(BAND, lay.height - top);
		const W = lay.width;
		const growing = Number.isFinite(t);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		if (clear) ctx.clearRect(0, 0, c.width, c.height);
		const flash = growing && impact && impact.y < top + h + 160 ? impact : null;
		if (ks.length === 0 && ns.length === 0 && !flash) return;

		// 1. Where the light falls: a soft mask, drawn small.
		m.setTransform(1, 0, 0, 1, 0, 0);
		m.globalCompositeOperation = 'source-over';
		m.clearRect(0, 0, mask.width, mask.height);
		m.setTransform(SOFT, 0, 0, SOFT, 0, -top * SOFT);
		m.lineCap = 'round';
		m.lineJoin = 'round';
		for (const pass of HALO) {
			for (const k of ks) brush(m, k, pass, t);
			if (growing) flush(m, pass);
		}
		for (const i of ns) {
			const node = lay.nodes[i];
			const heat = growing ? Math.exp(-(t - nodeTimes[i]) / 320) : 0;
			glow(
				m,
				node.bulb.x,
				node.bulb.y,
				node.bulb.r * (3 + heat),
				`rgb(255 255 255 / ${0.6 + 0.4 * heat})`,
				'rgb(255 255 255 / 0.3)',
			);
		}
		if (flash) {
			const heat = Math.exp(-t / 260);
			glow(
				m,
				flash.x,
				flash.y,
				60 + 90 * (1 - heat),
				`rgb(255 255 255 / ${heat})`,
				`rgb(255 255 255 / ${heat * 0.5})`,
			);
		}
		m.setTransform(1, 0, 0, 1, 0, 0);
		// The soft layers are stretched over the canvas: only over the rows
		// asked for, when a frame of the growth needs no more than is on screen.
		const y0 = rows ? clamp(Math.floor(rows[0] / 4) * 4, 0, h) : 0;
		const y1 = rows ? clamp(Math.ceil(rows[1] / 4) * 4, 0, h) : h;
		if (y1 <= y0) return;
		const span = y1 - y0;
		const mw = W * SOFT;

		// 2. The soil itself, lit: brightened and blued, let through the mask.
		if (soil) {
			l.setTransform(1, 0, 0, 1, 0, 0);
			l.globalCompositeOperation = 'copy';
			l.drawImage(litSoil(bi), 0, y0, W, span, 0, y0, W, span);
			l.globalCompositeOperation = 'destination-in';
			l.imageSmoothingQuality = 'high';
			l.drawImage(mask, 0, y0 * SOFT, mw, span * SOFT, 0, y0, W, span);
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(lit, 0, y0, W, span, 0, y0 * dpr, c.width, span * dpr);
		}

		// 3. The bloom: the same mask as blue light.
		m.globalCompositeOperation = 'source-in';
		m.fillStyle = rgba(BLUE_RGB, 1);
		m.fillRect(0, 0, mask.width, mask.height);
		m.globalCompositeOperation = 'source-over';
		ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = soil ? 0.2 : 0.55;
		ctx.drawImage(mask, 0, y0 * SOFT, mw, span * SOFT, 0, y0 * dpr, c.width, span * dpr);
		ctx.globalAlpha = 1;

		// 4. The threads and their joints.
		ctx.setTransform(dpr, 0, 0, dpr, 0, -top * dpr);
		ctx.lineCap = 'butt';
		ctx.lineJoin = 'round';
		for (const pass of CORE) {
			for (const k of ks) brush(ctx, k, pass, t);
			if (growing) flush(ctx, pass);
		}
		for (const k of ks) picked[k] = 1;
		for (const j of joints) {
			if (!picked[j.strand] || j.y < top - 20 || j.y > top + h + 20) continue;
			const heat = growing ? Math.exp(-(t - strands[j.strand].t0) / 220) : 0;
			const a = Math.min(1, j.lum * (0.85 + heat));
			glow(
				ctx,
				j.x,
				j.y,
				j.r * (3 + 2.5 * heat),
				rgba(BLUE_WHITE_RGB, a),
				rgba(BLUE_RGB, a * 0.42),
			);
		}
		for (const k of ks) picked[k] = 0;
		if (flash) {
			drawSparks(ctx, t);
			const heat = Math.exp(-t / 200);
			if (heat > 0.01) {
				glow(
					ctx,
					flash.x,
					flash.y,
					26 + 70 * (1 - heat),
					rgba(BLUE_WHITE_RGB, heat),
					rgba(BLUE_RGB, heat * 0.5),
				);
			}
		}

		// 5. Nothing above the surface: the sky there is not ours.
		if (bi === 0) {
			ctx.globalCompositeOperation = 'destination-out';
			ctx.fillStyle = '#000';
			ctx.beginPath();
			ctx.moveTo(0, -1);
			for (let x = 0; x <= W; x += 4) ctx.lineTo(x, edgeY(x));
			ctx.lineTo(W, edgeY(W));
			ctx.lineTo(W, -1);
			ctx.closePath();
			ctx.fill();
		}
		ctx.globalCompositeOperation = 'source-over';
	}

	/**
	 * The soil of one band as the light shows it: the picture, laid as the
	 * stylesheet lays it, each channel multiplied up. Kept while a growth
	 * lasts (it is asked for every frame then); made afresh otherwise.
	 */
	function litSoil(bi: number): HTMLCanvasElement {
		const kept = soilKept.get(bi);
		if (kept) return kept;
		const c = raf ? document.createElement('canvas') : soilScratch;
		if (!lay || !soil) return c;
		const top = bi * BAND;
		const h = Math.min(BAND, lay.height - top);
		const W = lay.width;
		if (c.width !== lit.width || c.height !== lit.height) {
			c.width = lit.width;
			c.height = lit.height;
		}
		const g = c.getContext('2d');
		if (!g) return c;
		g.globalCompositeOperation = 'source-over';
		g.clearRect(0, 0, c.width, c.height);
		const th = (W * soil.naturalHeight) / soil.naturalWidth;
		const first = EDGE.height + Math.floor((top - EDGE.height) / th) * th;
		for (let y = first; y < top + h; y += th) g.drawImage(soil, 0, y - top, W, th);
		g.globalCompositeOperation = 'color-dodge';
		g.fillStyle = DODGE;
		g.fillRect(0, 0, W, h);
		if (raf) soilKept.set(bi, c);
		return c;
	}

	/** The lines that pass through a band. */
	function inBand(bi: number): number[] {
		const top = bi * BAND;
		const out: number[] = [];
		for (let k = 0; k < strands.length; k++) {
			if (strands[k].bottom >= top && strands[k].top <= top + BAND) out.push(k);
		}
		return out;
	}

	function wipe(c: HTMLCanvasElement): void {
		const ctx = c.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, c.width, c.height);
	}

	/** One band, whole: grown and cool, or bare. */
	function drawBand(bi: number): void {
		const c = bands[bi];
		if (!c || !lay) return;
		over[bi]?.remove();
		delete over[bi];
		if (!shown) {
			wipe(c);
			return;
		}
		paint(
			c,
			bi,
			inBand(bi),
			lay.nodes.map((_, i) => i),
			Number.POSITIVE_INFINITY,
			true,
		);
	}

	/**
	 * One band, one frame of the growth. What has cooled is painted once into
	 * the band's own canvas and stays; only what is still hot is painted
	 * again, into a second canvas over it.
	 */
	function growBand(bi: number): void {
		const c = bands[bi];
		if (!c || !lay) return;
		let top = over[bi];
		if (!top) {
			top = document.createElement('canvas');
			top.width = c.width;
			top.height = c.height;
			top.style.cssText = c.style.cssText;
			over[bi] = top;
			c.after(top);
			baked[bi] = new Uint8Array(strands.length + lay.nodes.length);
			wipe(c);
		}
		const done = baked[bi];
		const cold: number[] = [];
		const hot: number[] = [];
		for (const k of inBand(bi)) {
			const s = strands[k];
			if (k !== 0 && s.t0 > now) continue;
			const coolAt = k === 0 ? runnerDone : s.t0 + s.len / s.speed + COOL_MS;
			if (now < coolAt) hot.push(k);
			else if (!done[k]) {
				done[k] = 1;
				cold.push(k);
			}
		}
		const coldN: number[] = [];
		const hotN: number[] = [];
		lay.nodes.forEach((node, i) => {
			if (
				nodeTimes[i] > now ||
				node.bulb.y < bi * BAND - 400 ||
				node.bulb.y > (bi + 1) * BAND + 400
			)
				return;
			if (now < nodeTimes[i] + 1100) hotN.push(i);
			else if (!done[strands.length + i]) {
				done[strands.length + i] = 1;
				coldN.push(i);
			}
		});
		if (cold.length || coldN.length) paint(c, bi, cold, coldN, Number.POSITIVE_INFINITY, false);
		// What is hot is painted only where it can be seen.
		const y = host.getBoundingClientRect().top + bi * BAND;
		paint(top, bi, hot, hotN, now, true, [-y - 48, window.innerHeight - y + 48]);
	}

	/** Which bands are on screen, or nearly. */
	function onScreen(): boolean[] {
		const y = host.getBoundingClientRect().top;
		return bands.map(
			(_, i) => y + (i + 1) * BAND > -200 && y + i * BAND < window.innerHeight + 200,
		);
	}

	/** Draw everything: what is on screen now, the rest in turn without holding a frame. */
	function paintAll(): void {
		window.clearTimeout(queue);
		const mineNow = token;
		const seen = onScreen();
		const later: number[] = [];
		bands.forEach((_, i) => {
			if (seen[i]) drawBand(i);
			else later.push(i);
		});
		const next = () => {
			if (mineNow !== token) return;
			const i = later.shift();
			if (i === undefined) return;
			drawBand(i);
			queue = window.setTimeout(next, 0);
		};
		if (later.length) queue = window.setTimeout(next, 0);
	}

	function stopGrowth(): void {
		token++;
		window.clearTimeout(queue);
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		impact = null;
		soilKept.clear();
		gathered.clear();
		for (const key of Object.keys(over)) {
			over[Number(key)].remove();
			delete over[Number(key)];
		}
	}

	/**
	 * THE REHEARSAL. The first time the browser is asked for each kind of mark
	 * the network is made of (a stroke of this cap under that blend, a glow, a
	 * picture let through a mask), its graphics process stops to build the
	 * program that draws it. Nothing of the network is drawn before the first
	 * growth, so all of that fell in the frames of the crash itself: about
	 * 140 ms of it, one frame of 67 to 83 ms on a desktop, measured. So a few
	 * frames of a growth, and a little of the grown network, are drawn once
	 * beforehand into a canvas that is in no document, one a frame, and the
	 * browser is made to carry each out (a bitmap is asked for and let go).
	 */
	let rehearsing = false;
	let rehearsed = false;
	let rehearsalTimer = 0;
	/** How often it has waited or started over: it gives up in the end (a soil picture that never comes). */
	let rehearsalTries = 0;
	function rehearse(): void {
		window.clearTimeout(rehearsalTimer);
		if (rehearsed || rehearsing) return;
		if (typeof createImageBitmap !== 'function') return;
		if (++rehearsalTries > 40) return;
		// A real growth builds what it needs as it goes: nothing is left to rehearse.
		if (raf) {
			rehearsed = true;
			return;
		}
		if (!soil || !lay || strands.length === 0 || bands.length === 0) {
			// The lit soil is part of every frame, and the ground must have been measured: wait.
			rehearsalTimer = window.setTimeout(rehearse, 300);
			return;
		}
		rehearsing = true;
		const mine = token;
		const stage = document.createElement('canvas');
		stage.width = bands[0].width;
		stage.height = bands[0].height;
		const all = inBand(0);
		const moments = [40, 110, 200, 320, 470, 650, 850];
		let step = -1;
		const rows: [number, number] = [0, Math.min(BAND, window.innerHeight)];
		const frame = () => {
			if (mine !== token || raf || !lay) {
				// The ground was measured again under it (the fonts arrived, the window
				// changed), or a real growth began: start over once that has settled.
				rehearsing = false;
				rehearsalTimer = window.setTimeout(rehearse, 300);
				return;
			}
			if (step < 0) {
				// What has cooled: a sample of the grown network.
				paint(
					stage,
					0,
					all.filter((_, i) => i % 5 === 0),
					[0],
					Number.POSITIVE_INFINITY,
					true,
				);
			} else {
				const t = moments[step];
				if (step === 0) strike(lay.width / 2);
				paint(
					stage,
					0,
					all.filter((k) => k === 0 || strands[k].t0 <= t),
					nodeTimes.map((at, n) => (at <= t ? n : -1)).filter((n) => n >= 0),
					t,
					true,
					rows,
				);
			}
			createImageBitmap(stage)
				.then((bitmap) => bitmap.close())
				.catch(() => {});
			step++;
			if (step < moments.length) requestAnimationFrame(frame);
			else {
				impact = null;
				rehearsing = false;
				rehearsed = true;
				stage.width = 1;
				stage.height = 1;
			}
		};
		requestAnimationFrame(frame);
	}

	/** Where along the runner an impact at x lands. */
	function strike(x: number): void {
		const runner = strands[0];
		const i = clamp(Math.round((x + 24) / 5), 0, runner.xs.length - 1);
		schedule(runner.at[i]);
		impact = { x: runner.xs[i], y: runner.ys[i] - 6 };
		// The blow itself: a few roots of pure light driven down from the point,
		// which fade as the network takes the light over. Seeded by where it fell.
		const rand = seeded(0xb1a57 + i);
		sparks = [];
		for (let k = 0; k < 5; k++) {
			let h = Math.PI / 2 + (k - 2) * 0.42 + (rand() - 0.5) * 0.3;
			let bend = 0;
			let px = runner.xs[i];
			let py = runner.ys[i];
			const xs = [px];
			const ys = [py];
			const n = Math.round((60 + rand() * 120) / 4);
			for (let q = 0; q < n; q++) {
				bend = bend * 0.9 + (rand() - 0.5) * 0.09;
				h += bend + Math.sin(Math.PI / 2 - h) * 0.01;
				px += Math.cos(h) * 4;
				py += Math.sin(h) * 4;
				xs.push(px);
				ys.push(py);
			}
			sparks.push({ xs, ys });
		}
	}

	/** Draw the blow's own roots, `t` ms after it. */
	function drawSparks(ctx: CanvasRenderingContext2D, t: number): void {
		const fade = t < 260 ? 1 : Math.exp(-(t - 260) / 190);
		if (fade < 0.02) return;
		for (const sp of sparks) {
			const n = Math.min(sp.xs.length - 1, Math.floor((t * 1.1) / 4));
			for (let i = 1; i <= n; i++) {
				const u = i / sp.xs.length;
				const tip = Math.max(0, 1 - (n - i) / 14); // hottest at the growing tip
				for (const [w, colour, a] of [
					[6, BLUE_RGB, 0.14],
					[1.9, MID_RGB, 0.65],
					[0.8, BLUE_WHITE_RGB, 0.95],
				] as const) {
					ctx.beginPath();
					ctx.moveTo(sp.xs[i - 1], sp.ys[i - 1]);
					ctx.lineTo(sp.xs[i], sp.ys[i]);
					ctx.lineWidth = w * (1 - 0.7 * u) * (1 + 0.6 * tip);
					ctx.strokeStyle = rgba(colour, Math.min(1, a * fade * (0.55 + tip)));
					ctx.stroke();
				}
			}
		}
	}

	// ───────────────────────────────────────────────── the guided light ──

	let pulse: HTMLCanvasElement | null = null;
	let route: { xs: number[]; ys: number[]; at: number[]; len: number; to: number } | null = null;
	let pulseRaf = 0;
	let pulseTimer = 0;
	let pulseStart = 0;
	let watching = false;

	function makeRoute(from: number, to: number): typeof route {
		if (!lay || trunk.length === 0) return null;
		const lo = Math.min(from, to);
		const hi = Math.max(from, to);
		const first = lo < 0 ? 0 : 3 * lo + 2;
		const lastK = hi >= lay.nodes.length ? trunk.length - 1 : 3 * hi + 1;
		const xs: number[] = [];
		const ys: number[] = [];
		for (let k = first; k <= lastK; k++) {
			const s = strands[trunk[k]];
			if (!s) continue;
			for (let i = 0; i < s.xs.length; i++) {
				xs.push(s.xs[i]);
				ys.push(s.ys[i]);
			}
		}
		if (from > to) {
			xs.reverse();
			ys.reverse();
		}
		if (xs.length < 2) return null;
		const at = [0];
		for (let i = 1; i < xs.length; i++)
			at.push(at[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
		return { xs, ys, at, len: at[at.length - 1], to };
	}

	/** Draw the light with its head `d` px along the route. */
	function drawPulse(d: number): void {
		if (!route) return;
		if (!pulse) {
			pulse = document.createElement('canvas');
			pulse.dataset.role = 'pulse';
			pulse.style.cssText = `top:0;width:${PULSE.box}px;height:${PULSE.box}px;will-change:transform`;
			host.append(pulse);
		}
		const size = Math.round(PULSE.box * dpr);
		if (pulse.width !== size) {
			pulse.width = size;
			pulse.height = size;
		}
		const ctx = pulse.getContext('2d');
		if (!ctx) return;
		const { xs, ys, at, len } = route;
		const headAt = clamp(d, 0, len);
		let hi = 0;
		while (hi < at.length - 2 && at[hi + 1] < headAt) hi++;
		const f = (headAt - at[hi]) / (at[hi + 1] - at[hi] || 1);
		const hx = xs[hi] + (xs[hi + 1] - xs[hi]) * f;
		const hy = ys[hi] + (ys[hi + 1] - ys[hi]) * f;
		const ox = hx - PULSE.box / 2;
		const oy = hy - PULSE.box / 2;
		pulse.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
		pulse.style.display = 'block';
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, size, size);
		// It rises as it sets off and sinks into where it arrives.
		const life = Math.min(1, headAt / 60) * Math.min(1, (len - headAt) / 46 + 0.25);
		ctx.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		// The trunk ahead of the light, a little dimmer for as long as the light is on its way.
		ctx.globalCompositeOperation = 'source-over';
		let qx = hx;
		let qy = hy;
		for (let j = hi + 1; j < at.length && at[j] - headAt < PULSE.ahead; j++) {
			const near = 1 - (at[j] - headAt) / PULSE.ahead;
			ctx.beginPath();
			ctx.moveTo(qx, qy);
			ctx.lineTo(xs[j], ys[j]);
			ctx.lineWidth = 7;
			ctx.strokeStyle = `rgb(8 7 7 / ${(PULSE.dim * near * life).toFixed(3)})`;
			ctx.stroke();
			qx = xs[j];
			qy = ys[j];
		}
		ctx.globalCompositeOperation = 'lighter';
		let i = hi;
		let px = hx;
		let py = hy;
		while (i >= 0 && headAt - at[i] < PULSE.tail) {
			const u = 1 - (headAt - at[i]) / PULSE.tail; // 1 at the head, 0 at the tail's end
			const a = u * u * life;
			for (const [w, colour, k] of [
				[34, BLUE_RGB, 0.07],
				[15, BLUE_RGB, 0.2],
				[6.5, MID_RGB, 0.75],
				[3.2, BLUE_WHITE_RGB, 1],
			] as const) {
				ctx.beginPath();
				ctx.moveTo(px, py);
				ctx.lineTo(xs[i], ys[i]);
				ctx.lineWidth = w * (0.5 + 0.5 * u);
				ctx.strokeStyle = rgba(colour, Math.min(1, a * k));
				ctx.stroke();
			}
			px = xs[i];
			py = ys[i];
			i--;
		}
		glow(ctx, hx, hy, 84, rgba(BLUE_WHITE_RGB, 0.8 * life), rgba(BLUE_RGB, 0.3 * life));
		glow(ctx, hx, hy, 30, rgba(BLUE_WHITE_RGB, life), rgba(BLUE_WHITE_RGB, 0.45 * life));
		glow(ctx, hx, hy, 11, rgba([1, 1, 1], life), rgba([1, 1, 1], 0.7 * life));
	}

	function routeOnScreen(): boolean {
		if (!route) return false;
		const y = host.getBoundingClientRect().top;
		const a = y + Math.min(route.ys[0], route.ys[route.ys.length - 1]);
		const b = y + Math.max(route.ys[0], route.ys[route.ys.length - 1]);
		return b > -80 && a < window.innerHeight + 80;
	}

	function hidePulse(): void {
		if (pulse) pulse.style.display = 'none';
	}

	/** One run of the light, then a rest, then again: but only while it can be seen. */
	function runPulse(): void {
		window.clearTimeout(pulseTimer);
		if (pulseRaf) cancelAnimationFrame(pulseRaf);
		pulseRaf = 0;
		if (!route || !active || !shown) return;
		if (!routeOnScreen()) {
			hidePulse();
			return; // the scroll listener starts it when the stretch comes into view
		}
		const r = route;
		const ms = clamp(r.len / PULSE.speed, 700, 2600);
		pulseStart = 0;
		const frame = (stamp: number) => {
			if (route !== r) return;
			if (!pulseStart) pulseStart = stamp;
			const u = Math.min(1, (stamp - pulseStart) / ms);
			// It gathers pace out of the node and eases into the next.
			const k = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
			drawPulse(k * r.len);
			if (u < 1) {
				pulseRaf = requestAnimationFrame(frame);
				return;
			}
			pulseRaf = 0;
			hidePulse();
			onArrive(r.to);
			pulseTimer = window.setTimeout(runPulse, PULSE.rest);
		};
		pulseRaf = requestAnimationFrame(frame);
	}

	function onScroll(): void {
		if (route && !pulseRaf && active && shown && routeOnScreen()) {
			window.clearTimeout(pulseTimer);
			pulseTimer = window.setTimeout(runPulse, 120);
		}
	}

	function stopGuide(): void {
		route = null;
		window.clearTimeout(pulseTimer);
		if (pulseRaf) cancelAnimationFrame(pulseRaf);
		pulseRaf = 0;
		hidePulse();
	}

	// ───────────────────────────────────────────────────────── the Net ──

	return {
		get shown() {
			return shown;
		},

		layout(next) {
			// A growth caught by a resize is finished, not restarted.
			stopGrowth();
			now = Number.POSITIVE_INFINITY;
			stopGuide(); // index.ts points the guided light again after every layout
			// The ground is measured again whenever it comes on stage, and nearly
			// always nothing has moved. The same measurements make the same network
			// (it is seeded), so it is not built a second time: on the press that
			// starts the fall that was most of the longest frame of a slow device.
			const same =
				lay !== null && strands.length > 0 && JSON.stringify(next) === JSON.stringify(lay);
			lay = next;
			loadSoil();
			if (!same) build();
			resize();
			paintAll();
		},

		showGrown() {
			stopGrowth();
			shown = true;
			now = Number.POSITIVE_INFINITY;
			paintAll();
		},

		growFrom(x, onNode) {
			stopGrowth();
			if (!lay || strands.length === 0) return Promise.resolve();
			const mine = token;
			shown = true;
			strike(x);
			now = 0;
			const reached = nodeTimes.map(() => false);
			const end = settledAt();
			const passed = nodeTimes[0] + 140;
			return new Promise<void>((resolve) => {
				let settled = false;
				let last = 0;
				const frame = (stamp: number) => {
					if (mine !== token) {
						if (!settled) resolve();
						return;
					}
					now += last ? Math.min(50, stamp - last) : 0;
					last = stamp;
					nodeTimes.forEach((at, i) => {
						if (!reached[i] && now >= at) {
							reached[i] = true;
							onNode(i);
						}
					});
					if (!settled && now >= passed) {
						settled = true;
						resolve();
					}
					if (now >= end) {
						stopGrowth();
						now = Number.POSITIVE_INFINITY;
						paintAll();
						return;
					}
					const seen = onScreen();
					for (let i = 0; i < bands.length; i++) if (seen[i]) growBand(i);
					raf = requestAnimationFrame(frame);
				};
				raf = requestAnimationFrame(frame);
			});
		},

		rehearse,

		hide() {
			stopGrowth();
			stopGuide();
			shown = false;
			now = Number.POSITIVE_INFINITY;
			for (let i = 0; i < bands.length; i++) drawBand(i);
		},

		setActive(on) {
			active = on;
			if (on && !watching) {
				watching = true;
				window.addEventListener('scroll', onScroll, { passive: true });
			} else if (!on && watching) {
				watching = false;
				window.removeEventListener('scroll', onScroll);
			}
			if (!on) {
				stopGuide();
				// A growth cut short by leaving the scene is finished, not frozen.
				if (raf) {
					stopGrowth();
					now = Number.POSITIVE_INFINITY;
					paintAll();
				}
			}
		},

		guide(from, to, atOnce = false) {
			const same = route && route.to === to && !atOnce;
			const next = makeRoute(from, to);
			if (
				same &&
				route &&
				next &&
				Math.abs(next.len - route.len) < 0.5 &&
				(pulseRaf || pulseTimer)
			) {
				return; // already on its way there
			}
			stopGuide();
			route = next;
			if (!route) return;
			if (atOnce) runPulse();
			else pulseTimer = window.setTimeout(runPulse, 500);
		},

		stopGuide,

		debug: {
			busy: () => raf !== 0,
			stats: () => ({
				strands: strands.length,
				points: strands.reduce((n, s) => n + s.xs.length, 0),
				joints: joints.length,
				bands: bands.length,
			}),
			growAt(x, ms) {
				stopGrowth();
				shown = true;
				strike(x);
				now = ms;
				for (let i = 0; i < bands.length; i++) {
					const ks = inBand(i).filter((k) => k === 0 || strands[k].t0 <= ms);
					const ns = nodeTimes.map((t, n) => (t <= ms ? n : -1)).filter((n) => n >= 0);
					paint(bands[i], i, ks, ns, ms, true);
				}
				return nodeTimes.filter((t) => t <= ms).length;
			},
			pulseAt(from, to, k) {
				stopGuide();
				route = makeRoute(from, to);
				if (route) drawPulse(k * route.len);
			},
			times(x) {
				strike(x);
				impact = null;
				return { nodes: [...nodeTimes], settled: settledAt() };
			},
		},
	};
}
