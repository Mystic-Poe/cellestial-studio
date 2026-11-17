// The client-facing steps, in order. Gro's spec (Nov 16) as corrected Nov 17:
// the client's part ends once Gabriel is invited on Cloudflare. Billing and
// the domain purchase are Gabriel's own steps (see /start/new).

import { CF_ROLE, type ClientConfig, STUDIO_EMAIL } from './link.ts';

export type StepId = 'gh-signup' | 'gh-org' | 'cf-signup' | 'cf-invite';

export interface Step {
	id: StepId;
	title: string;
	/** Deep link opened in a new tab */
	url: string;
	/** Written to the clipboard when the step is opened */
	copy?: { label: string; value: string };
	/** Invite feed whose new entry completes this step automatically */
	detect?: 'github' | 'cloudflare';
	/** Plain-language "what you'll see / do" lines */
	lines: string[];
}

export function slugify(name: string): string {
	const s = name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 39);
	return s || 'my-business';
}

export function buildSteps(c: ClientConfig): Step[] {
	const ms = c.l === 'ms';
	const steps: Step[] = [];

	if (c.t === 2) {
		const signup = new URL('https://github.com/signup');
		signup.searchParams.set('user_email', c.e);
		signup.searchParams.set('return_to', '/account/organizations/new?plan=free');
		steps.push({
			id: 'gh-signup',
			title: 'Create your GitHub account',
			url: signup.toString(),
			lines: ms
				? [
						'Your email is already filled in.',
						'Choose a password and a username, then enter the code GitHub emails you.',
						'GitHub may show a short puzzle — that is normal.',
					]
				: [
						'Tap "Continue with Google" and pick your business account.',
						'Choose a username when asked.',
					],
		});
		steps.push({
			id: 'gh-org',
			title: 'Create your organization and invite Gabriel',
			url: 'https://github.com/account/organizations/new?plan=free',
			copy: { label: 'Gabriel’s email', value: STUDIO_EMAIL },
			detect: 'github',
			lines: [
				`Organization name: ${slugify(c.n)} (any name works).`,
				'Choose the Free plan.',
				'When it asks who to add, paste Gabriel’s email (already copied) and invite him as Owner.',
			],
		});
	}

	steps.push({
		id: 'cf-signup',
		title: 'Create your Cloudflare account',
		url: 'https://dash.cloudflare.com/sign-up?to=/:account/members',
		copy: { label: 'Your email', value: c.e },
		lines: ms
			? [
					'Paste your email (already copied) and choose a password.',
					'Cloudflare emails you a link — open it to verify.',
				]
			: ['Tap "Continue with Google" and pick your business account.'],
	});
	steps.push({
		id: 'cf-invite',
		title: 'Invite Gabriel to Cloudflare',
		url: 'https://dash.cloudflare.com/?to=/:account/members',
		copy: { label: 'Gabriel’s email', value: STUDIO_EMAIL },
		detect: 'cloudflare',
		lines: [
			'Tap "Invite", then paste Gabriel’s email (already copied).',
			`For the role, pick: ${CF_ROLE}`,
			'Then send the invite. That’s the last step.',
		],
	});
	return steps;
}

/** Invite ids present now that were not there when the step began. */
export function newInvites(baseline: string[], current: string[]): string[] {
	const seen = new Set(baseline);
	return current.filter((id) => !seen.has(id));
}
