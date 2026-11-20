// PLACEHOLDER for the Roots and the Close (E1 → E6, F1, F2). The roots scene
// replaces this file, src/components/scenes/Roots.astro and Close.astro.
//
// The markup is the five offers, already readable, so there is nothing to
// grow and nothing to animate. The measuring methods are real.

import type { MountRoots } from '../contracts.ts';

/** Clear of the chrome, which is fixed over the top-left corner. */
const HEADROOM = 96;

export const mount: MountRoots = (ctx) => {
	const ground = document.getElementById('roots');
	if (!ground) throw new Error('roots: #roots is not in the document');

	const docY = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
	const f1 = () => ground.querySelector<HTMLElement>('[data-open-claim]');
	const f2 = () => ground.querySelector<HTMLElement>('[data-open-contact]');

	// E6, at the top of the ground.
	ground.querySelector('[data-ascend]')?.addEventListener('click', () => {
		ctx
			.when('director')
			.then((director) => director.ascend())
			.catch(() => {});
	});

	return {
		setActive() {},
		surfaceY: () => ground.getBoundingClientRect().top,
		growFrom: () => Promise.resolve(),
		showGrown() {},

		anchorY(which) {
			const top = docY(ground);
			if (which === 'top') return top;
			if (which === 'first-node') {
				const first = ground.querySelector('article');
				return first ? Math.max(top, docY(first) - HEADROOM) : top;
			}
			// The two buttons in the middle of the screen, or as near as the page allows.
			const close = f1()?.parentElement;
			const bottom = Math.max(top, document.documentElement.scrollHeight - window.innerHeight);
			if (!close) return bottom;
			const centred = docY(close) - (window.innerHeight - close.offsetHeight) / 2;
			return Math.min(bottom, Math.max(top, centred));
		},

		focusClose(which) {
			(which === 'claim' ? f1() : f2())?.focus();
		},
	};
};
