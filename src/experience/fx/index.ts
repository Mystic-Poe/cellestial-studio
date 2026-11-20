// PLACEHOLDER for the effects layer (C4, the D2 impact, G2). The effects scene
// replaces this file and src/components/scenes/Fx.astro.
//
// The teleport is a fade through black on the canvas itself, with the swap at
// its midpoint. There is no impact and the warp is only its duration.

import type { MountFx } from '../contracts.ts';
import { fadeThrough, tween } from '../motion.ts';

/** Half of the flash: C4 is 300–500ms in all. */
const HALF_MS = 200;

export const mount: MountFx = () => {
	const canvas = document.getElementById('fx-canvas');
	if (!canvas) throw new Error('fx: #fx-canvas is not in the document');
	canvas.style.background = '#000';
	canvas.style.opacity = '0';

	return {
		teleportFlash: (swap) => fadeThrough(canvas, swap, HALF_MS, HALF_MS),
		impact() {},
		warp: (ms) => tween(ms, () => {}),
	};
};
