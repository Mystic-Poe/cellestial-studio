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
import {
	easeIn,
	easeOut,
	fadeThrough,
	lerp,
	onFrame,
	onMotionChange,
	reducedMotion,
	tween,
} from './motion.ts';
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
/** D1: the soil rises this far into the frame, as a share of the screen, to meet the stars. */
const FALL_MEET = 0.32;
/** D1: how long that rise takes. The first star strikes about half way through it, the last as it ends. */
const FALL_RISE_MS = 900;
/** D2: then the view follows the growth down to the top of the ground. */
const FALL_FOLLOW_MS = 1200;
/** D2: the ground line is held this far down the effects canvas (a share of the screen) while bursts play. */
const FALL_BURST_LINE = 0.45;
/** D2: how long a burst lasts, with a frame to spare (the effects layer's own figure is 760 ms). */
const FALL_BURST_MS = 800;
/** After the fall the growth is given this long to pass the first node before focus moves. */
const GROWTH_WAIT_MS = 1500;
/** G2: the whole launch back to the sky. */
const WARP_MS = 1500;
/** G2: where in the warp the frame is covered, if the effects layer cannot say. */
const WARP_COVER_DEFAULT = 0.7;
/**
 * G2: the page becomes the sky this much of the warp before the middle of its
 * cover, in the first frame the cover is whole, so that a slow frame still
 * lands inside it.
 */
const WARP_LEAD = 0.04;
/** G2: with no frames coming (a hidden tab) the swap is made by a timer, this late. */
const WARP_LATE_MS = 250;
/** The veil sits over the effects layer (30) and under the chrome (40): the logo stays. */
const VEIL_Z = '35';
/** Or over everything, the loader (50) included. */
const VEIL_Z_OVER_ALL = '55';

const SCENES: readonly string[] = ['loading', 'sky', 'fall', 'roots', 'warp'];

/** A curve from 0 to 1 that leaves at slope `a` and arrives at slope `b` (a cubic Hermite). */
const hermite =
	(a: number, b: number) =>
	(k: number): number =>
		3 * k * k - 2 * k * k * k + a * (k * k * k - 2 * k * k + k) + b * (k * k * k - k * k);
/** D2: the follow leaves at this slope, so the ground is already moving when it begins. */
const FOLLOW_SLOPE = 0.5;
/** D1: the rise starts from rest and arrives at the speed the follow leaves at. */
const riseOn = hermite(
	0,
	(FOLLOW_SLOPE * (1 - FALL_MEET) * FALL_RISE_MS) / (FALL_FOLLOW_MS * FALL_MEET),
);
/** D2: the follow carries that speed on and comes to rest on the top of the ground. */
const followOn = hermite(FOLLOW_SLOPE, 0);

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
	 * D1 + D2. B11 was pressed: every star falls, the soil rises into the bottom
	 * of the frame to meet them, the first to reach it strikes, and the view
	 * follows the light down until the top of the ground is the top of the
	 * screen. It ends where arriveInRoots('top') ends, with one difference: the
	 * mycelium is left growing, not shown whole.
	 *
	 * The sky is a fixed canvas under the ground, so a star that passes the
	 * soil's edge is behind it. The effects layer is fixed too, so while its
	 * burst plays its canvas is carried along with the ground it struck.
	 */
	async function fall(): Promise<void> {
		const [sky, roots] = await Promise.all([soon('sky'), soon('roots'), soon('fx')]);
		const spacer = document.getElementById('sky-window');
		if (!sky || !roots || !spacer || noSky) return fade(() => arriveInRoots('top'));

		setScene('fall'); // the ground is on stage, under the fold; only this file can scroll
		jump(0);
		tell('roots', (ground) => ground.setActive(true)); // bare soil, waiting to be struck

		const surface = (): number => {
			try {
				const y = roots.surfaceY();
				if (Number.isFinite(y)) return y;
			} catch (err) {
				console.error('[cellestial] the roots threw', err);
			}
			return window.innerHeight;
		};
		const burst = document.getElementById('fx-canvas');
		/** The first star has struck: the growth is set off once. */
		let struck = false;
		let grown: Promise<void> | undefined;
		// The effects canvas is fixed and the ground is moving, so from the first
		// strike the canvas is carried with the ground: the ground line is held
		// at one height of the canvas (`line`), with room over it for the sparks
		// and room under it for the light driven into the soil, wherever the
		// ground is on the screen by then. Every burst is drawn at that height.
		let line = -1;
		let lastStrike = 0;
		const carry = (): void => {
			if (burst && line >= 0) burst.style.transform = `translateY(${surface() - line}px)`;
		};
		/** A star meets the ground: its burst, where it lands. All alike. */
		const strike = (x: number, size: number): void => {
			if (line < 0) line = Math.min(surface(), window.innerHeight * FALL_BURST_LINE);
			carry();
			lastStrike = performance.now();
			tell('fx', (fx) => fx.impact(x, line, size));
		};
		let landed = 0;
		const onLand = (x: number, size: number): void => {
			if (scene !== 'fall') return;
			landed++;
			strike(x, size);
		};
		const onImpact = (x: number): void => {
			if (scene !== 'fall' || struck) return;
			struck = true;
			if (landed === 0) strike(x, 1); // a sky that does not say where each star lands
			tell('roots', (ground) => {
				grown = ground.growFrom(x);
			});
		};
		const scrollTo = (share: number): void => {
			if (scene !== 'fall') return; // the sky was lost meanwhile: the page is the Roots already
			jump(spacer.offsetHeight * share);
			carry();
		};

		try {
			// Not awaited: it is over when the last star is behind the soil, and
			// restore() ends it in any case.
			Promise.resolve(sky.fall({ groundY: surface, onImpact, onLand })).catch((err) =>
				console.error('[cellestial] the sky threw', err),
			);
		} catch (err) {
			console.error('[cellestial] the sky threw', err);
		}
		try {
			// One motion, not two: the ground is still rising when the last stars
			// land on it and goes straight on up the screen, never standing still
			// (the two curves meet at the same speed).
			await tween(FALL_RISE_MS, (k) => scrollTo(FALL_MEET * k), riseOn);
			await tween(FALL_FOLLOW_MS, (k) => scrollTo(lerp(FALL_MEET, 1, k)), followOn);
		} finally {
			// The last bursts are still dying on the ground they struck: the canvas
			// stays with it (the visitor can scroll by now) until they are over.
			const stop = onFrame(() => {
				if (line >= 0 && performance.now() - lastStrike < FALL_BURST_MS) return carry();
				stop();
				if (burst) burst.style.transform = '';
			});
		}
		if (scene !== 'fall') return;

		setScene('roots'); // spacer gone, scrollTop corrected in the same frame: nothing moves
		jump(anchor('top'));
		tell('sky', (above) => {
			above.setActive(false);
			above.restore(); // unseen: on the ground the sky is not on stage
		});
		tell('roots', (ground) => ground.setActive(true));
		if (grown) await Promise.race([grown.catch(() => {}), wait(GROWTH_WAIT_MS)]);
		else tell('roots', (ground) => ground.showGrown()); // nothing struck: it is simply there
	}

	/**
	 * G2. E6 was pressed, or a star was just claimed from the ground: launch
	 * back up to the sky. The effects layer plays the warp; under it the ground
	 * drops away, faster and faster, with the sky's opening pose already drawn
	 * behind it, and in the first frame in which the warp covers everything the
	 * page becomes the sky (arriveInSky). Wall-clock time throughout, as the
	 * effects layer keeps it, and the swap is made in a frame callback, before
	 * that frame is painted, so it cannot be seen even when frames are slow.
	 */
	async function warp(): Promise<void> {
		const [sky, fx] = await Promise.all([soon('sky'), soon('fx')]);
		if (!sky || !fx || noSky) return fade(arriveInSky);
		const cover = await import('./fx/index.ts').then(
			(layer) => layer.WARP_COVER,
			() => WARP_COVER_DEFAULT,
		);

		setScene('warp'); // spacer back, scrollTop corrected in the same frame: nothing moves
		tell('sky', (above) => {
			// One frame of the opening pose, to be seen above the falling ground.
			// It is not set going until the page is the sky: the launch has the frame.
			above.restore();
			above.reset();
		});
		const from = window.scrollY;
		const t0 = performance.now();
		const until = WARP_MS * Math.max(0.1, cover - WARP_LEAD);
		let covered = (): void => {};
		const swapTime = new Promise<void>((resolve) => {
			covered = resolve;
		});
		const stop = onFrame(() => {
			const t = performance.now() - t0;
			if (scene === 'warp') jump(from * (1 - easeIn(Math.min(1, t / until))));
			if (t >= until || scene !== 'warp') covered();
		});
		const played = Promise.resolve()
			.then(() => fx.warp(WARP_MS))
			.catch((err) => console.error('[cellestial] the warp failed', err));
		try {
			await Promise.race([swapTime, wait(until + WARP_LATE_MS), played]);
		} finally {
			stop();
		}
		if (scene === 'warp') arriveInSky(); // under the cover
		await played;
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
