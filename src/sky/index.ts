// Boots the living sky. Owns the animation loop; everything it decides is
// computed by the pure modules and drawn by render.ts.

import { type ClaimState, INITIAL_CLAIM, isLit, type SlotId } from './claim.ts';
import {
	type DustStar,
	makeDust,
	mulberry32,
	STAR_COLORS,
	selectThreads,
	wakeLevel,
} from './field.ts';
import { approach, createInput } from './input.ts';
import { type Branch, growMycelium } from './mycelium.ts';
import { createGovernor, QUALITY_LEVELS } from './quality.ts';
import {
	drawBackground,
	drawDot,
	drawGlowStar,
	drawHalo,
	drawLine,
	drawMycelium,
} from './render.ts';

/** Filled in when the Higgsfield renders land in public/stars/. Empty = code-drawn. */
export const STAR_SPRITES: Partial<
	Record<'site' | 'systems' | 'app' | 'companion' | 'slot', string>
> = {};

export interface SkyApi {
	setClaim(s: ClaimState): void;
	ignite(id: SlotId): void;
	anchorOf(id: SlotId): { x: number; y: number } | null;
}

const IGNITE_MS = 1200;
const slotSeed = (id: string) => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

interface Anchor {
	el: HTMLElement;
	kind: string;
	slot: SlotId | null;
	x: number;
	y: number;
	visible: boolean;
}

export function bootSky(canvas: HTMLCanvasElement): SkyApi {
	const ctx = canvas.getContext('2d');
	const root = document.documentElement;
	const isPhone = () => innerWidth < 768;
	const baseDust = () => (isPhone() || (navigator.hardwareConcurrency ?? 8) <= 4 ? 70 : 160);

	const allDust: DustStar[] = makeDust(160, mulberry32(20261115));
	const input = createInput(window);
	const governor = createGovernor();
	const sprites: Record<string, HTMLImageElement> = {};
	for (const [k, src] of Object.entries(STAR_SPRITES)) {
		if (!src) continue;
		const img = new Image();
		img.decoding = 'async';
		img.src = src;
		sprites[k] = img;
	}

	let claim: ClaimState = INITIAL_CLAIM;
	const igniteAt = new Map<SlotId, number>();
	let anchors: Anchor[] = [];
	let horizonEl: HTMLElement | null = null;
	let rootsEl: HTMLElement | null = null;
	let cardEls: HTMLElement[] = [];
	let growKey = '';
	let rootsMargin = 0;
	let roots: Branch[] = [];
	let rootsBox = { left: 0, top: 0, height: 1 };
	let horizonTop = Number.POSITIVE_INFINITY;
	let light = { x: 0.5, y: 0.45 };
	let lightAlpha = 0;
	let w = 0;
	let h = 0;
	let dpr = 1;
	let raf = 0;
	let last = performance.now();

	const motionOn = () => root.dataset.motion !== 'off';

	function resize(redraw = true) {
		const q = QUALITY_LEVELS[governor.level];
		const nextDpr = Math.min(devicePixelRatio || 1, q.maxDpr);
		// Layout viewport, not innerWidth: the CSS box excludes classic scrollbars.
		const nextW = root.clientWidth;
		const nextH = root.clientHeight;
		// Mobile URL-bar show/hide fires resize without changing the layout box.
		if (nextW === w && nextH === h && nextDpr === dpr) {
			if (redraw) kick();
			return;
		}
		dpr = nextDpr;
		w = nextW;
		h = nextH;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
		collect();
		measure(true);
		if (redraw) kick(); // assigning canvas.width cleared the bitmap; redraw even with motion off
	}

	/** Cache element references once at boot and on resize. */
	function collect() {
		anchors = [...document.querySelectorAll<HTMLElement>('[data-sky-star]')].map((el) => ({
			el,
			kind: el.dataset.skyStar ?? 'site',
			slot: (el.dataset.slot as SlotId | undefined) ?? null,
			x: 0,
			y: 0,
			visible: false,
		}));
		horizonEl = document.querySelector<HTMLElement>('[data-horizon]');
		rootsEl = document.querySelector<HTMLElement>('[data-roots]');
		rootsMargin = rootsEl ? Number.parseFloat(getComputedStyle(rootsEl).marginTop) || 0 : 0;
		cardEls = [...document.querySelectorAll<HTMLElement>('[data-root-card]')];
	}

	/** Read positions. Elements are cached; rects are fresh because they track scroll. */
	function measure(regrowRoots = false) {
		for (const a of anchors) {
			const r = a.el.getBoundingClientRect();
			a.x = r.left + r.width / 2;
			a.y = r.top + r.height / 2;
			a.visible = a.y > -50 && a.y < h + 50;
		}
		const hb = horizonEl?.getBoundingClientRect();
		if (hb) horizonTop = hb.top;
		if (cardEls.length && (hb || rootsEl)) {
			// Roots start at the top of the gap above the cards, clear of the section text.
			const top = rootsEl ? rootsEl.getBoundingClientRect().top - rootsMargin : (hb?.bottom ?? 0);
			const targets = cardEls.map((c) => {
				const r = c.getBoundingClientRect();
				return { x: r.left + r.width / 2, y: r.top - top };
			});
			const height = Math.max(1, ...targets.map((t) => t.y));
			const key = targets.map((t) => `${Math.round(t.x)},${Math.round(t.y)}`).join('|');
			if (regrowRoots || roots.length === 0 || key !== growKey) {
				growKey = key;
				roots = growMycelium({
					width: w,
					targets,
					rand: mulberry32(7),
					sidesPerRoot: isPhone() ? 2 : 4,
				});
			}
			rootsBox = { left: 0, top, height };
		}
	}

	function frame(now: number) {
		raf = 0;
		if (!ctx) return;
		const dt = Math.min(64, now - last);
		last = now;
		const tSec = now / 1000;
		const moving = motionOn();
		if (moving) {
			const before = governor.level;
			governor.sample(dt, now);
			if (governor.level !== before) resize(false);
		}
		const q = QUALITY_LEVELS[governor.level];
		measure();

		// Light.
		const target = moving ? input.target(tSec) : { x: 0.5, y: 0.45, active: false };
		light = moving
			? { x: approach(light.x, target.x, dt), y: approach(light.y, target.y, dt) }
			: { x: target.x, y: target.y };
		lightAlpha = moving ? approach(lightAlpha, target.active ? 1 : 0.55, dt, 400) : 0;
		const lx = light.x * w;
		const ly = light.y * h;
		const reach = Math.min(w, h) * (isPhone() ? 0.42 : 0.3);

		// Background: night above the horizon, soil below it.
		const soilT = Math.min(1, Math.max(0, 1 - horizonTop / h));
		drawBackground(ctx, w, h, soilT);
		if (moving) drawHalo(ctx, lx, ly, reach, lightAlpha);

		// Dust with parallax (deeper = slower) and wake-up.
		const count = Math.round(baseDust() * q.dustScale);
		const scroll = moving ? scrollY : 0;
		const lit: { x: number; y: number; wake: number }[] = [];
		for (let i = 0; i < count; i++) {
			const s = allDust[i];
			const px = s.x * w;
			const py = (((s.y * h - scroll * 0.15 * s.depth) % h) + h) % h;
			const wake = moving ? wakeLevel(Math.hypot(px - lx, py - ly), reach) * lightAlpha : 0;
			const twinkle = moving ? 0.06 * Math.sin(tSec * 2 + s.phase) : 0;
			const fade = 1 - soilT * 0.6;
			drawDot(ctx, px, py, s.r + wake * 1.6, s.color, (0.22 + twinkle + wake * 0.75) * fade);
			if (wake > 0.25) lit.push({ x: px, y: py, wake });
		}
		if (q.threads && moving) {
			for (const th of selectThreads(lit, isPhone() ? 70 : 110)) {
				const a = lit[th.a];
				const b = lit[th.b];
				drawLine(ctx, a.x, a.y, b.x, b.y, STAR_COLORS.site, th.alpha * 0.5, 0.8);
			}
		}

		// Meaningful stars.
		const site = anchors.find((a) => a.kind === 'site');
		for (const a of anchors) {
			if (!a.visible) continue;
			const near = moving ? wakeLevel(Math.hypot(a.x - lx, a.y - ly), reach) * lightAlpha : 0;
			if (a.kind === 'slot' && a.slot) {
				const startedAt = igniteAt.get(a.slot);
				const claimed = isLit(claim, a.slot);
				const p = claimed
					? startedAt === undefined || !moving
						? 1
						: Math.min(1, (now - startedAt) / IGNITE_MS)
					: 0;
				if (p > 0 && site) {
					const ex = site.x + (a.x - site.x) * p;
					const ey = site.y + (a.y - site.y) * p;
					drawLine(ctx, site.x, site.y, ex, ey, STAR_COLORS.site, 0.55, 1);
				}
				if (p > 0 && p < 1 && moving) {
					const rr = mulberry32(slotSeed(a.slot));
					for (let k = 0; k < 8; k++) {
						const ang = rr() * Math.PI * 2 + tSec * 0.6;
						const d = 40 * (1 - p) * (0.6 + rr() * 0.4);
						const dx = a.x + Math.cos(ang) * d;
						const dy = a.y + Math.sin(ang) * d;
						drawDot(ctx, dx, dy, 1.6, STAR_COLORS.site, 0.2 + p * 0.7);
					}
				}
				const pulse = moving ? 1 + (p >= 1 ? 0.18 : 0.1) * Math.sin(tSec * (p >= 1 ? 2 : 1)) : 1;
				const color = p > 0 ? STAR_COLORS.site : STAR_COLORS.slot;
				drawGlowStar(
					ctx,
					a.x,
					a.y,
					(2.6 + p * 2.4) * pulse,
					color,
					0.45 + near * 0.3 + p * 0.5,
					p * (1 - p) * 4,
					sprites.slot,
				);
			} else {
				const breathe = moving && a.kind === 'site' ? 1 + 0.12 * Math.sin(tSec * 0.9) : 1;
				const color = STAR_COLORS[a.kind as 'site' | 'systems' | 'app'] ?? STAR_COLORS.site;
				drawGlowStar(ctx, a.x, a.y, 4 * breathe, color, 0.9, near * 0.4, sprites[a.kind]);
			}
		}

		// Mycelium: revealed as the soil scrolls into view.
		const reveal = Math.min(1, Math.max(0, (h - rootsBox.top) / (rootsBox.height + h * 0.4)));
		drawMycelium(ctx, roots, rootsBox.left, rootsBox.top, moving ? reveal : 1, 1);

		if (moving) raf = requestAnimationFrame(frame);
	}

	const kick = () => {
		if (!raf) raf = requestAnimationFrame(frame);
	};

	addEventListener('resize', () => resize(), { passive: true });
	addEventListener('scroll', () => !motionOn() && kick(), { passive: true });
	addEventListener('cellestial:motion', () => {
		last = performance.now();
		kick();
	});
	document.addEventListener('visibilitychange', () => {
		if (document.hidden && raf) {
			cancelAnimationFrame(raf);
			raf = 0;
		} else if (!document.hidden) {
			last = performance.now();
			kick();
		}
	});

	resize();

	const api: SkyApi = {
		setClaim(s) {
			claim = s;
			for (const id of [...igniteAt.keys()]) if (!isLit(s, id)) igniteAt.delete(id);
			kick();
		},
		ignite(id) {
			igniteAt.set(id, performance.now());
			kick();
		},
		anchorOf(id) {
			const a = anchors.find((x) => x.slot === id);
			return a ? { x: a.x, y: a.y } : null;
		},
	};
	return api;
}

declare global {
	interface Window {
		cellestialSky?: SkyApi;
	}
}
