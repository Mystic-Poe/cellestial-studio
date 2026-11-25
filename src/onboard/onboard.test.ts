import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CF_ROLE, type ClientConfig, STUDIO_EMAIL } from './link.ts';
import { buildSteps, newInvites, slugify } from './steps.ts';

const base: ClientConfig = {
	n: 'Enowood Carpentry',
	e: 'enock@enowood.com',
	d: 'enowood.com',
	l: 'ms',
	t: 2,
	m: 'test',
};

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

// Nov 24 live test: with the return_to chain, Google sign-up jumped to the
// org page before the username screen, leaving a half-made account that
// looped on sign-in. The Google lane lets GitHub finish its own flow.
test('Google lane: plain GitHub signup, no chain, says when it is finished', () => {
	const s = buildSteps({ ...base, l: 'g' })[0];
	const url = new URL(s.url);
	assert.equal(url.origin + url.pathname, 'https://github.com/signup');
	assert.equal(url.searchParams.get('return_to'), null);
	const words = s.lines.join(' ');
	assert.match(words, /username/i);
	assert.match(words, /home page/i);
	assert.match(words, /sign-in page/i);
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
