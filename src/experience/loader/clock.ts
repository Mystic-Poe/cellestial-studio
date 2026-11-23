// The loader's clock: the arithmetic of how long a run takes, and nothing
// else, so that it can be played through in a test (../loader-clock.test.ts).
// index.ts counts the frames and draws.
//
// The clock is the visitor's. It starts when the loader's picture is first
// SEEN. On a fast line that is the canvas's own first frame, a moment after
// the mount. On a slow line it is the unlit C of the server's markup, which
// stands there until the script has arrived and then until the other pictures
// have: all of that is time the visitor has spent looking at the loader, and
// all of it counts. What does not count is the time before there was anything
// to look at: the browser reports its first paint when the page's first
// content is painted, and on a slow line that can be a second before the
// unlit C is on screen (the page shows it only when its file is whole, never
// half-drawn). So the clock takes the later of the two: firstSeen().
//
// The owner's rule is "6 to 8 s, never under 6". The plan is 7.1 s. A run that
// is behind its plan may end up to LATE past it (7.5 s); to get there it
// plays its hand-off faster (down to HANDOFF_MIN) and hurries its script (by
// at most HURRY_MAX). Whatever it gives back, it never ends under FLOOR
// seconds on the visitor's clock.

import { FLOOR, HANDOFF, HANDOFF_MIN, HURRY_MAX, LATE, type Script, SETTLE } from './timeline.ts';

/**
 * The most of the wait before the mount that is counted, in seconds. Past
 * about two and a half the run is already as hurried as it gets and more
 * changes nothing; the cap is only there against a time that makes no sense.
 */
export const WAIT_CREDIT = 4;
/** Where the first paint came after the mount, at most this much is taken off the clock. */
export const LEAD_MAX = 2;
/** The floor is kept with this much to spare, for the frame the run ends on. */
export const FLOOR_SPARE = 0.05;

const known = (v: number | null): v is number => v !== null && Number.isFinite(v);

/**
 * When the loader's picture was first seen, in ms on performance.now()'s
 * clock, or null if nothing of it has been seen yet. `posterAt` is when the
 * page showed the server's unlit C (the markup's script notes the frame),
 * `canvasAt` when the canvas first drew: the earlier of the two is the first
 * sight of it. `paintAt` is the browser's first-contentful-paint: nothing can
 * have been seen before that, so where it is the later, it is the answer
 * (on a fast line it is the same frame, reported when it reached the glass).
 * Until the browser has reported a paint nothing counts as seen, as before
 * round 3: at the mount on a fast line that is the usual case, and a browser
 * that never reports one gets the run from its mount.
 */
export function firstSeen(
	paintAt: number | null,
	posterAt: number | null,
	canvasAt: number | null,
): number | null {
	let shown: number | null = null;
	if (known(posterAt)) shown = posterAt;
	if (known(canvasAt) && (shown === null || canvasAt < shown)) shown = canvasAt;
	if (shown === null || !known(paintAt)) return null;
	return Math.max(paintAt, shown);
}

/**
 * Seconds the loader's picture had been on screen when the script mounted:
 * the first paint (`paintAt`, ms, or null if the browser has not said) to the
 * mount (`mountedAt`, ms on the same clock). 0 if the mount came first.
 */
export function waitedBefore(mountedAt: number, paintAt: number | null): number {
	if (paintAt === null || !Number.isFinite(paintAt) || !Number.isFinite(mountedAt)) return 0;
	return Math.max(0, Math.min(WAIT_CREDIT, (mountedAt - paintAt) / 1000));
}

/**
 * Seconds from the mount to the first paint, where the script was there
 * first: the visitor's clock started that much after the loader's. 0 if the
 * paint came first, or is not known.
 */
export function paintedAfter(mountedAt: number, paintAt: number | null): number {
	if (paintAt === null || !Number.isFinite(paintAt) || !Number.isFinite(mountedAt)) return 0;
	return Math.max(0, Math.min(LEAD_MAX, (paintAt - mountedAt) / 1000));
}

/** The plan: the script at its tempo, then the hand-off. Seconds. */
export const planFor = (script: Script): number => script.end / script.tempo + HANDOFF;

/**
 * Seconds of script to a second on the clock, now: the tempo, and more when
 * the run is late. `t` is the second of the script on screen, `wall` the
 * seconds the picture has been on screen.
 */
export function paceAt(script: Script, t: number, wall: number, skipped: boolean): number {
	const left = script.end - t;
	if (left <= 0) return 1; // the finished wordmark waits in real seconds
	if (skipped) return script.tempo;
	// The latest the script may end and the hand-off still fit: hurry only past that.
	const room = planFor(script) + LATE - HANDOFF_MIN - wall;
	const top = script.tempo * HURRY_MAX;
	if (room <= 0) return top;
	return Math.max(script.tempo, Math.min(top, left / room));
}

/**
 * How long this run's hand-off takes, in seconds. A run that is behind gives
 * the time back here, as far as the hand-off can. `wall` and `seen` are now,
 * as the hand-off begins: the seconds the picture has been on screen as the
 * loader counts them, and on the visitor's clock (the same, less any moment
 * between the mount and the first paint). `skippedAt` is `wall` at the skip,
 * or -1.
 */
export function handoffLength(
	script: Script,
	wall: number,
	seen: number,
	skippedAt: number,
): number {
	const due = skippedAt >= 0 ? skippedAt + SETTLE + HANDOFF : planFor(script) + LATE;
	let length = Math.max(HANDOFF_MIN, Math.min(HANDOFF, due - wall));
	// Never under the floor, first paint to done, for a full play that was not skipped.
	if (script.mode === 'full' && skippedAt < 0) {
		length = Math.max(length, FLOOR + FLOOR_SPARE - seen);
	}
	return length;
}
