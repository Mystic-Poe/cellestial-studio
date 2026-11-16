// Claim-your-star state. Pure apart from the KV it is handed.

export type SlotId = string;

const SLOT_RE = /^slot-[1-9]\d?$/;
export const isSlotId = (v: unknown): v is SlotId => typeof v === 'string' && SLOT_RE.test(v);

export interface ClaimState {
	held: SlotId | null;
	pending: SlotId | null;
}

export const INITIAL_CLAIM: ClaimState = { held: null, pending: null };

export const startClaim = (s: ClaimState, id: SlotId): ClaimState => ({
	held: s.held,
	pending: id,
});

export const confirmClaim = (s: ClaimState): ClaimState =>
	s.pending ? { held: s.pending, pending: null } : s;

export const cancelClaim = (s: ClaimState): ClaimState => ({ held: s.held, pending: null });

export const isLit = (s: ClaimState, id: SlotId): boolean => s.held === id || s.pending === id;

export interface SlotPos {
	id: SlotId;
	x: number;
	y: number;
	visible: boolean;
}

/** Nearest slot the visitor doesn't already hold; visible ones win. */
export function nearestSlot(
	slots: SlotPos[],
	from: { x: number; y: number },
	s: ClaimState,
): SlotId | null {
	const free = slots.filter((p) => p.id !== s.held);
	const pool = free.some((p) => p.visible) ? free.filter((p) => p.visible) : free;
	let best: SlotPos | null = null;
	let bestD = Number.POSITIVE_INFINITY;
	for (const p of pool) {
		const d = Math.hypot(p.x - from.x, p.y - from.y);
		if (d < bestD) {
			bestD = d;
			best = p;
		}
	}
	return best ? best.id : null;
}

export interface KV {
	getItem(k: string): string | null;
	setItem(k: string, v: string): void;
}

export const CLAIM_KEY = 'cellestial:star';

export function loadClaim(store: KV | null): ClaimState {
	try {
		const v = store?.getItem(CLAIM_KEY);
		return isSlotId(v) ? { held: v, pending: null } : INITIAL_CLAIM;
	} catch {
		return INITIAL_CLAIM;
	}
}

export function saveClaim(store: KV | null, s: ClaimState): void {
	try {
		if (s.held) store?.setItem(CLAIM_KEY, s.held);
	} catch {
		// Storage blocked (private mode, policy): the claim still works this visit.
	}
}
