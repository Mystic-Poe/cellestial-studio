import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClientConfig } from './link.ts';
import { applyProgress, clampProgress, type Progress, stepIdsFor } from './progress.ts';
import type { StepId } from './steps.ts';

const tier2: ClientConfig = { n: 'Test Co', e: 'a@b.co', d: 'b.co', l: 'ms', t: 2, m: 'test' };
const ids = stepIdsFor(tier2);
const at = (step: number, done: StepId[] = []): Progress => ({ step, done });

test('stepIdsFor: four steps for tier 2, two for tier 1', () => {
	assert.deepEqual(ids, ['gh-signup', 'gh-org', 'cf-signup', 'cf-invite']);
	assert.deepEqual(stepIdsFor({ ...tier2, t: 1 }), ['cf-signup', 'cf-invite']);
});

test('done on the current step ticks it and moves on', () => {
	const r = applyProgress(at(0), 'done', 0, ids);
	assert.deepEqual(r, { ok: true, progress: at(1, ['gh-signup']), finished: false });
});

test('done on the last step finishes', () => {
	const r = applyProgress(at(3, ['gh-signup', 'gh-org', 'cf-signup']), 'done', 3, ids);
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.equal(r.finished, true);
		assert.equal(r.progress.step, 4);
		assert.equal(r.progress.done.length, 4);
	}
});

test('done on any other step is refused', () => {
	assert.equal(applyProgress(at(1, ['gh-signup']), 'done', 0, ids).ok, false);
	assert.equal(applyProgress(at(1, ['gh-signup']), 'done', 2, ids).ok, false);
	assert.equal(applyProgress(at(4), 'done', 4, ids).ok, false);
});

test('done twice does not duplicate the tick', () => {
	const r = applyProgress(at(0, ['gh-signup']), 'done', 0, ids);
	assert.ok(r.ok && r.progress.done.filter((d) => d === 'gh-signup').length === 1);
});

test('undo clears that step and rewinds to it, keeping other ticks', () => {
	const r = applyProgress(at(3, ['gh-signup', 'gh-org', 'cf-signup']), 'undo', 1, ids);
	assert.deepEqual(r, { ok: true, progress: at(1, ['gh-signup', 'cf-signup']), finished: false });
});

test('undo on the current step is allowed (redo this step)', () => {
	const r = applyProgress(at(2, ['gh-signup', 'gh-org', 'cf-signup']), 'undo', 2, ids);
	assert.deepEqual(r, { ok: true, progress: at(2, ['gh-signup', 'gh-org']), finished: false });
});

test('undo ahead of the current step is refused', () => {
	assert.equal(applyProgress(at(1, ['gh-signup']), 'undo', 2, ids).ok, false);
});

test('goto back is allowed; done ticks stay', () => {
	const r = applyProgress(at(3, ['gh-signup', 'gh-org', 'cf-signup']), 'goto', 0, ids);
	assert.deepEqual(r, {
		ok: true,
		progress: at(0, ['gh-signup', 'gh-org', 'cf-signup']),
		finished: false,
	});
});

test('goto forward to a ticked step is allowed, to an unticked one refused', () => {
	const p = at(0, ['gh-signup', 'gh-org', 'cf-signup']);
	assert.equal(applyProgress(p, 'goto', 2, ids).ok, true);
	assert.equal(applyProgress(p, 'goto', 3, ids).ok, false);
	assert.equal(applyProgress(at(0), 'goto', 1, ids).ok, false);
});

test('goto the end only when every step is ticked', () => {
	assert.equal(applyProgress(at(0, [...ids]), 'goto', 4, ids).ok, true);
	assert.equal(applyProgress(at(3, ids.slice(0, 3)), 'goto', 4, ids).ok, false);
});

test('bad step numbers and actions are refused', () => {
	for (const s of [-1, 1.5, Number.NaN, 99])
		assert.equal(applyProgress(at(1), 'goto', s, ids).ok, false);
	assert.equal(applyProgress(at(0), 'jump' as never, 0, ids).ok, false);
});

test('clampProgress keeps ticks that still exist; step never passes the first unticked one', () => {
	const tier1 = stepIdsFor({ ...tier2, t: 1 });
	assert.deepEqual(clampProgress(at(3, ['gh-signup', 'gh-org', 'cf-signup']), tier1), {
		step: 1,
		done: ['cf-signup'],
	});
	assert.deepEqual(clampProgress(at(-4, ['nope' as StepId]), tier1), { step: 0, done: [] });
});
