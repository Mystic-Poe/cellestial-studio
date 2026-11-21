// The Roots and the Close (E1 → E6, F1, F2): the scene's script.
//
// The markup (src/components/scenes/Roots.astro, Close.astro) is the whole
// scene as a page: five nodes as pictures, five tiles open one under another,
// two links. This makes it the scene the owner described: "Each node they
// CLICK opens a PANEL. They read it, close it. Closing it, the light leads
// them to the NEXT node." One tile at a time; guided, never locked.
//
//   nodes    each bulb becomes a button that opens its tile and closes any other
//   tiles    placed beside the node (under it on a phone), never taller than
//            the screen, brought into view, focus in and back
//   light    net.ts draws the mycelium from where the nodes are measured to
//            be, grows it from an impact (growFrom) or shows it whole
//            (showGrown), and runs the guided light to the next unread node
//
// Nothing here scrolls the page except to bring an opened tile into view, and
// nothing opens a tile but the visitor.

import { ASSETS } from '../assets.ts';
import type { MountRoots, RootsScene } from '../contracts.ts';
import { EDGE, EDGE_MEAN } from './edge.ts';
import { createNet, type Layout, type Pt } from './net.ts';

interface Stop {
	el: HTMLElement;
	id: string;
	node: HTMLElement;
	bulb: HTMLButtonElement;
	tile: HTMLElement;
}

/** The fixed chrome covers about this much of the top-left corner. */
const CHROME = { w: 126, h: 92 };
/** A tile beside a node is never narrower than this; else it goes under it. */
const BESIDE_MIN = 352;
/** A tile's width at most: 34rem, and 37rem on a wide screen (Roots.astro agrees). */
const tileMaxWidth = (width: number): number => (width >= 1024 ? 592 : 544);
/** Which stop the light leads to once every tile is read: the Close. */
const CLOSE = 5;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

export const mount: MountRoots = (ctx) => {
	const found = document.getElementById('roots');
	if (!found) throw new Error('roots: #roots is not in the document');
	const ground: HTMLElement = found;
	const host = ground.querySelector<HTMLElement>('.roots-net');
	if (!host) throw new Error('roots: .roots-net is not in the ground');

	const stops: Stop[] = [];
	for (const el of ground.querySelectorAll<HTMLElement>('.roots-stop')) {
		const node = el.querySelector<HTMLElement>('.roots-node');
		const bulb = el.querySelector<HTMLButtonElement>('.roots-node__bulb');
		const tile = el.querySelector<HTMLElement>('.roots-tile');
		if (node && bulb && tile) stops.push({ el, id: el.dataset.offer ?? '', node, bulb, tile });
	}

	/** The guided light has arrived: its target answers with a moment of brightness. */
	let hotTimer = 0;
	let hotNow: HTMLElement | null = null;
	function arrive(to: number): void {
		const target = to === CLOSE ? f1() : stops[to]?.node;
		if (!target) return;
		window.clearTimeout(hotTimer);
		if (hotNow !== target) hotNow?.removeAttribute('data-hot');
		hotNow = target;
		target.setAttribute('data-hot', '');
		hotTimer = window.setTimeout(() => target.removeAttribute('data-hot'), 900);
	}
	const net = createNet(host, arrive);
	const f1 = () => ground.querySelector<HTMLElement>('[data-open-claim]');
	const f2 = () => ground.querySelector<HTMLElement>('[data-open-contact]');
	const docY = (el: Element) => el.getBoundingClientRect().top + window.scrollY;

	let active = false;
	let grown = false;
	let opened: Stop | null = null;
	/** The tiles that have been opened, by index, and the last of them. */
	const read = new Set<number>();
	let lastRead = -1;

	// ───────────────────────────────────────────────────────── measuring ──

	/** Where the nodes, the surface and the Close are, for the network. */
	function measure(): Layout {
		const g = ground.getBoundingClientRect();
		const width = ground.clientWidth;
		const s = ASSETS.roots.e4NodeAlpha;
		// The lower thread's line, carried back up to the foot of the bulb.
		const run = Math.hypot(s.threadBottom.x - s.threadEnd.x, s.threadBottom.y - s.threadEnd.y);
		const dir = {
			x: (s.threadBottom.x - s.threadEnd.x) / run,
			y: (s.threadBottom.y - s.threadEnd.y) / run,
		};
		const back = (s.threadEnd.y - (s.bulb.y + s.bulb.r + 8)) / dir.y;
		const neck = { x: s.threadEnd.x - dir.x * back, y: s.threadEnd.y - dir.y * back };
		const nodes = stops.map((stop) => {
			const r = stop.node.getBoundingClientRect();
			const k = r.width / s.w;
			const at = (p: Pt): Pt => ({ x: r.left - g.left + p.x * k, y: r.top - g.top + p.y * k });
			return {
				top: at(s.threadTop),
				topNeck: at({ x: s.bulb.x - 5, y: s.bulb.y - s.bulb.r - 6 }),
				bottomNeck: at(neck),
				end: at(s.threadEnd),
				bulb: { ...at(s.bulb), r: s.bulb.r * k },
			};
		});
		// Beside E6, on the side the first node is on: never behind the button.
		const surfaceX = width * (width < 768 ? 0.73 : 0.4);
		const button = f1()?.getBoundingClientRect();
		return {
			width,
			height: ground.offsetHeight,
			surfaceX,
			nodes,
			close: button
				? { x: button.left - g.left + button.width / 2, y: button.top - g.top + 3 }
				: { x: width / 2, y: ground.offsetHeight - 120 },
		};
	}

	let measureTimer = 0;
	let guideTimer = 0;
	function remeasure(): void {
		net.layout(measure());
		// A growth caught by a resize is finished by it.
		if (grown) for (let i = 0; i < stops.length; i++) light(i);
		if (opened) place(opened);
		guide();
	}
	/** The ground changed size (a resize, a rotation, a late font): measure again, once. */
	function remeasureSoon(): void {
		window.clearTimeout(measureTimer);
		measureTimer = window.setTimeout(remeasure, 120);
	}

	// ───────────────────────────────────────────────────────────── tiles ──

	/** Where an open tile goes: beside its node where there is room, else under the bulb. */
	function place(stop: Stop): { top: number; height: number; left: number } {
		const width = ground.clientWidth;
		const g = ground.getBoundingClientRect();
		const s = stop.el.getBoundingClientRect();
		const b = stop.bulb.getBoundingClientRect();
		const margin = width <= 416 ? 12 : 16;
		const gap = 28;
		const roomRight = g.left + width - b.right - gap - margin;
		const roomLeft = b.left - g.left - gap - margin;
		const beside = width >= 768 && Math.max(roomRight, roomLeft) >= BESIDE_MIN;
		let w: number;
		let x: number;
		if (beside) {
			const right = roomRight >= roomLeft;
			w = Math.min(tileMaxWidth(width), right ? roomRight : roomLeft);
			x = right ? b.right - g.left + gap : b.left - g.left - gap - w;
		} else {
			w = Math.min(tileMaxWidth(width), width - 2 * margin);
			x = clamp(b.left - g.left + b.width / 2 - w / 2, margin, width - margin - w);
		}
		// Never taller than the screen, and never under the logo.
		const headroom = x < CHROME.w ? CHROME.h : margin;
		const max = window.innerHeight - headroom - margin;
		stop.tile.style.setProperty('--tile-x', `${x}px`);
		stop.tile.style.setProperty('--tile-w', `${w}px`);
		stop.tile.style.setProperty('--tile-max', `${max}px`);
		const h = stop.tile.offsetHeight;
		const stopTop = s.top - g.top;
		let y: number;
		if (beside) {
			y = b.top - s.top + b.height / 2 - h / 2;
			y = clamp(y, EDGE.height + 12 - stopTop, ground.offsetHeight - 12 - h - stopTop);
		} else {
			const gapUnder = Number.parseFloat(getComputedStyle(ground).getPropertyValue('--tile-gap'));
			y = b.bottom - s.top + (Number.isFinite(gapUnder) ? gapUnder : 14);
		}
		stop.tile.style.setProperty('--tile-y', `${y}px`);
		return { top: s.top + y, height: h, left: x };
	}

	/** Scroll just far enough that the whole tile is on screen, clear of the logo. */
	function bringIntoView(box: { top: number; height: number; left: number }): void {
		const margin = ground.clientWidth <= 416 ? 12 : 16;
		const headroom = box.left < CHROME.w ? CHROME.h : margin;
		const bottom = box.top + box.height;
		let by = 0;
		if (box.top < headroom) by = box.top - headroom;
		else if (bottom > window.innerHeight - margin) {
			by = Math.min(bottom - (window.innerHeight - margin), box.top - headroom);
		}
		if (Math.abs(by) < 1) return;
		window.scrollBy({ top: by, behavior: ctx.reducedMotion ? 'instant' : 'smooth' });
	}

	function open(stop: Stop): void {
		if (opened === stop) return;
		if (opened) shut(opened, false);
		const i = stops.indexOf(stop);
		opened = stop;
		stop.tile.dataset.open = '';
		stop.el.dataset.open = '';
		stop.bulb.setAttribute('aria-expanded', 'true');
		stop.node.dataset.read = '';
		read.add(i);
		lastRead = i;
		stop.tile.scrollTop = 0;
		const box = place(stop);
		stop.tile.focus({ preventScroll: true });
		bringIntoView(box);
		guide();
	}

	/** Close a tile. `refocus`: put the keyboard back on its node. */
	function shut(stop: Stop, refocus: boolean): void {
		delete stop.tile.dataset.open;
		delete stop.el.dataset.open;
		stop.bulb.setAttribute('aria-expanded', 'false');
		if (opened === stop) opened = null;
		if (refocus) stop.bulb.focus({ preventScroll: true });
		// "Closing it, the light leads them to the NEXT node": at once.
		guide(true);
	}

	// ───────────────────────────────────────────────────────── the light ──

	/** The node the light leads to: the next one down not yet read, or the Close. */
	function nextUnread(): number {
		for (let i = lastRead + 1; i < stops.length; i++) if (!read.has(i)) return i;
		for (let i = lastRead - 1; i >= 0; i--) if (!read.has(i)) return i;
		return CLOSE;
	}

	/** Point the guided light where it should go now, or still it. */
	function guide(atOnce = false): void {
		const to = nextUnread();
		stops.forEach((stop, i) => {
			stop.node.toggleAttribute('data-next', grown && i === to);
		});
		if (!active || !grown || opened || ctx.reducedMotion) net.stopGuide();
		else net.guide(lastRead, to, atOnce);
	}

	function light(i: number): void {
		stops[i]?.node.setAttribute('data-lit', '');
	}

	function showGrown(): void {
		grown = true;
		ground.dataset.grown = '';
		net.showGrown();
		for (let i = 0; i < stops.length; i++) light(i);
		guide();
	}

	/** Back to bare soil: the next arrival grows it again. What was read stays read. */
	function bare(): void {
		grown = false;
		delete ground.dataset.grown;
		net.hide();
		for (const stop of stops) stop.node.removeAttribute('data-lit');
		guide();
	}

	// ──────────────────────────────────────────────────────────── wiring ──

	ground.dataset.live = '';
	for (const stop of stops) {
		stop.bulb.disabled = false;
		stop.bulb.removeAttribute('aria-hidden');
		stop.tile.setAttribute('role', 'dialog');
		stop.bulb.addEventListener('click', () => {
			if (opened === stop) shut(stop, false);
			else open(stop);
		});
		stop.tile.querySelector('[data-tile-close]')?.addEventListener('click', () => shut(stop, true));
	}

	document.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape' || !opened || event.defaultPrevented) return;
		// A dialog over the page takes its own Escape.
		if (document.querySelector('dialog:modal')) return;
		event.preventDefault();
		shut(opened, true);
	});

	// A click anywhere outside the open tile closes it. Focus goes back to its
	// node unless the click was on something that takes focus itself.
	document.addEventListener('click', (event) => {
		const was = opened;
		if (!was || !(event.target instanceof Node)) return;
		if (was.tile.contains(event.target) || was.node.contains(event.target)) return;
		const taken =
			event.target instanceof Element && event.target.closest('a, button, input, textarea');
		shut(was, !taken);
	});

	// E6, at the top of the ground.
	ground.querySelector('[data-ascend]')?.addEventListener('click', () => {
		ctx
			.when('director')
			.then((director) => director.ascend())
			.catch(() => {});
	});

	net.layout(measure());
	new ResizeObserver(remeasureSoon).observe(ground);
	document.fonts?.ready.then(remeasureSoon).catch(() => {});

	const scene: RootsScene = {
		setActive(on) {
			if (on === active) return;
			active = on;
			ground.toggleAttribute('data-active', on);
			net.setActive(on);
			if (on) {
				remeasure();
			} else {
				if (opened) shut(opened, false);
				bare();
			}
		},

		surfaceY: () => ground.getBoundingClientRect().top + EDGE_MEAN,

		growFrom(x) {
			if (ctx.reducedMotion) {
				showGrown();
				return Promise.resolve();
			}
			grown = true;
			ground.dataset.grown = '';
			const g = ground.getBoundingClientRect();
			// Each node flares as the light reaches it, then settles to its breathing.
			const done = net.growFrom(x - g.left, (i) => {
				light(i);
				const node = stops[i]?.node;
				if (!node) return;
				node.setAttribute('data-hot', '');
				window.setTimeout(() => node.removeAttribute('data-hot'), 700);
			});
			// The guided light waits for the growth to pass: then it begins to lead.
			done.then(() => {
				window.clearTimeout(guideTimer);
				guideTimer = window.setTimeout(guide, 900);
			});
			return done;
		},

		showGrown,

		anchorY(which) {
			const top = docY(ground);
			const bottom = Math.max(top, document.documentElement.scrollHeight - window.innerHeight);
			if (which === 'top') return top;
			if (which === 'first-node') {
				// The first bulb two fifths of the way down the screen.
				const first = stops[0]?.bulb;
				if (!first) return top;
				const centre = docY(first) + first.offsetHeight / 2;
				return clamp(centre - window.innerHeight * 0.4, top, bottom);
			}
			// The two buttons in the middle of the screen, or as near as the page allows.
			const close = f1()?.parentElement;
			if (!close) return bottom;
			const a = f1()?.getBoundingClientRect();
			const b = f2()?.getBoundingClientRect();
			if (!a || !b) return bottom;
			const middle = (a.top + b.bottom) / 2 + window.scrollY;
			return clamp(middle - window.innerHeight / 2, top, bottom);
		},

		focusClose(which) {
			(which === 'claim' ? f1() : f2())?.focus({ preventScroll: true });
		},
	};

	// For the tools in tools/roots/ (the page puts the scene on window.__cellestial
	// with ?debug): every state reachable without a pointer.
	const debug = {
		open: (id: string) => {
			const stop = stops.find((s) => s.id === id);
			if (stop) open(stop);
		},
		close: () => {
			if (opened) shut(opened, true);
		},
		state: () => ({
			active,
			grown,
			open: opened?.id ?? null,
			read: [...read].map((i) => stops[i].id),
			next: nextUnread(),
		}),
		layout: measure,
		net,
	};
	return Object.assign(scene, { debug });
};
