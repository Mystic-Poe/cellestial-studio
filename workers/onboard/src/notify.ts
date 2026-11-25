// Gabriel's emails: a client sent their answers, added photos, or answered a
// review. Built only from the stored record; the one piece of client text (a
// change request) goes in as plain text, never as HTML.

import type { ClientRow } from './store.ts';

export interface MailEnv {
	RESEND_API_KEY?: string;
	NOTIFY_TO?: string;
	NOTIFY_FROM?: string;
}

export type MailKind = 'intake' | 'photos' | 'ok' | 'changes';

const SUBJECT: Record<MailKind, string> = {
	intake: 'sent their answers',
	photos: 'added photos',
	ok: 'approved their site',
	changes: 'asked for changes',
};

/** True when Resend accepted the email. Never throws. */
export async function sendMail(
	env: MailEnv,
	c: ClientRow,
	kind: MailKind,
	text = '',
): Promise<boolean> {
	if (!env.RESEND_API_KEY || !env.NOTIFY_TO || !env.NOTIFY_FROM) return false;
	const name = c.name.replace(/[^\p{L}\p{N} .'&-]/gu, '').slice(0, 60) || 'A client';
	const prefix = c.mode === 'test' ? '[TEST] ' : '';
	const lines = [
		`${name} ${SUBJECT[kind]}.`,
		kind === 'changes' && text ? `\nWhat they asked for:\n\n${text.slice(0, 2000)}\n` : '',
		`https://cellestialstudio.com/dashboard/#c/${encodeURIComponent(c.id)}`,
	].filter(Boolean);
	return sendNotice(env, `${prefix}Onboarding: ${name} ${SUBJECT[kind]}`, lines.join('\n'));
}

/** A plain-text email to Gabriel. True when Resend accepted it. Never throws. */
export async function sendNotice(env: MailEnv, subject: string, text: string): Promise<boolean> {
	if (!env.RESEND_API_KEY || !env.NOTIFY_TO || !env.NOTIFY_FROM) return false;
	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				authorization: `Bearer ${env.RESEND_API_KEY}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({ from: env.NOTIFY_FROM, to: [env.NOTIFY_TO], subject, text }),
		});
		return res.ok;
	} catch {
		return false;
	}
}
