// Run: node workers/onboard/test/admin.test.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUD, accessToken, certs, TEAM } from './access-token.mjs';
import { fakeD1 } from './fake-d1.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const worker = (await import(resolve(here, '../src/index.ts'))).default;

globalThis.fetch = async (url) => {
	if (String(url).endsWith('/cdn-cgi/access/certs')) return Response.json(certs);
	return new Response('{}', { status: 500 });
};

let db;
const env = () => ({ ACCESS_TEAM: TEAM, ACCESS_AUD: AUD, DB: db });
const good = await accessToken();

const call = async (path, { method = 'GET', json, token = good, e = env() } = {}) => {
	const headers = { 'content-type': 'application/json' };
	if (token) headers['cf-access-jwt-assertion'] = token;
	const r = await worker.fetch(
		new Request(`https://cellestialstudio.com/api/onboard/admin${path}`, {
			method,
			headers,
			...(json !== undefined ? { body: JSON.stringify(json) } : {}),
		}),
		e,
		{ waitUntil() {} },
	);
	return { status: r.status, body: await r.json().catch(() => null) };
};

let pass = 0;
const t = async (name, fn) => {
	db = fakeD1();
	await fn();
	console.log('  ok  -', name);
	pass++;
};

const fields = {
	name: 'Test Bakery',
	email: 'owner@example.com',
	domain: 'https://www.Example.com/about',
	lane: 'ms',
	tier: 2,
	mode: 'test',
};
const create = async (over = {}) =>
	(await call('/clients', { method: 'POST', json: { ...fields, ...over } })).body;

await t('every admin route is 503 without the Access settings, even with a token', async () => {
	for (const [path, method] of [
		['/clients', 'GET'],
		['/clients', 'POST'],
		['/clients/x', 'GET'],
		['/clients/x', 'PATCH'],
		['/clients/x', 'DELETE'],
		['/clients/x/rotate', 'POST'],
	]) {
		const r = await call(path, {
			method,
			json: method === 'GET' || method === 'DELETE' ? undefined : {},
			e: { DB: db },
		});
		assert.equal(r.status, 503, `${method} ${path}`);
	}
});

await t('every admin route is 401 without a valid token', async () => {
	const expired = await accessToken({ exp: Math.floor(Date.now() / 1000) - 5 });
	for (const token of [null, 'junk', expired]) {
		assert.equal((await call('/clients', { token })).status, 401);
		assert.equal((await call('/clients/x', { method: 'DELETE', token })).status, 401);
	}
});

await t('create returns the client with its link and steps; domain normalised', async () => {
	const r = await call('/clients', { method: 'POST', json: fields });
	assert.equal(r.status, 201);
	assert.equal(r.body.domain, 'example.com');
	assert.equal(r.body.step, 0);
	assert.equal(r.body.status, 'active');
	assert.equal(r.body.link, `https://cellestialstudio.com/start/#${r.body.code}`);
	assert.deepEqual(
		r.body.steps.map((s) => s.id),
		['gh-signup', 'gh-org', 'cf-signup', 'cf-invite'],
	);
});

await t('domain is optional: blank or missing saves as empty', async () => {
	const { domain, ...noDomain } = fields;
	assert.ok(domain);
	for (const json of [{ ...fields, domain: '' }, { ...fields, domain: '   ' }, noDomain]) {
		const r = await call('/clients', { method: 'POST', json });
		assert.equal(r.status, 201);
		assert.equal(r.body.domain, '');
	}
	const made = await call('/clients', { method: 'POST', json: fields });
	const cleared = await call(`/clients/${made.body.id}`, { method: 'PATCH', json: { domain: '' } });
	assert.equal(cleared.status, 200);
	assert.equal(cleared.body.domain, '');
});

await t('create refuses bad fields and names the field', async () => {
	for (const [k, v] of [
		['name', ''],
		['name', 'x'.repeat(81)],
		['email', 'not-an-email'],
		['domain', 'nodot'],
		['lane', 'apple'],
		['tier', 3],
		['mode', 'admin'],
	]) {
		const r = await call('/clients', { method: 'POST', json: { ...fields, [k]: v } });
		assert.equal(r.status, 400, k);
		assert.equal(r.body.field, k);
	}
	const { name, ...noName } = fields;
	assert.equal((await call('/clients', { method: 'POST', json: noName })).body.field, 'name');
	assert.ok(name);
});

await t('list: active and archived', async () => {
	const a = await create({ name: 'Alpha' });
	await create({ name: 'Beta' });
	await call(`/clients/${a.id}`, { method: 'PATCH', json: { status: 'archived' } });
	const active = (await call('/clients')).body.clients.map((c) => c.name);
	const archived = (await call('/clients?status=archived')).body.clients.map((c) => c.name);
	assert.deepEqual(active, ['Beta']);
	assert.deepEqual(archived, ['Alpha']);
});

await t('get one; unknown id is 404', async () => {
	const c = await create();
	assert.equal((await call(`/clients/${c.id}`)).body.name, 'Test Bakery');
	assert.equal((await call('/clients/nope')).status, 404);
	assert.equal((await call('/clients/nope', { method: 'PATCH', json: { name: 'X' } })).status, 404);
});

await t('patch edits fields; the client link stays the same', async () => {
	const c = await create();
	const r = await call(`/clients/${c.id}`, {
		method: 'PATCH',
		json: { name: 'New Name', email: 'new@example.com' },
	});
	assert.equal(r.status, 200);
	assert.equal(r.body.name, 'New Name');
	assert.equal(r.body.email, 'new@example.com');
	assert.equal(r.body.link, c.link);
});

await t('patch merges the checklist and saves notes', async () => {
	const c = await create();
	await call(`/clients/${c.id}`, { method: 'PATCH', json: { checklist: { invites: true } } });
	const r = await call(`/clients/${c.id}`, {
		method: 'PATCH',
		json: { checklist: { card: true }, notes: 'Call Tue' },
	});
	assert.deepEqual(r.body.checklist, { invites: true, billing: false, domain: false, card: true });
	assert.equal(r.body.notes, 'Call Tue');
	assert.equal(
		(await call(`/clients/${c.id}`, { method: 'PATCH', json: { checklist: { hacked: true } } }))
			.status,
		400,
	);
	assert.equal(
		(await call(`/clients/${c.id}`, { method: 'PATCH', json: { checklist: { card: 'yes' } } }))
			.status,
		400,
	);
});

await t('patch sets the step and ticks; finishing marks done; reset makes active', async () => {
	const c = await create({ tier: 1 });
	let r = await call(`/clients/${c.id}`, {
		method: 'PATCH',
		json: { step: 2, done: ['cf-invite', 'cf-signup'] },
	});
	assert.equal(r.body.step, 2);
	assert.deepEqual(r.body.done, ['cf-signup', 'cf-invite']);
	assert.equal(r.body.status, 'done');
	r = await call(`/clients/${c.id}`, { method: 'PATCH', json: { step: 0, done: [] } });
	assert.equal(r.body.status, 'active');
	assert.equal(
		(await call(`/clients/${c.id}`, { method: 'PATCH', json: { step: 3 } })).body.field,
		'step',
	);
	assert.equal(
		(await call(`/clients/${c.id}`, { method: 'PATCH', json: { done: ['gh-org'] } })).body.field,
		'done',
	);
});

await t('a tier change drops ticks that no longer exist', async () => {
	const c = await create();
	await call(`/clients/${c.id}`, {
		method: 'PATCH',
		json: { step: 3, done: ['gh-signup', 'gh-org', 'cf-signup'] },
	});
	const r = await call(`/clients/${c.id}`, { method: 'PATCH', json: { tier: 1 } });
	assert.deepEqual(r.body.done, ['cf-signup']);
	assert.equal(r.body.step, 1);
	assert.deepEqual(
		r.body.steps.map((s) => s.id),
		['cf-signup', 'cf-invite'],
	);
});

await t('an archived client stays archived through other edits', async () => {
	const c = await create();
	await call(`/clients/${c.id}`, { method: 'PATCH', json: { status: 'archived' } });
	const r = await call(`/clients/${c.id}`, { method: 'PATCH', json: { notes: 'x' } });
	assert.equal(r.body.status, 'archived');
});

await t('rotate gives a new link and the old one stops working', async () => {
	const c = await create();
	const r = await call(`/clients/${c.id}/rotate`, { method: 'POST' });
	assert.equal(r.status, 200);
	assert.notEqual(r.body.code, c.code);
	const old = await worker.fetch(
		new Request(`https://cellestialstudio.com/api/onboard/client/${c.code}`),
		env(),
		{
			waitUntil() {},
		},
	);
	assert.equal(old.status, 404);
	assert.equal((await call('/clients/nope/rotate', { method: 'POST' })).status, 404);
});

await t('delete removes the client', async () => {
	const c = await create();
	assert.equal((await call(`/clients/${c.id}`, { method: 'DELETE' })).status, 200);
	assert.equal((await call(`/clients/${c.id}`)).status, 404);
	assert.equal((await call(`/clients/${c.id}`, { method: 'DELETE' })).status, 404);
});

await t('unknown admin paths are 404', async () => {
	assert.equal((await call('/other')).status, 404);
	assert.equal((await call('/clients/x/y/z')).status, 404);
	assert.equal((await call('/clients/x/nope', { method: 'POST' })).status, 404);
});

await t('changes from another site, or not as JSON, are refused', async () => {
	const c = await create();
	const send = (headers, method = 'POST', path = `/clients/${c.id}/rotate`) =>
		worker.fetch(
			new Request(`https://cellestialstudio.com/api/onboard/admin${path}`, {
				method,
				headers: { 'cf-access-jwt-assertion': good, ...headers },
				body: method === 'DELETE' ? undefined : '{}',
			}),
			env(),
			{ waitUntil() {} },
		);
	assert.equal((await send({ 'content-type': 'text/plain' })).status, 403);
	assert.equal((await send({ 'content-type': 'application/x-www-form-urlencoded' })).status, 403);
	assert.equal(
		(await send({ 'content-type': 'application/json', origin: 'https://evil.example' })).status,
		403,
	);
	assert.equal(
		(await send({ 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' })).status,
		403,
	);
	assert.equal((await send({}, 'DELETE', `/clients/${c.id}`)).status, 403);
	assert.equal((await call(`/clients/${c.id}`)).body.code, c.code, 'nothing changed');
	const ok = await send({
		'content-type': 'application/json',
		origin: 'https://cellestialstudio.com',
		'sec-fetch-site': 'same-origin',
	});
	assert.equal(ok.status, 200);
});

console.log(`onboard admin: ${pass} passed`);
