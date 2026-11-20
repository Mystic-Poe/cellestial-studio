// PLACEHOLDER for the loading screen (A1 → A5). The loader scene replaces this
// file and src/components/scenes/Loader.astro.
//
// There is nothing to play yet, so the loader is over the moment it mounts.
// Asked to freeze (?scene=loading&t=…), it stays up until it is skipped.

import type { MountLoader } from '../contracts.ts';

export const mount: MountLoader = (_ctx, opts) => {
	let finish = () => {};
	const done = new Promise<void>((resolve) => {
		finish = resolve;
	});
	if (opts?.freezeAt === undefined) finish();

	return {
		done,
		skip: () => finish(),
		seek() {},
	};
};
