// Canvas drawing. No state, no DOM queries: index.ts decides what, this draws it.

import { STAR_COLORS } from './field.ts';
import type { Branch } from './mycelium.ts';

export type Ctx = CanvasRenderingContext2D;

export function mixColor(
	a: [number, number, number],
	b: [number, number, number],
	t: number,
): string {
	const m = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
	return `rgb(${m(0)},${m(1)},${m(2)})`;
}

export function drawBackground(x: Ctx, w: number, h: number, soilT: number): void {
	x.fillStyle = mixColor([4, 7, 10], [5, 8, 6], soilT);
	x.fillRect(0, 0, w, h);
}

export function drawHalo(x: Ctx, px: number, py: number, radius: number, alpha: number): void {
	if (alpha <= 0) return;
	const g = x.createRadialGradient(px, py, 0, px, py, radius);
	g.addColorStop(0, `rgba(${STAR_COLORS.site},${0.09 * alpha})`);
	g.addColorStop(1, `rgba(${STAR_COLORS.site},0)`);
	x.fillStyle = g;
	x.fillRect(px - radius, py - radius, radius * 2, radius * 2);
}

export function drawDot(
	x: Ctx,
	px: number,
	py: number,
	r: number,
	color: string,
	alpha: number,
): void {
	x.fillStyle = `rgba(${color},${alpha})`;
	x.beginPath();
	x.arc(px, py, r, 0, Math.PI * 2);
	x.fill();
}

export function drawLine(
	x: Ctx,
	ax: number,
	ay: number,
	bx: number,
	by: number,
	color: string,
	alpha: number,
	width: number,
): void {
	x.strokeStyle = `rgba(${color},${alpha})`;
	x.lineWidth = width;
	x.beginPath();
	x.moveTo(ax, ay);
	x.lineTo(bx, by);
	x.stroke();
}

/** A glowing star: soft bloom, bright core. `boost` widens the bloom (ignition). */
export function drawGlowStar(
	x: Ctx,
	px: number,
	py: number,
	r: number,
	color: string,
	alpha: number,
	boost = 0,
	sprite?: HTMLImageElement,
): void {
	if (sprite?.complete && sprite.naturalWidth > 0) {
		const s = r * (10 + boost * 6);
		x.save();
		x.globalAlpha = alpha;
		x.globalCompositeOperation = 'screen';
		x.drawImage(sprite, px - s / 2, py - s / 2, s, s);
		x.restore();
		return;
	}
	const R = r * (5 + boost * 5);
	const g = x.createRadialGradient(px, py, 0, px, py, R);
	g.addColorStop(0, `rgba(${color},${alpha})`);
	g.addColorStop(0.2, `rgba(${color},${alpha * 0.35})`);
	g.addColorStop(1, `rgba(${color},0)`);
	x.fillStyle = g;
	x.beginPath();
	x.arc(px, py, R, 0, Math.PI * 2);
	x.fill();
	drawDot(x, px, py, r * 0.45, '255,255,255', alpha);
}

/** Roots, revealed top-down by `reveal` (0–1). */
export function drawMycelium(
	x: Ctx,
	branches: Branch[],
	ox: number,
	oy: number,
	reveal: number,
	scale: number,
): void {
	if (reveal <= 0) return;
	x.lineCap = 'round';
	for (const b of branches) {
		const n = b.points.length;
		const shown = Math.max(2, Math.ceil(n * reveal));
		x.strokeStyle = `rgba(${STAR_COLORS.site},${(b.main ? 0.5 : 0.28) * reveal})`;
		x.lineWidth = b.width * scale;
		x.beginPath();
		x.moveTo(ox + b.points[0].x, oy + b.points[0].y);
		for (let i = 1; i < Math.min(n, shown); i++) x.lineTo(ox + b.points[i].x, oy + b.points[i].y);
		x.stroke();
	}
}

/** A constellation line, drawn in from its first star as `progress` goes 0 → 1. */
export function drawPolyline(
	x: Ctx,
	pts: { x: number; y: number }[],
	progress: number,
	dy: number,
	color: string,
	alpha: number,
): void {
	if (alpha <= 0 || pts.length < 2) return;
	const segs = pts.length - 1;
	const reach = Math.max(0, Math.min(1, progress)) * segs;
	x.strokeStyle = `rgba(${color},${alpha})`;
	x.lineWidth = 0.9;
	x.beginPath();
	x.moveTo(pts[0].x, pts[0].y + dy);
	for (let i = 1; i <= segs; i++) {
		if (i <= reach) {
			x.lineTo(pts[i].x, pts[i].y + dy);
		} else {
			const t = reach - (i - 1);
			if (t > 0) {
				const a = pts[i - 1];
				const b = pts[i];
				x.lineTo(a.x + (b.x - a.x) * t, a.y + dy + (b.y - a.y) * t);
			}
			break;
		}
	}
	x.stroke();
}
