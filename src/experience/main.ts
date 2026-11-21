// Boot. index.astro loads this one module, and it builds the Stage.
//
//   at once   the claims store, the director, the two flows, the loader
//   lazily    the sky, the Roots, the effects layer, the chrome: each is its
//             own chunk, so three.js can never land in the first one
//
// Every scene is mounted the same way (contracts.ts, "mounting"): its index.ts
// exports `mount`, which is called once, when its markup is in the document,
// and what it returns is registered on the stage. A scene that cannot be
// loaded or mounted is reported and marked failed; the page carries on
// without it, and without the sky it becomes the Roots (director.ts).
//
// The query string (BLUEPRINT §7):
//   ?scene=sky|roots|loading   start there; anything but `loading` skips the loader
//   ?debug                     the live Stage on window.__cellestial
//   ?rm=1                      reduced motion for this visit
//   ?t=3.2                     with scene=loading, freeze the loader at that second

import stars from '../content/stars.json';
import { ASSETS } from './assets.ts';
import { createClaimFlow } from './claim-flow.ts';
import { browserStorage, createClaimsStore } from './claims.ts';
import type { LoaderScene, SceneContext, Stage } from './contracts.ts';
import { createDirector, type StartScene } from './director.ts';
import { mount as mountLoader } from './loader/index.ts';
import { forceReducedMotion, reducedMotion } from './motion.ts';
import { B4_STATION_URL } from './sky/config.ts';
import { expose, fail, register, when } from './stage.ts';

/** The loader when it does not run: over before it began. */
const NO_LOADER: LoaderScene = { done: Promise.resolve(), skip() {}, seek() {} };

/**
 * Where the visit opens. Reduced motion never sees the loader. The script in
 * the head of index.astro makes the same choice before first paint, so the
 * right layers are on screen from the first frame: change one, change both.
 */
function startScene(query: URLSearchParams): StartScene {
	const want = query.get('scene');
	if (want === 'roots') return 'roots';
	return want === 'sky' || reducedMotion() ? 'sky' : 'loading';
}

function boot(): void {
	const query = new URLSearchParams(location.search);
	if (query.get('rm') === '1') forceReducedMotion();
	if (query.has('debug')) expose();

	const claims = createClaimsStore(stars, browserStorage());
	const director = createDirector();
	const claimFlow = createClaimFlow(claims, director);
	register('claims', claims);
	register('director', director);
	register('claimFlow', claimFlow);

	/** All a scene is given. It reaches every other part through this and nothing else. */
	const ctx: SceneContext = {
		when,
		get reducedMotion() {
			return reducedMotion();
		},
	};

	// The loader is in this chunk and mounts now: it is the first thing on screen.
	let at = startScene(query);
	let loader = NO_LOADER;
	if (at === 'loading') {
		const t = query.get('t');
		const freezeAt = t === null || t === '' ? Number.NaN : Number(t);
		try {
			loader = mountLoader(ctx, Number.isFinite(freezeAt) ? { freezeAt } : undefined);
		} catch (err) {
			console.error('[cellestial] the loader could not start', err);
			at = 'sky';
		}
	}
	register('loader', loader);
	director.start(at);

	// The rest arrive when they arrive. The director waits for none of them.
	function lazy<K extends 'sky' | 'roots' | 'fx'>(
		name: K,
		load: () => Promise<{ mount: (ctx: SceneContext) => Stage[K] }>,
	): void {
		load()
			.then((scene) => register(name, scene.mount(ctx)))
			.catch((err) => {
				console.error(`[cellestial] the ${name} could not start`, err);
				fail(name, err);
			});
	}
	// The sky is the one heavy start (about half a second of work on the main
	// thread: the context, the geometry, the shaders). Its script and its four
	// pictures are fetched from the first moment, so the line is used while the
	// loader plays; it is mounted at the loader's one still moment, after the
	// power-up, so the stall holds a picture that was standing still, and it is
	// ready long before the hand-off.
	const skyChunk = import('./sky/index.ts');
	const warm: HTMLImageElement[] = [];
	skyChunk
		.then(() => {
			const { b3Core, b3Ring, b4Empty, b5LitAdd } = ASSETS.sky;
			for (const url of [b3Core.url, b3Ring.url, b4Empty.url, B4_STATION_URL, b5LitAdd.url]) {
				const img = new Image();
				img.src = url;
				warm.push(img);
			}
		})
		.catch(() => {});
	const calm = loader.quiet ?? Promise.resolve();
	lazy('sky', () => calm.then(() => skyChunk));
	lazy('roots', () => import('./roots/index.ts'));
	lazy('fx', () => import('./fx/index.ts'));
	// The chrome exposes nothing, so there is nothing to register.
	import('./chrome/index.ts')
		.then((chrome) => chrome.mount(ctx))
		.catch((err) => console.error('[cellestial] the chrome could not start', err));
}

// Tells the watchdog in index.astro that the page's script is alive. Had this
// module never run, the page would have fallen back to the page without script.
document.documentElement.dataset.booted = '';

try {
	boot();
} catch (err) {
	console.error('[cellestial] the page could not start', err);
	// No scene at all: the stylesheet shows the page without script, which is
	// the logo, the five offers and two links to /contact.
	delete document.documentElement.dataset.scene;
}
