// The two small panels of the sky.
//
//   the empty-star panel (B10)   beside an empty star the visitor picked: what
//                                Cellestial can build, and the way to claim it
//   the lit-star panel           beside a lit star the camera has flown in on:
//                                exactly what was asked there, and nothing else
//
// Both are in the markup (Sky.astro), hidden; the offers' words are written
// there from the locked copy. This file only shows, places and closes them.
// A panel closes on a press outside it, on Escape, on its close button, and
// when the visitor flies on; focus goes into it and back to the star's button.

import type { ClaimsStore, SceneContext, ScreenCircle, SlotId } from '../contracts.ts';
import type { SkyHooks } from './hooks.ts';
import { placePanel, type Rect } from './panel-place.ts';

type Kind = 'empty' | 'lit';

export interface Panels {
	/** The panel that is open and the star it belongs to, or null. */
	open(): { kind: Kind; slot: SlotId } | null;
	/** True when the press now in progress has closed a panel or let a close-up go. */
	spent(): boolean;
	close(): void;
}

export function createPanels(hooks: SkyHooks, ctx: SceneContext): Panels {
	const { ui } = hooks;
	const els: Record<Kind, HTMLElement | null> = {
		empty: ui.querySelector<HTMLElement>('[data-sky-panel="empty"]'),
		lit: ui.querySelector<HTMLElement>('[data-sky-panel="lit"]'),
	};
	const askEl = els.lit?.querySelector<HTMLElement>('[data-sky-ask]') ?? null;

	let claims: ClaimsStore | null = null;
	hooks.claims.then(
		(store) => {
			claims = store;
		},
		() => {},
	);

	let shown: { kind: Kind; slot: SlotId; el: HTMLElement } | null = null;
	let spent = false;
	/** A press on the star whose panel it has just closed: the click that follows does not open it again. */
	let toggled: SlotId | null = null;
	const at = { x: Number.NaN, y: Number.NaN, r: Number.NaN, w: 0, h: 0, exit: false };

	const starButton = (slot: SlotId) =>
		ui.querySelector<HTMLElement>(`button.sky-star[data-slot="${slot}"]:not([hidden])`);

	// ── placing ──
	const exitButton = ui.querySelector<HTMLElement>('[data-descend]');
	/** The exit button where it stands, in the same pixels as the panel, or null while it is hidden. */
	const exitRect = (): Rect | null => {
		if (!exitButton || exitButton.hidden || exitButton.offsetParent === null) return null;
		const b = exitButton.getBoundingClientRect();
		const o = ui.getBoundingClientRect();
		return {
			left: b.left - o.left,
			top: b.top - o.top,
			right: b.right - o.left,
			bottom: b.bottom - o.top,
		};
	};
	/** Beside the star, whole on the screen, clear of the exit button (panel-place.ts). */
	const place = (el: HTMLElement, c: ScreenCircle) => {
		const { w, h } = hooks.layout();
		const exit = exitRect();
		const { x, y } = placePanel(c, { w: el.offsetWidth, h: el.offsetHeight }, { w, h }, exit);
		el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
		at.x = c.x;
		at.y = c.y;
		at.r = c.r;
		at.w = w;
		at.h = h;
		at.exit = exit !== null;
	};

	const follow = () => {
		const s = shown;
		if (!s) return;
		const c = hooks.starCircle(s.slot);
		if (!c) return;
		const { w, h } = hooks.layout();
		if (
			Math.abs(c.x - at.x) > 0.5 ||
			Math.abs(c.y - at.y) > 0.5 ||
			Math.abs(c.r - at.r) > 0.5 ||
			w !== at.w ||
			h !== at.h ||
			(exitButton !== null && !exitButton.hidden) !== at.exit
		)
			place(s.el, c);
	};
	hooks.on('frame', follow);

	// ── opening and closing ──
	const close = (opts: { letGo?: boolean } = {}) => {
		const s = shown;
		if (!s) return;
		shown = null;
		const hadFocus = s.el.contains(document.activeElement);
		s.el.hidden = true;
		if (s.kind === 'lit') {
			if (askEl) askEl.textContent = '';
			if (opts.letGo !== false && hooks.focused() === s.slot) hooks.releaseFocus();
		}
		if (hadFocus) (starButton(s.slot) ?? ui).focus({ preventScroll: true });
	};

	const show = (kind: Kind, slot: SlotId, circle: ScreenCircle | null) => {
		const el = els[kind];
		const c = circle ?? hooks.starCircle(slot);
		if (!el || !c) return;
		close();
		shown = { kind, slot, el };
		el.hidden = false;
		el.scrollTop = 0;
		place(el, c);
		el.focus({ preventScroll: true });
	};

	hooks.on('open-empty', ({ slot, circle }) => {
		if (toggled === slot) {
			toggled = null;
			return;
		}
		show('empty', slot, circle);
	});

	hooks.on('open-lit', ({ slot, circle }) => {
		const ask = claims?.all().get(slot)?.ask;
		if (!askEl || !ask) return;
		// Plain text, exactly as it was asked: never markup.
		askEl.textContent = ask;
		show('lit', slot, circle);
		askEl.scrollTop = 0;
		// A long ask scrolls inside the panel; the keyboard can then reach it.
		if (askEl.scrollHeight > askEl.clientHeight + 1) askEl.tabIndex = 0;
		else askEl.removeAttribute('tabindex');
		moreBelow();
	});

	/** While there is more of the ask below, its last line fades out (Sky.astro, [data-more]). */
	const moreBelow = () => {
		if (!askEl) return;
		const more = askEl.scrollTop + askEl.clientHeight < askEl.scrollHeight - 2;
		askEl.toggleAttribute('data-more', more);
	};
	askEl?.addEventListener('scroll', moreBelow, { passive: true });

	hooks.on('dismiss', () => close());
	hooks.on('star-pick', () => close());
	hooks.on('focus', ({ slot }) => {
		if (slot === null) {
			spent = true;
			if (shown?.kind === 'lit') close({ letGo: false });
		}
	});

	for (const el of Object.values(els)) {
		el?.querySelector('[data-sky-close]')?.addEventListener('click', () => close());
	}

	// "Claim your star": the build request, for this star.
	els.empty?.querySelector('[data-sky-claim]')?.addEventListener('click', () => {
		const slot = shown?.kind === 'empty' ? shown.slot : null;
		if (!slot) return;
		close();
		ctx
			.when('claimFlow')
			.then((flow) => flow.openClaim(slot))
			.catch((err) => console.error('[sky] no claim flow', err));
	});

	// A press anywhere outside the panel closes it.
	document.addEventListener(
		'pointerdown',
		(e) => {
			spent = false;
			toggled = null;
			const s = shown;
			if (!s || !(e.target instanceof Node) || s.el.contains(e.target)) return;
			const star = e.target instanceof Element ? e.target.closest('button.sky-star') : null;
			if (s.kind === 'empty' && star instanceof HTMLElement && star.dataset.slot === s.slot) {
				toggled = s.slot;
			}
			close();
			spent = true;
		},
		true,
	);

	document.addEventListener(
		'keydown',
		(e) => {
			if (e.key !== 'Escape' || !shown || e.defaultPrevented) return;
			// A dialog over the page has the key first.
			if (document.querySelector('dialog[open]')) return;
			e.preventDefault();
			close();
		},
		true,
	);

	return {
		open: () => (shown ? { kind: shown.kind, slot: shown.slot } : null),
		spent: () => spent,
		close: () => close(),
	};
}
