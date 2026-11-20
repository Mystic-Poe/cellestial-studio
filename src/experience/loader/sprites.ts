// Small pictures made once and drawn many times: round glows, and the pieces
// the wordmark comes apart into for A5.
//
// Nothing here is a new image. The glows are plain radial gradients (light,
// drawn in code), and every piece is cut from the pixels of the A4 picture
// through its matte.

import { ASSETS, type Box } from '../assets';
import { BLUE_WHITE } from '../tokens';
import { seeded } from './lightning';

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.ceil(w));
	canvas.height = Math.max(1, Math.ceil(h));
	return canvas;
}

export function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('loader: no 2D canvas');
	return ctx;
}

function radial(size: number, stops: readonly (readonly [number, string])[]): HTMLCanvasElement {
	const canvas = makeCanvas(size, size);
	const ctx = context(canvas);
	const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	for (const [at, colour] of stops) g.addColorStop(at, colour);
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, size, size);
	return canvas;
}

/** A point of light: white-hot in the middle, blue around it, nothing at its edge. */
export const hotSprite = () =>
	radial(160, [
		[0, 'rgb(255 255 255)'],
		[0.1, 'rgb(240 247 255 / 0.96)'],
		[0.22, 'rgb(170 200 255 / 0.6)'],
		[0.42, 'rgb(92 132 255 / 0.25)'],
		[0.68, 'rgb(52 92 255 / 0.08)'],
		[1, 'rgb(40 80 255 / 0)'],
	]);

/** A white disc with a soft blue rim: something lost in its own light. */
export const discSprite = () =>
	radial(192, [
		[0, 'rgb(255 255 255)'],
		[0.42, 'rgb(255 255 255)'],
		[0.62, 'rgb(232 240 255 / 0.84)'],
		[0.8, 'rgb(128 166 255 / 0.32)'],
		[0.92, 'rgb(64 104 255 / 0.08)'],
		[1, 'rgb(40 80 255 / 0)'],
	]);

/** Navy haze: light hanging in the air a long way from what glows. It falls off slowly. */
export const mistSprite = () =>
	radial(160, [
		[0, 'rgb(50 104 255 / 0.6)'],
		[0.2, 'rgb(50 104 255 / 0.49)'],
		[0.35, 'rgb(50 104 255 / 0.36)'],
		[0.5, 'rgb(50 104 255 / 0.24)'],
		[0.7, 'rgb(50 104 255 / 0.13)'],
		[0.85, 'rgb(50 104 255 / 0.06)'],
		[1, 'rgb(50 104 255 / 0)'],
	]);

/** Blue air: the soft light around something that glows. */
export const hazeSprite = () =>
	radial(128, [
		[0, 'rgb(72 116 255 / 0.5)'],
		[0.25, 'rgb(62 104 255 / 0.27)'],
		[0.55, 'rgb(52 92 255 / 0.09)'],
		[0.8, 'rgb(46 86 255 / 0.025)'],
		[1, 'rgb(40 80 255 / 0)'],
	]);

/** Part of the wordmark with the black gone, and the same shape as pure light. */
export interface Piece {
	readonly canvas: HTMLCanvasElement;
	/** The piece as a blue-white silhouette: what it bleaches to. */
	readonly light: HTMLCanvasElement;
	/** Where the canvas sits in the wordmark, in wordmark pixels. */
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
	/** The middle of the piece itself. */
	readonly cx: number;
	readonly cy: number;
}

/** One fragment of the star above the i. */
export interface Shard {
	readonly canvas: HTMLCanvasElement;
	/** Canvas pixels per wordmark pixel. */
	readonly scale: number;
	/** The fragment's middle: in its canvas, and in the wordmark. */
	readonly px: number;
	readonly py: number;
	readonly x: number;
	readonly y: number;
	/** The way out from the star's centre, in radians. */
	readonly angle: number;
	/** About how big it is, in wordmark pixels. */
	readonly size: number;
}

export interface Pieces {
	readonly emblem: Piece;
	/** e, l, l, e, s, t, i, a, l. */
	readonly letters: readonly Piece[];
	readonly star: Piece;
	readonly shards: readonly Shard[];
}

const WORD = ASSETS.loader.wordmark;

function cut(
	wordmark: CanvasImageSource,
	matte: CanvasImageSource,
	box: Box,
	pad: number,
	trim?: (ctx: CanvasRenderingContext2D) => void,
): Piece {
	const x = Math.floor(box.x - pad);
	const y = Math.floor(box.y - pad);
	const w = Math.ceil(box.x + box.w + pad) - x;
	const h = Math.ceil(box.y + box.h + pad) - y;
	const canvas = makeCanvas(w, h);
	const ctx = context(canvas);
	ctx.drawImage(wordmark, x, y, w, h, 0, 0, w, h);
	ctx.globalCompositeOperation = 'destination-in';
	ctx.drawImage(matte, x, y, w, h, 0, 0, w, h);
	if (trim) {
		ctx.translate(-x, -y);
		trim(ctx);
	}
	const light = makeCanvas(w, h);
	const l = context(light);
	l.drawImage(canvas, 0, 0);
	l.globalCompositeOperation = 'source-in';
	l.fillStyle = BLUE_WHITE;
	l.fillRect(0, 0, w, h);
	return { canvas, light, x, y, w, h, cx: box.x + box.w / 2, cy: box.y + box.h / 2 };
}

/**
 * The star, broken: seven cracks from a point just off its centre, each with
 * a kink, and the wedges that hold a tip split again across the kink. Eight
 * or nine irregular fragments, every one a clip of the star's own pixels.
 */
function shatter(star: Piece): Shard[] {
	const random = seeded(0x51a7);
	const { x: sx, y: sy, r } = WORD.star;
	const fx = sx + 2.5;
	const fy = sy - 1.5;
	const N = 7;
	const far = r + 14;
	const rays: number[] = [];
	const kinks: [number, number][] = [];
	for (let i = 0; i < N; i++) {
		const a = 0.5 + ((i + (random() - 0.5) * 0.5) * 2 * Math.PI) / N;
		rays.push(a);
		const ka = a + (random() - 0.5) * 0.35;
		const kr = 13 + 6 * random();
		kinks.push([fx + Math.cos(ka) * kr, fy + Math.sin(ka) * kr]);
	}
	const SCALE = 2;
	const shards: Shard[] = [];
	const add = (polygon: [number, number][], mid: number, reach: number, size: number) => {
		const canvas = makeCanvas(star.w * SCALE, star.h * SCALE);
		const ctx = context(canvas);
		ctx.scale(SCALE, SCALE);
		ctx.translate(-star.x, -star.y);
		ctx.beginPath();
		polygon.forEach(([x, y], i) => {
			if (i) ctx.lineTo(x, y);
			else ctx.moveTo(x, y);
		});
		ctx.closePath();
		ctx.clip();
		ctx.drawImage(star.canvas, star.x, star.y);
		const x = fx + Math.cos(mid) * reach;
		const y = fy + Math.sin(mid) * reach;
		shards.push({
			canvas,
			scale: SCALE,
			px: (x - star.x) * SCALE,
			py: (y - star.y) * SCALE,
			x,
			y,
			angle: mid,
			size,
		});
	};
	let splits = 0;
	for (let i = 0; i < N; i++) {
		const a = rays[i];
		const b = i + 1 < N ? rays[i + 1] : rays[0] + 2 * Math.PI;
		const rim: [number, number][] = [];
		for (let s = 0; s <= 4; s++) {
			const t = a + ((b - a) * s) / 4;
			rim.push([fx + Math.cos(t) * far, fy + Math.sin(t) * far]);
		}
		const k0 = kinks[i];
		const k1 = kinks[(i + 1) % N];
		const mid = (a + b) / 2;
		// A tip of the star (they point up, and every 72° from there) well inside this wedge?
		let tip = false;
		for (let n = 0; n < 5; n++) {
			const at = -Math.PI / 2 + (n * 2 * Math.PI) / 5;
			const turn = (((at - a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
			if (turn > 0.22 && turn < b - a - 0.22) tip = true;
		}
		if (tip && splits < 2) {
			splits++;
			add([[fx, fy], k0, k1], mid, 8, 15);
			add([k0, ...rim, k1], mid, 27, 24);
		} else add([[fx, fy], k0, ...rim, k1], mid, 19, 28);
	}
	return shards;
}

/** Cut the A4 picture into the C, the nine letters, the star and the star's fragments. */
export function cutWordmark(wordmark: CanvasImageSource, matte: CanvasImageSource): Pieces {
	const node = WORD.node;
	const e = WORD.letters[0];
	// The C's box and the first e's overlap: the main node pokes into the e's
	// corner, and the e's left side lies under the C's upper arm. The C keeps
	// the node's disc; the e loses it.
	const emblem = cut(wordmark, matte, WORD.emblem, 5, (ctx) => {
		ctx.globalCompositeOperation = 'destination-in';
		ctx.beginPath();
		ctx.rect(0, 0, e.x - 6, WORD.h);
		ctx.rect(0, 0, WORD.emblem.x + WORD.emblem.w + 6, e.y - 12);
		ctx.arc(node.x, node.y, node.r + 7, 0, 2 * Math.PI);
		ctx.fill();
	});
	const letters = WORD.letters.map((box, i) =>
		cut(
			wordmark,
			matte,
			box,
			5,
			i === 0
				? (ctx) => {
						ctx.globalCompositeOperation = 'destination-out';
						ctx.beginPath();
						ctx.arc(node.x, node.y, node.r + 7, 0, 2 * Math.PI);
						ctx.fill();
					}
				: undefined,
		),
	);
	const s = WORD.star;
	const star = cut(wordmark, matte, { x: s.x - s.r, y: s.y - s.r, w: 2 * s.r, h: 2 * s.r }, 4);
	return { emblem, letters, star, shards: shatter(star) };
}
