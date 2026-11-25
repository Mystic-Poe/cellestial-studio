// The rules for moving through the onboarding steps. One module, used by the
// Worker (which stores the result) and by the client page (which shows it at
// once and then saves it), so the two can never disagree.

import type { ClientConfig } from './link.ts';
import { buildSteps, type StepId } from './steps.ts';

export interface Progress {
	/** Index of the step the client is on; equal to the step count when finished. */
	step: number;
	/** Steps ticked, in step order. */
	done: StepId[];
}

export type ProgressAction = 'done' | 'undo' | 'goto';

export type ProgressResult =
	| { ok: true; progress: Progress; finished: boolean }
	| { ok: false; error: string };

export function stepIdsFor(c: ClientConfig): StepId[] {
	return buildSteps(c).map((s) => s.id);
}

const ordered = (ids: StepId[], set: Set<StepId>): StepId[] => ids.filter((id) => set.has(id));

export function applyProgress(
	p: Progress,
	action: ProgressAction,
	step: number,
	ids: StepId[],
): ProgressResult {
	if (!Number.isInteger(step) || step < 0 || step > ids.length)
		return { ok: false, error: 'Bad step.' };
	const done = new Set(p.done);

	if (action === 'done') {
		if (step !== p.step || step >= ids.length) return { ok: false, error: 'Not the current step.' };
		done.add(ids[step]);
		const next = step + 1;
		return {
			ok: true,
			progress: { step: next, done: ordered(ids, done) },
			finished: next === ids.length,
		};
	}

	if (action === 'undo') {
		if (step >= ids.length || (step > p.step && !done.has(ids[step])))
			return { ok: false, error: 'Can’t redo a step ahead.' };
		done.delete(ids[step]);
		return { ok: true, progress: { step, done: ordered(ids, done) }, finished: false };
	}

	if (action === 'goto') {
		const reachable =
			step <= p.step || (step < ids.length ? done.has(ids[step]) : ids.every((id) => done.has(id)));
		if (!reachable) return { ok: false, error: 'That step isn’t open yet.' };
		return {
			ok: true,
			progress: { step, done: ordered(ids, done) },
			finished: step === ids.length,
		};
	}

	return { ok: false, error: 'Bad action.' };
}

/** After the step list changes (a tier or lane edit): drop ticks that no longer exist. */
export function clampProgress(p: Progress, ids: StepId[]): Progress {
	const done = ordered(ids, new Set(p.done));
	const firstOpen = ids.findIndex((id) => !done.includes(id));
	const limit = firstOpen === -1 ? ids.length : firstOpen;
	const step = Number.isInteger(p.step) ? Math.min(Math.max(p.step, 0), limit) : 0;
	return { step, done };
}
