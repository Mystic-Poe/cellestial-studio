// What answers a touch (B8, B9): a tap on empty sky sends beads of light
// along the honeycomb to the nearest empty star, and that star then pulses
// with the words "claim yours" under it. Nothing here claims anything: it
// shows the visitor a star that can be theirs.
//
// The beads themselves are beads.ts. This file chooses the star, plans the
// route, runs the pulse and keeps the words with the star: exactly under it
// where that place is free, and beside it where under it they would be
// written across another star, into Cellestial's rings, within 40 px of a
// meaning's words or to the screen's edge (claim-label.ts has the rule; this
// file measures the page for it).
//
// With an ask waiting for a star (a request was sent with none chosen), the
// beads also go by themselves, from the middle of the screen, on entering
// the sky and each time the flight comes to rest.

import type { ClaimsStore, SlotId } from '../contracts.ts';
import { type BeadRun, type Beads, createBeads, planRoute, type Route } from './beads.ts';
import {
	type Box,
	type Disc,
	hadPlace,
	LABEL,
	type LabelScene,
	type LabelSpot,
	placeLabel,
} from './claim-label.ts';
import { B3, FADE, FIGURES, SPACING } from './config.ts';
import type { SkyHooks } from './hooks.ts';
import { mod, type PlanStar } from './layout.ts';

/** The pulse (B9): one slow loop, and how far the star's extra light swings. */
const PULSE = { period: 2, low: 0.3, high: 1, steady: 0.8 } as const;
/** The words: half their width and their height with the gap above them, for keeping them on screen. */
const WORDS = { half: 44, height: 26, gap: 7 } as const;
/** The logo and the menu button stand here: no star under them is offered. */
const CHROME = { w: 110, h: 80 } as const;
/** A plane nearer the lens than this is being flown through: the touch is answered in the next. */
const TOO_NEAR = 0.6;
/** The stars of this many layers from the nearest are drawn: the words keep off them. */
const LAYERS_SEEN = 5;
/** How long after the sky is entered, or the flight rests, the beads go by themselves. Milliseconds. */
const AUTO_MS = { enter: 900, rest: 350 } as const;
/**
 * The first light (the owner, 24 Nov): when the loader has handed the sky over, Cellestial's
 * star pulses three times, and each pulse sends beads to a third of the empty stars in front,
 * the nearest first; each star they reach does the "claim yours" pulse for a while. Seconds.
 */
export const FIRST_LIGHT = {
	/** After the hand-off, before the first pulse: the sky has settled. */
	delay: 0.6,
	pulses: 3,
	/** From one pulse to the next. */
	every: 1.3,
	/** A pulse rises this long and dies away over about this long. */
	rise: 0.18,
	fall: 0.45,
	/** The beads set off this long after a pulse begins: as it is brightest. */
	send: 0.12,
	/** A star the beads reach breathes this many times (PULSE.period each), then settles over `fade`. */
	breaths: 2,
	fade: 1.2,
	/**
	 * The words "claim yours" by the stars it reaches (the owner, 24 Nov: "space out the timing
	 * so it's not all at once"): one star's words after another's, in the order the beads
	 * arrive, never two within `every` of each other. Each is struck white-hot, cools into the
	 * brass and is gone, over `life`, and its star flares as they are struck. Words that find
	 * no room (other words, a meaning, the screen's edge) wait up to `wait` for it; after that
	 * their star only glows. When the visitor does something first they go, over `out`.
	 */
	words: { every: 0.35, life: 1.15, wait: 1.2, out: 0.25 },
} as const;

/** When the first light writes the words by each star, from when its beads arrive: one after another, `every` apart at least. */
export function firstLightWordTimes(arrivals: readonly number[]): number[] {
	const times: number[] = [];
	let last = Number.NEGATIVE_INFINITY;
	for (const at of [...arrivals].sort((a, b) => a - b)) {
		last = Math.max(at, last + FIRST_LIGHT.words.every);
		times.push(last);
	}
	return times;
}

/** The light on Cellestial's star `t` seconds into the first light, 0..1. */
export function firstLightPulse(t: number): number {
	let level = 0;
	for (let i = 0; i < FIRST_LIGHT.pulses; i++) {
		const u = t - i * FIRST_LIGHT.every;
		if (u < 0) continue;
		const up = Math.min(1, u / FIRST_LIGHT.rise);
		const rise = up * up * (3 - 2 * up);
		const down = u <= FIRST_LIGHT.rise ? 1 : Math.exp(-(u - FIRST_LIGHT.rise) / FIRST_LIGHT.fall);
		level = Math.max(level, rise * down);
	}
	return level;
}

/** The empty stars split into the waves of the first light: nearest the centre first. */
export function firstLightWaves<T extends { d: number }>(stars: readonly T[]): T[][] {
	const sorted = [...stars].sort((a, b) => a.d - b.d);
	const per = Math.ceil(sorted.length / FIRST_LIGHT.pulses);
	const waves: T[][] = [];
	for (let i = 0; i < FIRST_LIGHT.pulses; i++) waves.push(sorted.slice(i * per, (i + 1) * per));
	return waves;
}

export interface Answer {
	readonly beads: Beads;
	/** The star that is pulsing with the words under it, or null. */
	pulsing(): SlotId | null;
	/** The run in progress, or null. */
	run(): BeadRun | null;
	/** The star a touch at this point would be answered with, and the way there. Changes nothing. */
	plan(x: number, y: number): Route | null;
	/** Answer a touch at a viewport point, as a tap on empty sky there does. */
	touch(x: number, y: number): Route | null;
	/** Put out the beads, the pulse and the words. */
	clear(): void;
	/** Play the first light now, at the figure in front (the loader's hand-off does it by itself). False if it cannot. */
	firstLight(): boolean;
	/** True while the first light is playing. */
	firstLightOn(): boolean;
}

export interface AnswerOptions {
	/** True when the press that became this tap has just closed a panel: it is not answered again. */
	spent(): boolean;
	/** True while a panel is open. */
	busy(): boolean;
}

export function createAnswer(hooks: SkyHooks, opts: AnswerOptions): Answer {
	const beads = createBeads(hooks);
	const words = hooks.ui.querySelector<HTMLElement>('[data-claim-words]');

	let claims: ClaimsStore | null = null;
	let pulse: {
		slot: SlotId;
		t0: number;
		steady: boolean;
		release: (() => void) | null;
		/** The place by the star the words stand in, once they have one. */
		spot: LabelSpot | null;
		/** True once a press has begun while the words stand: only then is a click on them the visitor's. */
		pressed: boolean;
	} | null = null;
	let wordsAt = { x: Number.NaN, y: Number.NaN };
	let autoTimer = 0;

	// ── choosing the star ──
	const chosen = { slot: null as SlotId | null, layer: 0, star: null as PlanStar | null };

	/** The words of the meanings that are showing (B7): "claim yours" keeps 40 px from them. */
	const meanings = (): Box[] => {
		const boxes: Box[] = [];
		for (const el of hooks.ui.querySelectorAll<HTMLElement>('.sky-meaning:not([hidden])')) {
			const r = el.getBoundingClientRect();
			if (r.width > 0) boxes.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
		}
		return boxes;
	};

	/**
	 * Every star that is drawn on screen now, the far figures' points too. Cellestial's star
	 * is the full reach of its turning rings (the outer band's long half-axis, which the
	 * layout keeps every star of Virgo clear of), wherever it is drawn: the words are never
	 * written across it.
	 */
	const drawn = (): Disc[] => {
		const layout = hooks.layout();
		const front = hooks.lattice.layer();
		const discs: Disc[] = [];
		for (let layer = front; layer <= front + LAYERS_SEEN; layer++) {
			const figure = mod(layer, FIGURES);
			const plan = layout.plans[figure];
			const fit = layout.fits[figure];
			if (!plan || !fit) continue;
			for (const [i, star] of plan.stars.entries()) {
				const p = hooks.project(star.x, star.y, -layer * SPACING);
				if (p.scale <= 0 || p.depth < 0.25) continue;
				const rings = i === plan.epicentre;
				const r = rings
					? B3.ring * layout.b3 * p.scale
					: Math.max(fit.starR * layout.sizeOf(star) * p.scale, 1.25);
				if (p.x < -r || p.x > layout.w + r || p.y < -r || p.y > layout.h + r) continue;
				discs.push(rings ? { x: p.x, y: p.y, r, rings } : { x: p.x, y: p.y, r });
			}
		}
		// Cellestial's star is drawn further off than the figures are (index.ts, compose(): in the
		// next Virgo layer ahead while that is nearer than 1.5 x FADE.far[2]): a small light in the
		// middle of the screen, three stations before its figure is seen. The words keep off it there too.
		for (let layer = front + LAYERS_SEEN + 1; layer < front + FIGURES; layer++) {
			const plan = layout.plans[mod(layer, FIGURES)];
			const star = plan?.stars[plan.epicentre];
			if (!star) continue;
			const p = hooks.project(star.x, star.y, -layer * SPACING);
			if (p.scale <= 0 || p.depth >= FADE.far[2] * 1.5) continue;
			discs.push({ x: p.x, y: p.y, r: B3.ring * layout.b3 * p.scale, rings: true });
		}
		return discs;
	};

	/** What the words are placed among, as the screen is now. The stars are counted once, when first asked for. */
	const scene = (): LabelScene => {
		const layout = hooks.layout();
		let stars: Disc[] | null = null;
		return {
			w: layout.w,
			h: layout.h,
			meanings: meanings(),
			stars: () => {
				stars ??= drawn();
				return stars;
			},
		};
	};
	let view: LabelScene | null = null;

	/** The empty star nearest a point among those of one layer that can be shown with the words by them. */
	const nearestIn = (layer: number, x: number, y: number) => {
		const layout = hooks.layout();
		const figure = mod(layer, FIGURES);
		const plan = layout.plans[figure];
		const fit = layout.fits[figure];
		if (!plan || !fit) return false;
		let best = Number.POSITIVE_INFINITY;
		chosen.slot = null;
		for (const star of plan.stars) {
			if (!star.slot || hooks.isLit(star.slot)) continue;
			const p = hooks.project(star.x, star.y, -layer * SPACING);
			if (p.scale <= 0 || p.depth < 0.25) continue;
			const r = Math.max(fit.starR * layout.sizeOf(star) * p.scale, 1.25);
			if (p.x < r || p.x > layout.w - r) continue;
			if (p.y - r < 6 || p.y + r + WORDS.gap + WORDS.height > layout.h - 6) continue;
			if (p.x - WORDS.half < CHROME.w && p.y - r < CHROME.h) continue;
			// The words need a place by it: as they always did (round 3's question, so that a
			// touch offers the star it offered), and one that does not cross Cellestial's star.
			view ??= scene();
			const disc = { x: p.x, y: p.y, r };
			if (!hadPlace(disc, view) || !placeLabel(disc, view)) continue;
			const d = Math.hypot(p.x - x, p.y - y);
			if (d < best) {
				best = d;
				chosen.slot = star.slot;
				chosen.layer = layer;
				chosen.star = star;
			}
		}
		return chosen.slot !== null;
	};

	const plan = (x: number, y: number): Route | null => {
		const cam = hooks.camera();
		const layout = hooks.layout();
		let from = hooks.lattice.layer();
		if (cam.z + from * SPACING < TOO_NEAR) from++;
		// The layer the visitor is closest to; only if it has no empty star to show, the one behind it.
		view = null;
		const found = nearestIn(from, x, y) || nearestIn(from + 1, x, y);
		view = null;
		if (!found) return null;
		const { slot, layer, star } = chosen;
		if (!slot || !star) return null;
		const scale = layout.focal / Math.max(1e-3, cam.z + from * SPACING);
		const touch = {
			x: cam.x + (x - layout.w / 2) / scale,
			y: cam.y - (y - layout.h / 2) / scale,
		};
		return planRoute(hooks.lattice.graph, slot, touch, from, star, layer);
	};

	// ── the pulse and the words ──
	const placeWords = () => {
		if (!words || !pulse) return;
		const c = hooks.starCircle(pulse.slot);
		if (!c) {
			words.style.visibility = 'hidden';
			return;
		}
		// Under the star where that place is free; beside it where another star, Cellestial's
		// rings, a meaning's words or the screen's edge is in the way; and they keep the place
		// they have while it will do, and through a flight (the Home key's glide) whatever star
		// passes. Never by a meaning or across Cellestial's star: if the flight has carried
		// them there and no place is clear, they wait.
		const { mode } = hooks.flight();
		const place = placeLabel(c, scene(), pulse.spot, mode === 'thrust' || mode === 'glide');
		if (!place) {
			words.style.visibility = 'hidden';
			return;
		}
		const { x, y } = place;
		if (place.side !== pulse.spot?.side || place.slide !== pulse.spot.slide) {
			pulse.spot = { side: place.side, slide: place.slide };
			words.dataset.side = place.side;
			words.dataset.slide = String(place.slide);
		}
		// Written so that words with no place yet (NaN) are given one.
		if (!(Math.abs(x - wordsAt.x) <= 0.05 && Math.abs(y - wordsAt.y) <= 0.05)) {
			wordsAt = { x, y };
			words.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
		}
		words.style.visibility = '';
	};

	const endPulse = () => {
		const p = pulse;
		if (!p) return;
		pulse = null;
		p.release?.();
		hooks.setStarGlow(p.slot, 0);
		if (words) {
			words.hidden = true;
			delete words.dataset.slot;
			delete words.dataset.side;
			delete words.dataset.slide;
			words.style.removeProperty('--pulse');
		}
	};

	const startPulse = (slot: SlotId) => {
		endPulse();
		const steady = hooks.isStill();
		pulse = {
			slot,
			t0: hooks.time(),
			steady,
			release: steady ? null : hooks.keepAwake(),
			spot: null,
			pressed: false,
		};
		hooks.setStarGlow(slot, steady ? PULSE.steady : PULSE.high);
		if (words) {
			wordsAt = { x: Number.NaN, y: Number.NaN };
			words.dataset.slot = slot;
			words.dataset.steady = steady ? 'true' : 'false';
			words.style.setProperty('--pulse', '1');
			words.hidden = false;
			placeWords();
		}
		hooks.requestFrame();
	};

	const clear = () => {
		beads.stop();
		endPulse();
	};

	hooks.on('frame', ({ time }) => {
		const p = pulse;
		if (!p) return;
		if (!p.steady) {
			// Brightest as the beads strike, then one slow breath every two seconds.
			const wave = 0.5 + 0.5 * Math.cos((2 * Math.PI * (time - p.t0)) / PULSE.period);
			hooks.setStarGlow(p.slot, PULSE.low + (PULSE.high - PULSE.low) * wave);
			words?.style.setProperty('--pulse', wave.toFixed(3));
		}
		placeWords();
	});

	// ── a touch ──
	/** The route of the last touch: only its beads bring the words to a star. */
	let latest: Route | null = null;
	const touch = (x: number, y: number): Route | null => {
		const route = hooks.isActive() ? plan(x, y) : null;
		if (!route) {
			clear();
			return null;
		}
		if (hooks.isStill()) {
			// Nothing travels in a still sky: the star is simply marked.
			clear();
			startPulse(route.slot);
			return route;
		}
		// A touch sends MORE light: the beads of the touch before are left to finish their
		// course. The words leave the star they were at, unless these beads are for it too.
		if (pulse && pulse.slot !== route.slot) endPulse();
		latest = route;
		beads.start(route, () => {
			if (latest !== route || hooks.isLit(route.slot) || pulse?.slot === route.slot) return;
			startPulse(route.slot);
		});
		return route;
	};

	hooks.on('tap-empty', ({ x, y }) => {
		if (opts.spent()) return;
		touch(x, y);
	});

	// The words belong to the star: a click on them is a click on it. Only a press that began
	// after they were written counts. In a still sky the words are written the moment the sky
	// is touched, and beside a star they often stand under that very finger: the browser then
	// sends that touch's own click to them, and the tap that asked "which star?" would pick
	// the star as well.
	document.addEventListener(
		'pointerdown',
		() => {
			if (pulse) pulse.pressed = true;
		},
		true,
	);
	words?.addEventListener('click', (e) => {
		e.preventDefault();
		if (!pulse?.pressed) return;
		hooks.pick(pulse.slot);
	});

	// ── the first light ──
	interface Glowing {
		/** When the beads struck it, and when it began to settle (or NaN). */
		t0: number;
		end: number;
	}
	let first: {
		t0: number;
		layer: number;
		waves: { slot: SlotId; star: PlanStar }[][];
		/** The next wave to send. */
		next: number;
		release: () => void;
	} | null = null;
	const glowing = new Map<SlotId, Glowing>();

	// The words of the first light: "claim yours" by the stars it reached, one after another.
	interface Flash {
		slot: SlotId;
		el: HTMLElement;
		/** When they were struck. */
		t0: number;
		spot: LabelSpot | null;
		/** Where they stand now, or null while they have no place. */
		box: Box | null;
	}
	const flashes: Flash[] = [];
	/** The stars the beads have reached whose words are still to come, in the order they were reached. */
	const waiting: { slot: SlotId; at: number }[] = [];
	let lastFlash = Number.NEGATIVE_INFINITY;
	let flashHold: (() => void) | null = null;
	/** True once the visitor has done something first: the beads still on their way write no more words. */
	let hushed = false;

	const letGo = () => {
		if (flashes.length || waiting.length) return;
		flashHold?.();
		flashHold = null;
	};
	const dropFlash = (f: Flash) => {
		const i = flashes.indexOf(f);
		if (i >= 0) flashes.splice(i, 1);
		f.el.remove();
		letGo();
	};
	/** Put out the words of the first light, and those still to come: at once, or quickly fading. */
	const endFlashes = (fade: boolean) => {
		hushed = true;
		waiting.length = 0;
		for (const f of [...flashes]) {
			if (!fade) dropFlash(f);
			else if (f.el.dataset.out === undefined) {
				f.el.dataset.out = '';
				window.setTimeout(() => dropFlash(f), FIRST_LIGHT.words.out * 1000);
			}
		}
		letGo();
	};

	/** The other words showing: the first light's, and the visitor's own. */
	const wordsBesides = (f: Flash): Box[] => {
		const boxes: Box[] = [];
		for (const o of flashes) if (o !== f && o.box) boxes.push(o.box);
		if (pulse && words && !words.hidden && Number.isFinite(wordsAt.x)) {
			const { x, y } = wordsAt;
			boxes.push({ x0: x - LABEL.half, y0: y, x1: x + LABEL.half, y1: y + LABEL.height });
		}
		return boxes;
	};

	/** Stand the words by their star by the same rule as the visitor's own; false if they have no place. */
	const placeFlash = (f: Flash, view: LabelScene, moving: boolean): boolean => {
		const c = hooks.starCircle(f.slot);
		const place = c ? placeLabel(c, { ...view, words: wordsBesides(f) }, f.spot, moving) : null;
		if (!place) {
			f.el.style.visibility = 'hidden';
			f.box = null;
			return false;
		}
		f.spot = { side: place.side, slide: place.slide };
		f.box = place.box;
		// Placed by `translate`: the stylesheet's `transform` is the strike's swell.
		f.el.style.translate = `calc(${place.x.toFixed(1)}px - 50%) ${place.y.toFixed(1)}px`;
		f.el.style.visibility = '';
		return true;
	};

	const strike = (slot: SlotId, now: number, view: LabelScene, moving: boolean): boolean => {
		if (!words) return false;
		const el = document.createElement('p');
		el.className = 'sky-claim sky-claim--flash';
		el.dataset.slot = slot;
		el.dataset.glow = words.dataset.glow ?? '';
		el.textContent = words.textContent;
		// The stars' own buttons are what is read; these are seen.
		el.setAttribute('aria-hidden', 'true');
		el.style.setProperty('--life', `${FIRST_LIGHT.words.life}s`);
		const f: Flash = { slot, el, t0: now, spot: null, box: null };
		if (!placeFlash(f, view, moving)) return false;
		// As the visitor's own words are, they are their star: a click on them is a click on it.
		el.addEventListener('click', (e) => {
			e.preventDefault();
			if (el.dataset.out === undefined) hooks.pick(slot);
		});
		words.after(el);
		flashes.push(f);
		flashHold ??= hooks.keepAwake();
		return true;
	};

	hooks.on('frame', ({ time }) => {
		if (!flashes.length && !waiting.length) return;
		const { mode } = hooks.flight();
		const moving = mode === 'thrust' || mode === 'glide';
		const view = scene();
		for (const f of [...flashes]) {
			const done = time - f.t0 >= FIRST_LIGHT.words.life;
			if (done || hooks.isLit(f.slot) || pulse?.slot === f.slot) dropFlash(f);
			else placeFlash(f, view, moving);
		}
		for (let i = 0; i < waiting.length; ) {
			const w = waiting[i] as (typeof waiting)[number];
			const gone = hooks.isLit(w.slot) || pulse?.slot === w.slot;
			if (gone || time - w.at > FIRST_LIGHT.words.wait) waiting.splice(i, 1);
			else i++;
		}
		// The next words when it is time: by the first star waiting that has room for them.
		if (time - lastFlash >= FIRST_LIGHT.words.every) {
			for (const [i, w] of waiting.entries()) {
				if (!strike(w.slot, time, view, moving)) continue;
				waiting.splice(i, 1);
				lastFlash = time;
				// The star flares as its words are struck, and breathes on from there.
				const g = glowing.get(w.slot);
				if (g) {
					g.t0 = time;
					g.end = Number.NaN;
				}
				break;
			}
		}
		letGo();
	});

	/** Settle every star the first light is lighting, from now. */
	const settleGlows = (now: number) => {
		for (const g of glowing.values()) if (!Number.isFinite(g.end)) g.end = now;
	};

	const stopFirstLight = () => {
		const f = first;
		if (!f) return;
		first = null;
		hooks.setCorePulse(0);
		f.release();
		settleGlows(hooks.time());
		hooks.requestFrame();
	};

	const firstLight = (layer: number): boolean => {
		stopFirstLight();
		if (!hooks.isActive() || hooks.isStill()) return false;
		const layout = hooks.layout();
		const figure = mod(layer, FIGURES);
		const plan = layout.plans[figure];
		if (!plan) return false;
		const centre = plan.stars[plan.epicentre];
		const cx = centre?.x ?? 0;
		const cy = centre?.y ?? 0;
		// The empty stars of the figure in front that are on the screen: the first page only.
		const candidates: { slot: SlotId; star: PlanStar; d: number }[] = [];
		for (const star of plan.stars) {
			if (!star.slot || hooks.isLit(star.slot)) continue;
			const p = hooks.project(star.x, star.y, -layer * SPACING);
			if (p.scale <= 0 || p.x < 0 || p.x > layout.w || p.y < 0 || p.y > layout.h) continue;
			candidates.push({ slot: star.slot, star, d: Math.hypot(star.x - cx, star.y - cy) });
		}
		hushed = false;
		first = {
			t0: hooks.time() + FIRST_LIGHT.delay,
			layer,
			waves: firstLightWaves(candidates),
			next: 0,
			release: hooks.keepAwake(),
		};
		hooks.requestFrame();
		return true;
	};

	const sendWave = (f: NonNullable<typeof first>, wave: number) => {
		const { x, y } = (() => {
			const plan = hooks.layout().plans[mod(f.layer, FIGURES)];
			const c = plan?.stars[plan.epicentre];
			return { x: c?.x ?? 0, y: c?.y ?? 0 };
		})();
		for (const { slot, star } of f.waves[wave] ?? []) {
			if (hooks.isLit(slot)) continue;
			const route = planRoute(hooks.lattice.graph, slot, { x, y }, f.layer, star, f.layer);
			if (!route) continue;
			beads.start(route, () => {
				// The visitor's own pulse on this star wins; a lit one has its own light.
				if (hooks.isLit(slot) || pulse?.slot === slot) return;
				glowing.set(slot, { t0: hooks.time(), end: Number.NaN });
				if (!hushed) {
					waiting.push({ slot, at: hooks.time() });
					flashHold ??= hooks.keepAwake();
				}
				hooks.requestFrame();
			});
		}
	};

	hooks.on('frame', ({ time }) => {
		const f = first;
		if (f) {
			const t = time - f.t0;
			hooks.setCorePulse(t > 0 ? firstLightPulse(t) : 0);
			while (f.next < FIRST_LIGHT.pulses && t >= f.next * FIRST_LIGHT.every + FIRST_LIGHT.send) {
				sendWave(f, f.next);
				f.next++;
			}
			const last = (FIRST_LIGHT.pulses - 1) * FIRST_LIGHT.every;
			if (f.next >= FIRST_LIGHT.pulses && t > last + FIRST_LIGHT.rise + 5 * FIRST_LIGHT.fall) {
				first = null;
				hooks.setCorePulse(0);
				f.release();
				// An ask waiting for a star: its beads go now, as they would have on entering.
				auto(AUTO_MS.rest);
			}
		}
		// The stars the first light reached: the "claim yours" pulse, then they settle.
		for (const [slot, g] of glowing) {
			if (pulse?.slot === slot) {
				glowing.delete(slot);
				continue;
			}
			const age = time - g.t0;
			if (!Number.isFinite(g.end) && age >= FIRST_LIGHT.breaths * PULSE.period) g.end = time;
			const wave = 0.5 + 0.5 * Math.cos((2 * Math.PI * age) / PULSE.period);
			let level = PULSE.low + (PULSE.high - PULSE.low) * wave;
			if (Number.isFinite(g.end)) {
				const u = Math.min(1, (time - g.end) / FIRST_LIGHT.fade);
				level *= 1 - u * u * (3 - 2 * u);
				if (u >= 1) {
					glowing.delete(slot);
					if (!hooks.isLit(slot)) hooks.setStarGlow(slot, 0);
					continue;
				}
			}
			if (!hooks.isLit(slot)) hooks.setStarGlow(slot, level);
		}
	});

	hooks.on('first-light', ({ layer }) => {
		firstLight(layer);
	});
	// Whatever the visitor does first, the first light gives way to it: the waves still to
	// come are not sent, and the stars it lit settle.
	hooks.on('tap-empty', stopFirstLight);
	hooks.on('star-pick', stopFirstLight);
	hooks.on('tap-empty', () => endFlashes(true));
	hooks.on('star-pick', () => endFlashes(true));
	hooks.on('active', ({ on }) => {
		if (!on) endFlashes(false);
	});
	hooks.on('dismiss', () => {
		stopFirstLight();
		endFlashes(false);
		for (const slot of glowing.keys()) if (!hooks.isLit(slot)) hooks.setStarGlow(slot, 0);
		glowing.clear();
	});

	// ── what ends it ──
	hooks.on('dismiss', clear);
	hooks.on('star-pick', clear);
	hooks.on('focus', ({ slot }) => {
		if (slot) clear();
	});
	hooks.on('ignite', ({ slot }) => {
		if (pulse?.slot === slot) endPulse();
		beads.stopFor(slot);
	});

	// ── an ask is waiting for a star: show where one can go ──
	const auto = (ms: number) => {
		window.clearTimeout(autoTimer);
		autoTimer = window.setTimeout(() => {
			if (!claims || claims.unplaced() === null) return;
			if (!hooks.isActive() || opts.busy() || hooks.focused() || beads.run() || first) return;
			const { mode } = hooks.flight();
			if (mode === 'thrust' || mode === 'glide') return;
			const { w, h } = hooks.layout();
			touch(w / 2, h / 2);
		}, ms);
	};
	hooks.on('active', ({ on }) => {
		if (on) auto(AUTO_MS.enter);
		else window.clearTimeout(autoTimer);
	});
	hooks.on('dismiss', ({ reason }) => {
		// A teleport to the sky while already in it: it is entered again.
		if (reason === 'reset') auto(AUTO_MS.enter);
	});
	hooks.on('rest', () => auto(AUTO_MS.rest));
	hooks.claims
		.then((store) => {
			claims = store;
			store.subscribe((e) => {
				if (e.type === 'unplaced') auto(AUTO_MS.enter);
				else if (e.type === 'claimed' && pulse?.slot === e.slot) endPulse();
			});
			if (hooks.isActive()) auto(AUTO_MS.enter);
		})
		.catch(() => {});

	return {
		beads,
		pulsing: () => pulse?.slot ?? null,
		run: () => beads.run(),
		plan,
		touch,
		clear: () => {
			clear();
			endFlashes(false);
		},
		firstLight: () => firstLight(FIGURES * Math.ceil(hooks.lattice.layer() / FIGURES)),
		firstLightOn: () => first !== null,
	};
}
