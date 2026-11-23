// The shared sky: the stars other visitors have lit.
//
// The contact Worker keeps them (workers/contact: a star is written there only
// when a request was SENT, and what was asked is listed only once the owner has
// approved it). This file is the page's side: it fetches the list, hands it to
// the ClaimsStore, and tells the Worker when a request that was sent with no
// star has been given one.
//
// Nothing here can cost a visit: every fetch may fail (offline, no Worker
// behind a preview server) and the sky is then this device's own, as before.

import { isSlotId } from '../content/constellations.ts';
import type { ClaimsStore, SlotId } from './contracts.ts';

export const SHARED_URL = '/api/contact/stars.json';
export const PLACE_URL = '/api/contact/place';
/** localStorage: the key the waiting ask was sent with. */
export const WAITING_KEY = 'cellestial:claim-key';
/** localStorage: `{ key, slot }`, a placement the Worker has not confirmed yet. */
export const PLACING_KEY = 'cellestial:claim-place';
/** The shared sky is fetched again when the visitor comes back to the tab after this long. */
const AGAIN_MS = 60_000;

/** A key for one sent request: random, never shown, kept only on this device. */
export function newClaimKey(): string {
	const bytes = new Uint8Array(18);
	crypto.getRandomValues(bytes);
	return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const read = (key: string): string | null => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
};
const write = (key: string, value: string | null): void => {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		// Storage that is blocked or full costs the sharing of one star, never the visit.
	}
};

/** The claim flow calls this when a request was sent with no star: its key waits with the ask. */
export function keepClaimKey(key: string): void {
	write(WAITING_KEY, key);
}

async function place(slot: SlotId, key: string): Promise<void> {
	const body = new FormData();
	body.set('star', slot);
	body.set('claim-key', key);
	try {
		const response = await fetch(PLACE_URL, {
			method: 'POST',
			headers: { accept: 'application/json' },
			body,
		});
		// Answered, whatever the answer: lit, already lit by another, or nothing was waiting.
		// Only a Worker that could not be reached, or failed, is asked again on the next visit.
		if (response.status < 500) write(PLACING_KEY, null);
	} catch {
		// Offline: PLACING_KEY stays, and the next visit tries again.
	}
}

export function connectSharedSky(claims: ClaimsStore): void {
	let last = 0;
	const load = async () => {
		last = Date.now();
		try {
			const response = await fetch(SHARED_URL, { headers: { accept: 'application/json' } });
			if (response.ok) claims.share(await response.json());
		} catch {
			// No shared sky this time.
		}
	};
	void load();
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible' && Date.now() - last > AGAIN_MS) void load();
	});

	// A placement the Worker never confirmed (the visitor was offline): once more.
	try {
		const left = JSON.parse(read(PLACING_KEY) ?? 'null') as {
			key?: unknown;
			slot?: unknown;
		} | null;
		if (left && typeof left.key === 'string' && isSlotId(left.slot))
			void place(left.slot, left.key);
	} catch {
		write(PLACING_KEY, null);
	}

	claims.subscribe((event) => {
		if (event.type !== 'placed') return;
		const key = read(WAITING_KEY);
		if (!key) return;
		write(WAITING_KEY, null);
		write(PLACING_KEY, JSON.stringify({ key, slot: event.slot }));
		void place(event.slot, key);
	});
}
