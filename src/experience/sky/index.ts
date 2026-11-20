// The Sky (B, G1): the world and the flight.
//
// mount() finds <canvas id="sky-canvas"> and <div id="sky-ui"> (Sky.astro),
// builds the world and returns the SkyScene the stage talks to. It reaches
// the rest of the page only through the context it is handed.
//
// One clock drives everything that moves by itself (`time`, seconds), and
// one number says where the camera is (`flight.pos`, the distance flown).
// A frame is: step the clock, work out the camera, draw.

import { slotToStar } from '../../content/constellations.ts';
import type {
	ClaimsEvent,
	ClaimsStore,
	MountSky,
	ScreenCircle,
	SkyScene,
	SlotId,
} from '../contracts.ts';
import { createStarButtons, type StarSpot } from './buttons.ts';
import {
	B3,
	FADE,
	FALL,
	FIGURES,
	FLIGHT,
	FOCUS,
	IGNITE,
	LATTICE,
	ROUND_KEY,
	SPACING,
} from './config.ts';
import { createEmitter } from './emitter.ts';
import { createFlight } from './flight.ts';
import { createWorld, type Frame, LOOK, PLANE_GAP, type World } from './gl/world.ts';
import { createGovernor } from './governor.ts';
import type { SkyDebug, SkyEvents, SkyHooks, SkyInternals } from './hooks.ts';
import { attachInput } from './input.ts';
import { createHoneycomb } from './lattice.ts';
import {
	type Camera,
	clamp,
	createLayout,
	layerAhead,
	lerp,
	mod,
	type Projected,
	planFigures,
	smooth,
} from './layout.ts';
import { loadPictures } from './pictures.ts';

// ───────────────────────────────────────────────────────────── tuning ──

interface Quality {
	/** Cap on the pixel ratio. */
	dpr: number;
	/** Honeycomb planes drawn ahead, and how much of each plane's disc. */
	planes: number;
	radius: number;
	struts: boolean;
	/** The honeycomb planes between two layers. */
	between: boolean;
	/** Trail length in the fall, 0..1. */
	trail: number;
	/** Idle animation (the stars' slow turn, the core's breath). */
	idle: number;
}

/** What the governor sheds, in order: pixels first, then honeycomb, trails and idle motion. */
const QUALITY: readonly Quality[] = [
	{ dpr: 2, planes: 5, radius: 1, struts: true, between: true, trail: 1, idle: 1 },
	{ dpr: 1.5, planes: 5, radius: 1, struts: true, between: true, trail: 1, idle: 1 },
	{ dpr: 1, planes: 5, radius: 1, struts: true, between: true, trail: 1, idle: 1 },
	{ dpr: 1, planes: 3, radius: 0.8, struts: true, between: false, trail: 0.7, idle: 1 },
	{ dpr: 1, planes: 2, radius: 0.6, struts: false, between: false, trail: 0.45, idle: 0 },
];

/** The levels a screen of this pixel ratio really has: steps that would change nothing are left out. */
function levelsFor(device: number): Quality[] {
	const out: Quality[] = [];
	for (const q of QUALITY) {
		const dpr = Math.min(q.dpr, device);
		const prev = out[out.length - 1];
		if (prev && prev.dpr === dpr && prev.planes === q.planes && prev.struts === q.struts) continue;
		out.push({ ...q, dpr });
	}
	return out;
}

/** The loader's hand-off (A5). */
const INTRO = {
	/** The camera starts this far back and settles on the station. */
	pull: 1.4,
	/** The core swells this much in mid-flight. */
	swell: 0.12,
	/** The rings arrive this much larger, and this much turned (radians), and settle. */
	ringFrom: 1.45,
	spin: 2.2,
	/** The loop keeps running this long after the hand-off, until the stage activates the sky. */
	holdMs: 2500,
} as const;

/** Each ring's tilt breathes a little: amount, rate (rad/s), phase. */
const TILT = [
	[0.1, 0.23, 0.4],
	[0.13, 0.31, 2.1],
	[0.11, 0.19, 4.4],
] as const;

/** A claim made elsewhere waits this long for focusStar(slot, { ignite }) before it lights by itself. */
const CLAIM_GRACE_MS = 2500;
/** The end of the fall: what little is left fades over this long. */
const FALL_END = 0.25;
/** A star fainter than this neither lands nor is waited for. */
const FAINT = 0.03;
/** The reach of a star's quad, in disc radii (STAR_VERTEX's REACH). */
const REACH = 1.75;

const IGNITE_TOTAL = IGNITE.fire + IGNITE.flash + IGNITE.settle;

const smoother = (t: number) => {
	const c = clamp(t);
	return c * c * c * (c * (c * 6 - 15) + 10);
};

function readRound(): boolean {
	try {
		return window.sessionStorage.getItem(ROUND_KEY) === '1';
	} catch {
		return false;
	}
}

function writeRound(): void {
	try {
		window.sessionStorage.setItem(ROUND_KEY, '1');
	} catch {
		// Storage is blocked: the round is remembered for this page only.
	}
}

// ─────────────────────────────────────────────────── no WebGL, no sky ──

/** The scene when the sky cannot be drawn: nothing happens, and nothing waits on it. */
function deadScene(reason: unknown): SkyInternals {
	const error = reason instanceof Error ? reason : new Error(String(reason));
	const ready = Promise.reject(error);
	ready.catch(() => {});
	return {
		ready,
		setActive() {},
		reset() {},
		setStill() {},
		introPrime() {},
		introProgress() {},
		coreCircle: () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2, r: 0 }),
		fall({ onImpact }) {
			try {
				onImpact(window.innerWidth / 2);
			} catch (err) {
				console.error('[sky]', err);
			}
			return Promise.resolve();
		},
		restore() {},
		focusStar: () => Promise.resolve(),
		// There is no flight to complete, and the way on must not depend on one.
		roundComplete: () => true,
		hooks: null,
		debug: null,
	};
}

/** The sky's own hooks, for code inside src/experience/sky/. Null if the sky could not start. */
export function hooksOf(scene: SkyScene): SkyHooks | null {
	return (scene as Partial<SkyInternals>).hooks ?? null;
}

// ────────────────────────────────────────────────────────────── mount ──

export const mount: MountSky = (ctx) => {
	const canvas = document.getElementById('sky-canvas');
	const ui = document.getElementById('sky-ui');
	if (!(canvas instanceof HTMLCanvasElement) || !ui) {
		return deadScene(new Error('sky: #sky-canvas and #sky-ui are not in the document'));
	}

	const comb = createHoneycomb(LATTICE);
	const plans = planFigures(comb.cells);
	const measure = () => {
		const box = canvas.getBoundingClientRect();
		return {
			w: Math.round(box.width) || window.innerWidth || 1,
			h: Math.round(box.height) || window.innerHeight || 1,
		};
	};
	const first = measure();
	let layout = createLayout(first.w, first.h, plans);

	let world: World;
	try {
		world = createWorld(canvas, comb, layout);
	} catch (err) {
		return deadScene(err);
	}

	const emitter = createEmitter<SkyEvents>();
	const flight = createFlight(layout, layout.station(0));

	// ── state ──
	let time = 0;
	/** The debug clock: when set, time only moves when it is told to. */
	let pinned: number | null = null;
	let active = false;
	let still = ctx.reducedMotion;
	let ready = false;
	let hidden = document.hidden;

	const pathCam: Camera = { x: 0, y: 0, z: 0 };
	const cam: Camera = { x: 0, y: 0, z: 0 };
	/** The camera, less its place on the flight path: where a close-up has taken it. */
	const off = { x: 0, y: 0, z: 0 };
	const tmp: Projected = { x: 0, y: 0, scale: 0, depth: 0 };

	// ── quality ──
	let deviceDpr = window.devicePixelRatio || 1;
	let levels = levelsFor(deviceDpr);
	let governor = createGovernor({ levels: levels.length });
	let level = 0;
	let forced: number | null = null;
	let quality = levels[0] as Quality;
	let lastFrameMs = 0;

	world.resize(layout, quality.dpr);

	const applyLevel = (n: number) => {
		level = clamp(Math.round(n), 0, levels.length - 1);
		quality = levels[level] as Quality;
		if (world.dpr !== quality.dpr) world.resize(layout, quality.dpr);
	};

	// ── the loop ──
	let raf = 0;
	let last = -1;
	let frameWanted = false;
	let awake = 0;

	const schedule = () => {
		if (raf !== 0 || hidden || !ready) return;
		raf = window.requestAnimationFrame(loop);
	};
	const requestFrame = () => {
		frameWanted = true;
		schedule();
	};
	const wake = schedule;

	// ── the hand-off from the loader ──
	let introAt: ScreenCircle | null = null;
	let introT = 1;
	let introHold = 0;
	const introOn = () => introAt !== null && introT < 1;

	const introPose = (t: number): ScreenCircle => {
		const at = introAt ?? { x: layout.w / 2, y: layout.h / 2, r: 1 };
		const fit = layout.fits[0];
		const endR = B3.ring * B3.core * (fit?.scale ?? 1);
		const e = smoother(t);
		// Across first, then down: the arc of something let go.
		const ex = 1 - (1 - e) ** 1.3;
		const ey = e ** 1.3;
		const from = Math.max(at.r, 0.5);
		const swell = 1 + INTRO.swell * Math.sin(Math.PI * clamp(t));
		return {
			x: lerp(at.x, layout.w / 2, ex),
			y: lerp(at.y, layout.h / 2, ey),
			r: from * (endR / from) ** smooth(t) * swell,
		};
	};

	// ── the fall ──
	interface Fall {
		t0: number;
		gravity: number;
		groundY: () => number;
		onImpact: (x: number) => void;
		impacted: boolean;
		/** When the last of it began to fade, or -1. */
		ending: number;
		resolve: () => void;
	}
	let fall: Fall | null = null;
	/** The stars are down and have not been put back. */
	let fallen = false;

	// ── the camera ──
	const computeCamera = () => {
		layout.cameraAt(flight.pos, pathCam);
		cam.x = pathCam.x + off.x;
		cam.y = pathCam.y + off.y;
		cam.z = pathCam.z + off.z;
		if (introOn()) cam.z += INTRO.pull * (1 - smooth(introT));
	};
	const nearLayer = () => layerAhead(cam.z, PLANE_GAP);
	const depthOf = (k: number) => cam.z + k * SPACING;
	const nearFade = (depth: number) =>
		smooth((depth - FADE.near[0]) / (FADE.near[1] - FADE.near[0]));
	const farFade = (depth: number) => {
		const f = depth < FADE.far[0] ? 1 : Math.exp(-(depth - FADE.far[0]) / FADE.far[1]);
		return f * (1 - smooth((depth - 0.7 * FADE.far[2]) / (0.3 * FADE.far[2])));
	};

	// ── close-ups (focusStar) ──
	interface Focus {
		slot: SlotId;
		figure: number;
		star: number;
		layer: number;
		phase: 'travel' | 'in' | 'held' | 'out';
		/** The camera closes in from where the flight stands, not from the layer's station. */
		stay: boolean;
		/** Clock time at which the ease in on the star begins. */
		approachAt: number;
		ignite: boolean;
		/** Clock time at which the promise resolves once the camera is there, or -1. */
		settleAt: number;
		resolve: (() => void) | null;
	}
	let focus: Focus | null = null;
	/** The offset's own animation: from, to, progress 0..1, seconds. */
	const offFrom = { x: 0, y: 0, z: 0 };
	const offTo = { x: 0, y: 0, z: 0 };
	let offU = 1;
	let offDur = 1;

	const moveOff = (x: number, y: number, z: number, seconds: number) => {
		offFrom.x = off.x;
		offFrom.y = off.y;
		offFrom.z = off.z;
		offTo.x = x;
		offTo.y = y;
		offTo.z = z;
		offDur = Math.max(0.01, seconds);
		offU = 0;
	};
	const setOff = (x: number, y: number, z: number) => {
		off.x = offTo.x = x;
		off.y = offTo.y = y;
		off.z = offTo.z = z;
		offU = 1;
	};

	/** How far in front of its plane the camera stands to show one star large. */
	const closeDepth = (figure: number, star: number) => {
		const fit = layout.fits[figure];
		const s = plans[figure]?.stars[star];
		if (!fit || !s) return 1;
		const px = Math.min(FOCUS.size * Math.min(layout.w, layout.h), FOCUS.maxPx);
		// Never so close that the star begins to fade against the lens.
		return Math.max(FADE.near[1] * 1.15, (layout.focal * fit.starR * s.scale) / px);
	};

	/**
	 * Where the camera stands for that: the star large, at the centre of the
	 * safe area. Given as an offset from the flight path at `pos`.
	 */
	const closeUp = (layer: number, figure: number, star: number, pos: number) => {
		const s = plans[figure]?.stars[star];
		if (!s) return { x: 0, y: 0, z: 0 };
		const depth = closeDepth(figure, star);
		const scale = layout.focal / depth;
		const base = layout.cameraAt(pos);
		return {
			x: s.x - (layout.safeX - layout.w / 2) / scale - base.x,
			y: s.y + (layout.safeY - layout.h / 2) / scale - base.y,
			z: -layer * SPACING + depth - base.z,
		};
	};

	const settleFocus = (f: Focus) => {
		const done = f.resolve;
		f.resolve = null;
		done?.();
	};

	/** Let the star go: the camera eases back to the flight path. */
	const releaseFocus = (seconds = 0.7) => {
		const f = focus;
		if (!f || f.phase === 'out') return;
		settleFocus(f);
		f.phase = 'out';
		if (still) {
			setOff(0, 0, 0);
			focus = null;
		} else {
			moveOff(0, 0, 0, seconds);
		}
		emitter.emit('focus', { slot: null });
		requestFrame();
	};

	/** Drop a close-up at once, with no way back to ease along. */
	const dropFocus = () => {
		const f = focus;
		if (f) {
			settleFocus(f);
			focus = null;
			emitter.emit('focus', { slot: null });
		}
		setOff(0, 0, 0);
	};

	// ── the stars' states ──
	let claims: ClaimsStore | null = null;
	/** What the sky shows lit. */
	const lit = new Set<SlotId>();
	/** Claims being played: slot → the clock time it began. */
	const igniting = new Map<SlotId, number>();
	/** Claims heard of but not shown yet: slot → when (performance.now) to show them regardless. */
	const pending = new Map<SlotId, number>();
	let placedByMe: SlotId | null = null;

	const showLit = (slot: SlotId, on: boolean) => {
		const at = slotToStar(slot);
		if (!at) return;
		if (on) lit.add(slot);
		else lit.delete(slot);
		igniting.delete(slot);
		pending.delete(slot);
		world.setStar(at.constellation, at.star, { lit: on ? 1 : 0, ignite: -1 });
		requestFrame();
	};

	/** B4 to B5: the traces fire, the star flashes, and settles lit for good. */
	const ignite = (slot: SlotId) => {
		const at = slotToStar(slot);
		if (!at || igniting.has(slot)) return;
		pending.delete(slot);
		if (still || fallen) {
			showLit(slot, true);
			emitter.emit('ignite', { slot });
			return;
		}
		lit.add(slot);
		igniting.set(slot, time);
		world.setStar(at.constellation, at.star, { lit: 0, ignite: time });
		emitter.emit('ignite', { slot });
		wake();
	};

	const stepIgnitions = () => {
		for (const [slot, began] of igniting) {
			if (time - began < IGNITE_TOTAL) continue;
			igniting.delete(slot);
			const at = slotToStar(slot);
			if (at) world.setStar(at.constellation, at.star, { lit: 1, ignite: -1 });
		}
	};

	// ── extra light on a star: the pointer over it, and whatever asks through the hooks ──
	const hoverGlow = new Map<SlotId, number>();
	const askedGlow = new Map<SlotId, number>();
	let hoverSlot: SlotId | null = null;
	let glowBusy = false;

	const applyGlow = (slot: SlotId) => {
		const at = slotToStar(slot);
		if (!at) return;
		const glow = Math.max(hoverGlow.get(slot) ?? 0, askedGlow.get(slot) ?? 0);
		world.setStar(at.constellation, at.star, { glow });
	};

	const stepGlow = (dt: number) => {
		glowBusy = false;
		for (const [slot, now] of hoverGlow) {
			const want = slot === hoverSlot ? 1 : 0;
			if (now === want) continue;
			let next = now + (want - now) * (1 - Math.exp(-dt / 0.11));
			if (Math.abs(next - want) < 0.01) next = want;
			else glowBusy = true;
			if (next === 0) hoverGlow.delete(slot);
			else hoverGlow.set(slot, next);
			applyGlow(slot);
		}
	};

	const onHover = (slot: SlotId | null) => {
		hoverSlot = slot;
		if (slot && !hoverGlow.has(slot)) hoverGlow.set(slot, 0);
		if (still || pinned !== null) {
			// No clock to ease on: it is simply on or off.
			for (const s of [...hoverGlow.keys()]) {
				if (s === hoverSlot) hoverGlow.set(s, 1);
				else hoverGlow.delete(s);
				applyGlow(s);
			}
			requestFrame();
			return;
		}
		glowBusy = true;
		wake();
	};

	// ── a star's place on screen ──
	/** The nearest layer ahead that shows this figure. */
	const layerShowing = (figure: number) => {
		const near = nearLayer();
		return near + mod(figure - near, FIGURES);
	};

	const fallDrop = (seed: number) => {
		if (!fall) return 0;
		const t = Math.max(0, time - fall.t0 - seed * FALL.stagger);
		return 0.5 * fall.gravity * t * t;
	};

	const starCircle = (slot: SlotId): ScreenCircle | null => {
		const at = slotToStar(slot);
		if (!at || (fallen && !fall)) return null;
		computeCamera();
		const plan = plans[at.constellation];
		const fit = layout.fits[at.constellation];
		const star = plan?.stars[at.star];
		if (!fit || !star) return null;
		const layer = layerShowing(at.constellation);
		const depth = depthOf(layer);
		if (depth > FADE.far[2] || depth < FADE.near[0]) return null;
		layout.project(cam, star.x, star.y - fallDrop(star.seed), -layer * SPACING, tmp);
		const r = Math.max(fit.starR * star.scale * tmp.scale, LOOK.starMinPx);
		if (tmp.x + r < 0 || tmp.x - r > layout.w || tmp.y + r < 0 || tmp.y - r > layout.h) return null;
		return { x: tmp.x, y: tmp.y, r };
	};

	// ── picking ──
	const moving = () => flight.mode === 'thrust' || flight.mode === 'glide';

	const onPick = (slot: SlotId) => {
		const isLit = lit.has(slot) || (claims?.isLit(slot) ?? false);
		const circle = starCircle(slot);
		emitter.emit('star-pick', { slot, lit: isLit, circle });
		if (moving() && !(focus && focus.phase === 'travel')) flight.halt();
		if (isLit) {
			void scene.focusStar(slot);
			return;
		}
		const store = claims;
		if (!store) return;
		if (store.unplaced() !== null) {
			// A request was already sent with no star chosen: this is its star.
			placedByMe = slot;
			store.place(slot);
			if (store.isLit(slot) && !lit.has(slot)) ignite(slot);
			placedByMe = null;
		} else {
			store.pick(slot);
			// Part B opens the preview panel (B10) on this.
			emitter.emit('open-empty', { slot, circle });
		}
	};

	const buttons = createStarButtons(ui, { pick: onPick, hover: onHover });
	const spots: StarSpot[] = [];

	const updateButtons = () => {
		const on = active && ready && !introOn() && !fall && !fallen;
		buttons.setEnabled(on);
		if (!on) return;
		const near = nearLayer();
		const figure = mod(near, FIGURES);
		const plan = plans[figure];
		const fit = layout.fits[figure];
		if (!plan || !fit) return;
		const z = -near * SPACING;
		let n = 0;
		for (const star of plan.stars) {
			if (!star.slot) continue;
			layout.project(cam, star.x, star.y, z, tmp);
			const r = Math.max(fit.starR * star.scale * tmp.scale, LOOK.starMinPx);
			let spot = spots[n];
			if (!spot) {
				spot = { slot: star.slot, x: 0, y: 0, r: 0, lit: false, shown: false };
				spots[n] = spot;
			}
			n++;
			spot.slot = star.slot;
			spot.x = tmp.x;
			spot.y = tmp.y;
			spot.r = r;
			spot.lit = lit.has(star.slot);
			spot.shown =
				tmp.depth > 0.13 &&
				tmp.x > -r &&
				tmp.x < layout.w + r &&
				tmp.y > -r &&
				tmp.y < layout.h + r;
		}
		buttons.update(plan.name, spots, n);
	};

	// ── claims ──
	const flushPending = () => {
		const now = performance.now();
		for (const [slot, due] of pending) {
			if (now < due) continue;
			pending.delete(slot);
			if (lit.has(slot)) continue;
			if (active && !still && starCircle(slot)) ignite(slot);
			else showLit(slot, true);
		}
	};

	const onClaims = (e: ClaimsEvent) => {
		if (e.type !== 'claimed') return;
		const { slot } = e;
		if (lit.has(slot)) return;
		if (placedByMe === slot) {
			ignite(slot);
			return;
		}
		// Sent from the build-request dialog: the director brings the visitor to
		// the star and asks for the claim to be played there. If it never does,
		// the star lights by itself.
		pending.set(slot, performance.now() + CLAIM_GRACE_MS);
		window.setTimeout(flushPending, CLAIM_GRACE_MS + 40);
	};

	const claimsReady = ctx.when('claims');
	claimsReady
		.then((store) => {
			claims = store;
			for (const slot of store.all().keys()) if (!lit.has(slot)) showLit(slot, true);
			store.subscribe(onClaims);
		})
		.catch((err) => console.error('[sky] no claims store', err));

	// ── one full round ──
	let round = readRound();
	const visited = new Array<boolean>(FIGURES).fill(false);
	let lastCoord = Number.NaN;
	let lastStation: number | null = null;

	// ── B11, the way out ──
	// In the markup from the start (Sky.astro), hidden. It is shown once the
	// round is flown, and from the first moment when nothing moves; then it stays.
	const exit = ui.querySelector<HTMLElement>('[data-descend]');
	const showExit = (arriving = false) => {
		if (!exit) return;
		const show = round || still;
		if (show && exit.hidden && arriving) exit.dataset.arriving = '';
		exit.hidden = !show;
	};
	showExit();
	exit?.addEventListener('click', () => {
		ctx
			.when('director')
			.then((director) => director.descend())
			.catch((err) => console.error('[sky] no director', err));
	});

	const arrive = (layer: number) => {
		if (layer === lastStation) return;
		lastStation = layer;
		const figure = mod(layer, FIGURES);
		emitter.emit('station', { layer, figure });
		if (visited[figure]) return;
		visited[figure] = true;
		if (!round && visited.every(Boolean)) {
			round = true;
			writeRound();
			showExit(true);
			emitter.emit('round-complete', { figures: FIGURES });
		}
	};

	const trackStations = () => {
		if (introOn() || fall || fallen) return;
		const coord = layout.coordOf(flight.pos);
		if (lastStation !== null && Math.abs(coord - lastStation) > 0.05) lastStation = null;
		if (Number.isNaN(lastCoord)) {
			if (Math.abs(coord - Math.round(coord)) < 1e-6) arrive(Math.round(coord));
		} else if (coord > lastCoord) {
			for (let k = Math.floor(lastCoord + 1e-9) + 1; k <= Math.floor(coord + 1e-9); k++) arrive(k);
		} else if (coord < lastCoord) {
			for (let k = Math.ceil(lastCoord - 1e-9) - 1; k >= Math.ceil(coord - 1e-9); k--) arrive(k);
		}
		lastCoord = coord;
	};

	// ── stepping ──
	const stepFocus = (dt: number) => {
		if (offU < 1) {
			offU = Math.min(1, offU + dt / offDur);
			const e = smoother(offU);
			off.x = lerp(offFrom.x, offTo.x, e);
			off.y = lerp(offFrom.y, offTo.y, e);
			off.z = lerp(offFrom.z, offTo.z, e);
		}
		const f = focus;
		if (!f) return;
		if (f.phase === 'travel' && time >= f.approachAt) {
			const to = closeUp(f.layer, f.figure, f.star, f.stay ? flight.pos : layout.station(f.layer));
			moveOff(to.x, to.y, to.z, FOCUS.approach);
			f.phase = 'in';
		} else if (f.phase === 'in' && offU >= 1 && !moving()) {
			f.phase = 'held';
			emitter.emit('focus', { slot: f.slot });
			if (f.ignite) {
				ignite(f.slot);
				f.settleAt = time + IGNITE_TOTAL;
			} else {
				f.settleAt = time;
			}
		}
		if (f.phase === 'held' && f.resolve && time >= f.settleAt) {
			settleFocus(f);
			// Part B opens the lit-star panel on this.
			if (lit.has(f.slot)) {
				emitter.emit('open-lit', { slot: f.slot, circle: starCircle(f.slot), ignited: f.ignite });
			}
		}
		if (f.phase === 'out' && offU >= 1) focus = null;
	};

	const finishFall = () => {
		const f = fall;
		if (!f) return;
		fall = null;
		fallen = true;
		if (!f.impacted) {
			f.impacted = true;
			try {
				f.onImpact(layout.w / 2);
			} catch (err) {
				console.error('[sky] onImpact failed', err);
			}
		}
		f.resolve();
		requestFrame();
	};

	const stepFall = () => {
		const f = fall;
		if (!f) return;
		if (f.ending >= 0) {
			if (time - f.ending >= FALL_END) finishFall();
			return;
		}
		const elapsed = time - f.t0;
		computeCamera();
		let ground = Number.POSITIVE_INFINITY;
		try {
			const y = f.groundY();
			if (Number.isFinite(y)) ground = y;
		} catch (err) {
			console.error('[sky] groundY failed', err);
		}
		const floor = Math.min(ground, layout.h);
		let left = 0;
		let hitX = 0;
		let hitOver = -1;
		const near = nearLayer();
		for (let k = near; k < near + 7; k++) {
			const depth = depthOf(k);
			if (depth > FADE.far[2]) break;
			const figure = mod(k, FIGURES);
			const plan = plans[figure];
			const fit = layout.fits[figure];
			if (!plan || !fit) continue;
			const scale = layout.focal / depth;
			const seen = nearFade(depth) * farFade(depth);
			for (const star of plan.stars) {
				if (!star.slot) continue;
				const trueR = fit.starR * star.scale * scale;
				if (seen * Math.min(1, trueR / LOOK.starMinPx) < FAINT) continue;
				const r = Math.max(trueR, LOOK.starMinPx);
				const x = layout.w / 2 + (star.x - cam.x) * scale;
				if (x + r * REACH < 0 || x - r * REACH > layout.w) continue;
				const t = Math.max(0, elapsed - star.seed * FALL.stagger);
				const y = layout.h / 2 - (star.y - 0.5 * f.gravity * t * t - cam.y) * scale;
				const trail = Math.min(f.gravity * t * FALL.trail * quality.trail * scale, 16 * r);
				if (y + r >= ground && y + r - ground > hitOver) {
					hitOver = y + r - ground;
					hitX = x;
				}
				if (y - r * REACH - trail < floor) left++;
			}
		}
		if (!f.impacted && hitOver >= 0) {
			f.impacted = true;
			try {
				f.onImpact(clamp(hitX, 0, layout.w));
			} catch (err) {
				console.error('[sky] onImpact failed', err);
			}
		}
		if (left === 0 || elapsed > FALL.timeout) f.ending = time;
	};

	const step = (dt: number) => {
		time += dt;
		if (!still && !introOn() && !fall && !fallen) flight.step(dt);
		stepFocus(dt);
		stepGlow(dt);
		stepIgnitions();
		stepFall();
		trackStations();
	};

	// ── drawing ──
	const frame: Frame = {
		cam,
		time: 0,
		idle: 1,
		lattice: 1,
		lines: 1,
		stars: 1,
		fallT: -1,
		gravity: 0,
		b3: {
			layer: 0,
			free: null,
			coreAlpha: 1,
			ringAlpha: 1,
			ringScale: 1,
			angles: [0, 0, 0],
			tilts: [1, 1, 1],
		},
		planes: quality.planes,
		radius: quality.radius,
		struts: quality.struts,
		between: quality.between,
		trail: quality.trail,
	};
	const angles: [number, number, number] = [0, 0, 0];
	const tilts: [number, number, number] = [1, 1, 1];
	const free = { x: 0, y: 0, depth: 1, radius: 1 };

	const compose = () => {
		computeCamera();
		frame.time = time;
		frame.idle = still ? 0 : quality.idle;
		frame.planes = quality.planes;
		frame.radius = quality.radius;
		frame.struts = quality.struts;
		frame.between = quality.between;
		frame.trail = quality.trail;

		let lattice = 1;
		let lines = 1;
		let stars = 1;
		let coreAlpha = 1;
		let ringAlpha = 1;
		let ringScale = 1;
		let whirl = 0;
		frame.fallT = -1;
		frame.gravity = 0;
		frame.b3.free = null;

		if (fall) {
			const elapsed = time - fall.t0;
			frame.fallT = elapsed;
			frame.gravity = fall.gravity;
			lattice = 1 - smooth(elapsed / FALL.fade);
			lines = 1 - smooth(elapsed / (FALL.fade * 0.6));
			coreAlpha = ringAlpha = 1 - smooth(elapsed / (FALL.fade * 1.3));
			if (fall.ending >= 0) stars = 1 - clamp((time - fall.ending) / FALL_END);
		} else if (fallen) {
			lattice = lines = stars = coreAlpha = ringAlpha = 0;
		} else if (introOn()) {
			const pose = introPose(introT);
			const depth = Math.max(0.05, cam.z);
			const scale = layout.focal / depth;
			free.x = cam.x + (pose.x - layout.w / 2) / scale;
			free.y = cam.y - (pose.y - layout.h / 2) / scale;
			free.depth = depth;
			free.radius = pose.r / scale;
			frame.b3.free = free;
			// Virgo and the honeycomb come up out of the black, 0.3 to 1.
			lattice = lines = stars = smooth((introT - 0.3) / 0.7);
			// The rings gather out of the loader's shards, 0.4 to 0.85.
			const settle = smooth((introT - 0.4) / 0.45);
			ringAlpha = settle;
			ringScale = lerp(INTRO.ringFrom, 1, settle);
			whirl = INTRO.spin * (1 - settle) ** 2;
		}

		for (const [i, ring] of B3.rings.entries()) {
			const tilt = TILT[i] ?? TILT[0];
			const turn = still ? 0 : ring.rate * time;
			angles[i as 0 | 1 | 2] = ring.rest + turn + whirl * Math.sign(ring.rate);
			tilts[i as 0 | 1 | 2] = still ? 1 : 1 + tilt[0] * Math.sin(time * tilt[1] + tilt[2]);
		}
		frame.lattice = lattice;
		frame.lines = lines;
		frame.stars = stars;
		const b3 = frame.b3;
		b3.coreAlpha = coreAlpha;
		b3.ringAlpha = ringAlpha;
		b3.ringScale = ringScale;
		b3.angles = angles;
		b3.tilts = tilts;
		// B3 stands in every Virgo layer; only the next one ahead can be in sight.
		const virgo = FIGURES * Math.ceil(nearLayer() / FIGURES);
		b3.layer = depthOf(virgo) < FADE.far[2] * 1.5 ? virgo : null;
	};

	const render = (dt: number) => {
		compose();
		if (emitter.count('frame') > 0) emitter.emit('frame', { time, dt });
		updateButtons();
		world.draw(frame);
	};

	const wantsLoop = () =>
		!hidden &&
		ready &&
		!world.contextLost &&
		pinned === null &&
		((active && !still) ||
			introOn() ||
			performance.now() < introHold ||
			fall !== null ||
			offU < 1 ||
			(focus !== null && focus.phase !== 'held') ||
			(focus?.resolve ?? null) !== null ||
			igniting.size > 0 ||
			glowBusy ||
			awake > 0);

	function loop(now: number) {
		raf = 0;
		if (hidden || !ready || world.contextLost) {
			last = -1;
			return;
		}
		let dt = 0;
		let frameMs = 0;
		if (wantsLoop()) {
			if (last >= 0) {
				frameMs = now - last;
				dt = Math.min(0.1, frameMs / 1000);
			} else {
				dt = 1 / 60;
			}
			last = now;
		} else {
			last = -1;
		}
		frameWanted = false;
		if (dt > 0) step(dt);
		render(dt);
		if (frameMs > 0) {
			lastFrameMs = frameMs;
			if (forced === null) {
				const next = governor.sample(frameMs, now);
				if (next !== level) applyLevel(next);
			}
		}
		if (wantsLoop() || frameWanted) schedule();
		else last = -1;
	}

	// ── the visitor's hands ──
	const flying = () => ready && active && !still && !introOn() && !fall && !fallen;
	let downWasMoving = false;

	const thrust = (go: () => void) => {
		if (!flying()) return;
		if (focus) releaseFocus();
		if (flight.mode !== 'thrust') emitter.emit('dismiss', { reason: 'flight' });
		go();
		wake();
	};

	const input = attachInput(canvas, ui, {
		push: (dir, touch) => thrust(() => flight.push(dir, touch ? FLIGHT.touchHold : FLIGHT.hold)),
		hold: (dir) => thrust(() => flight.hold(dir)),
		release: () => flight.release(),
		home() {
			if (!flying()) return;
			if (focus) releaseFocus();
			// Every Virgo layer is the opening pose: go to the nearest.
			const coord = layout.coordOf(flight.pos);
			const target = FIGURES * Math.round(coord / FIGURES);
			const layers = Math.abs(target - coord);
			if (layers < 1e-3) return;
			flight.glideTo(target, clamp(0.9 + 0.4 * layers, 1.1, 3.2));
			wake();
		},
		escape() {
			if (!focus || focus.phase === 'out') return false;
			releaseFocus();
			return true;
		},
		down() {
			downWasMoving = moving();
			if (!downWasMoving) return;
			// A tap stops the flight dead, wherever it is.
			flight.halt();
			if (focus && focus.phase !== 'held') releaseFocus(0.5);
			requestFrame();
		},
		tap(x, y) {
			const wasMoving = downWasMoving;
			downWasMoving = false;
			if (!wasMoving && focus && focus.phase !== 'out') releaseFocus();
			emitter.emit('tap-empty', { x, y, wasMoving });
		},
		swipeFromStar: () => buttons.swallowNextClick(),
	});

	// ── the page around it ──
	const onResize = () => {
		const next = measure();
		const device = window.devicePixelRatio || 1;
		if (next.w === layout.w && next.h === layout.h && device === deviceDpr) return;
		const coord = layout.coordOf(flight.pos);
		layout = createLayout(next.w, next.h, plans);
		flight.rebase(layout, layout.posOf(coord));
		if (device !== deviceDpr) {
			deviceDpr = device;
			levels = levelsFor(device);
			governor = createGovernor({ levels: levels.length });
			level = Math.min(level, levels.length - 1);
		}
		quality = levels[level] as Quality;
		world.resize(layout, quality.dpr);
		const f = focus;
		if (f && f.phase !== 'out' && f.phase !== 'travel') {
			const to = closeUp(f.layer, f.figure, f.star, f.stay ? flight.pos : layout.station(f.layer));
			if (offU >= 1) setOff(to.x, to.y, to.z);
			else {
				offTo.x = to.x;
				offTo.y = to.y;
				offTo.z = to.z;
			}
		}
		governor.reset();
		requestFrame();
	};
	window.addEventListener('resize', onResize);
	if (typeof ResizeObserver === 'function') new ResizeObserver(onResize).observe(canvas);

	document.addEventListener('visibilitychange', () => {
		hidden = document.hidden;
		if (hidden) {
			if (raf !== 0) window.cancelAnimationFrame(raf);
			raf = 0;
			last = -1;
			flight.release();
		} else {
			governor.reset();
			last = -1;
			requestFrame();
		}
	});

	canvas.addEventListener('webglcontextlost', () => {
		if (raf !== 0) window.cancelAnimationFrame(raf);
		raf = 0;
		last = -1;
	});
	canvas.addEventListener('webglcontextrestored', () => {
		world.resize(layout, quality.dpr);
		governor.reset();
		requestFrame();
	});

	// ── ready ──
	const readyPromise = loadPictures().then((pictures) => {
		world.setPictures(pictures);
		compose();
		world.warm(frame);
		ready = true;
		render(0);
		schedule();
	});
	readyPromise.catch((err) => console.error('[sky]', err));

	// ── hooks ──
	const hooks: SkyHooks = {
		on: emitter.on,
		once: emitter.once,
		lattice: {
			graph: comb,
			layer() {
				computeCamera();
				return nearLayer();
			},
			vertexWorld(layer, vertex) {
				return {
					x: comb.vertices[vertex * 2] ?? 0,
					y: comb.vertices[vertex * 2 + 1] ?? 0,
					z: -layer * SPACING,
				};
			},
			vertexScreen(layer, vertex) {
				computeCamera();
				const p = layout.project(
					cam,
					comb.vertices[vertex * 2] ?? 0,
					comb.vertices[vertex * 2 + 1] ?? 0,
					-layer * SPACING,
				);
				return p.scale > 0 ? p : null;
			},
			nearestVertex(x, y, layer) {
				computeCamera();
				const k = layer ?? nearLayer();
				const scale = layout.focal / Math.max(1e-3, depthOf(k));
				const wx = cam.x + (x - layout.w / 2) / scale;
				const wy = cam.y - (y - layout.h / 2) / scale;
				return { layer: k, vertex: comb.nearestVertex(wx, wy) };
			},
			nearestVertexToStar(slot) {
				const at = slotToStar(slot);
				const star = at ? plans[at.constellation]?.stars[at.star] : undefined;
				if (!at || !star) return null;
				computeCamera();
				return {
					layer: layerShowing(at.constellation),
					vertex: comb.nearestVertex(star.x, star.y),
				};
			},
			path: (from, to) => comb.path(from, to),
			pulseEdge(layer, edge, strength = 1) {
				world.pulseEdge(layer, edge, strength, time);
				requestFrame();
			},
			pulseStrut(layer, vertex, strength = 1) {
				const strut = comb.strutOf[vertex] ?? -1;
				if (strut < 0) return;
				world.pulseStrut(layer, strut, strength, time);
				requestFrame();
			},
		},
		claims: claimsReady,
		claimsNow: () => claims,
		ui,
		starCircle,
		isLit: (slot) => lit.has(slot),
		nearestEmptyStar(x, y) {
			computeCamera();
			const near = nearLayer();
			const plan = plans[mod(near, FIGURES)];
			if (!plan) return null;
			let best: SlotId | null = null;
			let bestD = Number.POSITIVE_INFINITY;
			for (const star of plan.stars) {
				if (!star.slot || lit.has(star.slot)) continue;
				layout.project(cam, star.x, star.y, -near * SPACING, tmp);
				const d = Math.hypot(tmp.x - x, tmp.y - y);
				if (d < bestD) {
					bestD = d;
					best = star.slot;
				}
			}
			return best;
		},
		setStarGlow(slot, glow) {
			const v = clamp(glow);
			if (v > 0) askedGlow.set(slot, v);
			else askedGlow.delete(slot);
			applyGlow(slot);
			requestFrame();
		},
		focused: () => (focus && focus.phase !== 'out' ? focus.slot : null),
		releaseFocus: () => releaseFocus(),
		requestFrame,
		keepAwake() {
			let held = true;
			awake++;
			wake();
			return () => {
				if (!held) return;
				held = false;
				awake--;
			};
		},
		time: () => time,
		layout: () => layout,
		camera() {
			computeCamera();
			return cam;
		},
		project(x, y, z) {
			computeCamera();
			return layout.project(cam, x, y, z);
		},
		flight() {
			const coord = layout.coordOf(flight.pos);
			return {
				pos: flight.pos,
				vel: flight.vel,
				mode: flight.mode,
				coord,
				figure: mod(Math.round(coord), FIGURES),
			};
		},
		quality: () => ({ level, levels: levels.length, dpr: world.dpr, frameMs: lastFrameMs }),
		isStill: () => still,
		roundComplete: () => round,
		three: {
			scene: world.scene,
			camera: world.camera,
			layerZ(layer) {
				computeCamera();
				return -depthOf(layer);
			},
			layerOrder(layer) {
				computeCamera();
				return world.orderOf(layer, cam.z);
			},
		},
	};

	// ── for the test page ──
	const debug: SkyDebug = {
		setClock(seconds) {
			if (seconds === null) {
				pinned = null;
				last = -1;
				wake();
				return;
			}
			let guard = 0;
			while (time < seconds - 1e-9 && guard++ < 200000) step(Math.min(1 / 120, seconds - time));
			time = seconds;
			pinned = seconds;
			if (ready) render(0);
		},
		setCoord(coord) {
			dropFocus();
			flight.place(layout.posOf(coord));
			lastCoord = Number.NaN;
			requestFrame();
		},
		setLevel(n) {
			forced = n;
			if (n !== null) applyLevel(n);
			else governor.reset();
			requestFrame();
		},
		drawNow() {
			if (ready) render(0);
		},
		loseContext: () => world.forceContextLoss(),
		restoreContext: () => world.forceContextRestore(),
		stats() {
			computeCamera();
			return {
				spacing: SPACING,
				w: layout.w,
				h: layout.h,
				focal: layout.focal,
				fovY: (2 * Math.atan(layout.h / 2 / layout.focal) * 180) / Math.PI,
				fovX: (2 * Math.atan(layout.w / 2 / layout.focal) * 180) / Math.PI,
				safe: { ...layout.safe, x: layout.safeX, y: layout.safeY },
				starPx: layout.starPx,
				stations: layout.fits.map((fit, i) => ({
					figure: plans[i]?.name,
					dist: fit.dist,
					pxPerUnit: fit.scale,
					x: fit.sx,
					y: fit.sy,
					pass: plans[i]?.pass,
					clearance: plans[i]?.clearance,
				})),
				b3: {
					ringPx: B3.ring * (layout.fits[0]?.scale ?? 0),
					corePx: B3.ring * B3.core * (layout.fits[0]?.scale ?? 0),
				},
				honeycomb: {
					vertices: comb.vertexCount,
					edges: comb.edgeCount,
					struts: comb.struts.length,
					edge: comb.edge,
				},
				quality: { level, levels: levels.map((q) => ({ ...q })), dpr: world.dpr, deviceDpr },
				camera: { ...cam },
				flight: { pos: flight.pos, vel: flight.vel, mode: flight.mode, boost: flight.boost },
				time,
				active,
				still,
				lit: [...lit],
				visited: [...visited],
				round,
			};
		},
	};

	// ── the scene ──
	const scene: SkyInternals = {
		ready: readyPromise,

		setActive(on) {
			if (active === on) return;
			active = on;
			input.setEnabled(on);
			if (!on) {
				flight.release();
				emitter.emit('dismiss', { reason: 'inactive' });
			}
			governor.reset();
			last = -1;
			requestFrame();
		},

		reset() {
			if (fall) finishFall();
			fallen = false;
			emitter.emit('dismiss', { reason: 'reset' });
			dropFocus();
			introT = 1;
			flight.place(layout.station(0));
			lastCoord = Number.NaN;
			lastStation = null;
			requestFrame();
		},

		setStill(on) {
			if (still === on) return;
			still = on;
			showExit();
			if (on) {
				if (fall) finishFall();
				dropFocus();
				introT = 1;
				flight.place(layout.station(0));
				lastCoord = Number.NaN;
				lastStation = null;
				// Nothing plays out: a claim in progress is simply lit.
				for (const slot of [...igniting.keys()]) showLit(slot, true);
				for (const slot of [...hoverGlow.keys()]) {
					if (slot === hoverSlot) hoverGlow.set(slot, 1);
					else hoverGlow.delete(slot);
					applyGlow(slot);
				}
				glowBusy = false;
			}
			governor.reset();
			last = -1;
			requestFrame();
		},

		introPrime(at) {
			introAt = { x: at.x, y: at.y, r: at.r };
			introT = 0;
			emitter.emit('dismiss', { reason: 'reset' });
			if (fall) finishFall();
			fallen = false;
			dropFocus();
			flight.place(layout.station(0));
			lastCoord = Number.NaN;
			lastStation = null;
			requestFrame();
		},

		introProgress(t) {
			if (!introAt) return;
			const next = clamp(Number.isFinite(t) ? t : 1);
			if (next >= 1 && introT < 1) introHold = performance.now() + INTRO.holdMs;
			introT = next;
			requestFrame();
		},

		coreCircle() {
			if (introOn()) return introPose(introT);
			computeCamera();
			const virgo = FIGURES * Math.ceil(nearLayer() / FIGURES);
			layout.project(cam, 0, 0, -virgo * SPACING, tmp);
			return { x: tmp.x, y: tmp.y, r: B3.ring * B3.core * tmp.scale };
		},

		fall({ groundY, onImpact }) {
			if (fall) finishFall();
			introT = 1;
			emitter.emit('dismiss', { reason: 'fall' });
			if (still || !ready || fallen) {
				// Nothing to watch: the sky is simply empty.
				dropFocus();
				fallen = true;
				requestFrame();
				try {
					onImpact(layout.w / 2);
				} catch (err) {
					console.error('[sky] onImpact failed', err);
				}
				return Promise.resolve();
			}
			flight.halt();
			if (focus) settleFocus(focus);
			computeCamera();
			// One gravity for every star. It is set so that the nearest layer falls
			// at FALL.gravity on screen; the rest fall slower only because they are far.
			const depth = Math.max(1.6, depthOf(nearLayer()));
			const gravity = (FALL.gravity * depth) / layout.focal;
			return new Promise<void>((resolve) => {
				fall = { t0: time, gravity, groundY, onImpact, impacted: false, ending: -1, resolve };
				wake();
			});
		},

		restore() {
			if (fall) finishFall();
			fallen = false;
			requestFrame();
		},

		focusStar(slot, opts) {
			const at = slotToStar(slot);
			if (!at || !ready || fall || fallen) return Promise.resolve();
			const wantIgnite = opts?.ignite === true;
			if (focus) settleFocus(focus);
			introT = 1;
			pending.delete(slot);

			// The nearest layer that shows the star's figure, either way.
			const coord = layout.coordOf(flight.pos);
			const figure = at.constellation;
			const layer = figure + FIGURES * Math.round((coord - figure) / FIGURES);
			const make = (phase: Focus['phase'], stay: boolean, approachAt: number): Focus => ({
				slot,
				figure,
				star: at.star,
				layer,
				phase,
				stay,
				approachAt,
				ignite: wantIgnite,
				settleAt: time,
				resolve: null,
			});

			if (still) {
				// No flight: be there.
				flight.place(layout.station(layer));
				const to = closeUp(layer, figure, at.star, flight.pos);
				setOff(to.x, to.y, to.z);
				lastCoord = Number.NaN;
				focus = make('held', false, time);
				if (wantIgnite) showLit(slot, true);
				emitter.emit('focus', { slot });
				if (lit.has(slot)) {
					emitter.emit('open-lit', { slot, circle: starCircle(slot), ignited: wantIgnite });
				}
				requestFrame();
				return Promise.resolve();
			}

			// The claim is played on arrival: until then the star is as it was before it.
			if (wantIgnite && lit.has(slot)) showLit(slot, false);

			// Standing between the layer's station and the star already: close in from here.
			const station = layout.station(layer);
			const stay =
				!moving() &&
				flight.pos > station - 0.01 &&
				flight.pos < layer * SPACING - closeDepth(figure, at.star);
			let approachAt = time;
			if (!stay) {
				const layers = Math.abs(station - flight.pos) / SPACING;
				const seconds = clamp(0.9 + 0.45 * layers, 0.9, 3.2);
				flight.glideTo(layer, seconds);
				// A close-up it may be leaving is let go first, clear of the plane ahead.
				if (off.x !== 0 || off.y !== 0 || off.z !== 0)
					moveOff(0, 0, 0, Math.min(0.45, 0.3 * seconds));
				approachAt = time + seconds - Math.min(0.35, 0.25 * seconds);
			}
			return new Promise<void>((resolve) => {
				const next = make('travel', stay, approachAt);
				next.settleAt = -1;
				next.resolve = resolve;
				focus = next;
				wake();
			});
		},

		roundComplete: () => round,

		hooks,
		debug,
	};

	return scene;
};
