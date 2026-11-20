// What the visitor does to the flight: wheel, touch, keys, and the tap that
// stops it. This file only reads the DOM events and says what they mean; the
// scene decides what happens.
//
// While enabled the sky owns the wheel, a touch that begins on the sky, and
// the keys below, except when a dialog is open or focus is inside a dialog,
// a form field or the menu. Disabled, it owns nothing.

export interface InputHandlers {
	/** One sample of continuing input: +1 forward (Virgo towards Libra), -1 back. `touch`: it is a swipe. */
	push(dir: 1 | -1, touch: boolean): void;
	/** A flight key went down, and came up again. */
	hold(dir: 1 | -1): void;
	release(): void;
	/** Home. */
	home(): void;
	/** Escape. True if it did something. */
	escape(): boolean;
	/**
	 * A pointer is pressing on empty sky: at once for a mouse; for a finger, when it has
	 * rested there a moment or has come up again, but never when it turns out to be a swipe.
	 */
	down(x: number, y: number): void;
	/** It came up again without having moved: a tap. */
	tap(x: number, y: number): void;
	/** A swipe began on a star: the click that may follow is not a pick. */
	swipeFromStar(): void;
}

export interface SkyInput {
	setEnabled(on: boolean): void;
	destroy(): void;
}

const ELSEWHERE =
	'dialog, [role="dialog"], [aria-modal="true"], [role="menu"], nav, input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const FIELDS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const ACTIVATES = 'button, a[href], summary, [role="button"], [role="link"], [tabindex]';

/** Travel beyond this is a swipe, not a tap. CSS pixels. */
const SLOP = 9;
/** A press held longer than this is not a tap. */
const TAP_MS = 650;
/**
 * A finger that has rested this long is pressing, not swiping. A swipe moves
 * sooner than this, so it never stops the flight it is about to speed up.
 */
const PRESS_MS = 90;

export function attachInput(
	canvas: HTMLCanvasElement,
	ui: HTMLElement,
	handlers: InputHandlers,
): SkyInput {
	let enabled = false;
	let heldKey: string | null = null;
	let wheelSum = 0;
	let wheelAt = 0;
	/** The timer of a finger's press that may yet be a swipe, or 0. */
	let press = 0;
	let pointer: {
		id: number;
		x: number;
		y: number;
		lastY: number;
		sum: number;
		t: number;
		moved: boolean;
		star: boolean;
		touch: boolean;
	} | null = null;

	const modalOpen = () => {
		try {
			if (document.querySelector(':modal') !== null) return true;
		} catch {
			// A browser without :modal: the plain selectors below cover it.
		}
		return document.querySelector('dialog[open], [aria-modal="true"]') !== null;
	};

	const where = (target: EventTarget | null): 'sky' | 'star' | null => {
		if (!(target instanceof Element)) return null;
		if (target.closest('.sky-star')) return 'star';
		if (
			target === canvas ||
			target === ui ||
			target === document.body ||
			target === document.documentElement ||
			target.id === 'sky-window' ||
			target.classList.contains('sky-stars')
		)
			return 'sky';
		return null;
	};

	const onWheel = (e: WheelEvent) => {
		if (!enabled || e.ctrlKey || modalOpen()) return;
		if (e.target instanceof Element && e.target.closest(ELSEWHERE)) return;
		// Someone typing in a field is not flying, wherever the pointer happens to be.
		if (document.activeElement?.closest(FIELDS)) return;
		e.preventDefault();
		const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
		const dy = e.deltaY * unit;
		if (Math.abs(dy) <= Math.abs(e.deltaX * unit)) return;
		const now = performance.now();
		if (now - wheelAt > 220 || Math.sign(dy) !== Math.sign(wheelSum)) wheelSum = 0;
		wheelAt = now;
		wheelSum += dy;
		// The tail of a trackpad's glide is a trickle of tiny deltas: not input.
		if (Math.abs(wheelSum) < 4) return;
		handlers.push(wheelSum > 0 ? 1 : -1, false);
		wheelSum = 0;
	};

	const onKeyDown = (e: KeyboardEvent) => {
		if (!enabled || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		if (modalOpen()) return;
		const el = document.activeElement;
		const inside = el && el !== document.body ? el : null;
		if (inside?.closest(`${ELSEWHERE}, #chrome`)) return;
		let dir: 1 | -1 | 0 = 0;
		switch (e.key) {
			case 'ArrowDown':
			case 'PageDown':
				dir = 1;
				break;
			case 'ArrowUp':
			case 'PageUp':
				dir = -1;
				break;
			case ' ':
			case 'Spacebar':
				// Space on a button presses the button.
				if (inside?.closest(ACTIVATES)) return;
				dir = e.shiftKey ? -1 : 1;
				break;
			case 'Home':
				e.preventDefault();
				handlers.home();
				return;
			case 'Escape':
				if (handlers.escape()) e.preventDefault();
				return;
			default:
				return;
		}
		e.preventDefault();
		if (e.repeat && heldKey === e.key) return;
		heldKey = e.key;
		handlers.hold(dir);
	};

	const onKeyUp = (e: KeyboardEvent) => {
		if (heldKey === null || e.key !== heldKey) return;
		heldKey = null;
		handlers.release();
	};

	const letGo = () => {
		if (heldKey !== null) {
			heldKey = null;
			handlers.release();
		}
		pointer = null;
		settlePress(false);
	};

	const onPointerDown = (e: PointerEvent) => {
		if (!enabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
		if (modalOpen()) return;
		const on = where(e.target);
		if (!on) return;
		pointer = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			lastY: e.clientY,
			sum: 0,
			t: performance.now(),
			moved: false,
			star: on === 'star',
			touch: e.pointerType !== 'mouse',
		};
		if (on !== 'sky') return;
		if (e.pointerType === 'mouse') {
			handlers.down(e.clientX, e.clientY);
			return;
		}
		const { clientX: x, clientY: y } = e;
		press = window.setTimeout(() => {
			press = 0;
			handlers.down(x, y);
		}, PRESS_MS);
	};

	/** The press that was waiting to see whether it is a swipe: `now` true makes it, false forgets it. */
	const settlePress = (now: boolean, x = 0, y = 0) => {
		if (press === 0) return;
		window.clearTimeout(press);
		press = 0;
		if (now) handlers.down(x, y);
	};

	const onPointerMove = (e: PointerEvent) => {
		const p = pointer;
		if (!p || e.pointerId !== p.id) return;
		if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) {
			p.moved = true;
			settlePress(false);
			if (p.star) handlers.swipeFromStar();
			p.lastY = e.clientY;
		}
		if (!p.moved || !p.touch || !enabled) return;
		// A finger moving up the screen flies forward, as it would scroll a page down.
		p.sum += e.clientY - p.lastY;
		p.lastY = e.clientY;
		if (Math.abs(p.sum) < 5) return;
		handlers.push(p.sum < 0 ? 1 : -1, true);
		p.sum = 0;
	};

	const onPointerUp = (e: PointerEvent) => {
		const p = pointer;
		if (!p || e.pointerId !== p.id) return;
		pointer = null;
		if (!enabled || p.moved || p.star) {
			settlePress(false);
			return;
		}
		// A quick tap comes up before the press was made: it is made now.
		settlePress(true, p.x, p.y);
		if (performance.now() - p.t > TAP_MS) return;
		handlers.tap(e.clientX, e.clientY);
	};

	const onPointerCancel = (e: PointerEvent) => {
		if (pointer && e.pointerId === pointer.id) {
			pointer = null;
			settlePress(false);
		}
	};

	window.addEventListener('wheel', onWheel, { passive: false });
	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);
	window.addEventListener('blur', letGo);
	window.addEventListener('pointerdown', onPointerDown);
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('pointercancel', onPointerCancel);

	return {
		setEnabled(on) {
			if (enabled === on) return;
			enabled = on;
			if (!on) letGo();
		},
		destroy() {
			window.removeEventListener('wheel', onWheel);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', letGo);
			window.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerCancel);
		},
	};
}
