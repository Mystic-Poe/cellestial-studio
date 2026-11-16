// Where the light is. Pure helpers on top, DOM wiring in createInput().

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Phone held naturally: gamma (left/right) −30..30, beta (front/back) 15..65. */
export function tiltToLight(
	beta: number | null,
	gamma: number | null,
): { x: number; y: number } | null {
	if (beta == null || gamma == null) return null;
	return { x: clamp01((gamma + 30) / 60), y: clamp01((beta - 15) / 50) };
}

/** Slow Lissajous drift for when nobody is steering. */
export function wanderLight(tSec: number): { x: number; y: number } {
	return {
		x: 0.5 + 0.32 * Math.cos(tSec * 0.23),
		y: 0.45 + 0.25 * Math.sin(tSec * 0.31),
	};
}

/** Frame-rate-independent easing: the gap halves every halfLifeMs. */
export function approach(current: number, target: number, dtMs: number, halfLifeMs = 120): number {
	const k = 1 - 0.5 ** (dtMs / halfLifeMs);
	return current + (target - current) * k;
}

export interface LightPick {
	pointer: { x: number; y: number } | null;
	pointerType: string;
	fresh: boolean;
	touching: boolean;
	tilt: { x: number; y: number } | null;
	wander: { x: number; y: number };
}

/**
 * Priority: a touch under the finger, then a fresh mouse, then tilt, then a
 * lingering touch, then wander. A desktop with orientation data still follows
 * its cursor.
 */
export function pickLight(s: LightPick): { x: number; y: number; active: boolean } {
	if (s.pointer && s.touching) return { ...s.pointer, active: true };
	if (s.pointer && s.fresh && s.pointerType === 'mouse') return { ...s.pointer, active: true };
	if (s.tilt) return { ...s.tilt, active: true };
	if (s.pointer && s.fresh) return { ...s.pointer, active: true };
	return { ...s.wander, active: false };
}

/**
 * Latch for the tilt permission ask. Once the answer is 'granted' or 'denied'
 * it never asks again; a rejection (iOS refuses a non-gesture call) or a call
 * still in flight leaves it free to retry on a later click. Without
 * requestPermission it just listens, once.
 */
export function createTiltGate(
	request: (() => Promise<string>) | undefined,
	listen: () => void,
): { ask(): void } {
	let settled = false;
	let inFlight = false;
	return {
		ask() {
			if (settled || inFlight) return;
			if (!request) {
				settled = true;
				listen();
				return;
			}
			inFlight = true;
			let p: Promise<string>;
			try {
				p = request();
			} catch {
				inFlight = false;
				return;
			}
			p.then(
				(r) => {
					inFlight = false;
					if (r === 'granted') {
						settled = true;
						listen();
					} else if (r === 'denied') {
						settled = true;
					}
				},
				() => {
					inFlight = false;
				},
			);
		},
	};
}

export interface LightInput {
	target(tSec: number): { x: number; y: number; active: boolean };
	requestTilt(): void;
	dispose(): void;
}

type OrientationCtor = typeof DeviceOrientationEvent & {
	requestPermission?: () => Promise<'granted' | 'denied'>;
};

export function createInput(win: Window): LightInput {
	let pointer: { x: number; y: number } | null = null;
	let pointerAt = Number.NEGATIVE_INFINITY;
	let pointerType = '';
	let touching = false;
	let tilt: { x: number; y: number } | null = null;
	let gate: { ask(): void } | null = null;

	// Normalise by the layout viewport (excludes classic scrollbars) so the light
	// lines up with the canvas, which is sized from the same box.
	const norm = (cx: number, cy: number) => {
		const el = win.document?.documentElement;
		return {
			x: cx / (el?.clientWidth || win.innerWidth),
			y: cy / (el?.clientHeight || win.innerHeight),
		};
	};

	const onMove = (e: PointerEvent) => {
		pointer = norm(e.clientX, e.clientY);
		pointerAt = performance.now();
		pointerType = e.pointerType;
	};
	const onDown = (e: PointerEvent) => {
		if (e.pointerType === 'touch') touching = true;
		onMove(e);
	};
	// iOS only accepts a click as the gesture for the permission prompt; pointerdown
	// (fired with touchstart) is rejected.
	const onClick = () => api.requestTilt();
	const onUp = (e: PointerEvent) => {
		if (e.pointerType === 'touch') touching = false;
	};
	const onOrient = (e: DeviceOrientationEvent) => {
		tilt = tiltToLight(e.beta, e.gamma);
	};

	win.addEventListener('pointermove', onMove, { passive: true });
	win.addEventListener('pointerdown', onDown, { passive: true });
	win.addEventListener('click', onClick, { passive: true });
	win.addEventListener('pointerup', onUp, { passive: true });
	win.addEventListener('pointercancel', onUp, { passive: true });

	const api: LightInput = {
		target(tSec) {
			return pickLight({
				pointer,
				pointerType,
				fresh: performance.now() - pointerAt < 3000,
				touching,
				tilt,
				wander: wanderLight(tSec),
			});
		},
		requestTilt() {
			if (!('DeviceOrientationEvent' in globalThis)) return;
			if (!gate) {
				const Ctor = globalThis.DeviceOrientationEvent as OrientationCtor;
				gate = createTiltGate(
					typeof Ctor.requestPermission === 'function'
						? () => Ctor.requestPermission!()
						: undefined,
					() => win.addEventListener('deviceorientation', onOrient, { passive: true }),
				);
			}
			gate.ask();
		},
		dispose() {
			win.removeEventListener('pointermove', onMove);
			win.removeEventListener('pointerdown', onDown);
			win.removeEventListener('click', onClick);
			win.removeEventListener('pointerup', onUp);
			win.removeEventListener('pointercancel', onUp);
			win.removeEventListener('deviceorientation', onOrient);
		},
	};
	return api;
}
