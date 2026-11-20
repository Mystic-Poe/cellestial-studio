// Motion: whether the visitor asked for stillness, and the one clock every
// scene draws from.
//
// Nothing here touches the DOM when the module is imported, only when a
// function is called, so the pure parts can be imported by a node test.

const REDUCE = '(prefers-reduced-motion: reduce)';

let forced = false;
let watching = false;
let lastReduced = false;
const motionSubscribers = new Set<(reduced: boolean) => void>();

/**
 * True when motion is off. Base.astro writes <html data-motion="on|off">
 * before first paint; this reads it, and falls back to the media query if
 * the attribute is not there.
 */
export function reducedMotion(): boolean {
	const v = document.documentElement.dataset.motion;
	if (v === 'off') return true;
	if (v === 'on') return false;
	return matchMedia(REDUCE).matches;
}

/** ?rm=1: motion is off for this visit, whatever the device says. */
export function forceReducedMotion(): void {
	forced = true;
	watch();
	document.documentElement.dataset.motion = 'off';
}

/**
 * Call `fn` whenever motion is turned on or off: the device setting changed
 * mid-visit, or something rewrote data-motion. Returns an unsubscribe.
 */
export function onMotionChange(fn: (reduced: boolean) => void): () => void {
	watch();
	motionSubscribers.add(fn);
	return () => {
		motionSubscribers.delete(fn);
	};
}

function watch(): void {
	if (watching) return;
	watching = true;
	const html = document.documentElement;
	lastReduced = reducedMotion();

	// Keep the attribute in step with the device setting.
	matchMedia(REDUCE).addEventListener('change', (e) => {
		if (!forced) html.dataset.motion = e.matches ? 'off' : 'on';
	});

	// Whoever changes the attribute, everybody hears about it once.
	new MutationObserver(() => {
		const now = reducedMotion();
		if (now === lastReduced) return;
		lastReduced = now;
		for (const fn of [...motionSubscribers]) fn(now);
	}).observe(html, { attributes: true, attributeFilter: ['data-motion'] });
}

// ───────────────────────────────────────────────────────────── ticker ──

/**
 * A frame. `now` is the ticker's own clock in milliseconds: it starts at 0
 * and stands still while the tab is hidden, so a timeline built on it never
 * skips. `dt` is the time since the previous frame in milliseconds, never
 * more than MAX_DT, and 0 on the first frame after a start or a resume.
 */
export type FrameFn = (now: number, dt: number) => void;

/** A stalled frame (a long task, a debugger) counts as this much at most. */
export const MAX_DT = 100;

const frameFns = new Set<FrameFn>();
let rafId = 0;
let lastStamp = -1;
let clock = 0;
let listeningForVisibility = false;

function tick(stamp: number): void {
	rafId = requestAnimationFrame(tick);
	const dt = lastStamp < 0 ? 0 : Math.min(MAX_DT, Math.max(0, stamp - lastStamp));
	lastStamp = stamp;
	clock += dt;
	for (const fn of [...frameFns]) {
		if (!frameFns.has(fn)) continue; // unsubscribed by an earlier callback this frame
		try {
			fn(clock, dt);
		} catch (err) {
			// One broken subscriber must not stop the clock or repeat its error
			// sixty times a second: drop it and report the failure once.
			frameFns.delete(fn);
			console.error('[cellestial] a frame callback threw and was removed', err);
		}
	}
	if (frameFns.size === 0) stopTicker();
}

function startTicker(): void {
	if (rafId !== 0 || document.hidden) return;
	lastStamp = -1;
	rafId = requestAnimationFrame(tick);
}

function stopTicker(): void {
	if (rafId !== 0) cancelAnimationFrame(rafId);
	rafId = 0;
}

/**
 * Run `fn` every animation frame until the returned function is called.
 * One requestAnimationFrame loop serves every subscriber. It stops while the
 * tab is hidden and while nobody is subscribed.
 */
export function onFrame(fn: FrameFn): () => void {
	if (!listeningForVisibility) {
		listeningForVisibility = true;
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) stopTicker();
			else if (frameFns.size > 0) startTicker();
		});
	}
	frameFns.add(fn);
	startTicker();
	return () => {
		frameFns.delete(fn);
	};
}

// ──────────────────────────────────────────────────────────── easings ──

export type Ease = (t: number) => number;

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const linear: Ease = (t) => t;
/** Starts slow, ends fast. */
export const easeIn: Ease = (t) => t * t;
/** Starts fast, settles. */
export const easeOut: Ease = (t) => 1 - (1 - t) * (1 - t);
/** Slow, fast, slow. */
export const easeInOut: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Hermite 0 → 1 between two edges, for thresholds. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
	const t = clamp01((x - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
};

// ───────────────────────────────────────────────────────────── tweens ──

/**
 * Call `step` with 0 … 1 over `ms` milliseconds of the ticker's clock, eased.
 * The last call is always exactly `step(1)`. Like the ticker, it waits while
 * the tab is hidden.
 */
export function tween(ms: number, step: (k: number) => void, ease: Ease = linear): Promise<void> {
	if (!(ms > 0)) {
		step(1);
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		let elapsed = 0;
		const stop = onFrame((_now, dt) => {
			elapsed += dt;
			const t = clamp01(elapsed / ms);
			try {
				step(t >= 1 ? 1 : ease(t));
			} catch (err) {
				stop();
				reject(err);
				return;
			}
			if (t >= 1) {
				stop();
				resolve();
			}
		});
	});
}

/**
 * A fade through a cover: `cover` (something opaque over the page) fades in
 * over `outMs`, `swap` runs while nothing can be seen, and the cover fades
 * out again over `inMs`. The cover is left exactly as it was found. This is
 * the whole of a reduced-motion transition, and the simple form of the rest.
 */
export async function fadeThrough(
	cover: HTMLElement,
	swap: () => void | Promise<void>,
	outMs = 250,
	inMs = 250,
): Promise<void> {
	const { opacity, pointerEvents } = cover.style;
	cover.style.pointerEvents = 'auto'; // nothing underneath can be clicked mid-swap
	try {
		await tween(
			outMs,
			(k) => {
				cover.style.opacity = String(k);
			},
			easeIn,
		);
		await swap();
	} finally {
		try {
			await tween(
				inMs,
				(k) => {
					cover.style.opacity = String(1 - k);
				},
				easeOut,
			);
		} finally {
			cover.style.opacity = opacity;
			cover.style.pointerEvents = pointerEvents;
		}
	}
}
