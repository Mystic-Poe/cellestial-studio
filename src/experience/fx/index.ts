// The effects layer: three short effects drawn on one full-screen canvas that
// sits above every scene. C4 the teleport flash, D2 the impact, G2 the warp.
//
// It is light drawn by code: no image files, no words, no sound. When nothing
// is playing it costs nothing: the canvas is clear and put away, and no frame
// is requested.

import type { MountFx } from '../contracts.ts';
import { createFx } from './layer.ts';

/**
 * Where in a warp the frame is covered, as a fraction of its length: the page
 * swaps the Roots for the sky at `WARP_COVER * ms` after calling `warp(ms)`.
 */
export { WARP_COVER } from './warp.ts';

export const mount: MountFx = (ctx) => createFx(ctx);
