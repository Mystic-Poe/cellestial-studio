// The Stage: where the parts of the experience find each other.
//
// main.ts registers each part as it comes into being. Anything that needs a
// part asks for it by name, so no scene ever imports another scene, and the
// sky's three.js can stay out of the first chunk.
//
//   register('sky', impl)   the part exists from now on
//   await when('sky')       the part, as soon as it exists (at once if it does)
//   get('sky')              the part or undefined, without waiting
//   fail('sky', reason)     the part will never exist: when('sky') rejects
//
// when() can reject. A caller that would otherwise leave the page stuck must
// catch that and carry on without the part (see director.ts).

import type { Stage, StagePart } from './contracts.ts';

interface Entry<K extends StagePart> {
	readonly promise: Promise<Stage[K]>;
	resolve(impl: Stage[K]): void;
	reject(reason: unknown): void;
	settled: boolean;
}

const parts: Partial<Stage> = {};
const entries: { [K in StagePart]?: Entry<K> } = {};

function entry<K extends StagePart>(name: K): Entry<K> {
	const known = entries[name] as Entry<K> | undefined;
	if (known) return known;

	let resolve!: (impl: Stage[K]) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<Stage[K]>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	// A part may fail before anybody has asked for it. That is not an unhandled
	// rejection: whoever asks later still gets the rejection from when().
	promise.catch(() => {});

	const made: Entry<K> = { promise, resolve, reject, settled: false };
	(entries as Record<StagePart, unknown>)[name] = made;
	return made;
}

/** The part exists. Each part is registered once; a second time is a bug. */
export function register<K extends StagePart>(name: K, impl: Stage[K]): void {
	const e = entry(name);
	if (e.settled) throw new Error(`stage: "${name}" was already registered or failed`);
	e.settled = true;
	parts[name] = impl;
	e.resolve(impl);
}

/** The part could not be made (its chunk did not load, or its mount threw). */
export function fail(name: StagePart, reason: unknown): void {
	const e = entry(name);
	if (e.settled) return;
	e.settled = true;
	e.reject(reason);
}

/** The part, once it exists. Rejects if it failed. */
export function when<K extends StagePart>(name: K): Promise<Stage[K]> {
	return entry(name).promise;
}

/** The part if it exists right now. */
export function get<K extends StagePart>(name: K): Stage[K] | undefined {
	return parts[name];
}

/**
 * Debug (?debug): put the live Stage on `window.__cellestial`. It is the
 * registry itself, so a part registered later appears on it.
 */
export function expose(): void {
	(window as unknown as { __cellestial?: Partial<Stage> }).__cellestial = parts;
}
