// The flight (G1) as numbers: one position along the path, one velocity,
// and the rules that move them. No DOM and no rendering, so it can be run
// and tested on its own.
//
//   thrust  input is arriving: the speed is pulled towards cruise, and the
//           longer the input goes on the further towards the maximum
//   glide   the input has stopped: one smooth curve from the speed it had
//           to a standstill exactly on a station
//   rest    standing at a station
//   halt    stopped dead by a tap, wherever that was; no settling
//
// A glide is a quintic in time: it starts with the velocity the flight had,
// with no jolt (zero acceleration), and arrives with zero velocity and zero
// acceleration. That is what "settles softly" is here.

import { FLIGHT } from './config.ts';
import { clamp, smooth } from './layout.ts';

export type FlightMode = 'rest' | 'thrust' | 'glide' | 'halt';

/** What the flight needs to know about the world: where the stations are. */
export interface Stations {
	station(k: number): number;
	nearestStation(pos: number): number;
}

export interface Flight {
	/** Distance flown along the path. Forward (Virgo towards Libra) is up. */
	readonly pos: number;
	readonly vel: number;
	readonly mode: FlightMode;
	/** 0 at cruise, 1 at the maximum: how far continued input has built the speed. */
	readonly boost: number;
	/** The station a glide is heading for, else null. */
	readonly target: number | null;
	/**
	 * One input event (a wheel tick, a swipe sample) in a direction: +1 forward, -1 back.
	 * The input counts as continuing for `linger` seconds after it (FLIGHT.hold if left out).
	 */
	push(dir: 1 | -1, linger?: number): void;
	/** A key went down: input in that direction until release(). */
	hold(dir: 1 | -1): void;
	release(): void;
	/** Stop dead, here. */
	halt(): void;
	/** Stand at `pos`, at rest. */
	place(pos: number): void;
	/** Glide to station `k` in `seconds`, from whatever it is doing. */
	glideTo(k: number, seconds: number): void;
	/** Swap the stations (the viewport changed) without moving. */
	rebase(stations: Stations, pos: number): void;
	/** Advance by `dt` seconds. True while it is moving or about to. */
	step(dt: number): boolean;
}

export function createFlight(initial: Stations, start = 0): Flight {
	let stations = initial;
	let pos = start;
	let vel = 0;
	let mode: FlightMode = 'rest';
	let boost = 0;
	let time = 0;
	let dir: 1 | -1 = 1;
	let held: 0 | 1 | -1 = 0;
	let lastInput = -Infinity;
	let target: number | null = null;
	// The glide in flight: from x0 with v0 at t0, by `span` in `T` seconds.
	let x0 = 0;
	let v0 = 0;
	let t0 = 0;
	let span = 0;
	let T = 1;

	const startGlide = (k: number, seconds: number) => {
		target = k;
		x0 = pos;
		v0 = vel;
		t0 = time;
		span = stations.station(k) - pos;
		T = Math.max(0.05, seconds);
		mode = 'glide';
	};

	const settle = () => {
		const speed = Math.abs(vel);
		const sign = speed > 0.02 ? Math.sign(vel) : dir;
		// Far enough ahead to stop over FLIGHT.decel without braking hard.
		const need = Math.max(1e-4, (speed * FLIGHT.decel) / 2);
		let k = stations.nearestStation(pos + sign * need);
		while (sign * (stations.station(k) - pos) < need) k += sign;
		while (sign * (stations.station(k - sign) - pos) >= need) k -= sign;
		const dist = Math.abs(stations.station(k) - pos);
		const natural = speed > 1e-6 ? (2 * dist) / speed : Infinity;
		const seconds = Math.max(FLIGHT.glideMin, Math.min(natural, dist / FLIGHT.glideSpeed + 0.5));
		startGlide(k, seconds);
	};

	return {
		get pos() {
			return pos;
		},
		get vel() {
			return vel;
		},
		get mode() {
			return mode;
		},
		get boost() {
			return boost;
		},
		get target() {
			return target;
		},
		push(d, linger = FLIGHT.hold) {
			if (d !== dir && held === 0) boost = 0;
			dir = d;
			// Never shorten what an earlier push is still owed.
			lastInput = Math.max(lastInput, time + linger - FLIGHT.hold);
		},
		hold(d) {
			if (d !== dir) boost = 0;
			dir = d;
			held = d;
			lastInput = time;
		},
		release() {
			if (held === 0) return;
			held = 0;
			lastInput = time - FLIGHT.hold;
		},
		halt() {
			vel = 0;
			boost = 0;
			held = 0;
			lastInput = -Infinity;
			target = null;
			mode = 'halt';
		},
		place(p) {
			pos = p;
			vel = 0;
			boost = 0;
			held = 0;
			lastInput = -Infinity;
			target = null;
			mode = 'rest';
		},
		glideTo(k, seconds) {
			held = 0;
			lastInput = -Infinity;
			startGlide(k, seconds);
		},
		rebase(next, p) {
			stations = next;
			pos = p;
			if (mode === 'glide' && target !== null) {
				// Keep heading for the same station, from here, in the time that was left.
				const left = Math.max(0.3, T - (time - t0));
				startGlide(target, left);
			}
		},
		step(dt) {
			time += dt;
			const active = held !== 0 || time - lastInput < FLIGHT.hold;
			if (active) {
				const d = held !== 0 ? held : dir;
				mode = 'thrust';
				target = null;
				boost = Math.min(1, boost + dt / FLIGHT.build);
				const want = d * (FLIGHT.cruise + (FLIGHT.max - FLIGHT.cruise) * smooth(boost));
				vel += (want - vel) * (1 - Math.exp(-dt / FLIGHT.response));
				pos += vel * dt;
				return true;
			}
			boost = Math.max(0, boost - dt / FLIGHT.forget);
			if (mode === 'thrust') settle();
			if (mode !== 'glide') return false;
			const t = time - t0;
			if (t >= T) {
				pos = x0 + span;
				vel = 0;
				mode = 'rest';
				return false;
			}
			const u = clamp(t / T);
			const a = 10 * span - 6 * v0 * T;
			const b = -15 * span + 8 * v0 * T;
			const c = 6 * span - 3 * v0 * T;
			const u2 = u * u;
			pos = x0 + v0 * t + u2 * u * (a + u * (b + u * c));
			vel = v0 + (u2 * (3 * a + u * (4 * b + u * 5 * c))) / T;
			return true;
		},
	};
}
