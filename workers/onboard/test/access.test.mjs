// Run: node workers/onboard/test/access.test.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { verifyAccess, resetAccessKeys } = await import(resolve(here, '../src/access.ts'));

let pass = 0;
const t = async (name, fn) => {
	resetAccessKeys();
	await fn();
	console.log('  ok  -', name);
	pass++;
};

const TEAM = 'studio-test.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const env = { ACCESS_TEAM: TEAM, ACCESS_AUD: AUD };

const alg = {
	name: 'RSASSA-PKCS1-v1_5',
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: 'SHA-256',
};
const good = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
const other = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', good.publicKey)), kid: 'k1', alg: 'RS256' };

let certFetches = 0;
globalThis.fetch = async (url) => {
	assert.equal(String(url), `https://${TEAM}/cdn-cgi/access/certs`);
	certFetches++;
	return Response.json({ keys: [jwk] });
};

const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

async function sign(
	payload,
	{ key = good.privateKey, header = { alg: 'RS256', kid: 'k1', typ: 'JWT' } } = {},
) {
	const head = b64u(JSON.stringify(header));
	const body = b64u(JSON.stringify(payload));
	const sig = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		key,
		new TextEncoder().encode(`${head}.${body}`),
	);
	return `${head}.${body}.${b64u(new Uint8Array(sig))}`;
}

const claims = (over = {}) => ({
	aud: [AUD],
	iss: `https://${TEAM}`,
	email: 'gabriel@example.com',
	exp: now() + 600,
	iat: now() - 5,
	...over,
});

const req = (token) =>
	new Request('https://cellestialstudio.com/api/onboard/admin/clients', {
		headers: token === undefined ? {} : { 'cf-access-jwt-assertion': token },
	});

await t('a valid token passes', async () => {
	assert.equal(await verifyAccess(req(await sign(claims())), env), 'ok');
});

await t('aud given as a plain string also passes', async () => {
	assert.equal(await verifyAccess(req(await sign(claims({ aud: AUD }))), env), 'ok');
});

await t('keys are fetched once and reused', async () => {
	certFetches = 0;
	await verifyAccess(req(await sign(claims())), env);
	await verifyAccess(req(await sign(claims())), env);
	assert.equal(certFetches, 1);
});

await t('missing settings answer unconfigured, even with a good token', async () => {
	const tok = await sign(claims());
	assert.equal(await verifyAccess(req(tok), {}), 'unconfigured');
	assert.equal(await verifyAccess(req(tok), { ACCESS_TEAM: TEAM }), 'unconfigured');
	assert.equal(await verifyAccess(req(tok), { ACCESS_AUD: AUD }), 'unconfigured');
});

await t('no token, garbage token: denied', async () => {
	assert.equal(await verifyAccess(req(undefined), env), 'denied');
	assert.equal(await verifyAccess(req('not.a.jwt'), env), 'denied');
	assert.equal(await verifyAccess(req('abc'), env), 'denied');
});

await t('signed by another key: denied', async () => {
	assert.equal(
		await verifyAccess(req(await sign(claims(), { key: other.privateKey })), env),
		'denied',
	);
});

await t('wrong audience or issuer: denied', async () => {
	assert.equal(
		await verifyAccess(req(await sign(claims({ aud: ['someone-else'] }))), env),
		'denied',
	);
	assert.equal(
		await verifyAccess(req(await sign(claims({ iss: 'https://evil.example' }))), env),
		'denied',
	);
});

await t('expired or not yet valid: denied', async () => {
	assert.equal(await verifyAccess(req(await sign(claims({ exp: now() - 1 }))), env), 'denied');
	assert.equal(await verifyAccess(req(await sign(claims({ nbf: now() + 600 }))), env), 'denied');
	assert.equal(await verifyAccess(req(await sign(claims({ exp: undefined }))), env), 'denied');
});

await t('alg none or HS256, unknown kid: denied', async () => {
	const p = b64u(JSON.stringify(claims()));
	assert.equal(
		await verifyAccess(req(`${b64u(JSON.stringify({ alg: 'none', kid: 'k1' }))}.${p}.`), env),
		'denied',
	);
	assert.equal(
		await verifyAccess(req(await sign(claims(), { header: { alg: 'HS256', kid: 'k1' } })), env),
		'denied',
	);
	assert.equal(
		await verifyAccess(req(await sign(claims(), { header: { alg: 'RS256', kid: 'k9' } })), env),
		'denied',
	);
});

await t('certs endpoint down: denied, never open', async () => {
	const saved = globalThis.fetch;
	globalThis.fetch = async () => new Response('down', { status: 500 });
	assert.equal(await verifyAccess(req(await sign(claims())), env), 'denied');
	globalThis.fetch = saved;
});

console.log(`access: ${pass} passed`);
