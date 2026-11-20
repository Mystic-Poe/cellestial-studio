import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	CLAIMS_KEY,
	createClaimsStore,
	initialState,
	type KV,
	litStars,
	PICKED_KEY,
	parseClaims,
	reduceAdopt,
	reducePick,
	reducePlace,
	reduceSent,
	UNPLACED_KEY,
} from './claims.ts';
import type { ClaimsEvent, ClaimsStore, SlotId } from './contracts.ts';

/** Storage that works. `items` is what is on disk. */
function memory(seed: Record<string, string> = {}): KV & { items: Map<string, string> } {
	const items = new Map(Object.entries(seed));
	return {
		items,
		getItem: (k) => items.get(k) ?? null,
		setItem: (k, v) => {
			items.set(k, v);
		},
		removeItem: (k) => {
			items.delete(k);
		},
	};
}

/** Storage that is there but refuses everything, as in a locked-down browser. */
const blocked: KV = {
	getItem() {
		throw new Error('SecurityError');
	},
	setItem() {
		throw new Error('QuotaExceededError');
	},
	removeItem() {
		throw new Error('SecurityError');
	},
};

/** Storage that can be read but is full. */
function full(seed: Record<string, string> = {}): KV {
	const kv = memory(seed);
	return {
		...kv,
		setItem() {
			throw new Error('QuotaExceededError');
		},
	};
}

function listen(store: ClaimsStore): ClaimsEvent[] {
	const events: ClaimsEvent[] = [];
	store.subscribe((e) => events.push(e));
	return events;
}

const stored = (kv: { items: Map<string, string> }) =>
	JSON.parse(kv.items.get(CLAIMS_KEY) ?? 'null');

// ─────────────────────────────────────────────────────────── sources ──

test('the sky starts empty', () => {
	const store = createClaimsStore([]);
	assert.equal(store.all().size, 0);
	assert.equal(store.isLit('slot-1'), false);
	assert.equal(store.picked(), null);
	assert.equal(store.unplaced(), null);
});

test('the registry lights its stars', () => {
	const store = createClaimsStore([
		{ slot: 'slot-3', ask: 'A site for the bakery' },
		{ slot: 'slot-146', ask: 'An app' },
	]);
	assert.equal(store.all().size, 2);
	assert.deepEqual(store.all().get('slot-3'), { slot: 'slot-3', ask: 'A site for the bakery' });
	assert.equal(store.isLit('slot-146'), true);
	assert.equal(store.isLit('slot-4'), false);
});

test('bad registry entries are ignored, good ones around them still count', () => {
	const store = createClaimsStore([
		{ slot: 'slot-0', ask: 'no such slot' },
		{ slot: 'slot-147', ask: 'past the last slot' },
		{ slot: 'slot-01', ask: 'padded' },
		{ slot: ' slot-1', ask: 'leading space' },
		{ slot: 'SLOT-1', ask: 'wrong case' },
		{ slot: 7, ask: 'a number' },
		{ slot: 'slot-5' },
		{ slot: 'slot-6', ask: 42 },
		{ slot: 'slot-7', ask: null },
		{ ask: 'no slot' },
		null,
		'slot-8',
		['slot-9', 'an array'],
		{ slot: 'slot-2', ask: 'the good one' },
		{ slot: 'slot-2', ask: 'a second entry for a lit star' },
	]);
	assert.deepEqual([...store.all().values()], [{ slot: 'slot-2', ask: 'the good one' }]);
});

test('a registry that is not a list is no registry', () => {
	for (const raw of [null, undefined, {}, 'slot-1', 5, { slot: 'slot-1', ask: 'x' }]) {
		assert.equal(createClaimsStore(raw).all().size, 0);
	}
});

test('an entry keeps only its slot and its ask', () => {
	const claims = parseClaims([{ slot: 'slot-1', ask: 'A site', name: 'Ada', email: 'a@b.c' }]);
	assert.deepEqual(claims.get('slot-1'), { slot: 'slot-1', ask: 'A site' });
});

test('this device lights the stars it stored', () => {
	const local = memory({
		[CLAIMS_KEY]: JSON.stringify([{ slot: 'slot-12', ask: 'Booking for the studio' }]),
	});
	const store = createClaimsStore([], { local });
	assert.deepEqual(store.all().get('slot-12'), { slot: 'slot-12', ask: 'Booking for the studio' });
});

test('corrupt or malformed device storage is no claims, and nothing throws', () => {
	const cases = [
		'{not json',
		'',
		'null',
		'"slot-1"',
		'{"slot":"slot-1","ask":"an object, not a list"}',
		JSON.stringify([{ slot: 'slot-999', ask: 'x' }, { slot: 'slot-1' }, 3, null]),
	];
	for (const text of cases) {
		const store = createClaimsStore([], { local: memory({ [CLAIMS_KEY]: text }) });
		assert.equal(store.all().size, 0, text);
	}
});

test('corrupt storage is written clean by the next send', () => {
	const local = memory({ [CLAIMS_KEY]: '{not json' });
	const store = createClaimsStore([], { local });
	store.recordSent('A site', 'slot-1');
	assert.deepEqual(stored(local), [{ slot: 'slot-1', ask: 'A site' }]);
});

test('the registry wins on conflict', () => {
	const local = memory({
		[CLAIMS_KEY]: JSON.stringify([
			{ slot: 'slot-3', ask: 'what this device stored' },
			{ slot: 'slot-4', ask: 'only on this device' },
		]),
	});
	const store = createClaimsStore([{ slot: 'slot-3', ask: 'what was published' }], { local });
	assert.equal(store.all().get('slot-3')?.ask, 'what was published');
	assert.equal(store.all().get('slot-4')?.ask, 'only on this device');
	assert.equal(store.all().size, 2);
});

// ────────────────────────────────────────────────────── blocked storage ──

test('with storage blocked, everything still works for the visit', () => {
	const store = createClaimsStore([{ slot: 'slot-9', ask: 'published' }], {
		local: blocked,
		session: blocked,
	});
	const events = listen(store);
	assert.equal(store.isLit('slot-9'), true);

	store.pick('slot-1');
	assert.equal(store.picked(), 'slot-1');
	store.recordSent('A site', 'slot-1');
	assert.equal(store.isLit('slot-1'), true);
	assert.equal(store.all().get('slot-1')?.ask, 'A site');

	store.recordSent('Later ask', null);
	assert.equal(store.unplaced(), 'Later ask');
	store.place('slot-2');
	assert.equal(store.all().get('slot-2')?.ask, 'Later ask');
	assert.equal(store.unplaced(), null);

	assert.deepEqual(
		events.map((e) => e.type),
		['picked', 'claimed', 'picked', 'unplaced', 'claimed'],
	);
});

test('with no storage at all, everything still works for the visit', () => {
	const store = createClaimsStore([], { local: null, session: null });
	store.pick('slot-5');
	store.recordSent('A site', store.picked());
	assert.equal(store.isLit('slot-5'), true);
	assert.equal(store.picked(), null);
});

test('with storage full, a claim still stands for the visit', () => {
	const store = createClaimsStore([], { local: full(), session: full() });
	store.recordSent('A site', 'slot-1');
	assert.equal(store.isLit('slot-1'), true);
});

// ───────────────────────────────────────────────────────── recordSent ──

test('a sent request with an empty star lights it and emits claimed', () => {
	const local = memory();
	const store = createClaimsStore([], { local });
	const events = listen(store);

	store.recordSent('A site for the bakery', 'slot-7');

	assert.equal(store.isLit('slot-7'), true);
	assert.deepEqual(store.all().get('slot-7'), { slot: 'slot-7', ask: 'A site for the bakery' });
	assert.deepEqual(events, [{ type: 'claimed', slot: 'slot-7' }]);
	assert.deepEqual(stored(local), [{ slot: 'slot-7', ask: 'A site for the bakery' }]);
	assert.equal(store.unplaced(), null);
});

test('the ask is kept exactly: nothing trimmed, nothing added', () => {
	const ask = '  Two lines,\n\tone "quoted" — and an emoji-free ending.  ';
	const local = memory();
	createClaimsStore([], { local }).recordSent(ask, 'slot-1');
	const again = createClaimsStore([], { local });
	assert.equal(again.all().get('slot-1')?.ask, ask);
	assert.deepEqual(Object.keys(stored(local)[0]), ['slot', 'ask']);
});

test('a claimed star stays lit on the next visit', () => {
	const local = memory();
	createClaimsStore([], { local }).recordSent('A site', 'slot-7');
	const nextVisit = createClaimsStore([], { local, session: memory() });
	assert.equal(nextVisit.isLit('slot-7'), true);
	assert.equal(nextVisit.all().get('slot-7')?.ask, 'A site');
});

test('a sent request with no star waits as unplaced', () => {
	const local = memory();
	const store = createClaimsStore([], { local });
	const events = listen(store);

	store.recordSent('Something, not sure which star', null);

	assert.equal(store.unplaced(), 'Something, not sure which star');
	assert.equal(store.all().size, 0);
	assert.deepEqual(events, [{ type: 'unplaced' }]);
	assert.equal(local.items.get(UNPLACED_KEY), 'Something, not sure which star');
	assert.equal(local.items.has(CLAIMS_KEY), false);
});

test('the waiting ask survives to the next visit', () => {
	const local = memory();
	createClaimsStore([], { local }).recordSent('Waiting', null);
	assert.equal(createClaimsStore([], { local }).unplaced(), 'Waiting');
});

test('a sent request for a star the registry already lit waits as unplaced', () => {
	const store = createClaimsStore([{ slot: 'slot-3', ask: 'published' }], { local: memory() });
	const events = listen(store);
	store.recordSent('Mine', 'slot-3');
	assert.equal(store.all().get('slot-3')?.ask, 'published', 'the lit star keeps its ask');
	assert.equal(store.unplaced(), 'Mine');
	assert.deepEqual(events, [{ type: 'unplaced' }]);
});

test('a sent request for a star this device already lit waits as unplaced', () => {
	const store = createClaimsStore([], { local: memory() });
	store.recordSent('First', 'slot-3');
	const events = listen(store);
	store.recordSent('Second', 'slot-3');
	assert.equal(store.all().get('slot-3')?.ask, 'First');
	assert.equal(store.unplaced(), 'Second');
	assert.deepEqual(events, [{ type: 'unplaced' }]);
});

test('a sent request naming something that is not a slot waits as unplaced', () => {
	const store = createClaimsStore([], { local: memory() });
	store.recordSent('Mine', 'slot-999' as SlotId);
	store.recordSent('Mine again', '' as SlotId);
	assert.equal(store.all().size, 0);
	assert.equal(store.unplaced(), 'Mine again');
});

test('a second ask sent with no star takes the place of the one waiting', () => {
	const local = memory();
	const store = createClaimsStore([], { local });
	store.recordSent('First', null);
	store.recordSent('Second', null);
	assert.equal(store.unplaced(), 'Second');
	assert.equal(local.items.get(UNPLACED_KEY), 'Second');
});

test('lighting a star leaves a waiting ask waiting', () => {
	const store = createClaimsStore([], { local: memory() });
	store.recordSent('Waiting', null);
	store.recordSent('Direct', 'slot-4');
	assert.equal(store.unplaced(), 'Waiting');
	assert.equal(store.all().get('slot-4')?.ask, 'Direct');
});

// ────────────────────────────────────────────────────────────── place ──

test('place moves the waiting ask onto an empty star', () => {
	const local = memory();
	const store = createClaimsStore([], { local });
	store.recordSent('Waiting', null);
	const events = listen(store);

	store.place('slot-20');

	assert.deepEqual(store.all().get('slot-20'), { slot: 'slot-20', ask: 'Waiting' });
	assert.equal(store.unplaced(), null);
	assert.deepEqual(events, [{ type: 'claimed', slot: 'slot-20' }]);
	assert.deepEqual(stored(local), [{ slot: 'slot-20', ask: 'Waiting' }]);
	assert.equal(local.items.has(UNPLACED_KEY), false, 'nothing is left waiting on disk');
});

test('place refuses a lit star and the ask keeps waiting', () => {
	const store = createClaimsStore([{ slot: 'slot-3', ask: 'published' }], { local: memory() });
	store.recordSent('Direct', 'slot-4');
	store.recordSent('Waiting', null);
	const events = listen(store);

	store.place('slot-3');
	store.place('slot-4');
	store.place('slot-0' as SlotId);

	assert.equal(store.unplaced(), 'Waiting');
	assert.equal(store.all().get('slot-3')?.ask, 'published');
	assert.equal(store.all().get('slot-4')?.ask, 'Direct');
	assert.deepEqual(events, []);
});

test('place with nothing waiting does nothing', () => {
	const local = memory();
	const store = createClaimsStore([], { local });
	const events = listen(store);
	store.place('slot-1');
	assert.equal(store.all().size, 0);
	assert.deepEqual(events, []);
	assert.equal(local.items.size, 0);
});

test('one waiting ask lights one star, not two', () => {
	const store = createClaimsStore([], { local: memory() });
	store.recordSent('Waiting', null);
	store.place('slot-1');
	store.place('slot-2');
	assert.deepEqual([...store.all().keys()], ['slot-1']);
});

test('an empty waiting ask is still a waiting ask', () => {
	const store = createClaimsStore([], { local: memory() });
	store.recordSent('', null);
	assert.equal(store.unplaced(), '');
	store.place('slot-1');
	assert.equal(store.isLit('slot-1'), true);
	assert.equal(store.unplaced(), null);
});

// ─────────────────────────────────────────────────────────────── pick ──

test('pick chooses an empty star and remembers it for the session', () => {
	const session = memory();
	const local = memory();
	const store = createClaimsStore([], { local, session });
	const events = listen(store);

	store.pick('slot-8');

	assert.equal(store.picked(), 'slot-8');
	assert.deepEqual(events, [{ type: 'picked', slot: 'slot-8' }]);
	assert.equal(session.items.get(PICKED_KEY), 'slot-8');
	assert.equal(local.items.size, 0, 'a pick is never written where it would outlive the session');
	assert.equal(createClaimsStore([], { local, session }).picked(), 'slot-8');
});

test('pick refuses lit stars', () => {
	const store = createClaimsStore([{ slot: 'slot-3', ask: 'published' }], {
		local: memory(),
		session: memory(),
	});
	store.recordSent('Mine', 'slot-4');
	store.pick('slot-8');
	const events = listen(store);

	store.pick('slot-3');
	store.pick('slot-4');

	assert.equal(store.picked(), 'slot-8', 'the earlier pick stands');
	assert.deepEqual(events, []);
});

test('pick refuses what is not a slot', () => {
	const store = createClaimsStore([]);
	const events = listen(store);
	for (const bad of ['slot-0', 'slot-147', 'star', '']) store.pick(bad as SlotId);
	assert.equal(store.picked(), null);
	assert.deepEqual(events, []);
});

test('pick(null) lets go of the star', () => {
	const session = memory();
	const store = createClaimsStore([], { session });
	store.pick('slot-8');
	const events = listen(store);
	store.pick(null);
	assert.equal(store.picked(), null);
	assert.deepEqual(events, [{ type: 'picked', slot: null }]);
	assert.equal(session.items.has(PICKED_KEY), false);
});

test('picking the same star again, or nothing when nothing is picked, says nothing', () => {
	const store = createClaimsStore([]);
	const events = listen(store);
	store.pick(null);
	store.pick('slot-8');
	store.pick('slot-8');
	assert.deepEqual(events, [{ type: 'picked', slot: 'slot-8' }]);
});

test('claiming the picked star lets go of the pick', () => {
	const session = memory();
	const store = createClaimsStore([], { local: memory(), session });
	store.pick('slot-8');
	const events = listen(store);

	store.recordSent('A site', 'slot-8');

	assert.equal(store.picked(), null);
	assert.deepEqual(events, [
		{ type: 'claimed', slot: 'slot-8' },
		{ type: 'picked', slot: null },
	]);
	assert.equal(session.items.has(PICKED_KEY), false);
});

test('claiming another star leaves the pick alone', () => {
	const store = createClaimsStore([], { local: memory(), session: memory() });
	store.pick('slot-8');
	store.recordSent('A site', 'slot-9');
	assert.equal(store.picked(), 'slot-8');
});

test('a remembered pick that is lit by now, or is not a slot, is dropped', () => {
	const lit = memory({ [PICKED_KEY]: 'slot-3' });
	const store = createClaimsStore([{ slot: 'slot-3', ask: 'published' }], { session: lit });
	assert.equal(store.picked(), null);
	assert.equal(lit.items.has(PICKED_KEY), false);

	const junk = memory({ [PICKED_KEY]: 'slot-1; drop table' });
	assert.equal(createClaimsStore([], { session: junk }).picked(), null);
	assert.equal(junk.items.has(PICKED_KEY), false);
});

// ───────────────────────────────────────────────── no send, no claim ──

test('no send, no claim: picking a star lights nothing and stores no claim', () => {
	const local = memory();
	const session = memory();
	const store = createClaimsStore([], { local, session });
	const events = listen(store);

	store.pick('slot-8'); // the visitor chose a star, opened the dialog, and left
	store.pick('slot-9'); // changed their mind
	store.place('slot-9'); // nothing was sent, so nothing is waiting to be placed

	assert.equal(store.all().size, 0);
	assert.equal(store.isLit('slot-8'), false);
	assert.equal(store.isLit('slot-9'), false);
	assert.equal(store.unplaced(), null);
	assert.equal(local.items.size, 0, 'nothing reached localStorage');
	assert.deepEqual(
		events.map((e) => e.type),
		['picked', 'picked'],
	);

	const nextVisit = createClaimsStore([], { local, session: memory() });
	assert.equal(nextVisit.all().size, 0);
	assert.equal(nextVisit.picked(), null, 'a pick does not outlive the session');
});

// ──────────────────────────────────────────────────────── subscribers ──

test('unsubscribe stops the events', () => {
	const store = createClaimsStore([]);
	const events: ClaimsEvent[] = [];
	const stop = store.subscribe((e) => events.push(e));
	store.pick('slot-1');
	stop();
	store.pick('slot-2');
	assert.equal(events.length, 1);
});

test('a subscriber that throws neither undoes the claim nor silences the others', (t) => {
	const logged = t.mock.method(console, 'error', () => {});
	const store = createClaimsStore([], { local: memory() });
	store.subscribe(() => {
		throw new Error('broken listener');
	});
	const events = listen(store);

	store.recordSent('A site', 'slot-1');

	assert.equal(store.isLit('slot-1'), true);
	assert.deepEqual(events, [{ type: 'claimed', slot: 'slot-1' }]);
	assert.equal(logged.mock.callCount(), 1);
});

test('a subscriber sees the finished state', () => {
	const store = createClaimsStore([], { local: memory() });
	store.pick('slot-1');
	const seen: Array<[string, boolean, SlotId | null]> = [];
	store.subscribe((e) => seen.push([e.type, store.isLit('slot-1'), store.picked()]));
	store.recordSent('A site', 'slot-1');
	assert.deepEqual(seen, [
		['claimed', true, null],
		['picked', true, null],
	]);
});

test('a map handed out by all() does not change under its reader', () => {
	const store = createClaimsStore([], { local: memory() });
	const before = store.all();
	store.recordSent('A site', 'slot-1');
	assert.equal(before.size, 0);
	assert.equal(store.all().size, 1);
	assert.equal(store.all(), store.all(), 'and it is the same map until something changes');
});

// ──────────────────────────────────────────────────────────── two tabs ──

test('two tabs: a send in one never drops a star the other lit', () => {
	const local = memory();
	const a = createClaimsStore([], { local });
	const b = createClaimsStore([], { local }); // loaded before A sent anything

	a.recordSent('From tab A', 'slot-1');
	const events = listen(b);
	b.recordSent('From tab B', 'slot-2');

	assert.deepEqual(stored(local), [
		{ slot: 'slot-1', ask: 'From tab A' },
		{ slot: 'slot-2', ask: 'From tab B' },
	]);
	assert.equal(b.isLit('slot-1'), true, 'B learned of A’s star');
	assert.deepEqual(events, [
		{ type: 'claimed', slot: 'slot-1' },
		{ type: 'claimed', slot: 'slot-2' },
	]);
});

test('two tabs: a star lit in the other tab is not lit twice', () => {
	const local = memory();
	const a = createClaimsStore([], { local });
	const b = createClaimsStore([], { local, session: memory() });
	b.pick('slot-1');

	a.recordSent('From tab A', 'slot-1');
	b.recordSent('From tab B', 'slot-1');

	assert.equal(b.all().get('slot-1')?.ask, 'From tab A');
	assert.equal(b.unplaced(), 'From tab B');
	assert.equal(b.picked(), null, 'the star B had picked is lit now');
	assert.deepEqual(stored(local), [{ slot: 'slot-1', ask: 'From tab A' }]);
});

// ─────────────────────────────────────────────────────── the pure core ──

test('the core never changes the state it was given', () => {
	const start = initialState([{ slot: 'slot-3', ask: 'published' }], [], 'slot-8', null);
	const frozen = JSON.stringify([[...start.registry], [...start.device], start.picked]);

	const sent = reduceSent(start, 'A site', 'slot-8');
	reducePick(start, 'slot-9');
	reducePlace({ ...start, unplaced: 'Waiting' }, 'slot-10');
	reduceAdopt(start, parseClaims([{ slot: 'slot-11', ask: 'other tab' }]));

	assert.equal(JSON.stringify([[...start.registry], [...start.device], start.picked]), frozen);
	assert.notEqual(sent.state, start);
	assert.equal(sent.state.registry, start.registry, 'what did not change is shared, not copied');
});

test('a rule that changes nothing hands back the very same state', () => {
	const start = initialState([{ slot: 'slot-3', ask: 'published' }], [], null, null);
	assert.equal(reducePick(start, 'slot-3').state, start);
	assert.equal(reducePick(start, null).state, start);
	assert.equal(reducePlace(start, 'slot-1').state, start);
	assert.equal(reduceAdopt(start, new Map()).state, start);
});

test('litStars puts the registry over the device', () => {
	const state = initialState(
		[{ slot: 'slot-3', ask: 'published' }],
		[
			{ slot: 'slot-3', ask: 'device' },
			{ slot: 'slot-4', ask: 'device' },
		],
		null,
		null,
	);
	assert.deepEqual([...litStars(state).values()].map((c) => `${c.slot}:${c.ask}`).sort(), [
		'slot-3:published',
		'slot-4:device',
	]);
});

test('adopting a claim the registry already shows makes no noise', () => {
	const start = initialState([{ slot: 'slot-3', ask: 'published' }], [], null, null);
	const step = reduceAdopt(start, parseClaims([{ slot: 'slot-3', ask: 'device copy' }]));
	assert.deepEqual(step.events, []);
	assert.equal(litStars(step.state).get('slot-3')?.ask, 'published');
});
