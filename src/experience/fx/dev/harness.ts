// The test page's driver. Dev only: src/pages/dev/fx.astro is its one caller,
// and nothing in the shipped layer imports it.
//
// Query parameters:
//   fx=flash|impact|warp   what to play (nothing: the layer at rest)
//   bg=black|soil|split|bright
//   dir=up|down|none       the flash's direction
//   x, y                   the impact's point: CSS pixels, or 0 to 1 of the frame
//   ms                     the warp's length (1500)
//   t=0..1                 freeze the effect at this fraction of its length
//   seed=<number>          the same picture every time
//   rm=1                   reduced motion
//   loop=1                 replay every two seconds
//   swap=0                 leave the background alone (by default the flash's
//                          swap() changes it, and so does the warp at its cover)
//   probe=1                read the canvas at the moment of that swap, into the log
//
// window.__fx is the mounted layer. window.__fxDev has the rest: play(),
// alpha() (what is on the canvas right now), log (what happened and when).

import type { FxLayer, SceneContext } from '../../contracts.ts';
import { FADE_MS, FLASH_MS } from '../flash.ts';
import { IMPACT_MS } from '../impact.ts';
import { mount, WARP_COVER } from '../index.ts';
import { type Clock, createFx } from '../layer.ts';

type Bg = 'black' | 'soil' | 'split' | 'bright';

interface LogEntry {
	event: string;
	at: number;
	[key: string]: unknown;
}

interface AlphaReading {
	/** The canvas is shown (not display: none). */
	on: boolean;
	width: number;
	height: number;
	min: number;
	max: number;
	/** Share of pixels that are fully opaque. */
	solid: number;
}

export interface FxDev {
	params: Record<string, string>;
	log: LogEntry[];
	play(): Promise<void> | undefined;
	alpha(): AlphaReading;
	setBg(bg: Bg): void;
	/** Frozen runs only: move the hand-driven clock on by this many ms. */
	step(ms: number): void;
}

declare global {
	interface Window {
		__fx?: FxLayer;
		__fxDev?: FxDev;
	}
}

/** A clock that only moves when told to: one frame per step. */
function handClock(): Clock & { step(ms: number): void } {
	let now = 10_000;
	let next = 1;
	const frames = new Map<number, (now: number) => void>();
	return {
		now: () => now,
		frame(fn) {
			frames.set(next, fn);
			return next++;
		},
		cancelFrame(id) {
			frames.delete(id);
		},
		beat: () => 0,
		stopBeat() {},
		step(ms) {
			now += ms;
			const due = [...frames.values()];
			frames.clear();
			for (const fn of due) fn(now);
		},
	};
}

const AFTER: Record<Bg, Bg> = { black: 'soil', soil: 'black', split: 'soil', bright: 'soil' };

export function boot(): void {
	const query = new URLSearchParams(location.search);
	const params = Object.fromEntries(query.entries());
	const num = (key: string): number | null => {
		const raw = query.get(key);
		if (raw === null || raw === '') return null;
		const v = Number(raw);
		return Number.isFinite(v) ? v : null;
	};
	const kind = (['flash', 'impact', 'warp'] as const).find((k) => k === query.get('fx')) ?? null;
	const firstBg =
		(['black', 'soil', 'split', 'bright'] as const).find((b) => b === query.get('bg')) ?? 'black';
	const dir = (['up', 'down', 'none'] as const).find((d) => d === query.get('dir')) ?? 'none';
	const freeze = num('t');
	const seed = num('seed');
	const reducedMotion = query.get('rm') === '1';
	const swaps = query.get('swap') !== '0';
	const ms = num('ms') ?? 1500;

	const root = document.documentElement;
	const setBg = (bg: Bg): void => {
		root.dataset.bg = bg;
	};
	setBg(firstBg);
	root.dataset.motion = reducedMotion ? 'off' : 'on';

	const ctx: SceneContext = {
		when: () => new Promise<never>(() => {}),
		reducedMotion,
	};
	const clock = freeze === null ? null : handClock();
	const layer =
		clock || seed !== null
			? createFx(ctx, { seed: seed ?? undefined, clock: clock ?? undefined })
			: mount(ctx);

	const canvas = document.getElementById('fx-canvas') as HTMLCanvasElement;
	const log: LogEntry[] = [];
	const note = (event: string, extra: Record<string, unknown> = {}): void => {
		log.push({ event, at: performance.now(), ...extra });
	};

	const alpha = (): AlphaReading => {
		const on = getComputedStyle(canvas).display !== 'none';
		const { width, height } = canvas;
		const g = canvas.getContext('2d');
		let min = 255;
		let max = 0;
		let solid = 0;
		if (g && width > 0 && height > 0) {
			const data = g.getImageData(0, 0, width, height).data;
			for (let k = 3; k < data.length; k += 4) {
				const a = data[k];
				if (a < min) min = a;
				if (a > max) max = a;
				if (a === 255) solid++;
			}
			solid /= width * height;
		}
		return { on, width, height, min, max, solid };
	};

	const point = (key: 'x' | 'y', fallback: number, span: number): number => {
		const v = num(key);
		if (v === null) return fallback * span;
		return v <= 1 ? v * span : v;
	};

	let swapTimer = 0;
	const play = (): Promise<void> | undefined => {
		setBg(firstBg);
		window.clearTimeout(swapTimer);
		note('call', { kind });
		if (kind === 'flash') {
			return layer
				.teleportFlash(() => {
					// What is on the canvas at the very moment the section changes.
					note('swap', query.get('probe') === '1' ? { alpha: alpha() } : {});
					if (swaps) setBg(AFTER[firstBg]);
				}, dir)
				.then(
					() => note('settled', { ok: true }),
					(error) => note('settled', { ok: false, error: String(error) }),
				);
		}
		if (kind === 'impact') {
			layer.impact(point('x', 0.5, window.innerWidth), point('y', 0.62, window.innerHeight));
			return undefined;
		}
		if (kind === 'warp') {
			// The page swaps the Roots for the sky under the cover; so does this one.
			if (swaps && !clock) {
				swapTimer = window.setTimeout(() => {
					note('swap', query.get('probe') === '1' ? { alpha: alpha() } : {});
					setBg(AFTER[firstBg]);
				}, ms * WARP_COVER);
			}
			return layer.warp(ms).then(() => note('settled', { ok: true }));
		}
		return undefined;
	};

	window.__fx = layer;
	window.__fxDev = {
		params,
		log,
		play,
		alpha,
		setBg,
		step(by) {
			clock?.step(by);
		},
	};

	if (!kind) return;
	play();
	if (clock && freeze !== null) {
		// Walk the hand-driven clock to the asked-for moment a frame at a time,
		// as a screen would, and leave it there.
		const length =
			kind === 'flash'
				? reducedMotion
					? FADE_MS * 2
					: FLASH_MS
				: kind === 'impact'
					? IMPACT_MS
					: ms;
		const target = Math.min(Math.max(freeze, 0), 1) * length;
		let at = 0;
		while (at < target) {
			const by = Math.min(4, target - at);
			at += by;
			if (kind === 'warp' && swaps && at >= ms * WARP_COVER && at - by < ms * WARP_COVER) {
				setBg(AFTER[firstBg]);
			}
			clock.step(by);
		}
		// One more frame at the same instant, so what is drawn is exactly `t`.
		clock.step(0);
		note('frozen', { t: freeze });
		return;
	}
	if (query.get('loop') === '1') window.setInterval(play, 2000);
}
