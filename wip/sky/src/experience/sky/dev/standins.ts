// Stand-ins for the rest of the stage, for the sky's own test page
// (src/pages/dev/sky.astro). Development only: nothing here ships.

import { isSlotId } from '../../../content/constellations.ts';
import type {
	Claim,
	ClaimFlow,
	ClaimsEvent,
	ClaimsStore,
	Director,
	SceneContext,
	SlotId,
	Stage,
	StagePart,
} from '../../contracts.ts';

/** Everything the stand-ins were asked to do, newest last, for capture scripts to read. */
export const log: { at: number; what: string; detail?: unknown }[] = [];

function note(what: string, detail?: unknown) {
	log.push({ at: Math.round(performance.now()), what, detail });
	console.info(`[dev] ${what}`, detail ?? '');
}

/** A claims store that lives in memory and forgets on reload. */
export function createMemoryClaims(
	seed: readonly string[] = [],
	waiting: string | null = null,
): ClaimsStore {
	const lit = new Map<SlotId, Claim>();
	for (const slot of seed) if (isSlotId(slot)) lit.set(slot, { slot, ask: '(seeded by ?lit)' });
	const listeners = new Set<(e: ClaimsEvent) => void>();
	let picked: SlotId | null = null;
	let unplaced = waiting;
	const tell = (e: ClaimsEvent) => {
		note(`claims: ${e.type}`, e);
		for (const fn of [...listeners]) fn(e);
	};
	return {
		all: () => lit,
		isLit: (slot) => lit.has(slot),
		picked: () => picked,
		pick(slot) {
			picked = slot;
			tell({ type: 'picked', slot });
		},
		unplaced: () => unplaced,
		recordSent(ask, slot) {
			if (slot && !lit.has(slot)) {
				lit.set(slot, { slot, ask });
				picked = null;
				tell({ type: 'claimed', slot });
			} else {
				unplaced = ask;
				tell({ type: 'unplaced' });
			}
		},
		place(slot) {
			if (unplaced === null || lit.has(slot)) return;
			lit.set(slot, { slot, ask: unplaced });
			unplaced = null;
			picked = null;
			tell({ type: 'claimed', slot });
		},
		subscribe(fn) {
			listeners.add(fn);
			return () => {
				listeners.delete(fn);
			};
		},
	};
}

/** A director that only says what it was asked. */
export function createLogDirector(reducedMotion: boolean): Director {
	return {
		scene: 'sky',
		reducedMotion,
		async go(dest) {
			note('director.go', dest);
		},
		async descend() {
			note('director.descend');
		},
		async ascend() {
			note('director.ascend');
		},
		async showStar(slot) {
			note('director.showStar', slot);
		},
	};
}

export function createLogClaimFlow(): ClaimFlow {
	return {
		openClaim(slot) {
			note('claimFlow.openClaim', slot ?? null);
		},
		openContact() {
			note('claimFlow.openContact');
		},
	};
}

/** A context whose `when` answers for the parts it was given, and waits for ever on the rest. */
export function createContext(parts: Partial<Stage>, reducedMotion: boolean): SceneContext {
	return {
		reducedMotion,
		when<K extends StagePart>(part: K): Promise<Stage[K]> {
			const have = parts[part];
			return have ? Promise.resolve(have as Stage[K]) : new Promise<Stage[K]>(() => {});
		},
	};
}
