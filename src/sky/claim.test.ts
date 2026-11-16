import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	CLAIM_KEY,
	cancelClaim,
	confirmClaim,
	INITIAL_CLAIM,
	isLit,
	isSlotId,
	loadClaim,
	nearestSlot,
	saveClaim,
	startClaim,
} from './claim.ts';

test('isSlotId accepts slot-1..slot-99 only', () => {
	for (const ok of ['slot-1', 'slot-5', 'slot-42']) assert.ok(isSlotId(ok), ok);
	for (const bad of ['slot-0', 'slot-100', 'slot-', 'star-1', '', null, 3, 'slot-1;drop'])
		assert.ok(!isSlotId(bad), String(bad));
});

test('start → confirm holds the star; a second confirm releases the first', () => {
	let s = startClaim(INITIAL_CLAIM, 'slot-2');
	assert.deepEqual(s, { held: null, pending: 'slot-2' });
	assert.ok(isLit(s, 'slot-2'));
	s = confirmClaim(s);
	assert.deepEqual(s, { held: 'slot-2', pending: null });
	s = confirmClaim(startClaim(s, 'slot-4'));
	assert.deepEqual(s, { held: 'slot-4', pending: null });
	assert.ok(!isLit(s, 'slot-2'));
});

test('cancel drops only the pending claim', () => {
	const held = { held: 'slot-1', pending: null };
	const s = cancelClaim(startClaim(held, 'slot-3'));
	assert.deepEqual(s, held);
	assert.ok(!isLit(s, 'slot-3'));
});

test('confirm with nothing pending changes nothing', () => {
	assert.deepEqual(confirmClaim(INITIAL_CLAIM), INITIAL_CLAIM);
});

test('nearestSlot prefers visible, unheld slots closest to the point', () => {
	const slots = [
		{ id: 'slot-1', x: 100, y: 100, visible: true },
		{ id: 'slot-2', x: 300, y: 100, visible: true },
		{ id: 'slot-3', x: 110, y: 100, visible: false },
	];
	assert.equal(nearestSlot(slots, { x: 120, y: 100 }, INITIAL_CLAIM), 'slot-1');
	assert.equal(nearestSlot(slots, { x: 120, y: 100 }, { held: 'slot-1', pending: null }), 'slot-2');
	const noneVisible = slots.map((s) => ({ ...s, visible: false }));
	assert.equal(
		nearestSlot(noneVisible, { x: 120, y: 100 }, INITIAL_CLAIM),
		'slot-3',
		'falls back to any',
	);
	assert.equal(nearestSlot([], { x: 0, y: 0 }, INITIAL_CLAIM), null);
});

test('persistence round-trips a held star and survives bad storage', () => {
	const mem = new Map<string, string>();
	const kv = {
		getItem: (k: string) => mem.get(k) ?? null,
		setItem: (k: string, v: string) => void mem.set(k, v),
	};
	saveClaim(kv, { held: 'slot-3', pending: 'slot-4' });
	assert.equal(mem.get(CLAIM_KEY), 'slot-3');
	assert.deepEqual(loadClaim(kv), { held: 'slot-3', pending: null });

	mem.set(CLAIM_KEY, '<script>');
	assert.deepEqual(loadClaim(kv), INITIAL_CLAIM);

	const throwing = {
		getItem: () => {
			throw new Error('denied');
		},
		setItem: () => {
			throw new Error('denied');
		},
	};
	assert.deepEqual(loadClaim(throwing), INITIAL_CLAIM);
	assert.doesNotThrow(() => saveClaim(throwing, { held: 'slot-1', pending: null }));
	assert.deepEqual(loadClaim(null), INITIAL_CLAIM);
});
