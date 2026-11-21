// The light all three effects are drawn with: the sampled blue, the sampled
// blue-white, a brass glint, and soft round glows of each. Nothing here is an
// image file; the glows are small canvases filled once with a gradient.

import {
	BLUE_RGB,
	BLUE_WHITE_RGB,
	BRASS_HI_RGB,
	BRASS_RGB,
	BRASS_TEXT_RGB,
	type Rgb,
	rgba,
} from '../tokens.ts';

export type Ctx = CanvasRenderingContext2D;

export const BLUE_INK = rgba(BLUE_RGB);
export const PALE_INK = rgba(BLUE_WHITE_RGB);
export const BRASS_INK = rgba(BRASS_HI_RGB);
export const BLACK_INK = '#000';

export const blue = (alpha: number): string => rgba(BLUE_RGB, alpha);
export const pale = (alpha: number): string => rgba(BLUE_WHITE_RGB, alpha);

export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 0 below `a`, 1 above `b`, eased between. */
export function smooth(a: number, b: number, v: number): number {
	const t = clamp((v - a) / (b - a));
	return t * t * (3 - 2 * t);
}

export const easeOut = (t: number): number => 1 - (1 - t) ** 3;
export const easeIn = (t: number): number => t ** 3;

/** Colour stops that fall away from `peak` at the middle to nothing at the rim. */
export function falloff(grad: CanvasGradient, rgb: Rgb, peak: number, power = 2, steps = 8): void {
	for (let i = 0; i <= steps; i++) {
		const p = i / steps;
		grad.addColorStop(p, rgba(rgb, clamp(peak * (1 - p) ** power)));
	}
}

/**
 * Stops for a round light that runs from blue to blue-white: at `p` (0 the
 * middle, 1 the rim) it is `strengthAt(p)` strong, and `heatAt(p)` of the way
 * from the blue to the blue-white. Its hottest is the blue-white itself.
 */
export function lightStops(
	grad: CanvasGradient,
	strengthAt: (p: number) => number,
	heatAt: (p: number) => number,
	steps = 14,
): void {
	for (let i = 0; i <= steps; i++) {
		const p = i / steps;
		const t = clamp(heatAt(p));
		grad.addColorStop(
			p,
			rgba(
				[
					mix(BLUE_RGB[0], BLUE_WHITE_RGB[0], t),
					mix(BLUE_RGB[1], BLUE_WHITE_RGB[1], t),
					mix(BLUE_RGB[2], BLUE_WHITE_RGB[2], t),
				],
				Math.round(clamp(strengthAt(p)) * 1000) / 1000,
			),
		);
	}
}

export type Tint = 'pale' | 'blue' | 'brass';

const SPRITE = 128;
const sprites = new Map<Tint, HTMLCanvasElement>();

/**
 * A round glow, 128 px across: white-hot in the middle with a blue skirt
 * (`pale`), blue all through (`blue`), or a brass glint. Drawn additively.
 */
export function glow(tint: Tint): HTMLCanvasElement {
	let c = sprites.get(tint);
	if (c) return c;
	c = document.createElement('canvas');
	c.width = c.height = SPRITE;
	const g = c.getContext('2d');
	if (g) {
		const r = SPRITE / 2;
		const skirt = g.createRadialGradient(r, r, 0, r, r, r);
		if (tint === 'brass') falloff(skirt, BRASS_RGB, 0.5, 2.2);
		else falloff(skirt, BLUE_RGB, tint === 'pale' ? 0.62 : 0.8, 2.4);
		g.fillStyle = skirt;
		g.fillRect(0, 0, SPRITE, SPRITE);
		if (tint !== 'blue') {
			g.globalCompositeOperation = 'lighter';
			const core = g.createRadialGradient(r, r, 0, r, r, r * 0.42);
			if (tint === 'brass') {
				core.addColorStop(0, rgba(BRASS_HI_RGB, 1));
				core.addColorStop(0.4, rgba(BRASS_TEXT_RGB, 0.55));
				core.addColorStop(1, rgba(BRASS_TEXT_RGB, 0));
			} else {
				core.addColorStop(0, rgba(BLUE_WHITE_RGB, 1));
				core.addColorStop(0.3, rgba(BLUE_WHITE_RGB, 0.85));
				core.addColorStop(1, rgba(BLUE_WHITE_RGB, 0));
			}
			g.fillStyle = core;
			g.fillRect(0, 0, SPRITE, SPRITE);
		}
	}
	sprites.set(tint, c);
	return c;
}

/** One glow, centred on (x, y), `size` across. Set the blend mode and alpha first. */
export function spot(g: Ctx, tint: Tint, x: number, y: number, size: number): void {
	g.drawImage(glow(tint), x - size / 2, y - size / 2, size, size);
}
