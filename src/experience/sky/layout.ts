// Where everything is: the twelve figures in world space, the station each
// one is framed from, and the path the camera flies between them. Pure
// geometry, no rendering.
//
// The flight is measured by `pos`, the distance flown along -z: the camera is
// at z = -pos, and layer k is at pos = k * SPACING. Layers run on for ever in
// both directions and show figure k mod 12.

import { CONSTELLATIONS } from '../../content/constellations.ts';
import type { SlotId } from '../contracts.ts';
import {
	B3,
	B3_PORTRAIT_PX,
	B11,
	FIGURES,
	FOCAL,
	KNOT,
	MAG,
	PORTRAIT,
	SAFE,
	SPACING,
	STAR_PX,
} from './config.ts';

export const mod = (n: number, m: number) => ((n % m) + m) % m;
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const smooth = (t: number) => {
	const c = clamp(t);
	return c * c * (3 - 2 * c);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** How much bigger than the base a star of this magnitude is drawn. */
export function magScale(mag: number): number {
	const t = clamp((mag - MAG.bright) / (MAG.faint - MAG.bright));
	return lerp(MAG.brightScale, MAG.faintScale, t);
}

export interface PlanStar {
	/** World x, y in the plane of its layer; the flight axis is the origin. */
	readonly x: number;
	readonly y: number;
	/** Size as a multiple of the figure's base star radius. */
	readonly scale: number;
	/** Null for Cellestial's own star. */
	readonly slot: SlotId | null;
	/** A fixed pseudo-random number in 0..1, for phases and delays. */
	readonly seed: number;
}

/**
 * A figure, laid out about the flight axis: as the data has it (north up), or
 * turned a quarter counter-clockwise. A layout chooses one of the two for each
 * figure, and everything that needs a star's place reads it from the layout's
 * `plans`: nothing else knows that a figure can be turned.
 */
export interface FigurePlan {
	readonly index: number;
	readonly name: string;
	/** Turned a quarter counter-clockwise: north to the left, as the figure stands when it rises. */
	readonly turned: boolean;
	readonly stars: readonly PlanStar[];
	readonly lines: readonly (readonly [number, number])[];
	/** Index of the star that is B3, or -1. It sits on the axis. */
	readonly epicentre: number;
	/** Where the camera's path goes through the plane: clear of every star. */
	readonly pass: { readonly x: number; readonly y: number };
	/** How far the nearest star is from `pass`. */
	readonly clearance: number;
}

/** A pseudo-random number in 0..1 from two integers. The same every time. */
export function hash2(a: number, b: number): number {
	let h = (Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b)) >>> 0;
	h ^= h >>> 15;
	h = Math.imul(h, 0x2c1b3c6d) >>> 0;
	h ^= h >>> 12;
	h = Math.imul(h, 0x297a2d39) >>> 0;
	h ^= h >>> 15;
	return (h >>> 0) / 4294967296;
}

function distanceToSegment(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
): number {
	const dx = bx - ax;
	const dy = by - ay;
	const len2 = dx * dx + dy * dy;
	const t = len2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2) : 0;
	return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

/** The twelve figures, each both ways. A layout takes one of the two for each figure. */
export interface PlanSet {
	/** North up: the figures as the data has them. */
	readonly upright: readonly FigurePlan[];
	/** The same stars a quarter-turn counter-clockwise: (x, y) -> (-y, x). */
	readonly turned: readonly FigurePlan[];
}

/**
 * The twelve figures about the flight axis, upright and turned. `cells` are
 * the centres of the honeycomb's cells: the path goes through the middle of
 * one, so that no lattice line ever meets the lens either. The honeycomb is
 * not the same after a quarter-turn, so a turned figure's way through is
 * found again for its turned stars.
 */
export function planFigures(cells: Float32Array): PlanSet {
	return { upright: planAll(cells, false), turned: planAll(cells, true) };
}

function planAll(cells: Float32Array, turned: boolean): FigurePlan[] {
	return CONSTELLATIONS.map((figure, index) => {
		const epicentre = figure.epicentre ?? -1;
		const origin = epicentre >= 0 ? figure.stars[epicentre] : undefined;
		const ox = origin?.x ?? 0;
		const oy = origin?.y ?? 0;
		const stars: PlanStar[] = figure.stars.map((s, i) => ({
			x: turned ? -(s.y - oy) : s.x - ox,
			y: turned ? s.x - ox : s.y - oy,
			scale: magScale(s.mag),
			slot: s.slot,
			seed: hash2(index, i),
		}));

		let best = { x: 0, y: 0, score: -Infinity, clearance: 0 };
		for (let c = 0; c < cells.length; c += 2) {
			const cx = cells[c] as number;
			const cy = cells[c + 1] as number;
			const off = Math.hypot(cx, cy);
			if (off > 1.3) continue;
			let clearance = Infinity;
			let blocked = false;
			for (const [i, s] of stars.entries()) {
				const d = Math.hypot(s.x - cx, s.y - cy);
				if (i === epicentre && d < B3.clearance) blocked = true;
				clearance = Math.min(clearance, d);
			}
			if (blocked) continue;
			let wire = Infinity;
			for (const [p, q] of figure.lines) {
				const a = stars[p] as PlanStar;
				const b = stars[q] as PlanStar;
				wire = Math.min(wire, distanceToSegment(cx, cy, a.x, a.y, b.x, b.y));
			}
			// Clear of the stars first; then near the axis, so the swerve is small;
			// then, a little, clear of the lines.
			const score = Math.min(clearance, 0.5) - 0.3 * off + 0.15 * Math.min(wire, 0.2);
			if (score > best.score) best = { x: cx, y: cy, score, clearance };
		}

		return {
			index,
			name: figure.name,
			turned,
			stars,
			lines: figure.lines,
			epicentre,
			pass: { x: best.x, y: best.y },
			clearance: best.clearance,
		};
	});
}

/** How one figure is framed in one viewport. */
export interface FigureFit {
	/** Pixels per world unit in the figure's plane, seen from its station. */
	readonly scale: number;
	/** How far in front of the plane the station is. */
	readonly dist: number;
	/** The camera's x, y at the station. */
	readonly sx: number;
	readonly sy: number;
	/** The base radius of this figure's stars, world units. */
	readonly starR: number;
}

export interface Camera {
	x: number;
	y: number;
	z: number;
}

export interface Projected {
	/** Viewport pixels. */
	x: number;
	y: number;
	/** Pixels per world unit at that depth. Zero or less: behind the lens. */
	scale: number;
	/** Distance in front of the lens. */
	depth: number;
}

export interface Layout {
	readonly w: number;
	readonly h: number;
	/** Focal length, pixels. */
	readonly focal: number;
	readonly safe: { top: number; bottom: number; side: number };
	/** The centre of the safe area, viewport pixels. */
	readonly safeX: number;
	readonly safeY: number;
	/** Radius of a base star's disc at its station, pixels. */
	readonly starPx: number;
	/**
	 * The least a star's `scale` counts for in this viewport (0: no floor). On a
	 * portrait screen the faint stars are drawn up to it, so that every star is
	 * large enough to be seen and touched. Use `sizeOf` and never `star.scale`.
	 */
	readonly minScale: number;
	/**
	 * Cellestial's star here, as a multiple of its world size. On a portrait
	 * screen it is never drawn too small for the hand and never so large that
	 * its rings would reach one of Virgo's stars. Everywhere else it is 1,
	 * unless a star of Virgo drawn at the faintest star's size would still
	 * touch its rings: then the rings give way.
	 */
	readonly b3: number;
	/**
	 * Its rings end short of every star of Virgo at Virgo's station, so nothing
	 * needs to be drawn over them. False only on a portrait screen with
	 * `PORTRAIT.turn` off: there the star is the size it was before the turn
	 * (`B3_PORTRAIT_PX`), its rings reach over Virgo's nearest stars, and those
	 * are drawn over the rings so that none is hidden.
	 */
	readonly b3Clear: boolean;
	/** A star's size in this viewport, as a multiple of the figure's base star radius. */
	sizeOf(star: PlanStar): number;
	/**
	 * The twelve figures as they stand in this viewport: each upright, or (on a
	 * portrait screen, a wide figure) turned. The one place a star's x and y come from.
	 */
	readonly plans: readonly FigurePlan[];
	readonly fits: readonly FigureFit[];
	/** `pos` of layer k's station. */
	station(k: number): number;
	/** The station nearest a position. */
	nearestStation(pos: number): number;
	/** Position as a layer number: whole at a station, fractions between two. */
	coordOf(pos: number): number;
	posOf(coord: number): number;
	/** The camera on the flight path at `pos`. */
	cameraAt(pos: number, out?: Camera): Camera;
	/** A world point on screen, for a camera anywhere. */
	project(cam: Camera, x: number, y: number, z: number, out?: Projected): Projected;
}

const GLOW_PAD = 1.3;
/** The furthest a station may stand from its plane. */
const MAX_DIST = 0.8 * SPACING;

export interface LayoutOptions {
	/** Whether a portrait screen turns its wide figures. `PORTRAIT.turn` when left out. */
	readonly turn?: boolean;
}

export function createLayout(
	w: number,
	h: number,
	set: PlanSet,
	options: LayoutOptions = {},
): Layout {
	const width = Math.max(1, w);
	const height = Math.max(1, h);
	const focal = FOCAL * Math.max(width, height);
	const side = width <= SAFE.narrow ? SAFE.sidePhone : SAFE.sideDesktop;
	// On a very short viewport (a phone on its side) the chrome's room is cut down in
	// proportion. The exit button is not: it is as high on every screen, and the room
	// under the figures is never less than the button, its distance from the screen's
	// bottom and the clear space above it (96 px; a fifth of the height from 480 px up).
	const footRoom = B11.above + B11.height + B11.clear;
	const safe = {
		top: Math.min(SAFE.top, 0.16 * height),
		bottom: Math.min(SAFE.bottom, Math.max(0.2 * height, footRoom)),
		side,
	};
	/** No star's disc stands lower than this at its station, viewport pixels from the top. */
	const footLine = height - footRoom;
	// A portrait screen is held in the hand: its stars are sized for that, with a floor.
	const portrait = height > width && width <= SAFE.narrow;
	const starPx = portrait
		? STAR_PX.portrait
		: clamp(STAR_PX.base + STAR_PX.slope * Math.min(width, height), STAR_PX.min, STAR_PX.max);
	const minScale = portrait ? STAR_PX.floor / starPx : 0;
	/** The stars this viewport draws at a size of its own (knots, and Virgo's star nearest the rings): see below. */
	const sizes = new Map<PlanStar, number>();
	const natural = (star: PlanStar) => Math.max(star.scale, minScale);
	const sizeOf = (star: PlanStar) =>
		(sizes.size > 0 ? sizes.get(star) : undefined) ?? natural(star);

	// Room about the middle of the viewport, to each side.
	const right = Math.max(40, width / 2 - side);
	const up = Math.max(40, height / 2 - safe.top);
	const down = Math.max(40, height / 2 - safe.bottom);

	const fit = (plan: FigurePlan): FigureFit => {
		const pinned = plan.epicentre >= 0;
		// The figure's padded extent in pixels at scale s, about the axis.
		const extent = (s: number) => {
			let minX = Infinity;
			let maxX = -Infinity;
			let minY = Infinity;
			let maxY = -Infinity;
			for (const star of plan.stars) {
				const pad = starPx * natural(star) * GLOW_PAD;
				minX = Math.min(minX, star.x * s - pad);
				maxX = Math.max(maxX, star.x * s + pad);
				minY = Math.min(minY, star.y * s - pad);
				maxY = Math.max(maxY, star.y * s + pad);
			}
			return { minX, maxX, minY, maxY };
		};
		const fitsAt = (s: number) => {
			const e = extent(s);
			// B3 stays in the very middle of the screen, so Virgo is fitted about it.
			if (pinned) return e.maxX <= right && -e.minX <= right && e.maxY <= up && -e.minY <= down;
			return e.maxX - e.minX <= 2 * right && e.maxY - e.minY <= up + down;
		};
		let lo = 1;
		let hi = 4 * Math.max(width, height);
		for (let i = 0; i < 40; i++) {
			const mid = (lo + hi) / 2;
			if (fitsAt(mid)) lo = mid;
			else hi = mid;
		}
		// A station is never further from its plane than this: the layer before it stays behind the lens.
		const scale = Math.max(lo, focal / MAX_DIST);
		const e = extent(scale);
		// Centre the padded figure in the safe area, whose middle is a little above the screen's.
		const sx = pinned ? 0 : (e.minX + e.maxX) / 2 / scale;
		let sy = pinned ? 0 : ((e.minY + e.maxY) / 2 - (up - down) / 2) / scale;
		if (!pinned) {
			// A figure held at its furthest stand is taller than a short screen's safe area
			// (five of the twelve on a phone on its side) and, centred, would hang out of it
			// at both ends: at the foot, into the exit button. Its foot wins: the figure is
			// moved up until its lowest disc stands on the line, as long as its topmost disc
			// stays inside the screen. Nothing fitted inside the safe area is ever moved.
			let low = -Infinity;
			let high = Infinity;
			for (const star of plan.stars) {
				const y = height / 2 - (star.y - sy) * scale;
				const r = starPx * natural(star);
				low = Math.max(low, y + r);
				high = Math.min(high, y - r);
			}
			const lift = Math.min(low - footLine, high - B11.head);
			if (lift > 0) sy -= lift / scale;
		}
		return { scale, dist: focal / scale, sx, sy, starR: starPx / scale };
	};

	// On a portrait screen a wide figure fitted to the width is a band across a tall dark
	// screen. Turned a quarter, it stands tall and is seen from much nearer: a figure is
	// turned where that gains enough to be worth it. Nowhere else is anything turned.
	const turning = portrait && (options.turn ?? PORTRAIT.turn);
	const plans: FigurePlan[] = [];
	const fits: FigureFit[] = [];
	for (const [i, upright] of set.upright.entries()) {
		let plan = upright;
		let framed = fit(upright);
		const turned = turning ? set.turned[i] : undefined;
		if (turned) {
			const other = fit(turned);
			if (other.scale >= PORTRAIT.turnGain * framed.scale) {
				plan = turned;
				framed = other;
			}
		}
		plans.push(plan);
		fits.push(framed);
	}

	/** A star's disc radius at its figure's station, pixels. */
	const discPx = (star: PlanStar) => starPx * sizeOf(star);

	// Knots. Where two stars of a figure would cover each other by more than a third of the
	// smaller one's width, both are drawn smaller, so that they read as two stars and not
	// as a lump. Only what is drawn changes: a star's tap target is as large as ever. On
	// every screen: the closest pair of the Hyades is a knot on a desktop too.
	for (const [i, plan] of plans.entries()) {
		const scale = (fits[i] as FigureFit).scale;
		for (let pass = 0; pass < 4; pass++) {
			let changed = false;
			for (let a = 0; a < plan.stars.length; a++) {
				for (let b = a + 1; b < plan.stars.length; b++) {
					if (a === plan.epicentre || b === plan.epicentre) continue;
					const p = plan.stars[a] as PlanStar;
					const q = plan.stars[b] as PlanStar;
					const d = Math.hypot(p.x - q.x, p.y - q.y) * scale;
					const rp = discPx(p);
					const rq = discPx(q);
					if (rp + rq - d <= KNOT.over * 2 * Math.min(rp, rq) + 1e-9) continue;
					const r = Math.max(
						KNOT.leastPx,
						Math.min(Math.max(KNOT.floorPx, KNOT.radius * d), KNOT.tight * d),
					);
					for (const [star, now] of [
						[p, rp],
						[q, rq],
					] as const) {
						if (r < now - 1e-9) {
							sizes.set(star, r / starPx);
							changed = true;
						}
					}
				}
			}
			if (!changed) break;
		}
	}

	// Cellestial's star. On a portrait screen it is the first thing a visitor is handed, and
	// it must stand clear: its rings end short of every star of Virgo. It is drawn at its
	// world size on the turned Virgo, never too small for the hand; a neighbour that would
	// touch the rings is drawn at the floor size; and if one still would, the rings give way.
	let b3 = 1;
	let b3Clear = true;
	const virgo = plans.findIndex((plan) => plan.epicentre >= 0);
	const virgoFit = fits[virgo];
	const virgoPlan = plans[virgo];
	if (portrait && virgoPlan && virgoFit) {
		const world = B3.ring * virgoFit.scale;
		if (!turning) {
			// The sky as it was before the turn: sized for the hand whatever Virgo's fit.
			b3 = Math.max(1, B3_PORTRAIT_PX / (2 * world));
			b3Clear = false;
		} else {
			const want = Math.max(world, PORTRAIT.b3MinPx / 2);
			const centre = virgoPlan.stars[virgoPlan.epicentre] as PlanStar;
			const others = virgoPlan.stars.filter((star) => star !== centre);
			const free = (star: PlanStar) =>
				Math.hypot(star.x - centre.x, star.y - centre.y) * virgoFit.scale - discPx(star);
			for (const star of others) {
				if (free(star) < want + PORTRAIT.b3Clear && sizeOf(star) > minScale) {
					sizes.set(star, minScale);
				}
			}
			const room = Math.min(...others.map(free)) - PORTRAIT.b3Clear;
			b3 = Math.max(0.5, Math.min(want, room) / world);
		}
	} else if (virgoPlan && virgoFit) {
		// Every other screen: the star is its world size, and its rings end short of every
		// star of Virgo there too. Where Virgo is fitted small (a phone on its side, a short
		// window, a tablet upright) the disc of its brightest star would reach into the
		// rings' sweep by a pixel or three: that star is drawn just small enough to stand
		// clear, never smaller than the faintest star is drawn; if it then still would
		// touch, the rings give way. On a large screen nothing is near and nothing changes.
		const world = B3.ring * virgoFit.scale;
		const centre = virgoPlan.stars[virgoPlan.epicentre] as PlanStar;
		const others = virgoPlan.stars.filter((star) => star !== centre);
		const away = (star: PlanStar) =>
			Math.hypot(star.x - centre.x, star.y - centre.y) * virgoFit.scale;
		for (const star of others) {
			const room = away(star) - world - PORTRAIT.b3Clear;
			if (discPx(star) > room) {
				sizes.set(star, Math.min(sizeOf(star), Math.max(MAG.faintScale, room / starPx)));
			}
		}
		const room = Math.min(...others.map((star) => away(star) - discPx(star))) - PORTRAIT.b3Clear;
		if (room < world - 1e-6) b3 = Math.max(0.5, room / world);
	}

	const fitOf = (k: number) => fits[mod(k, FIGURES)] as FigureFit;
	const planOf = (k: number) => plans[mod(k, FIGURES)] as FigurePlan;
	const station = (k: number) => k * SPACING - fitOf(k).dist;

	const nearestStation = (pos: number) => {
		let k = Math.round(pos / SPACING);
		while (Math.abs(station(k + 1) - pos) < Math.abs(station(k) - pos)) k++;
		while (Math.abs(station(k - 1) - pos) < Math.abs(station(k) - pos)) k--;
		return k;
	};

	const coordOf = (pos: number) => {
		let k = Math.floor(pos / SPACING);
		if (pos >= station(k + 1)) k++;
		const a = station(k);
		return k + (pos - a) / (station(k + 1) - a);
	};

	const posOf = (coord: number) => {
		const k = Math.floor(coord);
		return lerp(station(k), station(k + 1), coord - k);
	};

	const cameraAt = (pos: number, out: Camera = { x: 0, y: 0, z: 0 }) => {
		const k = Math.floor(pos / SPACING);
		const plane = k * SPACING;
		const next = fitOf(k + 1);
		const stop = station(k + 1);
		let ax: number;
		let ay: number;
		let bx: number;
		let by: number;
		let t: number;
		if (pos <= stop) {
			// Out of the plane just crossed, towards the next station.
			({ x: ax, y: ay } = planOf(k).pass);
			bx = next.sx;
			by = next.sy;
			t = (pos - plane) / (stop - plane);
		} else {
			// From the station into its plane, easing round whatever stands in the way.
			ax = next.sx;
			ay = next.sy;
			({ x: bx, y: by } = planOf(k + 1).pass);
			t = (pos - stop) / next.dist;
		}
		const e = smooth(t);
		out.x = lerp(ax, bx, e);
		out.y = lerp(ay, by, e);
		out.z = -pos;
		return out;
	};

	const project = (
		cam: Camera,
		x: number,
		y: number,
		z: number,
		out: Projected = { x: 0, y: 0, scale: 0, depth: 0 },
	) => {
		const depth = cam.z - z;
		out.depth = depth;
		if (depth <= 1e-6) {
			out.scale = 0;
			out.x = Number.NaN;
			out.y = Number.NaN;
			return out;
		}
		const s = focal / depth;
		out.scale = s;
		out.x = width / 2 + (x - cam.x) * s;
		out.y = height / 2 - (y - cam.y) * s;
		return out;
	};

	return {
		w: width,
		h: height,
		focal,
		safe,
		safeX: width / 2,
		safeY: height / 2 - (up - down) / 2,
		starPx,
		minScale,
		b3,
		b3Clear,
		sizeOf,
		plans,
		fits,
		station,
		nearestStation,
		coordOf,
		posOf,
		cameraAt,
		project,
	};
}

/** The layer nearest in front of the lens: its plane is at least `gap` ahead. */
export function layerAhead(camZ: number, gap: number): number {
	return Math.ceil((-camZ + gap) / SPACING);
}
