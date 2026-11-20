// PLACEHOLDER for the chrome (C1 → C3). The chrome scene replaces this file and
// src/components/chrome/Chrome.astro.
//
// The menu is a native popover, so the button opens it, and Escape or a click
// elsewhere closes it, with no script at all. All this adds is the teleport:
// each item asks the director to go to its destination.

import type { Destination, MountChrome } from '../contracts.ts';

const DESTINATIONS: readonly string[] = ['sky', 'build', 'claim', 'contact'];

export const mount: MountChrome = (ctx) => {
	const chrome = document.getElementById('chrome');
	if (!chrome) throw new Error('chrome: #chrome is not in the document');
	const menu = chrome.querySelector<HTMLElement>('[popover]');

	chrome.addEventListener('click', (event) => {
		if (!(event.target instanceof Element)) return;
		const item = event.target.closest<HTMLElement>('[data-dest]');
		const dest = item?.dataset.dest;
		if (dest === undefined || !DESTINATIONS.includes(dest)) return;
		// Only a plain click teleports. With a modifier the item is the link it is.
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		if (menu?.matches(':popover-open')) menu.hidePopover();
		ctx
			.when('director')
			.then((director) => director.go(dest as Destination))
			.catch(() => {});
	});
};
