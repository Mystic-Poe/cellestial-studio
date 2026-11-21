// The beads of light (B8): light flows from a touch along the honeycomb to
// one empty star.
//
// This file is the run itself: the route over the honeycomb's graph, the
// beads' places along it at any moment, and the points that draw them. It
// decides nothing: answer.ts says where a run starts and which star it is for.
//
// A route is a real walk over the graph: from the vertex nearest the touch,
// edge by edge, to the vertex nearest the star, and where the star stands in
// the next layer, along a strut from one plane to the other on the way. Only
// its two ends leave the honeycomb: the hop from the finger onto the first
// vertex, and the last hop from the lattice into the star.

import {
	BufferAttribute,
	BufferGeometry,
	CustomBlending,
	OneFactor,
	OneMinusSrcAlphaFactor,
	Points,
	ShaderMaterial,
	Vector3,
} from 'three';
import type { SlotId } from '../contracts.ts';
import { BLUE_RGB, BLUE_WHITE_RGB } from '../tokens.ts';
import { LATTICE, SPACING } from './config.ts';
import type { SkyHooks } from './hooks.ts';
import type { Honeycomb } from './lattice.ts';

/** How the beads look and move. Lengths are in honeycomb edges unless they say pixels. */
export const BEADS = {
	/** Beads in the trail, the head included. */
	count: 10,
	/** The gap between two beads: this many pixels at a station, kept within these shares of an edge. */
	gapPx: 17,
	gap: [0.1, 0.32],
	/** Edges a second, for a short run and for a long one. */
	speed: [5.5, 15],
	/** A run is never quicker than this to arrive, seconds. */
	minTime: 0.5,
	/** The beads set off smoothly over about this long. */
	ease: 0.09,
	/** What a strut costs to cross, in edges: it is twenty long, and the light leaps it. */
	strut: 5,
	/** The head's glow, pixels across at a station; the tail's last bead is this share of it. */
	px: 36,
	tail: 0.6,
	/** How much the light fades from one bead to the next: the last keeps this share. */
	fade: 0.12,
	/** The spark under the finger: pixels across, and how long it lasts. */
	spark: 64,
	sparkTime: 0.45,
	/** How bright a passed edge is lit. */
	edge: 1,
} as const;

const EDGE = LATTICE.edge;

/** One corner of a route. `layer` may be a fraction: partway along a strut. */
export interface RoutePoint {
	x: number;
	y: number;
	layer: number;
}

export interface Route {
	readonly slot: SlotId;
	/** The layer the run starts in, and the layer the star stands in. */
	readonly fromLayer: number;
	readonly toLayer: number;
	/** The walk in the first plane, and after a strut, in the second (empty if there is none). */
	readonly vertices: readonly number[];
	readonly edges: readonly number[];
	readonly vertices2: readonly number[];
	readonly edges2: readonly number[];
	/** The vertex whose strut carries the light across, or -1. */
	readonly strut: number;
	/** Every corner: the touch, the vertices in order, the star. */
	readonly points: readonly RoutePoint[];
	/** Where each corner is along the route, in edges; the last is the route's length. */
	readonly at: readonly number[];
	/** What is walked into each corner: an edge of the first plane, of the second, the strut, or a hop. */
	readonly kinds: readonly ('hop' | 'edge' | 'edge2' | 'strut')[];
	readonly ids: readonly number[];
}

/**
 * The shortest way over the honeycomb from a point of one plane to a star.
 * `to` is the star's place in its own plane. With `toLayer` one more than
 * `fromLayer`, the way crosses by the strut that makes the whole walk shortest.
 */
export function planRoute(
	comb: Honeycomb,
	slot: SlotId,
	from: { x: number; y: number },
	fromLayer: number,
	to: { x: number; y: number },
	toLayer: number,
): Route | null {
	const start = comb.nearestVertex(from.x, from.y);
	const goal = comb.nearestVertex(to.x, to.y);
	const vx = (v: number) => comb.vertices[v * 2] as number;
	const vy = (v: number) => comb.vertices[v * 2 + 1] as number;

	let first = comb.path(start, goal);
	let second: { vertices: number[]; edges: number[] } = { vertices: [], edges: [] };
	let strut = -1;
	if (toLayer !== fromLayer) {
		if (toLayer !== fromLayer + 1) return null;
		let best = Infinity;
		for (const s of comb.struts) {
			// Cheap bound first: no walk is shorter than the straight line, in edges.
			const bound =
				(Math.hypot(vx(s) - vx(start), vy(s) - vy(start)) +
					Math.hypot(vx(s) - vx(goal), vy(s) - vy(goal))) /
				comb.edge;
			if (bound >= best) continue;
			const a = comb.path(start, s);
			const b = comb.path(s, goal);
			if (!a || !b) continue;
			const cost = a.edges.length + b.edges.length;
			if (cost < best) {
				best = cost;
				first = a;
				second = b;
				strut = s;
			}
		}
		if (strut < 0) return null;
	}
	if (!first) return null;

	const points: RoutePoint[] = [{ x: from.x, y: from.y, layer: fromLayer }];
	const at: number[] = [0];
	const kinds: Route['kinds'][number][] = ['hop'];
	const ids: number[] = [-1];
	let length = 0;
	const add = (
		x: number,
		y: number,
		layer: number,
		cost: number,
		kind: Route['kinds'][number],
		id: number,
	) => {
		length += cost;
		points.push({ x, y, layer });
		at.push(length);
		kinds.push(kind);
		ids.push(id);
	};
	const hop = (ax: number, ay: number, bx: number, by: number) =>
		Math.hypot(bx - ax, by - ay) / comb.edge;

	add(vx(start), vy(start), fromLayer, hop(from.x, from.y, vx(start), vy(start)), 'hop', -1);
	for (const [i, e] of first.edges.entries()) {
		const v = first.vertices[i + 1] as number;
		add(vx(v), vy(v), fromLayer, 1, 'edge', e);
	}
	if (strut >= 0) {
		add(vx(strut), vy(strut), toLayer, BEADS.strut, 'strut', strut);
		for (const [i, e] of second.edges.entries()) {
			const v = second.vertices[i + 1] as number;
			add(vx(v), vy(v), toLayer, 1, 'edge2', e);
		}
	}
	add(to.x, to.y, toLayer, hop(vx(goal), vy(goal), to.x, to.y), 'hop', -1);

	return {
		slot,
		fromLayer,
		toLayer,
		vertices: first.vertices,
		edges: first.edges,
		vertices2: second.vertices,
		edges2: second.edges,
		strut,
		points,
		at,
		kinds,
		ids,
	};
}

/** How far the head has come, in edges, `t` seconds after it set off at `speed`. */
const travelled = (t: number, speed: number) =>
	t <= 0 ? 0 : speed * (t - BEADS.ease * (1 - Math.exp(-t / BEADS.ease)));

/** When the head has come `s` edges. */
function timeAt(s: number, speed: number): number {
	if (s <= 0) return 0;
	let lo = s / speed;
	let hi = lo + BEADS.ease;
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		if (travelled(mid, speed) < s) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

const VERTEX = /* glsl */ `
attribute vec2 aBead;
uniform float uDpr;
varying float vLevel;
void main() {
	vLevel = aBead.y;
	gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
	gl_PointSize = max(1.0, aBead.x * uDpr);
}
`;

// A round bead: a small bright body, the sampled blue, in a soft glow of the
// same blue. The head's body is lifted towards the blue-white of a star's core.
const FRAGMENT = /* glsl */ `
uniform vec3 uBlue;
uniform vec3 uHot;
varying float vLevel;
void main() {
	float d = length(gl_PointCoord * 2.0 - 1.0);
	float body = 1.0 - smoothstep(0.16, 0.25, d);
	float glow = exp(-d * d * 4.2) * (1.0 - smoothstep(0.55, 1.0, d));
	// Only the heart of the leading beads is white-hot; the rest is the blue itself.
	float hot = (1.0 - smoothstep(0.0, 0.17, d)) * smoothstep(0.5, 1.0, vLevel);
	vec3 light = uBlue * (1.15 * body + 0.75 * glow) + uHot * 0.6 * hot;
	gl_FragColor = vec4(light * vLevel, 0.0);
}
`;

export interface BeadRun {
	readonly route: Route;
	/** Clock time the beads set off. */
	readonly t0: number;
	/** Seconds from then until the head reaches the star, and until the last bead has. */
	readonly arriveAfter: number;
	readonly endAfter: number;
	/** Each corner's time after `t0`. */
	readonly times: readonly number[];
	arrived: boolean;
}

export interface Beads {
	/** Send beads along a route, now. A run in progress is replaced. */
	start(route: Route, onArrive: (run: BeadRun) => void): BeadRun;
	/** Put out whatever is running. */
	stop(): void;
	/** The run in progress, or null. */
	run(): BeadRun | null;
	/** Where the beads are on screen now, head first (viewport pixels), for the capture tools. */
	screen(): { x: number; y: number; level: number }[];
}

export function createBeads(hooks: SkyHooks): Beads {
	const n = BEADS.count + 1; // the spark is the last point
	const position = new BufferAttribute(new Float32Array(n * 3), 3);
	const bead = new BufferAttribute(new Float32Array(n * 2), 2);
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', position);
	geometry.setAttribute('aBead', bead);
	const uDpr = { value: 1 };
	const material = new ShaderMaterial({
		vertexShader: VERTEX,
		fragmentShader: FRAGMENT,
		uniforms: {
			uDpr,
			uBlue: { value: new Vector3(...BLUE_RGB) },
			uHot: { value: new Vector3(...BLUE_WHITE_RGB) },
		},
		transparent: true,
		depthTest: false,
		depthWrite: false,
		toneMapped: false,
		// As everything in this sky: colour is added, the canvas's alpha is left alone.
		blending: CustomBlending,
		blendSrc: OneFactor,
		blendDst: OneMinusSrcAlphaFactor,
		blendSrcAlpha: OneFactor,
		blendDstAlpha: OneMinusSrcAlphaFactor,
	});
	const points = new Points(geometry, material);
	points.frustumCulled = false;
	points.visible = false;
	hooks.three.scene.add(points);

	let run: BeadRun | null = null;
	let speed = 1;
	let gap: number = BEADS.gap[1];
	let arrive: ((run: BeadRun) => void) | null = null;
	/** The next corner whose edge has not been lit yet. */
	let nextCorner = 1;
	let release: (() => void) | null = null;
	const places: { x: number; y: number; level: number }[] = [];

	const stop = () => {
		run = null;
		arrive = null;
		points.visible = false;
		places.length = 0;
		release?.();
		release = null;
		hooks.requestFrame();
	};

	/** A place along the route, `s` edges from its start. */
	const along = (route: Route, s: number, out: RoutePoint) => {
		const { at, points: corners } = route;
		let i = 1;
		while (i < at.length - 1 && (at[i] as number) < s) i++;
		const a = corners[i - 1] as RoutePoint;
		const b = corners[i] as RoutePoint;
		const from = at[i - 1] as number;
		const span = (at[i] as number) - from;
		const u = span > 0 ? Math.min(1, Math.max(0, (s - from) / span)) : 1;
		out.x = a.x + (b.x - a.x) * u;
		out.y = a.y + (b.y - a.y) * u;
		out.layer = a.layer + (b.layer - a.layer) * u;
	};

	const tmp: RoutePoint = { x: 0, y: 0, layer: 0 };

	const draw = (time: number) => {
		const r = run;
		if (!r) return;
		const t = time - r.t0;
		const { route } = r;
		const length = route.at[route.at.length - 1] as number;

		// Light each edge as the head comes onto it.
		while (nextCorner < r.times.length && (r.times[nextCorner - 1] as number) <= t) {
			const kind = route.kinds[nextCorner];
			const id = route.ids[nextCorner] as number;
			const when = r.t0 + (r.times[nextCorner - 1] as number);
			if (kind === 'edge') hooks.lattice.pulseEdge(route.fromLayer, id, BEADS.edge, when);
			else if (kind === 'edge2') hooks.lattice.pulseEdge(route.toLayer, id, BEADS.edge, when);
			else if (kind === 'strut') hooks.lattice.pulseStrut(route.fromLayer, id, BEADS.edge, when);
			nextCorner++;
		}

		if (!r.arrived && t >= r.arriveAfter) {
			r.arrived = true;
			const done = arrive;
			arrive = null;
			done?.(r);
			if (run !== r) return;
		}
		if (t >= r.endAfter && t >= BEADS.sparkTime) {
			stop();
			return;
		}

		const { dpr } = hooks.quality();
		uDpr.value = dpr;
		const layout = hooks.layout();
		const cam = hooks.camera();
		// A bead is as large as it would be at a station; nearer or further, it follows a little.
		const station = layout.fits[((route.fromLayer % 12) + 12) % 12]?.dist ?? 3;
		const head = travelled(t, speed);
		const pos = position.array as Float32Array;
		const look = bead.array as Float32Array;
		places.length = 0;
		for (let i = 0; i < BEADS.count; i++) {
			const s = head - i * gap;
			const k = i / (BEADS.count - 1);
			let level = s < 0 || s >= length ? 0 : BEADS.fade ** k;
			// A bead comes up out of the spark rather than appearing whole.
			if (level > 0) level *= Math.min(1, s / 0.35 + 0.25);
			along(route, Math.min(Math.max(s, 0), length), tmp);
			const depth = cam.z + tmp.layer * SPACING;
			pos[i * 3] = tmp.x;
			pos[i * 3 + 1] = tmp.y;
			pos[i * 3 + 2] = -depth;
			const near = Math.min(1.5, Math.max(0.4, station / Math.max(0.05, depth)));
			look[i * 2] = BEADS.px * near * (1 - (1 - BEADS.tail) * k);
			look[i * 2 + 1] = depth > 0.05 ? level : 0;
			if (level > 0 && depth > 0.05) {
				const p = hooks.project(tmp.x, tmp.y, -tmp.layer * SPACING);
				places.push({ x: p.x, y: p.y, level });
			}
		}
		// The spark under the finger.
		const origin = route.points[0] as RoutePoint;
		const depth0 = cam.z + origin.layer * SPACING;
		const s = BEADS.count;
		pos[s * 3] = origin.x;
		pos[s * 3 + 1] = origin.y;
		pos[s * 3 + 2] = -depth0;
		const u = Math.min(1, Math.max(0, t / BEADS.sparkTime));
		look[s * 2] = BEADS.spark * (0.55 + 0.45 * u);
		look[s * 2 + 1] = depth0 > 0.05 ? 0.9 * (1 - u) ** 2 : 0;
		position.needsUpdate = true;
		bead.needsUpdate = true;
		points.renderOrder = hooks.three.layerOrder(route.fromLayer) + 3;
		points.visible = true;
	};

	hooks.on('frame', ({ time }) => draw(time));

	return {
		start(route, onArrive) {
			stop();
			const length = route.at[route.at.length - 1] as number;
			// A long way is run faster, so that no run keeps the visitor waiting.
			const [slow, fast] = BEADS.speed;
			speed = Math.min(fast, Math.max(slow, slow + (length - 6) * 0.55));
			speed = Math.min(speed, length / Math.max(0.05, BEADS.minTime - BEADS.ease));
			// The beads stand about as far apart on screen whatever the size of the honeycomb there.
			const fit = hooks.layout().fits[((route.fromLayer % 12) + 12) % 12];
			const edgePx = route.fromLayer === route.toLayer ? (fit?.scale ?? 300) * EDGE : 0;
			gap = Math.min(BEADS.gap[1], Math.max(BEADS.gap[0], BEADS.gapPx / Math.max(1, edgePx)));
			const times = route.at.map((s) => timeAt(s, speed));
			const next: BeadRun = {
				route,
				t0: hooks.time(),
				arriveAfter: times[times.length - 1] as number,
				endAfter: timeAt(length + BEADS.count * gap, speed),
				times,
				arrived: false,
			};
			run = next;
			arrive = onArrive;
			nextCorner = 1;
			release = hooks.keepAwake();
			hooks.requestFrame();
			return next;
		},
		stop,
		run: () => run,
		screen: () => places.map((p) => ({ ...p })),
	};
}
