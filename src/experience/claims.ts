// The ClaimsStore: which stars are lit, which empty star this visitor has
// picked, and an ask that is waiting for a star.
//
// A lit star comes from one of three places (BLUEPRINT §9.1; the shared sky
// since 23 Nov, on the owner's word):
//   the registry   src/content/stars.json: lit for everyone
//   this device    localStorage: lit by a request this visitor sent
//   the shared sky the stars other visitors lit, as the contact Worker's store
//                  lists them: lit for everyone at once, their text shown only
//                  once the owner has approved it (until then `ask` is empty)
// Where two name the same star, the registry wins, then this device (a visitor
// always reads their own ask), then the shared sky.
//
// The one rule: a claim exists only because a request was SENT. Nothing in
// here runs before /api/contact has answered OK (claim-flow.ts sees to that).
// Picking a star claims nothing. No send, no claim.
//
// Three layers, so the rules can be tested without a browser:
//   1. a pure core      state in, new state and events out
//   2. a storage adapter every read and write guarded: storage that is
//                        blocked, full or corrupt costs persistence, never
//                        the visit
//   3. createClaimsStore the two behind the ClaimsStore contract

import { isSlotId } from '../content/constellations.ts';
import type { Claim, ClaimsEvent, ClaimsStore, SlotId } from './contracts.ts';

/** localStorage: a JSON array of { slot, ask }, the stars this device lit. */
export const CLAIMS_KEY = 'cellestial:claims';
/** sessionStorage: the slot id of the empty star the visitor picked. */
export const PICKED_KEY = 'cellestial:picked';
/** localStorage: an ask that was sent with no star, as plain text. */
export const UNPLACED_KEY = 'cellestial:unplaced';

// ─────────────────────────────────────────────────────── 1. pure core ──

export interface ClaimsState {
	/** Lit for everyone. Wins over `device` where both name a slot. */
	readonly registry: ReadonlyMap<SlotId, Claim>;
	/** Lit by requests sent from this device. */
	readonly device: ReadonlyMap<SlotId, Claim>;
	/** Lit by other visitors: the shared sky. Empty until it has been fetched. */
	readonly shared: ReadonlyMap<SlotId, Claim>;
	/** Always an empty star, or null. */
	readonly picked: SlotId | null;
	readonly unplaced: string | null;
}

/** What a rule decided: the state from now on, and what to tell subscribers. */
export interface Step {
	readonly state: ClaimsState;
	readonly events: readonly ClaimsEvent[];
}

const unchanged = (state: ClaimsState): Step => ({ state, events: [] });

/**
 * Claims out of anything at all. Whatever is not an array is no claims; an
 * entry that is not { slot: a real slot id, ask: a string } is left out; of
 * two entries for one slot the first stands.
 */
export function parseClaims(raw: unknown): Map<SlotId, Claim> {
	const claims = new Map<SlotId, Claim>();
	if (!Array.isArray(raw)) return claims;
	for (const entry of raw) {
		if (typeof entry !== 'object' || entry === null) continue;
		const { slot, ask } = entry as { slot?: unknown; ask?: unknown };
		if (!isSlotId(slot) || typeof ask !== 'string' || claims.has(slot)) continue;
		claims.set(slot, { slot, ask });
	}
	return claims;
}

export function isLit(state: ClaimsState, slot: SlotId): boolean {
	return state.registry.has(slot) || state.device.has(slot) || state.shared.has(slot);
}

/** Every lit star: the shared sky's, this device's over them, then the registry's over both. */
export function litStars(state: ClaimsState): Map<SlotId, Claim> {
	const lit = new Map(state.shared);
	for (const [slot, claim] of state.device) lit.set(slot, claim);
	for (const [slot, claim] of state.registry) lit.set(slot, claim);
	return lit;
}

/**
 * The shared sky out of anything at all: `{ stars: [{ slot, ask }] }` as the
 * Worker answers, or the bare list. An `ask` that is not a string (the owner
 * has not approved it) is an empty one: the star is lit, with nothing to read.
 */
export function parseShared(raw: unknown): Map<SlotId, Claim> {
	const claims = new Map<SlotId, Claim>();
	const list = Array.isArray(raw) ? raw : (raw as { stars?: unknown } | null)?.stars;
	if (!Array.isArray(list)) return claims;
	for (const entry of list) {
		if (typeof entry !== 'object' || entry === null) continue;
		const { slot, ask } = entry as { slot?: unknown; ask?: unknown };
		if (!isSlotId(slot) || claims.has(slot)) continue;
		claims.set(slot, { slot, ask: typeof ask === 'string' ? ask : '' });
	}
	return claims;
}

/** The state a visit starts from. Each argument is whatever was found: nothing is trusted. */
export function initialState(
	registry: unknown,
	device: unknown,
	picked: unknown,
	unplaced: unknown,
): ClaimsState {
	const state: ClaimsState = {
		registry: parseClaims(registry),
		device: parseClaims(device),
		shared: new Map(),
		picked: null,
		unplaced: typeof unplaced === 'string' ? unplaced : null,
	};
	// A remembered pick only stands while its star is still empty.
	return isSlotId(picked) && !isLit(state, picked) ? { ...state, picked } : state;
}

/** Choose an empty star, or null to let go of it. A lit star cannot be picked. */
export function reducePick(state: ClaimsState, slot: SlotId | null): Step {
	if (slot === state.picked) return unchanged(state);
	if (slot !== null && (!isSlotId(slot) || isLit(state, slot))) return unchanged(state);
	return { state: { ...state, picked: slot }, events: [{ type: 'picked', slot }] };
}

function light(state: ClaimsState, slot: SlotId, ask: string): Step {
	const device = new Map(state.device).set(slot, { slot, ask });
	const events: ClaimsEvent[] = [{ type: 'claimed', slot }];
	let { picked } = state;
	if (picked === slot) {
		// It is no longer an empty star somebody chose: it is theirs.
		picked = null;
		events.push({ type: 'picked', slot: null });
	}
	return { state: { ...state, device, picked }, events };
}

/**
 * A request was sent. With an empty star it lights that star. With no star,
 * or one that is already lit, the ask waits to be placed; a later ask sent
 * the same way takes the place of one still waiting.
 */
export function reduceSent(state: ClaimsState, ask: string, slot: SlotId | null): Step {
	if (slot !== null && isSlotId(slot) && !isLit(state, slot)) return light(state, slot, ask);
	return { state: { ...state, unplaced: ask }, events: [{ type: 'unplaced' }] };
}

/** Put the waiting ask on an empty star. With nothing waiting, or a lit star, nothing happens. */
export function reducePlace(state: ClaimsState, slot: SlotId): Step {
	if (state.unplaced === null || !isSlotId(slot) || isLit(state, slot)) return unchanged(state);
	const step = light(state, slot, state.unplaced);
	return {
		state: { ...step.state, unplaced: null },
		events: [{ type: 'placed', slot }, ...step.events],
	};
}

/**
 * Take in the shared sky. Stars it names are lit; a text the owner has since
 * approved replaces an empty one. Within a visit nothing is ever put out by it:
 * a star the owner took back is empty again on the next visit.
 */
export function reduceShare(state: ClaimsState, incoming: ReadonlyMap<SlotId, Claim>): Step {
	let shared: Map<SlotId, Claim> | null = null;
	const events: ClaimsEvent[] = [];
	for (const [slot, claim] of incoming) {
		const held = state.shared.get(slot);
		if (held && held.ask === claim.ask) continue;
		shared ??= new Map(state.shared);
		shared.set(slot, claim);
		if (!isLit(state, slot)) events.push({ type: 'claimed', slot });
	}
	if (!shared) return unchanged(state);
	let { picked } = state;
	if (picked !== null && shared.has(picked)) {
		picked = null;
		events.push({ type: 'picked', slot: null });
	}
	return { state: { ...state, shared, picked }, events };
}

/**
 * Take in device claims this state has not seen: another tab sent a request
 * since this one loaded. A claim already held is never replaced.
 */
export function reduceAdopt(state: ClaimsState, stored: ReadonlyMap<SlotId, Claim>): Step {
	let device: Map<SlotId, Claim> | null = null;
	const events: ClaimsEvent[] = [];
	for (const [slot, claim] of stored) {
		if (state.device.has(slot)) continue;
		device ??= new Map(state.device);
		device.set(slot, claim);
		if (!state.registry.has(slot)) events.push({ type: 'claimed', slot });
	}
	if (!device) return unchanged(state);
	let { picked } = state;
	if (picked !== null && device.has(picked)) {
		picked = null;
		events.push({ type: 'picked', slot: null });
	}
	return { state: { ...state, device, picked }, events };
}

// ────────────────────────────────────────────────── 2. storage adapter ──

/** The part of Storage this needs: localStorage and sessionStorage both fit. */
export interface KV {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface ClaimsStorage {
	/** Outlives the visit: the lit stars and the waiting ask. Null if there is none. */
	local?: KV | null;
	/** This tab only: the picked star. Null if there is none. */
	session?: KV | null;
}

function read(kv: KV | null, key: string): string | null {
	try {
		return kv?.getItem(key) ?? null;
	} catch {
		return null; // blocked: carry on as if nothing was stored
	}
}

function write(kv: KV | null, key: string, value: string | null): void {
	try {
		if (value === null) kv?.removeItem(key);
		else kv?.setItem(key, value);
	} catch {
		// Blocked or full. The visit goes on from memory; only persistence is lost.
	}
}

function readClaims(kv: KV | null): unknown {
	const text = read(kv, CLAIMS_KEY);
	if (text === null) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null; // corrupt: no claims, and the next send writes it clean
	}
}

/** This browser's storage. Merely touching it can throw where it is blocked. */
export function browserStorage(): ClaimsStorage {
	const open = (name: 'localStorage' | 'sessionStorage'): KV | null => {
		try {
			return window[name];
		} catch {
			return null;
		}
	};
	return { local: open('localStorage'), session: open('sessionStorage') };
}

// ──────────────────────────────────────────────────────── 3. the store ──

/**
 * @param registry the published registry (the parsed src/content/stars.json)
 * @param storage  where this device remembers; leave out for a store that
 *                 lives in memory only
 */
export function createClaimsStore(registry: unknown, storage: ClaimsStorage = {}): ClaimsStore {
	const local = storage.local ?? null;
	const session = storage.session ?? null;
	const subscribers = new Set<(e: ClaimsEvent) => void>();

	const rememberedPick = read(session, PICKED_KEY);
	let state = initialState(registry, readClaims(local), rememberedPick, read(local, UNPLACED_KEY));
	let lit: ReadonlyMap<SlotId, Claim> = litStars(state);
	if (rememberedPick !== null && state.picked === null) write(session, PICKED_KEY, null);

	/** Make a step real: remember what changed, then tell whoever is listening. */
	function apply(step: Step): void {
		const before = state;
		state = step.state;
		if (state.device !== before.device) {
			write(local, CLAIMS_KEY, JSON.stringify([...state.device.values()]));
		}
		if (state.device !== before.device || state.shared !== before.shared) {
			// A new map each time, so one handed out by all() never changes under its reader.
			lit = litStars(state);
		}
		if (state.picked !== before.picked) write(session, PICKED_KEY, state.picked);
		if (state.unplaced !== before.unplaced) write(local, UNPLACED_KEY, state.unplaced);

		for (const event of step.events) {
			for (const fn of [...subscribers]) {
				try {
					fn(event);
				} catch (err) {
					// A broken listener must not undo a claim or silence the others.
					console.error('[cellestial] a claims subscriber threw', err);
				}
			}
		}
	}

	/**
	 * Before deciding whether a star is empty, take in what another tab has
	 * lit since this one last looked. It also means the list written back is
	 * never missing a star that the other tab stored.
	 */
	function refresh(): void {
		apply(reduceAdopt(state, parseClaims(readClaims(local))));
	}

	return {
		all: () => lit,
		isLit: (slot) => lit.has(slot),
		picked: () => state.picked,
		pick(slot) {
			apply(reducePick(state, slot));
		},
		unplaced: () => state.unplaced,
		recordSent(ask, slot) {
			refresh();
			apply(reduceSent(state, ask, slot));
		},
		place(slot) {
			refresh();
			apply(reducePlace(state, slot));
		},
		share(raw) {
			apply(reduceShare(state, parseShared(raw)));
		},
		subscribe(fn) {
			subscribers.add(fn);
			return () => {
				subscribers.delete(fn);
			};
		},
	};
}
