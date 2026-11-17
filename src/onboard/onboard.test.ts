import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CF_ROLE, type ClientConfig, decodeConfig, encodeConfig, STUDIO_EMAIL } from './link.ts';
import { buildSteps, newInvites, slugify } from './steps.ts';

const base: ClientConfig = {
	v: 1,
	n: 'Enowood Carpentry',
	e: 'enock@enowood.com',
	d: 'enowood.com',
	l: 'ms',
	t: 2,
	m: 'test',
};

test('encode/decode round-trips, including non-ASCII names', () => {
	const c = { ...base, n: 'Café Señora' };
	assert.deepEqual(decodeConfig(encodeConfig(c)), c);
});

test('encoded form is URL-fragment safe (base64url, no padding)', () => {
	assert.match(encodeConfig(base), /^[A-Za-z0-9_-]+$/);
});

test('decode rejects garbage and out-of-range fields', () => {
	assert.equal(decodeConfig(''), null);
	assert.equal(decodeConfig('not base64 at all!'), null);
	assert.equal(decodeConfig(encodeConfig({ ...base, l: 'x' as never })), null);
	assert.equal(decodeConfig(encodeConfig({ ...base, t: 3 as never })), null);
	assert.equal(decodeConfig(encodeConfig({ ...base, m: 'admin' as never })), null);
	assert.equal(decodeConfig(encodeConfig({ ...base, v: 2 as never })), null);
	assert.equal(decodeConfig(encodeConfig({ ...base, n: '' })), null);
});

test('tier 2/3 gets all four steps in order; tier 1 skips GitHub', () => {
	assert.deepEqual(
		buildSteps(base).map((s) => s.id),
		['gh-signup', 'gh-org', 'cf-signup', 'cf-invite'],
	);
	assert.deepEqual(
		buildSteps({ ...base, t: 1 }).map((s) => s.id),
		['cf-signup', 'cf-invite'],
	);
});

test('GitHub signup pre-fills the email and chains to free org creation', () => {
	const url = new URL(buildSteps(base)[0].url);
	assert.equal(url.origin + url.pathname, 'https://github.com/signup');
	assert.equal(url.searchParams.get('user_email'), 'enock@enowood.com');
	assert.equal(url.searchParams.get('return_to'), '/account/organizations/new?plan=free');
});

test('lanes change the instructions, not the order', () => {
	const ms = buildSteps(base)[0].lines.join(' ');
	const g = buildSteps({ ...base, l: 'g' })[0].lines.join(' ');
	assert.match(ms, /password/i);
	assert.match(g, /Continue with Google/);
});

test('Cloudflare invite copies the studio email and names the exact role', () => {
	const invite = buildSteps(base).find((s) => s.id === 'cf-invite');
	assert.ok(invite);
	assert.equal(invite.copy?.value, STUDIO_EMAIL);
	assert.equal(invite.detect, 'cloudflare');
	assert.ok(invite.lines.some((l) => l.includes(CF_ROLE)));
	assert.equal(invite.url, 'https://dash.cloudflare.com/?to=/:account/members');
});

test('Cloudflare signup copies the client email and chains to Members', () => {
	const s = buildSteps(base).find((x) => x.id === 'cf-signup');
	assert.equal(s?.copy?.value, 'enock@enowood.com');
	assert.equal(s?.url, 'https://dash.cloudflare.com/sign-up?to=/:account/members');
});

test('GitHub org step suggests a slug and detects GitHub invites', () => {
	const s = buildSteps(base).find((x) => x.id === 'gh-org');
	assert.equal(s?.detect, 'github');
	assert.ok(s?.lines.some((l) => l.includes('enowood-carpentry')));
});

test('newInvites returns only ids absent from the baseline', () => {
	assert.deepEqual(newInvites(['a', 'b'], ['b', 'c', 'a', 'd']), ['c', 'd']);
	assert.deepEqual(newInvites(['a'], ['a']), []);
});

test('slugify', () => {
	assert.equal(slugify("  Bob's Café & Bar! "), 'bobs-cafe-bar');
	assert.equal(slugify('!!!'), 'my-business');
});
