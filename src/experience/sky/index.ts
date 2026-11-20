// PLACEHOLDER for the sky (B1 → B11, G1). The sky scene replaces this file and
// src/components/scenes/Sky.astro.
//
// A black canvas and the one button that leaves it. Every method of the
// contract is here and safe to call; none of them draws anything.

import type { MountSky } from '../contracts.ts';

/** The stub's whole flight: the first of these, a wheel or a swipe, counts as the full round. */
const FLIGHT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ']);

export const mount: MountSky = (ctx) => {
	const ui = document.getElementById('sky-ui');
	if (!ui) throw new Error('sky: #sky-ui is not in the document');
	const exit = ui.querySelector<HTMLElement>('[data-descend]');

	let active = false;
	let still = ctx.reducedMotion;
	let round = false;

	// B11 is there after one full round, or from the start when nothing moves.
	const showExit = () => {
		if (exit) exit.hidden = !(round || still);
	};
	showExit();

	const flew = () => {
		// Not while the sky is paused, and not under a dialog: that is not flying.
		if (!active || round || document.querySelector(':modal')) return;
		round = true;
		showExit();
	};
	window.addEventListener('wheel', flew, { passive: true });
	window.addEventListener('touchmove', flew, { passive: true });
	window.addEventListener('keydown', (event) => {
		if (FLIGHT_KEYS.has(event.key)) flew();
	});

	exit?.addEventListener('click', () => {
		ctx
			.when('director')
			.then((director) => director.descend())
			.catch(() => {});
	});

	return {
		ready: Promise.resolve(),
		setActive(on) {
			active = on;
		},
		reset() {},
		setStill(on) {
			still = on;
			showExit();
		},
		introPrime() {},
		introProgress() {},
		coreCircle: () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2, r: 40 }),
		fall(opts) {
			// One star, straight down the middle, landing at once.
			opts.onImpact(window.innerWidth / 2);
			return Promise.resolve();
		},
		restore() {},
		focusStar: () => Promise.resolve(),
		roundComplete: () => round,
	};
};
