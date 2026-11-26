// Billing routes against a pretend Stripe. Run: node workers/onboard/test/billing.test.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUD, accessToken, certs, TEAM } from './access-token.mjs';
import { fakeD1 } from './fake-d1.mjs';
import { fakeR2 } from './fake-r2.mjs';
import { fakeStripe } from './fake-stripe.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const worker = (await import(resolve(here, '../src/index.ts'))).default;
const { encode } = await import(resolve(here, '../src/stripe.ts'));

let stripe;
globalThis.fetch = async (url, init) => {
	if (String(url).endsWith('/cdn-cgi/access/certs')) return Response.json(certs);
	if (String(url).startsWith('https://api.stripe.com/')) return stripe.handle(url, init);
	return new Response('{}', { status: 500 });
};

const ORIGIN = 'https://cellestialstudio.com';
const KEY = 'rk_test_abc';
let db;
const env = (over = {}) => ({
	ACCESS_TEAM: TEAM,
	ACCESS_AUD: AUD,
	DB: db,
	PHOTOS: fakeR2(),
	STRIPE_SECRET_KEY: KEY,
	...over,
});
const good = await accessToken();
const call = async (path, { method = 'GET', json, e = env() } = {}) => {
	const h = { 'cf-access-jwt-assertion': good };
	if (method !== 'GET') h['content-type'] = 'application/json';
	const r = await worker.fetch(
		new Request(`${ORIGIN}/api/onboard/admin${path}`, {
			method,
			headers: h,
			body: method === 'GET' ? undefined : JSON.stringify(json ?? {}),
		}),
		e,
		{ waitUntil() {} },
	);
	return { status: r.status, body: await r.json() };
};

let pass = 0;
const t = async (name, fn) => {
	db = fakeD1();
	stripe = fakeStripe();
	await fn();
	console.log('  ok  -', name);
	pass++;
};
const create = async () =>
	(
		await call('/clients', {
			method: 'POST',
			json: { name: 'Test Bakery', email: 'owner@example.com' },
		})
	).body;
const join = (c) => call(`/clients/${c.id}/billing`, { method: 'POST', json: { offer: 'cohort' } });
const overview = async () => (await call('/billing')).body;

await t('form encoding nests the way Stripe reads it', () => {
	assert.equal(
		decodeURIComponent(
			encode({
				a: 1,
				items: [{ price: 'p' }],
				keys: ['k'],
				meta: { x: 'y' },
				skip: undefined,
			}).join('&'),
		),
		'a=1&items[0][price]=p&keys[]=k&meta[x]=y',
	);
});

await t('without a key: overview says not connected; setup refuses, nothing sent', async () => {
	assert.deepEqual((await call('/billing', { e: env({ STRIPE_SECRET_KEY: '' }) })).body, {
		connected: false,
	});
	const c = await create();
	const r = await call(`/clients/${c.id}/billing`, {
		method: 'POST',
		json: { offer: 'cohort' },
		e: env({ STRIPE_SECRET_KEY: undefined }),
	});
	assert.equal(r.status, 503);
	assert.equal(stripe.calls.length, 0);
});

await t('confirm: a Stripe customer and a card link; nothing charged', async () => {
	const c = await create();
	const r = await join(c);
	assert.equal(r.status, 201);
	assert.equal(r.body.status, 'card_pending');
	assert.match(r.body.card_link, /^https:\/\/checkout\.stripe\.com\//);
	assert.equal(stripe.customers.length, 1);
	assert.equal(stripe.customers[0].email, 'owner@example.com');
	assert.equal(stripe.sessions[0].success_url, `${ORIGIN}/start/card-saved/`);
	assert.equal(stripe.subs.length, 0);
	const o = await overview();
	assert.equal(o.mode, 'test');
	assert.equal(o.plans[0].status, 'card_pending');
	assert.equal(o.plans[0].card_link, r.body.card_link);
	assert.deepEqual(o.figures, { monthly: 0, owed: 0, paid_this_month: 0 });
	assert.equal((await join(c)).status, 409, 'once only');
});

await t('only offers with a Stripe price can start, and the price must match', async () => {
	const c = await create();
	assert.equal(
		(await call(`/clients/${c.id}/billing`, { method: 'POST', json: { offer: 'quoted' } })).status,
		400,
	);
	assert.equal(
		(await call(`/clients/${c.id}/billing`, { method: 'POST', json: { offer: 'nope' } })).status,
		400,
	);
	stripe.prices[0].unit_amount = 4900;
	const r = await join(c);
	assert.equal(r.status, 409);
	assert.match(r.body.error, /\$49, not \$39/);
	assert.equal(stripe.customers.length, 0, 'no customer made on a mismatch');
});

await t('moving to Live starts care once the card is saved', async () => {
	const c = await create();
	await join(c);
	// No card yet: Live doesn't start anything, and Start care says why.
	await call(`/clients/${c.id}`, { method: 'PATCH', json: { stage: 'live' } });
	assert.equal(stripe.subs.length, 0);
	const early = await call(`/clients/${c.id}/billing/start`, { method: 'POST' });
	assert.equal(early.status, 409);
	assert.match(early.body.error, /card/);
	// They save a card: the next look at Billing sees they're Live and starts care.
	stripe.saveCard(stripe.sessions[0].id);
	const o = await overview();
	assert.equal(stripe.subs.length, 1);
	assert.equal(stripe.subs[0].default_payment_method, `pm_${stripe.sessions[0].id}`);
	assert.equal(stripe.subs[0].items.data[0].price.id, 'price_cohort');
	assert.equal(o.plans[0].status, 'active');
	assert.ok(o.plans[0].next > Date.now() / 1000);
	assert.deepEqual(o.figures, { monthly: 39, owed: 0, paid_this_month: 39 });
	assert.equal(o.invoices[0].name, 'Test Bakery');
});

await t('card saved first, then Live: care starts at the stage change', async () => {
	const c = await create();
	await join(c);
	stripe.saveCard(stripe.sessions[0].id);
	assert.equal((await overview()).plans[0].status, 'card_saved');
	assert.equal(stripe.subs.length, 0, 'not before Live');
	await call(`/clients/${c.id}`, { method: 'PATCH', json: { stage: 'review' } });
	assert.equal(stripe.subs.length, 0);
	await call(`/clients/${c.id}`, { method: 'PATCH', json: { stage: 'live' } });
	assert.equal(stripe.subs.length, 1);
	// Again is harmless: one plan per client.
	assert.equal((await call(`/clients/${c.id}/billing/start`, { method: 'POST' })).status, 200);
	assert.equal(stripe.subs.length, 1);
});

await t('start care now, before Live', async () => {
	const c = await create();
	await join(c);
	stripe.saveCard(stripe.sessions[0].id);
	assert.equal((await call(`/clients/${c.id}/billing/start`, { method: 'POST' })).status, 200);
	assert.equal(stripe.subs.length, 1);
	assert.equal((await overview()).plans[0].status, 'active');
});

await t('a new card link replaces an expired one; not once a card is saved', async () => {
	const c = await create();
	const first = (await join(c)).body.card_link;
	const r = await call(`/clients/${c.id}/billing/link`, { method: 'POST' });
	assert.equal(r.status, 200);
	assert.notEqual(r.body.card_link, first);
	assert.equal(stripe.customers.length, 1, 'same customer');
	assert.equal((await overview()).plans[0].card_link, r.body.card_link);
	stripe.saveCard(stripe.sessions[1].id);
	assert.equal((await call(`/clients/${c.id}/billing/link`, { method: 'POST' })).status, 409);
});

await t('a Stripe error comes back as words, not a crash', async () => {
	const c = await create();
	const r = await call(`/clients/${c.id}/billing`, {
		method: 'POST',
		json: { offer: 'cohort' },
		e: env({ STRIPE_SECRET_KEY: 'rk_live_wrong' }),
	});
	assert.equal(r.status, 502);
	assert.equal(r.body.error, 'Invalid API key.');
});

await t('deleting a client forgets their billing row', async () => {
	const c = await create();
	await join(c);
	await call(`/clients/${c.id}`, { method: 'DELETE' });
	assert.deepEqual((await overview()).plans, []);
});

await t('billing routes need Access like the rest', async () => {
	const r = await worker.fetch(new Request(`${ORIGIN}/api/onboard/admin/billing`), env(), {
		waitUntil() {},
	});
	assert.equal(r.status, 401);
});

console.log(`onboard billing: ${pass} passed`);
