// What answers a touch (B8, B9): a tap on empty sky sends beads of light
// along the honeycomb to the nearest empty star, and that star then pulses
// with the words "claim yours" under it. Nothing here claims anything: it
// shows the visitor a star that can be theirs.
//
// The beads themselves are beads.ts. This file chooses the star, plans the
// route, runs the pulse and keeps the words exactly under the star.
//
// With an ask waiting for a star (a request was sent with none chosen), the
// beads also go by themselves, from the middle of the screen, on entering
// the sky and each time the flight comes to rest.

import type { ClaimsStore, SlotId } from '../contracts.ts';
import { type BeadRun, type Beads, createBeads, planRoute, type Route } from './beads.ts';
import { FIGURES, SPACING } from './config.ts';
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
/** How long after the sky is entered, or the flight rests, the beads go by themselves. Milliseconds. */
const AUTO_MS = { enter: 900, rest: 350 } as const;

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
	let pulse: { slot: SlotId; t0: number; steady: boolean; release: (() => void) | null } | null =
		null;
	let wordsAt = { x: Number.NaN, y: Number.NaN };
	let autoTimer = 0;

	// ── choosing the star ──
	const chosen = { slot: null as SlotId | null, layer: 0, star: null as PlanStar | null };

	/** True if a box on screen lies on the words of a meaning that is showing (B7): nothing is written over those. */
	const overMeaning = (x0: number, y0: number, x1: number, y1: number): boolean => {
		for (const el of hooks.ui.querySelectorAll<HTMLElement>('.sky-meaning:not([hidden])')) {
			const r = el.getBoundingClientRect();
			if (r.width > 0 && x0 < r.right && x1 > r.left && y0 < r.bottom && y1 > r.top) return true;
		}
		return false;
	};

	/** The empty star nearest a point among those of one layer that can be shown with the words under them. */
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
			const r = Math.max(fit.starR * star.scale * p.scale, 1.25);
			if (p.x < r || p.x > layout.w - r) continue;
			if (p.y - r < 6 || p.y + r + WORDS.gap + WORDS.height > layout.h - 6) continue;
			if (p.x - WORDS.half < CHROME.w && p.y - r < CHROME.h) continue;
			const under = p.y + r * 1.1 + WORDS.gap;
			if (overMeaning(p.x - WORDS.half, under, p.x + WORDS.half, under + WORDS.height)) continue;
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
		if (!nearestIn(from, x, y) && !nearestIn(from + 1, x, y)) return null;
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
		const y = c.y + c.r * 1.1 + WORDS.gap;
		// Under the star's centre; beside a screen edge, only as far in as keeps them whole.
		const w = hooks.layout().w;
		const x = Math.min(Math.max(c.x, WORDS.half + 4), w - WORDS.half - 4);
		// Never over a meaning: if the flight has carried the star's words onto one, they wait.
		if (overMeaning(x - WORDS.half, y, x + WORDS.half, y + WORDS.height)) {
			words.style.visibility = 'hidden';
			return;
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
			words.style.removeProperty('--pulse');
		}
	};

	const startPulse = (slot: SlotId) => {
		endPulse();
		const steady = hooks.isStill();
		pulse = { slot, t0: hooks.time(), steady, release: steady ? null : hooks.keepAwake() };
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
	const touch = (x: number, y: number): Route | null => {
		clear();
		if (!hooks.isActive()) return null;
		const route = plan(x, y);
		if (!route) return null;
		if (hooks.isStill()) {
			// Nothing travels in a still sky: the star is simply marked.
			startPulse(route.slot);
			return route;
		}
		beads.start(route, () => {
			if (!hooks.isLit(route.slot)) startPulse(route.slot);
		});
		return route;
	};

	hooks.on('tap-empty', ({ x, y }) => {
		if (opts.spent()) return;
		touch(x, y);
	});

	// The words belong to the star: a click on them is a click on it.
	words?.addEventListener('click', (e) => {
		e.preventDefault();
		const slot = pulse?.slot;
		if (slot) hooks.pick(slot);
	});

	// ── what ends it ──
	hooks.on('dismiss', clear);
	hooks.on('star-pick', clear);
	hooks.on('focus', ({ slot }) => {
		if (slot) clear();
	});
	hooks.on('ignite', ({ slot }) => {
		if (pulse?.slot === slot) endPulse();
		if (beads.run()?.route.slot === slot) beads.stop();
	});

	// ── an ask is waiting for a star: show where one can go ──
	const auto = (ms: number) => {
		window.clearTimeout(autoTimer);
		autoTimer = window.setTimeout(() => {
			if (!claims || claims.unplaced() === null) return;
			if (!hooks.isActive() || opts.busy() || hooks.focused() || beads.run()) return;
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

	return { beads, pulsing: () => pulse?.slot ?? null, run: () => beads.run(), plan, touch, clear };
}
