// Gabriel's "a client finished a step" email. Built only from the stored
// record, so nothing a client's browser sends ever reaches the email.

import { buildSteps } from '../../../src/onboard/steps.ts';
import type { ClientRow } from './store.ts';

export interface MailEnv {
	RESEND_API_KEY?: string;
	NOTIFY_TO?: string;
	NOTIFY_FROM?: string;
}

const config = (c: ClientRow) => ({
	n: c.name,
	e: c.email,
	d: c.domain,
	l: c.lane,
	t: c.tier,
	m: c.mode,
});

/** True when Resend accepted the email. Never throws. */
export async function sendStepEmail(
	env: MailEnv,
	c: ClientRow,
	stepIndex: number,
	via: 'invite' | 'button',
): Promise<boolean> {
	if (c.mode === 'person') return false;
	if (!env.RESEND_API_KEY || !env.NOTIFY_TO || !env.NOTIFY_FROM) return false;
	const steps = buildSteps(config(c));
	const step = steps[stepIndex];
	if (!step) return false;

	const name = c.name.replace(/[^\p{L}\p{N} .'&-]/gu, '').slice(0, 60) || 'A client';
	const prefix = c.mode === 'test' ? '[TEST] ' : '';
	const n = stepIndex + 1;
	const last = n === steps.length;
	const subject = `${prefix}Onboarding: ${name} ${via === 'invite' ? 'sent your invite' : 'finished a step'} (step ${n} of ${steps.length})`;
	const lines = [
		`${name} finished step ${n} of ${steps.length}: ${step.title}.`,
		via === 'invite' ? 'Their invite has reached you. Accept it from your email or dashboard.' : '',
		last ? 'That was the last step — your follow-up checklist is on the dashboard.' : '',
		'',
		'https://cellestialstudio.com/dashboard/',
	].filter((l, i, a) => l !== '' || a[i - 1] !== '');
	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				authorization: `Bearer ${env.RESEND_API_KEY}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				from: env.NOTIFY_FROM,
				to: [env.NOTIFY_TO],
				subject,
				text: lines.join('\n'),
			}),
		});
		return res.ok;
	} catch {
		return false;
	}
}
