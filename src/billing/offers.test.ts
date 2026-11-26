import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OFFERS, offerText } from '../content/offers.ts';
import { BILLING_OFFERS, planSummary, readPrice } from './offers.ts';

const cohort = BILLING_OFFERS.find((o) => o.id === 'cohort');
const quoted = BILLING_OFFERS.find((o) => o.id === 'quoted');
assert.ok(cohort && quoted);

test('the founding cohort matches the locked site copy', () => {
	const site = offerText(OFFERS.find((o) => o.id === 'site') ?? OFFERS[0]);
	assert.match(site, new RegExp(`\\$${cohort.buildWas} slashed → FREE — founding cohort`));
	assert.match(
		site,
		new RegExp(`\\$${cohort.careWas}/mo slashed → \\$${cohort.care}/mo, locked for life`),
	);
	assert.equal(cohort.build, 0);
	assert.equal(cohort.locked, true);
});

test('offer ids are unique', () => {
	assert.equal(new Set(BILLING_OFFERS.map((o) => o.id)).size, BILLING_OFFERS.length);
});

test('cohort summary: free build, locked care from go-live', () => {
	assert.deepEqual(planSummary(cohort, 'Test Bakery'), {
		ok: true,
		text: 'Test Bakery · Founding cohort · Build: free · Care: $39/mo, locked for life, starting when their site goes live',
	});
});

test('quoted summary needs both prices', () => {
	assert.deepEqual(planSummary(quoted, 'Test Bakery'), {
		ok: false,
		error: 'Type in the build price.',
	});
	assert.deepEqual(planSummary(quoted, 'Test Bakery', { build: 2500 }), {
		ok: false,
		error: 'Type in the monthly care price.',
	});
	assert.deepEqual(planSummary(quoted, 'Test Bakery', { build: 2500, care: 89 }), {
		ok: true,
		text: 'Test Bakery · Quoted build · Build: $2,500, invoiced now · Care: $89/mo, starting when their site goes live',
	});
});

test('no client, no summary', () => {
	assert.deepEqual(planSummary(cohort, ' '), { ok: false, error: 'Pick a client first.' });
});

test('prices read as whole dollars', () => {
	assert.equal(readPrice('$2,500'), 2500);
	assert.equal(readPrice(' 89 '), 89);
	assert.equal(readPrice('0'), 0);
	assert.equal(readPrice('12.50'), null);
	assert.equal(readPrice('-5'), null);
	assert.equal(readPrice(''), null);
});
