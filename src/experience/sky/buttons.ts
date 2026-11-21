// Picking. Every star of the layer in front has a real <button> in #sky-ui,
// kept exactly over it, so mouse, touch, keyboard and screen readers all pick
// the same way. The buttons are transparent: the star is the picture.
//
// Stars can stand closer together than a 44 px target is wide. A pointer
// therefore means the star whose centre is nearest to it, not whichever
// button happens to lie on top.

import type { SlotId } from '../contracts.ts';

/** The smallest target, CSS pixels. */
const MIN = 44;

export interface StarSpot {
	slot: SlotId;
	/** Centre and disc radius, viewport pixels. */
	x: number;
	y: number;
	r: number;
	lit: boolean;
	/** On screen and solid enough to pick. */
	shown: boolean;
}

export interface StarButtons {
	/** The first `count` of `spots` are the stars to show; `figure` names them to assistive tech. */
	update(figure: string, spots: readonly StarSpot[], count: number): void;
	setEnabled(on: boolean): void;
	/** A swipe began on a button: the click that may follow it is not a pick. */
	swallowNextClick(): void;
	readonly element: HTMLElement;
	destroy(): void;
}

interface Entry {
	el: HTMLButtonElement;
	slot: SlotId | null;
	x: number;
	y: number;
	r: number;
	size: number;
	label: string;
	shown: boolean;
}

export function createStarButtons(
	ui: HTMLElement,
	handlers: {
		pick(slot: SlotId): void;
		/** The star under the pointer or holding keyboard focus, or null. */
		hover(slot: SlotId | null): void;
	},
): StarButtons {
	const group = document.createElement('div');
	group.className = 'sky-stars';
	group.hidden = true;
	ui.prepend(group);

	const entries: Entry[] = [];
	let live = 0;
	let swallow = 0;
	let hovered: SlotId | null = null;
	let focused: SlotId | null = null;
	let told: SlotId | null = null;

	const entryOf = (target: EventTarget | null) => {
		if (!(target instanceof Element)) return null;
		const el = target.closest('button.sky-star');
		return el ? (entries.find((e) => e.el === el) ?? null) : null;
	};

	/** The shown star nearest a point, among those whose target reaches it. */
	const nearest = (x: number, y: number, fallback: SlotId | null) => {
		let slot = fallback;
		let best = Infinity;
		for (let i = 0; i < live; i++) {
			const o = entries[i] as Entry;
			if (!o.shown || !o.slot) continue;
			const d = Math.hypot(o.x - x, o.y - y);
			if (d <= o.size / 2 + 2 && d < best) {
				best = d;
				slot = o.slot;
			}
		}
		return slot;
	};

	const tellHover = () => {
		const now = focused ?? hovered;
		if (now === told) return;
		told = now;
		handlers.hover(now);
	};

	const make = (): Entry => {
		const el = document.createElement('button');
		el.type = 'button';
		el.className = 'sky-star';
		el.hidden = true;
		group.append(el);
		return { el, slot: null, x: NaN, y: NaN, r: 0, size: 0, label: '', shown: false };
	};

	const onClick = (e: MouseEvent) => {
		const entry = entryOf(e.target);
		if (!entry?.slot) return;
		e.preventDefault();
		e.stopPropagation();
		if (performance.now() < swallow) {
			swallow = 0;
			return;
		}
		// A click made with a pointer has a place; one made from the keyboard has none.
		const pointed = e.detail > 0 && (e.clientX !== 0 || e.clientY !== 0);
		const slot = pointed ? nearest(e.clientX, e.clientY, entry.slot) : entry.slot;
		if (slot) handlers.pick(slot);
	};
	const onMove = (e: PointerEvent) => {
		if (e.pointerType === 'touch') return;
		const entry = entryOf(e.target);
		hovered = entry ? nearest(e.clientX, e.clientY, entry.slot) : null;
		tellHover();
	};
	const onLeave = () => {
		hovered = null;
		tellHover();
	};
	const onFocusIn = (e: FocusEvent) => {
		const entry = entryOf(e.target);
		// Only a keyboard's focus is shown; a click's is not.
		focused = entry?.el.matches(':focus-visible') ? entry.slot : null;
		tellHover();
	};
	const onFocusOut = () => {
		focused = null;
		tellHover();
	};
	group.addEventListener('click', onClick);
	group.addEventListener('pointermove', onMove);
	group.addEventListener('pointerover', onMove);
	group.addEventListener('pointerout', onLeave);
	group.addEventListener('focusin', onFocusIn);
	group.addEventListener('focusout', onFocusOut);

	return {
		element: group,
		update(figure, spots, count) {
			while (entries.length < count) entries.push(make());
			const upto = Math.max(count, live);
			for (let i = 0; i < upto; i++) {
				const entry = entries[i] as Entry;
				const spot = i < count ? spots[i] : undefined;
				if (!spot?.shown) {
					if (entry.shown) {
						entry.shown = false;
						entry.el.hidden = true;
						if (hovered === entry.slot) hovered = null;
						if (focused === entry.slot) focused = null;
					}
					if (spot) entry.slot = spot.slot;
					continue;
				}
				entry.slot = spot.slot;
				entry.r = spot.r;
				const size = Math.max(MIN, Math.round(2 * spot.r + 8));
				if (size !== entry.size) {
					entry.size = size;
					entry.el.style.width = `${size}px`;
					entry.el.style.height = `${size}px`;
					entry.el.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
				}
				// Written so that a button with no place yet (NaN) is given one.
				if (!(Math.abs(spot.x - entry.x) <= 0.05 && Math.abs(spot.y - entry.y) <= 0.05)) {
					entry.x = spot.x;
					entry.y = spot.y;
					entry.el.style.transform = `translate3d(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px, 0)`;
				}
				// Each star of a figure has a name of its own: "Empty star 3 of 12 in Virgo".
				const label = `${spot.lit ? 'Claimed' : 'Empty'} star ${i + 1} of ${count} in ${figure}`;
				if (label !== entry.label) {
					entry.label = label;
					entry.el.setAttribute('aria-label', label);
					entry.el.dataset.lit = spot.lit ? 'true' : 'false';
				}
				if (entry.el.dataset.slot !== spot.slot) entry.el.dataset.slot = spot.slot;
				if (!entry.shown) {
					entry.shown = true;
					entry.el.hidden = false;
				}
			}
			live = count;
			tellHover();
		},
		setEnabled(on) {
			if (group.hidden === !on) return;
			group.hidden = !on;
			if (!on) {
				hovered = focused = null;
				tellHover();
			}
		},
		swallowNextClick() {
			swallow = performance.now() + 400;
		},
		destroy() {
			group.remove();
		},
	};
}
