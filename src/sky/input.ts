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
	let touching = false;
	let tilt: { x: number; y: number } | null = null;
	let tiltRequested = false;

	const norm = (cx: number, cy: number) => ({ x: cx / win.innerWidth, y: cy / win.innerHeight });

	const onMove = (e: PointerEvent) => {
		pointer = norm(e.clientX, e.clientY);
		pointerAt = performance.now();
	};
	const onDown = (e: PointerEvent) => {
		if (e.pointerType === 'touch') touching = true;
		onMove(e);
		api.requestTilt();
	};
	const onUp = (e: PointerEvent) => {
		if (e.pointerType === 'touch') touching = false;
	};
	const onOrient = (e: DeviceOrientationEvent) => {
		tilt = tiltToLight(e.beta, e.gamma);
	};

	win.addEventListener('pointermove', onMove, { passive: true });
	win.addEventListener('pointerdown', onDown, { passive: true });
	win.addEventListener('pointerup', onUp, { passive: true });
	win.addEventListener('pointercancel', onUp, { passive: true });

	const api: LightInput = {
		target(tSec) {
			const fresh = performance.now() - pointerAt < 3000;
			if (pointer && (touching || (fresh && !tilt))) return { ...pointer, active: true };
			if (tilt) return { ...tilt, active: true };
			if (pointer && fresh) return { ...pointer, active: true };
			return { ...wanderLight(tSec), active: false };
		},
		requestTilt() {
			if (tiltRequested || !('DeviceOrientationEvent' in globalThis)) return;
			tiltRequested = true;
			const Ctor = globalThis.DeviceOrientationEvent as OrientationCtor;
			const listen = () => win.addEventListener('deviceorientation', onOrient, { passive: true });
			if (typeof Ctor.requestPermission === 'function') {
				Ctor.requestPermission()
					.then((r) => r === 'granted' && listen())
					.catch(() => {});
			} else {
				listen();
			}
		},
		dispose() {
			win.removeEventListener('pointermove', onMove);
			win.removeEventListener('pointerdown', onDown);
			win.removeEventListener('pointerup', onUp);
			win.removeEventListener('pointercancel', onUp);
			win.removeEventListener('deviceorientation', onOrient);
		},
	};
	return api;
}
