// Run: node workers/auth/test/broker.test.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const worker = (await import(resolve(here, '../src/index.ts'))).default;

const env = { OAUTH_GITHUB_CLIENT_ID: 'Ov23liGhNy5svNQkVD3Y', OAUTH_GITHUB_CLIENT_SECRET: 's3cret' };
const get = (path, { cookie, env: e = env } = {}) =>
  worker.fetch(new Request(`https://cellestialstudio.com${path}`, { headers: cookie ? { cookie } : {} }), e);

let pass = 0;
const t = async (name, fn) => { await fn(); console.log('  ok  -', name); pass++; };

const r1 = await get('/api/auth?provider=github');
const loc = new URL(r1.headers.get('location'));
const cookie1 = r1.headers.get('set-cookie');
const state = /decap_oauth_state=([^;]+)/.exec(cookie1)[1];

await t('/api/auth 302s to github authorize', () => {
  assert.equal(r1.status, 302);
  assert.equal(loc.origin + loc.pathname, 'https://github.com/login/oauth/authorize');
});
await t('carries client_id, scope, callback uri, state', () => {
  assert.equal(loc.searchParams.get('client_id'), env.OAUTH_GITHUB_CLIENT_ID);
  assert.equal(loc.searchParams.get('scope'), 'public_repo');
  assert.equal(loc.searchParams.get('redirect_uri'), 'https://cellestialstudio.com/api/auth/callback');
  assert.equal(loc.searchParams.get('state'), state);
});
await t('state cookie is HttpOnly + Secure + path-scoped', () => {
  for (const f of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/api/auth']) assert.ok(cookie1.includes(f), f);
});
await t('state is fresh per request', async () => {
  const r = await get('/api/auth');
  assert.notEqual(/decap_oauth_state=([^;]+)/.exec(r.headers.get('set-cookie'))[1], state);
});
await t('missing client_id -> 500, no redirect', async () => {
  const r = await get('/api/auth', { env: {} });
  assert.equal(r.status, 500);
  assert.equal(r.headers.get('location'), null);
});
await t('unrelated paths are refused, not served', async () => {
  for (const p of ['/', '/admin/', '/api/other']) {
    const r = await get(p);
    assert.equal(r.status, 404, p);
  }
});
await t('non-GET is 405 with Allow', async () => {
  const r = await worker.fetch(new Request('https://cellestialstudio.com/api/auth', { method: 'POST' }), env);
  assert.equal(r.status, 405);
  assert.equal(r.headers.get('allow'), 'GET');
});

const realFetch = globalThis.fetch;
let seen = null;
const stubToken = () => { globalThis.fetch = async (u, i) => { seen = { url: String(u), body: JSON.parse(i.body) }; return new Response(JSON.stringify({ access_token: 'gho_TESTTOKEN' }), { headers: { 'content-type': 'application/json' } }); }; };

stubToken();
const okRes = await get(`/api/auth/callback?code=abc123&state=${state}`, { cookie: `decap_oauth_state=${state}` });
const okHtml = await okRes.text();

await t('success: posts authorization:github:success with the token', () => {
  assert.ok(okHtml.includes('authorization:github:success'));
  assert.ok(okHtml.includes('gho_TESTTOKEN'));
  assert.ok(okHtml.includes("postMessage('authorizing:github'"));
});
await t('success: secret goes to github, never to the browser', () => {
  assert.equal(seen.url, 'https://github.com/login/oauth/access_token');
  assert.equal(seen.body.client_secret, 's3cret');
  assert.equal(seen.body.code, 'abc123');
  assert.ok(!okHtml.includes('s3cret'));
});
await t('success: clears the state cookie', () => {
  assert.ok(okRes.headers.getSetCookie().some((c) => c.includes('decap_oauth_state=;')));
});
await t('state mismatch -> error page, github never contacted', async () => {
  seen = null; stubToken();
  const r = await get(`/api/auth/callback?code=abc&state=attacker`, { cookie: `decap_oauth_state=${state}` });
  assert.ok((await r.text()).includes('authorization:github:error'));
  assert.equal(seen, null);
});
await t('missing cookie -> error page, github never contacted', async () => {
  seen = null; stubToken();
  const r = await get(`/api/auth/callback?code=abc&state=${state}`);
  assert.ok((await r.text()).includes('authorization:github:error'));
  assert.equal(seen, null);
});
await t('missing code -> error page', async () => {
  const r = await get(`/api/auth/callback?state=${state}`, { cookie: `decap_oauth_state=${state}` });
  assert.ok((await r.text()).includes('authorization:github:error'));
});
await t('no secret set yet -> honest error, no exchange attempt', async () => {
  seen = null; globalThis.fetch = async (u) => { seen = u; return new Response('{}'); };
  const r = await get(`/api/auth/callback?code=abc&state=${state}`, {
    cookie: `decap_oauth_state=${state}`, env: { OAUTH_GITHUB_CLIENT_ID: 'x' },
  });
  assert.ok((await r.text()).includes('authorization:github:error'));
  assert.equal(seen, null);
});
await t('github error -> reason surfaced, no token', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'bad_verification_code', error_description: 'expired' }), { headers: { 'content-type': 'application/json' } });
  const h = await (await get(`/api/auth/callback?code=stale&state=${state}`, { cookie: `decap_oauth_state=${state}` })).text();
  assert.ok(h.includes('authorization:github:error') && h.includes('expired'));
});
await t('token payload cannot break out of the script tag', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'x</script><img src=1>' }), { headers: { 'content-type': 'application/json' } });
  const h = await (await get(`/api/auth/callback?code=abc&state=${state}`, { cookie: `decap_oauth_state=${state}` })).text();
  assert.ok(!h.includes('</script><img'), 'raw break-out present');
  assert.ok(h.includes('\\u003c/script'));
});
globalThis.fetch = realFetch;
console.log(`\n${pass} checks passed`);
