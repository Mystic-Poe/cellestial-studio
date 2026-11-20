// The canvas the effects are drawn on, and nothing else.
//
// At rest it is `display: none` with a 1×1 backing store: no layer to
// composite, no memory held. open() shows it and sizes it to the viewport;
// close() clears it and puts it away. While it is open it follows the
// viewport (resize, rotation, a toolbar sliding away) and steps its
// resolution down when frames come late.

import type { Ctx } from './light.ts';

/** Device pixels per CSS pixel, from the sharpest the layer draws at to the roughest. */
const STEPS = [2, 1.5, 1] as const;
/** A frame later than this is a late frame (60 Hz is 16.7 ms). */
const LATE_MS = 25;
/** This many late frames out of the last eight and the resolution steps down. */
const LATE_FRAMES = 4;

export interface Surface {
	readonly g: Ctx;
	/** The frame in CSS pixels. Zero while closed. */
	readonly w: number;
	readonly h: number;
	/** Device pixels per CSS pixel in use right now. */
	readonly ratio: number;
	readonly isOpen: boolean;
	open(): void;
	close(): void;
	/** Wipe the frame, ready to draw in CSS pixels. */
	clear(): void;
	/**
	 * Tell it how long the last frame took to come round. Returns true when it
	 * has just dropped its resolution: the frame is blank and must be drawn again.
	 */
	paced(ms: number): boolean;
	/** Called when the frame changes size while open, after it has been resized (and so wiped). */
	onResize: (() => void) | null;
}

export function createSurface(canvas: HTMLCanvasElement): Surface | null {
	const g = canvas.getContext('2d');
	if (!g) return null;

	let w = 0;
	let h = 0;
	let isOpen = false;
	/** Index into STEPS that this session has been pushed down to. It never climbs back. */
	let step = 0;
	let late = 0;
	let seen = 0;
	let observer: ResizeObserver | null = null;

	const ratio = (): number => Math.min(window.devicePixelRatio || 1, STEPS[step]);

	/** Size the backing store to the box. True if anything changed. */
	const fit = (): boolean => {
		const cw = canvas.clientWidth || window.innerWidth;
		const ch = canvas.clientHeight || window.innerHeight;
		const pw = Math.max(1, Math.round(cw * ratio()));
		const ph = Math.max(1, Math.round(ch * ratio()));
		if (cw === w && ch === h && canvas.width === pw && canvas.height === ph) return false;
		w = cw;
		h = ch;
		// Setting either size wipes the canvas and resets its state.
		canvas.width = pw;
		canvas.height = ph;
		g.setTransform(pw / w, 0, 0, ph / h, 0, 0);
		return true;
	};

	const refit = (): void => {
		if (isOpen && fit()) surface.onResize?.();
	};

	const surface: Surface = {
		g,
		get w() {
			return w;
		},
		get h() {
			return h;
		},
		get ratio() {
			return ratio();
		},
		get isOpen() {
			return isOpen;
		},
		onResize: null,

		open() {
			if (isOpen) return;
			isOpen = true;
			late = 0;
			seen = 0;
			canvas.dataset.on = '';
			fit();
			window.addEventListener('resize', refit);
			window.addEventListener('orientationchange', refit);
			if (typeof ResizeObserver === 'function') {
				observer = new ResizeObserver(refit);
				observer.observe(canvas);
			}
		},

		close() {
			if (!isOpen) return;
			isOpen = false;
			window.removeEventListener('resize', refit);
			window.removeEventListener('orientationchange', refit);
			observer?.disconnect();
			observer = null;
			delete canvas.dataset.on;
			// Give the memory back; this also leaves the canvas blank.
			canvas.width = 1;
			canvas.height = 1;
			w = 0;
			h = 0;
		},

		clear() {
			g.setTransform(1, 0, 0, 1, 0, 0);
			g.globalAlpha = 1;
			g.globalCompositeOperation = 'source-over';
			g.clearRect(0, 0, canvas.width, canvas.height);
			if (w > 0 && h > 0) g.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
		},

		paced(ms) {
			if (!isOpen || step >= STEPS.length - 1) return false;
			// Nothing to gain where the screen is no sharper than the next step down.
			if ((window.devicePixelRatio || 1) <= STEPS[step + 1]) return false;
			// The first frame of an effect pays for the canvas itself; do not count it.
			seen++;
			if (seen <= 1) return false;
			late = Math.max(0, late + (ms > LATE_MS ? 1 : -0.5));
			if (late < LATE_FRAMES) return false;
			step++;
			late = 0;
			return fit();
		},
	};
	return surface;
}
