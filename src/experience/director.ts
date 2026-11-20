// The Director: which scene the page is in, and how it gets from one to the
// next. It owns three things, and nothing else may touch them:
//
//   <html data-scene>   the page is always in exactly one scene
//   SCENE_EVENT         fired on document whenever that changes
//   the scroll model    BLUEPRINT §3
//
// THE SCROLL MODEL. The sky is a fixed canvas. The Roots are in the flow,
// under #sky-window: a spacer one screen tall that the sky shows through.
//
//   loading, sky   scrollTop is 0 and stays 0; the visitor cannot scroll
//   fall, warp     only the director scrolls, by script
//   roots          the spacer is collapsed, so the top of the document is the
//                  top of the ground, and the visitor scrolls natively
//
// The stylesheet in index.astro derives all of that from data-scene. The one
// thing a stylesheet cannot do is hold the view still while the spacer comes
// or goes, so setScene() corrects scrollTop in the same frame.
//
// TRANSITIONS. One runs at a time, and a request made meanwhile is ignored
// (showStar alone waits its turn: it follows a send, and must not be lost).
// Every transition exists in its simple form, a fade through black, which is
// also the whole of a reduced-motion transition. With motion on, three of
// them hand over to the full choreography: see "THE FULL CHOREOGRAPHY" below,
// the only part of this file a later scene needs to write.
//
// PARTS. The sky, the Roots, the effects layer and the chrome load apart and
// may arrive late or never. Nothing here assumes a part exists: a transition
// waits a few seconds for one that is still loading, then goes on without it.
// If the sky can never be made, the page is the Roots from then on, and
// <html data-no-sky> says so.

import {
	type Destination,
	type Director,
	SCENE_EVENT,
	type SceneChangeDetail,
	type SceneId,
	type Stage,
	type StagePart,
} from './contracts.ts';
import { easeOut, fadeThrough, onMotionChange, reducedMotion, tween } from './motion.ts';
import { get, when } from './stage.ts';

export type StartScene = 'loading' | 'sky' | 'roots';

/** The Director, and the one call that belongs to main.ts alone. */
export interface StageDirector extends Director {
	/** Once, at boot: the scene the page opens in. */
	start(at: StartScene): void;
}

type Anchor = 'top' | 'first-node' | 'close';
type Felt = 'up' | 'down' | 'none';

/** One half of a fade through black. */
const FADE_MS = 250;
/** The page coming up out of black when it opens straight on the sky. */
const OPEN_MS = 600;
/** How long a transition waits for a part that is still loading before going on without it. */
const PART_WAIT_MS = 4000;
/** How long the page stays black for the sky's first frame when there is no loader to hold it. */
const SKY_WAIT_MS = 6000;
/** How long a skipped loader is given to finish its hand-off. */
const LOADER_WAIT_MS = 10_000;
/** The veil sits over the effects layer (30) and under the chrome (40): the logo stays. */
const VEIL_Z = '35';
/** Or over everything, the loader (50) included. */
const VEIL_Z_OVER_ALL = '55';

const SCENES: readonly string[] = ['loading', 'sky', 'fall', 'roots', 'warp'];

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function createDirector(): StageDirector {
	const html = document.documentElement;
	const found = html.dataset.scene;
	let scene: SceneId =
		found !== undefined && SCENES.includes(found) ? (found as SceneId) : 'loading';
	let started = false;
	/** The transition in progress, if there is one. */
	let running: Promise<void> | null = null;
	/** The sky could not be made. */
	let noSky = false;
	let veilEl: HTMLElement | undefined;

	// ───────────────────────────────────────────────── the scroll model ──

	function jump(y: number): void {
		window.scrollTo({ left: 0, top: y, behavior: 'instant' });
	}

	/**
	 * Change the scene. The stylesheet collapses or restores the spacer from
	 * data-scene; this measures it either side and moves scrollTop by the
	 * difference before the browser paints, so what is on screen stays put.
	 */
	function setScene(to: SceneId): void {
		const from = scene;
		if (to === from) {
			html.dataset.scene = to;
			return;
		}
		const spacer = document.getElementById('sky-window');
		const before = spacer?.offsetHeight ?? 0;
		const y = window.scrollY;
		scene = to;
		html.dataset.scene = to;
		const after = spacer?.offsetHeight ?? 0;
		if (after !== before) jump(Math.max(0, y + after - before));
		document.dispatchEvent(
			new CustomEvent<SceneChangeDetail>(SCENE_EVENT, { detail: { from, to } }),
		);
	}

	// In the sky nothing may scroll the document: not a focused element, not a
	// link to a fragment, not the browser restoring an old position.
	window.addEventListener(
		'scroll',
		() => {
			const now = html.dataset.scene;
			if ((now === 'sky' || now === 'loading') && window.scrollY !== 0) jump(0);
		},
		{ passive: true },
	);

	// ───────────────────────────────────────────────────────── the parts ──

	/** A part, or nothing if it failed or is not here within `ms`. Never rejects. */
	function soon<K extends StagePart>(name: K, ms = PART_WAIT_MS): Promise<Stage[K] | undefined> {
		const here = get(name);
		if (here) return Promise.resolve(here);
		return Promise.race([when(name).catch(() => undefined), wait(ms).then(() => undefined)]);
	}

	/** Do something with a part if it exists. A part that throws must not stop a transition. */
	function tell<K extends StagePart>(name: K, fn: (part: Stage[K]) => void): void {
		const part = get(name);
		if (!part) return;
		try {
			fn(part);
		} catch (err) {
			console.error(`[cellestial] the ${name} threw`, err);
		}
	}

	/** Document Y of a landing spot in the Roots, in the layout as it is right now. */
	function anchor(which: Anchor): number {
		const roots = get('roots');
		if (roots) {
			try {
				const y = roots.anchorY(which);
				if (Number.isFinite(y)) return Math.max(0, y);
			} catch (err) {
				console.error('[cellestial] the roots threw', err);
			}
		}
		// The Roots' script is not there. The markup alone still has a top and a bottom.
		const ground = document.getElementById('roots');
		if (!ground) return 0;
		const top = ground.getBoundingClientRect().top + window.scrollY;
		return which === 'close' ? Math.max(top, html.scrollHeight - window.innerHeight) : top;
	}

	// A part that turns up after its scene has begun is brought in line with it.
	when('roots').then(
		() =>
			tell('roots', (roots) => {
				roots.setActive(scene === 'roots');
				if (scene === 'roots') roots.showGrown();
			}),
		() => {}, // the markup of the Roots is readable without its script
	);
	when('sky').then(
		() =>
			tell('sky', (sky) => {
				// Mounted, but its textures never came: that is no sky either.
				sky.ready.catch(loseSky);
				sky.setStill(reducedMotion());
				if (scene === 'roots') sky.setActive(false);
				else if (scene === 'sky') {
					// The scene began without it.
					sky.reset();
					sky.setActive(true);
				}
				// While the loader plays the sky is the loader's: introPrime() starts it.
			}),
		loseSky,
	);

	onMotionChange((reduced) => {
		tell('sky', (sky) => sky.setStill(reduced));
		// The device asked for stillness while the loader was playing.
		if (reduced && scene === 'loading') tell('loader', (loader) => loader.skip());
	});

	// ────────────────────────────────────────────────────────── arrivals ──
	//
	// Each of these is everything that makes the page one scene, done in a
	// single frame. They are the `swap` of every simple transition, and where
	// every full one must end.

	function arriveInRoots(at: Anchor): void {
		setScene('roots');
		jump(anchor(at)); // measured after the spacer went
		tell('sky', (sky) => sky.setActive(false));
		tell('roots', (roots) => {
			roots.setActive(true);
			roots.showGrown();
		});
	}

	function arriveInSky(): void {
		setScene('sky');
		jump(0);
		tell('roots', (roots) => roots.setActive(false));
		tell('sky', (sky) => {
			sky.restore();
			sky.reset();
			sky.setStill(reducedMotion());
			sky.setActive(true);
		});
	}

	/** The loader has handed over (or never ran, or let go). */
	function enterFromLoader(): void {
		if (scene !== 'loading') return;
		if (noSky) {
			arriveInRoots('top');
			return;
		}
		setScene('sky');
		jump(0);
		tell('roots', (roots) => roots.setActive(false));
		tell('sky', (sky) => {
			// After a finished hand-off this changes nothing: introProgress(1) is
			// reset()'s pose by contract. After an abandoned one it is the rescue.
			sky.reset();
			sky.setStill(reducedMotion());
			sky.setActive(true);
		});
	}

	/** The sky cannot be made: from here on the page is the Roots. */
	function loseSky(): void {
		if (noSky) return;
		noSky = true;
		html.dataset.noSky = '';
		if (scene === 'roots') return;
		// Mid-loader with nothing else going on, go gently. Otherwise at once:
		// whatever is running ends on the Roots.
		if (scene === 'loading' && !running) run(() => fade(() => arriveInRoots('top'), true));
		else arriveInRoots('top');
	}

	// ───────────────────────────────────────────────────── the simple form ──

	function veil(overAll: boolean): HTMLElement {
		if (!veilEl) {
			veilEl = document.createElement('div');
			veilEl.setAttribute('aria-hidden', 'true');
			// Styled here, not in a stylesheet: it must work whatever else failed.
			Object.assign(veilEl.style, {
				position: 'fixed',
				inset: '0',
				background: '#000',
				opacity: '0',
				pointerEvents: 'none',
			});
			document.body.append(veilEl);
		}
		veilEl.style.zIndex = overAll ? VEIL_Z_OVER_ALL : VEIL_Z;
		return veilEl;
	}

	/** A fade through black. `swap` runs while nothing can be seen. */
	function fade(swap: () => void | Promise<void>, overAll = false): Promise<void> {
		return fadeThrough(veil(overAll), swap, FADE_MS, FADE_MS);
	}

	/**
	 * Opening straight on the sky (reduced motion, or ?scene=sky): there is no
	 * loader to hold the screen, so the page stays black until the sky has a
	 * frame to show, then comes up out of it. index.astro paints the black
	 * from the first frame (html[data-opening]); this takes it over.
	 */
	async function openOnSky(): Promise<void> {
		const cover = veil(true);
		cover.style.opacity = '1';
		cover.style.pointerEvents = 'auto';
		delete html.dataset.opening; // black to black: nothing to see
		// A sky that is lost is dealt with where it is lost; here it only ends the wait.
		const ready = when('sky')
			.then((sky) => sky.ready)
			.catch(() => {});
		await Promise.race([ready, wait(SKY_WAIT_MS)]);
		try {
			await tween(
				OPEN_MS,
				(k) => {
					cover.style.opacity = String(1 - k);
				},
				easeOut,
			);
		} finally {
			cover.style.opacity = '0';
			cover.style.pointerEvents = 'none';
		}
	}

	// ══════════════════════════════════════════════════════════════════════
	//  THE FULL CHOREOGRAPHY                                 (motion on only)
	//
	//  These three are where D1, D2, G2 and C4 go. Each is called inside
	//  run(), so nothing else can start while it plays, and only when motion
	//  is on: reduced motion never reaches them. Each must END exactly as its
	//  simple form does, by way of the same arrival, so that whatever came
	//  before, the page is left in one well-defined scene.
	//
	//  The tools, all in this closure:
	//    setScene(id)        changes the scene and keeps the view still while
	//                        the spacer comes or goes
	//    jump(y)             scrollTop, at once. In 'fall' and 'warp' the
	//                        visitor cannot scroll, and this still can
	//    soon(part)          a part, or undefined if it never arrived
	//    tell(part, fn)      call into a part that may be missing or may throw
	//    arriveInRoots(at)   arriveInSky()
	//    fade(swap)          the simple form, for when a part is missing
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * D1 + D2. B11 was pressed: every star falls, one meets the soil, and the
	 * Roots grow from where it struck. To be written; until then the fade.
	 *
	 *   const [sky, roots, fx] = await Promise.all([soon('sky'), soon('roots'), soon('fx')]);
	 *   if (!sky || !roots) return fade(() => arriveInRoots('top'));
	 *   setScene('fall');                  // the soil is now visible under the fold
	 *   roots.setActive(true);
	 *   const drop = document.getElementById('sky-window').offsetHeight;
	 *   let grown: Promise<void> | undefined;
	 *   await Promise.all([
	 *     sky.fall({
	 *       groundY: () => roots.surfaceY(),
	 *       onImpact: (x) => {
	 *         fx?.impact(x, roots.surfaceY());
	 *         grown = roots.growFrom(x);
	 *       },
	 *     }),
	 *     tween(ms, (k) => jump(drop * k), easeIn),   // the soil rises into the frame
	 *   ]);
	 *   setScene('roots');                 // spacer gone, scrollTop corrected: no jump
	 *   sky.setActive(false);
	 *   await grown;
	 */
	async function fall(): Promise<void> {
		await fade(() => arriveInRoots('top'));
	}

	/**
	 * G2. E6 was pressed, or a star was just claimed from the ground: launch
	 * back up to the sky. To be written; until then the fade.
	 *
	 *   const [sky, fx] = await Promise.all([soon('sky'), soon('fx')]);
	 *   if (!sky || !fx) return fade(arriveInSky);
	 *   setScene('warp');                  // spacer back, scrollTop corrected: no jump
	 *   sky.restore(); sky.reset(); sky.setActive(true);
	 *   const from = window.scrollY;
	 *   await Promise.all([fx.warp(ms), tween(ms, (k) => jump(from * (1 - k)), easeIn)]);
	 *   setScene('sky');
	 *   tell('roots', (roots) => roots.setActive(false));
	 */
	async function warp(): Promise<void> {
		await fade(arriveInSky);
	}

	/**
	 * C4. A menu teleport: the effects layer plays the circuit flash and calls
	 * `swap` at its peak. Whatever the effect does, `swap` runs exactly once.
	 */
	async function flash(swap: () => void, dir: Felt): Promise<void> {
		const fx = await soon('fx');
		if (!fx) return fade(swap);
		let swapped = false;
		const once = () => {
			if (swapped) return;
			swapped = true;
			swap();
		};
		try {
			await fx.teleportFlash(once, dir);
		} catch (err) {
			console.error('[cellestial] the teleport flash failed', err);
		} finally {
			once(); // the visitor arrives, effect or no effect
		}
	}

	// ─────────────────────────────────────────────────────── transitions ──

	/** Run a transition, unless one is running: then the request is ignored. */
	function run(job: () => Promise<void>): Promise<void> {
		if (running) return Promise.resolve();
		const mine = job()
			.catch((err) => console.error('[cellestial] a transition failed', err))
			.finally(() => {
				if (running === mine) running = null;
			});
		running = mine;
		return mine;
	}

	/** Asked to go somewhere while the loader plays: that skips it, as any key does. */
	async function pastLoader(): Promise<void> {
		if (scene !== 'loading') return;
		const loader = await soon('loader');
		if (loader) {
			try {
				loader.skip();
				await Promise.race([loader.done, wait(LOADER_WAIT_MS)]);
			} catch (err) {
				console.error('[cellestial] the loader threw', err);
			}
		}
		enterFromLoader();
	}

	const toRoots = () => (reducedMotion() ? fade(() => arriveInRoots('top')) : fall());
	const toSky = () => (reducedMotion() ? fade(arriveInSky) : warp());
	const teleport = (swap: () => void, dir: Felt) =>
		reducedMotion() ? fade(swap) : flash(swap, dir);

	/** Which way a jump inside the Roots feels. */
	function felt(toY: number): Felt {
		const d = toY - window.scrollY;
		return d > 2 ? 'down' : d < -2 ? 'up' : 'none';
	}

	// ───────────────────────────────────────────────────────────── focus ──

	/** Put keyboard focus on a region, so reading and tabbing go on from there. */
	function focusOn(id: 'sky-ui' | 'roots'): void {
		const region = document.getElementById(id);
		if (!region) return;
		if (!region.hasAttribute('tabindex')) region.setAttribute('tabindex', '-1');
		region.focus({ preventScroll: true });
	}

	function focusClose(which: 'claim' | 'contact'): void {
		const roots = get('roots');
		if (roots) {
			try {
				roots.focusClose(which);
				return;
			} catch (err) {
				console.error('[cellestial] the roots threw', err);
			}
		}
		const trigger = which === 'claim' ? '[data-open-claim]' : '[data-open-contact]';
		document.querySelector<HTMLElement>(`#roots ${trigger}`)?.focus();
	}

	// "Skip to content" (Base.astro) points at #main, which sits where the
	// ground begins. In the sky that would scroll a page that must not scroll,
	// so here it means: the content of the scene the visitor is in.
	document.addEventListener('click', (event) => {
		if (event.defaultPrevented || !(event.target instanceof Element)) return;
		if (!event.target.closest('a[href="#main"]')) return;
		event.preventDefault();
		if (scene === 'roots') {
			jump(anchor('top'));
			focusOn('roots');
		} else if (scene === 'sky') focusOn('sky-ui');
	});

	// ────────────────────────────────────────────────────── the Director ──

	return {
		get scene() {
			return scene;
		},
		get reducedMotion() {
			return reducedMotion();
		},

		start(at) {
			if (started) return;
			started = true;
			try {
				history.scrollRestoration = 'manual'; // a reload opens on the sky, at the top
			} catch {
				// Not allowed here. The scroll guard above covers it.
			}
			scene = at;
			html.dataset.scene = at;
			jump(0);
			if (at === 'loading') {
				when('loader')
					.then((loader) => loader.done)
					.catch((err) => console.error('[cellestial] the loader failed', err))
					.then(enterFromLoader);
			} else if (at === 'sky') {
				// Counts as a transition: nothing else starts until the page is up.
				run(openOnSky);
			}
			// On the Roots there is nothing to do: the parts fall in line as they arrive.
		},

		go(dest: Destination) {
			return run(async () => {
				await pastLoader();
				if (dest === 'sky') {
					if (noSky || !(await soon('sky'))) return;
					await teleport(arriveInSky, scene === 'roots' ? 'up' : 'none');
					focusOn('sky-ui');
					return;
				}
				await soon('roots');
				const at: Anchor = dest === 'build' ? 'top' : 'close';
				const dir: Felt = scene === 'roots' ? felt(anchor(at)) : 'down';
				await teleport(() => arriveInRoots(at), dir);
				if (dest === 'build') focusOn('roots');
				else focusClose(dest);
				// "Contact me" lands on the bottom buttons, then the message box opens.
				if (dest === 'contact') (await soon('claimFlow'))?.openContact();
			});
		},

		descend() {
			return run(async () => {
				if (scene !== 'sky') return;
				await soon('roots');
				await toRoots();
				focusOn('roots');
			});
		},

		ascend() {
			return run(async () => {
				if (scene !== 'roots' || noSky || !(await soon('sky'))) return;
				await toSky();
				focusOn('sky-ui');
			});
		},

		async showStar(slot) {
			// Unlike the rest, this waits its turn: it follows a send.
			while (running) await running;
			return run(async () => {
				await pastLoader();
				const sky = noSky ? undefined : await soon('sky');
				if (!sky) return; // the star is lit all the same; there is no sky to show it in
				if (scene !== 'sky') {
					await toSky();
					focusOn('sky-ui');
				}
				await sky.focusStar(slot, { ignite: true });
			});
		},
	};
}
