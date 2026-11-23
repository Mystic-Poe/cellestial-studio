// The loader's clock (loader/clock.ts) is the visitor's: it starts at the
// first paint of the loader's picture, not at the script's mount. The owner's
// rule: "Loading 6-8 s (never under 6)". Round 2 found the picture on screen
// 8.0 to 8.2 s on a slow line. These runs are played frame by frame as
// loader/index.ts plays them, with the same arithmetic.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	FLOOR_SPARE,
	firstSeen,
	handoffLength,
	paceAt,
	paintedAfter,
	planFor,
	WAIT_CREDIT,
	waitedBefore,
} from './loader/clock.ts';
import { FLOOR, FULL, HANDOFF, HANDOFF_MIN, LATE } from './loader/timeline.ts';

/** As in loader/index.ts. */
const STEP_MAX = 0.08;
const WALL_STEP_MAX = 1;
const POSTER_CREDIT = 0.25;

interface Visit {
	/** First paint to the script's mount, seconds. Negative: the script was there first. */
	wait: number;
	/** The mount to the pictures being in, seconds. */
	pictures: number;
	/** Seconds between frames. */
	frame?: number;
	/** One frame this long (seconds) in the middle of the script. */
	stall?: number;
	/** The sky is ready this long after the mount. */
	sky?: number;
}

/** A full first visit, never skipped. Returns the seconds from the first paint to done, and from the mount. */
function visit(v: Visit): { seen: number; fromMount: number; handoff: number; hurry: number } {
	const frame = v.frame ?? 1 / 60;
	const paintAt = 1000;
	const mountedAt = paintAt + v.wait * 1000;
	// At the mount the browser knows of a paint only if it has happened.
	const credit = waitedBefore(mountedAt, v.wait >= 0 ? paintAt : null);
	const lead = credit === 0 ? paintedAfter(mountedAt, paintAt) : 0;
	let wall = credit;
	let sinceMount = 0;
	let t = -1; // the pictures are not in yet
	let u = -1; // not handing off yet
	let handoff = 0;
	let hurry = 1;
	let stalled = false;
	for (let i = 0; i < 100000; i++) {
		let ms = frame;
		if (v.stall && !stalled && t > 3) {
			stalled = true;
			ms = v.stall;
		}
		sinceMount += ms;
		const dt = Math.min(STEP_MAX, ms);
		wall += Math.min(WALL_STEP_MAX, ms);
		if (t < 0) {
			if (sinceMount >= v.pictures) t = Math.min(wall * FULL.tempo, POSTER_CREDIT);
			continue;
		}
		if (u < 0) {
			const pace = paceAt(FULL, t, wall, false);
			hurry = Math.max(hurry, pace / FULL.tempo);
			t += dt * pace;
			if (t >= FULL.end && sinceMount >= (v.sky ?? 0)) {
				handoff = handoffLength(FULL, wall, wall - lead, -1);
				u = 0;
			}
			continue;
		}
		u += (dt * HANDOFF) / handoff;
		if (u >= HANDOFF) return { seen: sinceMount + v.wait, fromMount: sinceMount, handoff, hurry };
	}
	throw new Error('the run never ended');
}

test('a fast line: the script is there before the first paint, and the run is the plan', () => {
	for (const lead of [0.02, 0.035, 0.17]) {
		const r = visit({ wait: -lead, pictures: 0.03 });
		assert.ok(Math.abs(r.fromMount - planFor(FULL)) < 0.05, `from the mount ${r.fromMount}`);
		assert.ok(r.seen > 6.9 && r.seen < 7.15, `on the visitor's clock ${r.seen}`);
		assert.equal(r.hurry, 1);
		assert.ok(Math.abs(r.handoff - HANDOFF) < 1e-9);
	}
});

test("slow 4G as measured (the script a second after the first paint, the pictures a second after that): 7.5 s on the visitor's clock", () => {
	// Round 2, with the pictures asked for by the markup: first paint 0.80 s, mount 1.92 s, pictures 2.95 s.
	const r = visit({ wait: 1.12, pictures: 1.03 });
	assert.ok(Math.abs(r.seen - (planFor(FULL) + LATE)) < 0.05, `on the visitor's clock ${r.seen}`);
	assert.ok(r.seen >= 6 && r.seen <= 7.9);
	// And with the CPU slowed as well.
	const s = visit({ wait: 1.14, pictures: 1.13, frame: 1 / 30 });
	assert.ok(s.seen >= 6 && s.seen <= 7.9, `slowed: ${s.seen}`);
});

test('whatever came late before the script began, it is given back while the means last', () => {
	// The run can give back LATE, the hand-off's 0.4 s, and 35% of the script: it ends
	// planned + LATE after the first paint for any wait up to about 2.4 s in all.
	for (let wait = 0; wait <= 2.4; wait += 0.1) {
		for (let pictures = 0.02; wait + pictures <= 2.4; pictures += 0.1) {
			const r = visit({ wait, pictures });
			assert.ok(
				r.seen <= planFor(FULL) + LATE + 0.05,
				`wait ${wait.toFixed(1)}, pictures ${pictures.toFixed(2)}: ${r.seen.toFixed(2)} s on the visitor's clock`,
			);
			assert.ok(
				r.seen >= FLOOR,
				`wait ${wait.toFixed(1)}, pictures ${pictures.toFixed(2)}: ${r.seen}`,
			);
			assert.ok(r.handoff >= HANDOFF_MIN - 1e-9);
		}
	}
});

test('the wait before the mount counts whole: a late script with its pictures already in is not played out from the mount', () => {
	// The script 2 s after the first paint, the pictures there with it: before round 2 only 1 s
	// of that wait counted and the floor was kept from the mount, so the run ended 8 s after
	// the first paint. It is the visitor's 7.5.
	const r = visit({ wait: 2, pictures: 0.05 });
	assert.ok(r.seen <= 7.6, `on the visitor's clock ${r.seen}`);
	assert.ok(r.seen >= FLOOR);
	assert.ok(WAIT_CREDIT >= 2.5);
});

test("never under 6 s on the visitor's clock, whatever the line, the frames or the stall", () => {
	for (const wait of [-1.5, -0.4, -0.17, -0.035, 0, 0.3, 0.9, 1.5, 2.2, 3, 5, 9]) {
		for (const pictures of [0.02, 0.3, 1, 2.1, 4]) {
			for (const frame of [1 / 120, 1 / 60, 1 / 30, 1 / 12]) {
				for (const stall of [0, 0.5, 1, 3]) {
					const r = visit({ wait, pictures, frame, stall });
					assert.ok(
						r.seen >= FLOOR,
						`wait ${wait}, pictures ${pictures}, frames ${frame.toFixed(3)}, stall ${stall}: ${r.seen.toFixed(3)} s on the visitor's clock`,
					);
					assert.ok(
						r.handoff >= HANDOFF_MIN - 1e-9 && r.handoff <= Math.max(HANDOFF, FLOOR + FLOOR_SPARE),
					);
					assert.ok(r.hurry <= 1.35 + 1e-9);
				}
			}
		}
	}
});

test("the floor is the visitor's: where the script came first, the moment before the first paint is not counted", () => {
	// A run that is far behind (long stalls) hurries all it can; its floor is 6 s from the paint, not from the mount.
	const r = visit({ wait: -0.17, pictures: 0.02, stall: 1 });
	assert.ok(r.seen >= FLOOR, `${r.seen}`);
	assert.equal(waitedBefore(1000, null), 0);
	assert.equal(waitedBefore(1000, 1500), 0);
	assert.equal(waitedBefore(2500, 1000), 1.5);
	assert.equal(waitedBefore(99000, 1000), WAIT_CREDIT);
	assert.equal(paintedAfter(1000, null), 0);
	assert.equal(paintedAfter(1000, 900), 0);
	assert.ok(Math.abs(paintedAfter(1000, 1170) - 0.17) < 1e-12);
	assert.equal(waitedBefore(Number.NaN, 1000), 0);
});

test("the clock starts when the unlit C is first SEEN: the later of the browser's first paint and the frame the page showed it in", () => {
	// Slow 4G as the third look measured it: the browser's first paint at 0.8 s (nothing of the C
	// yet), the C on screen a second later. The visitor's clock starts at the second, not the first.
	assert.equal(firstSeen(800, 1800, null), 1800);
	// A fast line: the page shows the C in the frame the browser then reports as its first paint.
	assert.equal(firstSeen(88, 74, null), 88);
	// The canvas drew before the server's picture was shown (the script was there first).
	assert.equal(firstSeen(88, null, 80), 88);
	assert.equal(firstSeen(88, 120, 80), 88);
	assert.equal(firstSeen(60, 300, 200), 200);
	// Painted, but nothing of the loader's picture shown yet: nothing has been seen.
	assert.equal(firstSeen(800, null, null), null);
	assert.equal(firstSeen(null, null, null), null);
	// The browser has not reported a paint (yet, or ever): nothing counts as seen, as before round 3.
	assert.equal(firstSeen(null, 1800, null), null);
	assert.equal(firstSeen(null, 1800, 1700), null);
	assert.equal(firstSeen(Number.NaN, 1800, null), null);
	assert.equal(firstSeen(800, Number.NaN, null), null);
});

test('a slow line on the new clock: the wait counted is the wait since the C was seen, and the run is 6 to 8 s from there', () => {
	// The mount 0.3 s after the C was first seen, the pictures 1.2 s after the mount.
	const paint = 800;
	const poster = 1500;
	const mount = 1800;
	assert.equal(waitedBefore(mount, firstSeen(paint, poster, null)), 0.3);
	// Before round 3 the black second before the C counted too.
	assert.equal(waitedBefore(mount, paint), 1);
	const r = visit({ wait: 0.3, pictures: 1.2 });
	assert.ok(r.seen >= FLOOR && r.seen <= planFor(FULL) + LATE + 0.05, `${r.seen}`);
	// The script outran the unlit C: nothing had been seen at the mount, and the moment until it is
	// seen is not on the visitor's clock.
	assert.equal(waitedBefore(mount, firstSeen(paint, null, null)), 0);
	assert.ok(Math.abs(paintedAfter(mount, firstSeen(paint, 2100, null)) - 0.3) < 1e-12);
});
