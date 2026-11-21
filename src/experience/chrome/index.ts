// The chrome (C1 → C3): what the markup in Chrome.astro cannot do by itself.
//
// The menu is a native popover, so opening it, Escape and a click elsewhere
// need no script. This adds:
//   the teleports   the logo and each item ask the director to go there; the
//                   director plays the flash and moves the visitor, not this
//   aria-expanded   the button says whether the panel is open
//   focus           into the panel when it opens, back to the button when it closes
//   a fallback      for a browser with no popovers: the same behaviour by hand
//
// It exposes nothing and reaches the rest of the page only through ctx.

import type { Destination, MountChrome } from '../contracts.ts';

const DESTINATIONS: readonly string[] = ['sky', 'build', 'claim', 'contact'];

/** Only a plain click teleports. With a modifier a link is the link it is. */
const plain = (event: MouseEvent): boolean =>
	event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export const mount: MountChrome = (ctx) => {
	const chrome = document.getElementById('chrome');
	if (!chrome) throw new Error('chrome: #chrome is not in the document');
	const button = chrome.querySelector<HTMLButtonElement>('button[aria-controls="chrome-menu"]');
	const menu = chrome.querySelector<HTMLElement>('#chrome-menu');
	const native = typeof HTMLElement.prototype.showPopover === 'function';

	const isOpen = (): boolean => {
		if (!menu) return false;
		return native ? menu.matches(':popover-open') : menu.hasAttribute('data-open');
	};

	/** The panel opened or closed, by whatever means: say so, and move focus. */
	function changed(open: boolean): void {
		button?.setAttribute('aria-expanded', String(open));
		if (open) {
			menu?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
			return;
		}
		// Back to the button, unless the visitor has already put focus somewhere else.
		const at = document.activeElement;
		if (!at || at === document.body || menu?.contains(at)) button?.focus({ preventScroll: true });
	}

	function close(): void {
		if (!menu || !isOpen()) return;
		if (native) menu.hidePopover();
		else {
			menu.removeAttribute('data-open');
			changed(false);
		}
	}

	const go = (dest: Destination): void => {
		ctx
			.when('director')
			.then((director) => director.go(dest))
			.catch(() => {});
	};

	button?.setAttribute('aria-expanded', 'false');
	if (native) {
		menu?.addEventListener('toggle', (event) => {
			changed((event as ToggleEvent).newState === 'open');
		});
	} else if (button && menu) {
		// No popovers here: the button, Escape and a click elsewhere, by hand.
		button.addEventListener('click', () => {
			if (isOpen()) close();
			else {
				menu.setAttribute('data-open', '');
				changed(true);
			}
		});
		document.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !isOpen()) return;
			event.preventDefault();
			close();
		});
		document.addEventListener('click', (event) => {
			if (!isOpen() || !(event.target instanceof Node)) return;
			if (menu.contains(event.target) || button.contains(event.target)) return;
			close();
		});
	}

	chrome.addEventListener('click', (event) => {
		if (!(event.target instanceof Element) || !plain(event)) return;
		// C1: the logo goes home, which on this page is the sky.
		if (event.target.closest('[data-home]')) {
			event.preventDefault();
			close();
			go('sky');
			return;
		}
		const dest = event.target.closest<HTMLElement>('[data-dest]')?.dataset.dest;
		if (dest === undefined || !DESTINATIONS.includes(dest)) return;
		event.preventDefault();
		close();
		go(dest as Destination);
	});
};
