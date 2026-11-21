// E2, the mycelium, and everything that is light in the ground: drawn here,
// by code, into canvases laid over the soil. There is no picture of it.
//
// The network is built from where the nodes actually are (index.ts measures
// them and hands over a Layout), so its trunk meets each node's own threads
// at any screen size, and from a seeded generator, so it is the same network
// on every visit and after every resize.
//
// The ground is several screens tall. It is cut into bands, one canvas each,
// drawn once and then left alone: scrolling moves finished bitmaps and runs
// no script. Only the growth (growFrom) redraws, and only the bands on screen.

import { BLUE_RGB, BLUE_WHITE_RGB } from '../tokens.ts';

export interface Pt {
	x: number;
	y: number;
}

/** Where things are, in CSS pixels from the top-left corner of #roots. */
export interface Layout {
	width: number;
	height: number;
	/** Where the trunk leaves the surface. */
	surface: Pt;
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

/** A line of the network: points, and how far along the line each one is. */
interface Strand {
	pts: Pt[];
	/** Cumulative length at each point. */
	at: number[];
	/** How far the light has to travel from the surface to reach its first point. */
	from: number;
}

export interface Net {
	/** New measurements: rebuild, and redraw if the network is showing. */
	layout(next: Layout): void;
	showGrown(): void;
	/**
	 * Grow from `x` on the surface. `onNode(i)` fires as the light reaches node
	 * i. Resolves when it has passed the first node; the rest follows.
	 */
	growFrom(x: number, onNode: (i: number) => void): Promise<void>;
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
}

const BAND = 800;
const MAX_DPR = 2;

const rgb = (c: readonly [number, number, number], a: number): string =>
	`rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)} / ${a})`;

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

function measure(pts: Pt[]): number[] {
	const at = [0];
	for (let i = 1; i < pts.length; i++) {
		at.push(at[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
	}
	return at;
}

/**
 * A grown-looking line from a to b: it leaves a along `ta` and arrives at b
 * along `tb` (so it runs straight into a node's thread), and wanders between.
 */
function wander(a: Pt, ta: Pt, b: Pt, tb: Pt, rand: () => number): Pt[] {
	const len = Math.hypot(b.x - a.x, b.y - a.y);
	const reach = len * 0.36;
	const c1 = { x: a.x + ta.x * reach, y: a.y + ta.y * reach };
	const c2 = { x: b.x - tb.x * reach, y: b.y - tb.y * reach };
	const n = Math.max(8, Math.round(len / 5));
	// Three slow waves of sideways drift, nothing at either end.
	const waves = [0, 1, 2].map((k) => ({
		f: 1.2 + k * 1.7 + rand() * 0.9,
		p: rand() * Math.PI * 2,
		a: (len * (0.05 - k * 0.014) * (0.6 + rand() * 0.8)) / (k + 1) ** 0.3,
	}));
	const out: Pt[] = [];
	for (let i = 0; i <= n; i++) {
		const u = i / n;
		const v = 1 - u;
		const x = v * v * v * a.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * b.x;
		const y = v * v * v * a.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * b.y;
		// The tangent, turned a quarter: sideways.
		const dx =
			3 * v * v * (c1.x - a.x) + 6 * v * u * (c2.x - c1.x) + 3 * u * u * (b.x - c2.x) || 0.0001;
		const dy = 3 * v * v * (c1.y - a.y) + 6 * v * u * (c2.y - c1.y) + 3 * u * u * (b.y - c2.y);
		const d = Math.hypot(dx, dy);
		const env = Math.sin(Math.PI * u) ** 1.4;
		let off = 0;
		for (const w of waves) off += w.a * Math.sin(u * Math.PI * w.f + w.p);
		out.push({ x: x + (-dy / d) * off * env, y: y + (dx / d) * off * env });
	}
	return out;
}

const unit = (a: Pt, b: Pt): Pt => {
	const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
	return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
};

export function createNet(host: HTMLElement): Net {
	let lay: Layout | null = null;
	let trunk: Strand[] = [];
	/** How far from the surface the light is at each node's bulb. */
	let nodeAt: number[] = [];
	let total = 0;
	const bands: HTMLCanvasElement[] = [];
	let dpr = 1;
	let shown = false;
	/** The growth in progress: how far the light has got. Infinity when grown. */
	let front = Number.POSITIVE_INFINITY;
	let raf = 0;
	let growToken = 0;

	function build(): void {
		if (!lay) return;
		const rand = seeded(0xce11e57a);
		trunk = [];
		nodeAt = [];
		let from = 0;
		const down: Pt = { x: 0, y: 1 };
		const push = (pts: Pt[]) => {
			const at = measure(pts);
			trunk.push({ pts, at, from });
			from += at[at.length - 1];
		};
		let start = lay.surface;
		let startDir = down;
		for (const node of lay.nodes) {
			const into = unit(node.top, node.topNeck);
			// To the top of the sprite's frame, then down its own thread to the bulb.
			push([...wander(start, startDir, node.top, into, rand), node.topNeck]);
			nodeAt.push(from + Math.hypot(node.bulb.x - node.topNeck.x, node.bulb.y - node.topNeck.y));
			// Through the bulb, unseen.
			from += Math.hypot(node.bottomNeck.x - node.topNeck.x, node.bottomNeck.y - node.topNeck.y);
			start = node.end;
			startDir = unit(node.bottomNeck, node.end);
			// The lower thread itself, from the bulb to where the picture lets it fade.
			push([node.bottomNeck, node.end]);
		}
		push(wander(start, startDir, lay.close, down, rand));
		total = from;
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
	}

	/** Draw one band as the network is with the light at `front`. */
	function drawBand(i: number): void {
		const c = bands[i];
		const ctx = c?.getContext('2d');
		if (!c || !ctx || !lay) return;
		const top = i * BAND;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, c.width, c.height);
		if (!shown) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, -top * dpr);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		const passes: [number, string][] = [
			[18, rgb(BLUE_RGB, 0.06)],
			[8, rgb(BLUE_RGB, 0.14)],
			[2.6, rgb(BLUE_RGB, 0.9)],
			[1, rgb(BLUE_WHITE_RGB, 0.9)],
		];
		for (const s of trunk) {
			if (s.from > front) continue;
			const first = s.pts[0];
			const last = s.pts[s.pts.length - 1];
			const lo = Math.min(first.y, last.y) - 60;
			const hi = Math.max(first.y, last.y) + 60;
			if (hi < top || lo > top + BAND) continue;
			ctx.beginPath();
			ctx.moveTo(first.x, first.y);
			for (let k = 1; k < s.pts.length; k++) {
				if (s.from + s.at[k] > front) break;
				ctx.lineTo(s.pts[k].x, s.pts[k].y);
			}
			for (const [w, colour] of passes) {
				ctx.lineWidth = w;
				ctx.strokeStyle = colour;
				ctx.stroke();
			}
		}
	}

	function drawAll(): void {
		for (let i = 0; i < bands.length; i++) drawBand(i);
	}

	function stop(): void {
		growToken++;
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	return {
		get shown() {
			return shown;
		},

		layout(next) {
			lay = next;
			build();
			resize();
			drawAll();
		},

		showGrown() {
			stop();
			shown = true;
			front = Number.POSITIVE_INFINITY;
			drawAll();
		},

		growFrom(x, onNode) {
			stop();
			if (!lay) return Promise.resolve();
			const token = growToken;
			shown = true;
			// Sideways under the surface to the trunk first, then down it.
			const lead = Math.abs(x - lay.surface.x);
			front = -lead;
			const reached = nodeAt.map(() => false);
			return new Promise<void>((resolve) => {
				let settled = false;
				let last = performance.now();
				const frame = (now: number) => {
					if (token !== growToken) {
						if (!settled) resolve();
						return;
					}
					const dt = Math.min(64, now - last);
					last = now;
					front += dt * 2.2;
					nodeAt.forEach((at, i) => {
						if (!reached[i] && front >= at) {
							reached[i] = true;
							onNode(i);
						}
					});
					if (!settled && front >= nodeAt[0] + 120) {
						settled = true;
						resolve();
					}
					if (front >= total) {
						front = Number.POSITIVE_INFINITY;
						raf = 0;
						drawAll();
						return;
					}
					drawAll();
					raf = requestAnimationFrame(frame);
				};
				raf = requestAnimationFrame(frame);
			});
		},

		hide() {
			stop();
			shown = false;
			drawAll();
		},

		guide() {},
		stopGuide() {},

		setActive(on) {
			// A growth cut short by leaving the scene is finished, not frozen.
			if (!on && raf) {
				stop();
				front = Number.POSITIVE_INFINITY;
				drawAll();
			}
		},
	};
}
