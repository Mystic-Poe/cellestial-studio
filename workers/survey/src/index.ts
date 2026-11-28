// Founding-client survey endpoint — POST /api/survey
//
// Built from the 27 Nov build sheet (the owner's decision of that day). A
// separate Worker on purpose: the contact, /admin and /start Workers are not
// touched. Same proven shape as the contact form: validate shape, then
// Turnstile, then Resend. No database in v1: the email is the record.
//
// Order matters: Turnstile is checked before Resend is touched so spam can
// never spend the mail quota, and a misconfigured Worker answers 503 instead
// of looking like a delivered survey.

export interface Env {
	TURNSTILE_SECRET_KEY?: string;
	RESEND_API_KEY?: string;
	SURVEY_TO?: string;
	SURVEY_FROM?: string;
}

/** The five questions, in the page's order, worded exactly as the page shows them. */
export const QUESTIONS = [
	{ name: 'business', label: 'Your business name', max: 200 },
	{ name: 'doing', label: 'Is the site doing its job?', max: 20 },
	{ name: 'harder', label: 'What, if anything, has it made harder instead of easier?', max: 5000 },
	{
		name: 'tell',
		label: "What would you tell another owner who's thinking about getting a site from me?",
		max: 5000,
	},
	{ name: 'better', label: 'What should I do better next time?', max: 5000 },
] as const;

export const DOING = ['Yes', 'Mostly', 'Not yet'] as const;

/** The subject line keeps to one line whatever was typed. */
const oneLine = (text: string) => text.replace(/[\r\n\t]+/g, ' ').trim();

export function emailText(answers: Record<string, string>): string {
	return `${QUESTIONS.map((q) => `${q.label}\n${answers[q.name]}`).join('\n\n')}\n`;
}

function reply(request: Request, status: number, payload: { ok?: true; error?: string }) {
	const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
	if (wantsJson) {
		return new Response(JSON.stringify(payload), {
			status,
			headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
		});
	}
	// No-JS submit: a plain page. The browser's Back keeps what was typed.
	const message = payload.ok ? 'Thank you — this genuinely helps.' : payload.error;
	const safe = String(message).replace(/[<>&]/g, (c) => `&#${c.charCodeAt(0)};`);
	const back = payload.ok
		? ''
		: '<p>Your answers are still on the form: use your browser’s Back button.</p>';
	return new Response(
		`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex" /><title>Survey</title></head>
<body style="font-family:system-ui,sans-serif;background:#000;color:#eef0f3;padding:2rem;max-width:40rem;line-height:1.5">
<p>${safe}</p>${back}</body></html>`,
		{
			status,
			headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
		},
	);
}

async function verifyHuman(token: string, secret: string, ip: string | null): Promise<boolean> {
	const body = new FormData();
	body.set('secret', secret);
	body.set('response', token);
	if (ip) body.set('remoteip', ip);
	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		body,
	});
	if (!res.ok) return false;
	const data = (await res.json()) as { success?: boolean };
	return data.success === true;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (pathname !== '/api/survey') {
			return new Response('Not found. This Worker only serves /api/survey.', {
				status: 404,
				headers: { 'content-type': 'text/plain' },
			});
		}
		if (request.method !== 'POST') {
			return reply(request, 405, { error: 'Send the survey with POST.' });
		}

		let form: FormData;
		try {
			form = await request.formData();
		} catch {
			return reply(request, 400, { error: 'That submission could not be read.' });
		}

		const answers: Record<string, string> = {};
		for (const q of QUESTIONS) {
			const value = String(form.get(q.name) ?? '').trim();
			if (!value) return reply(request, 400, { error: 'Please answer every question.' });
			if (value.length > q.max) {
				return reply(request, 400, { error: 'One of those answers is too long to send.' });
			}
			answers[q.name] = value;
		}
		if (!(DOING as readonly string[]).includes(answers.doing as string)) {
			return reply(request, 400, { error: 'Please choose Yes, Mostly or Not yet.' });
		}

		if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY || !env.SURVEY_TO || !env.SURVEY_FROM) {
			return reply(request, 503, {
				error: 'The survey is not fully set up yet, so nothing was sent.',
			});
		}

		const token = String(form.get('cf-turnstile-response') ?? '');
		if (!token) {
			return reply(request, 400, { error: 'Please complete the spam check and try again.' });
		}
		const human = await verifyHuman(
			token,
			env.TURNSTILE_SECRET_KEY,
			request.headers.get('cf-connecting-ip'),
		);
		if (!human) {
			return reply(request, 400, { error: 'The spam check did not pass. Please try again.' });
		}

		const sent = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				authorization: `Bearer ${env.RESEND_API_KEY}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				from: env.SURVEY_FROM,
				to: [env.SURVEY_TO],
				subject: `Survey: ${oneLine(answers.business as string)}`,
				text: emailText(answers),
			}),
		}).catch(() => null);

		if (!sent?.ok) {
			return reply(request, 502, {
				error:
					'That did not send, so nothing was lost: your answers are still here. Please try again.',
			});
		}
		return reply(request, 200, { ok: true });
	},
};
