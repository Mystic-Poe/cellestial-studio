// The pack pictures the sky draws with, decoded before the first frame.

import { ASSETS } from '../assets.ts';
import { B4_STATION_URL } from './config.ts';
import type { Pictures } from './gl/world.ts';

async function load(url: string): Promise<HTMLImageElement> {
	const img = new Image();
	img.decoding = 'async';
	img.src = url;
	try {
		await img.decode();
	} catch {
		// decode() can refuse where a plain load would do; wait for that instead.
		if (!img.complete || img.naturalWidth === 0) {
			await new Promise<void>((resolve, reject) => {
				img.addEventListener('load', () => resolve(), { once: true });
				img.addEventListener('error', () => reject(new Error(`sky: could not load ${url}`)), {
					once: true,
				});
			});
		}
	}
	if (img.naturalWidth === 0) throw new Error(`sky: could not load ${url}`);
	return img;
}

/** B3's core and ring, B4 (as the pack has it, and as it stands at a station), and B5 on black (it is blended additively). */
export async function loadPictures(): Promise<Pictures> {
	const { b3Core, b3Ring, b4Empty, b5LitAdd } = ASSETS.sky;
	const [core, ring, b4, b4Station, b5] = await Promise.all([
		load(b3Core.url),
		load(b3Ring.url),
		load(b4Empty.url),
		load(B4_STATION_URL),
		load(b5LitAdd.url),
	]);
	return { core, ring, b4, b4Station, b5 };
}
