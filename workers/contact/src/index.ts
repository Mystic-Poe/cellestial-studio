// Contact form endpoint — POST /api/contact
//
// Ratified shape (Nov 12): our own edge function + Turnstile + Resend. No
// third-party form service, so the lead data never leaves infrastructure the
// client owns.
//
// Order matters: validate shape, then verify the human, then send. Turnstile is
// checked before Resend is touched so spam can never spend the mail quota.
//
// Resend free tier is 3,000/month AND 100/day. Neither is enforced here -- that
// needs durable storage (KV or D1), which is not provisioned. See README.

export interface Env {
	TURNSTILE_SECRET_KEY?: string;
	RESEND_API_KEY?: string;
	CONTACT_TO?: string;
	CONTACT_FROM?: string;
}

const MAX = { name: 120, email: 254, message: 5000 } as const;

function reply(request: Request, status: number, payload: { ok?: true; error?: string }) {
	const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');

	if (wantsJson) {
		return new Response(JSON.stringify(payload), {
			status,
			headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
		});
	}

	// No-JS submit: a plain page, so the form still works without scripts.
	const message = payload.ok ? 'Message sent. We will reply by email.' : payload.error;
	const safe = String(message).replace(/[<>&]/g, (c) => `&#${c.charCodeAt(0)};`);
	return new Response(
		`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Contact</title></head>
<body style="font-family:ui-monospace,monospace;background:#04070a;color:#eef0f3;padding:2rem">
<p>${safe}</p><p><a style="color:#5ef2d6" href="/contact">Back to the form</a></p></body></html>`,
		{
			status,
			headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
		},
	);
}

function looksLikeEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
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
		if (new URL(request.url).pathname !== '/api/contact') {
			return new Response('Not found. This Worker only serves /api/contact.', {
				status: 404,
				headers: { 'content-type': 'text/plain' },
			});
		}
		if (request.method !== 'POST') {
			return reply(request, 405, { error: 'Send the form with POST.' });
		}

		let form: FormData;
		try {
			form = await request.formData();
		} catch {
			return reply(request, 400, { error: 'That submission could not be read.' });
		}

		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const message = String(form.get('message') ?? '').trim();

		if (!name || !email || !message) {
			return reply(request, 400, { error: 'Please fill in every field.' });
		}
		if (name.length > MAX.name || email.length > MAX.email || message.length > MAX.message) {
			return reply(request, 400, { error: 'That message is too long to send.' });
		}
		if (!looksLikeEmail(email)) {
			return reply(request, 400, { error: 'That email address does not look right.' });
		}

		// Misconfiguration must never look like a delivered message.
		if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY || !env.CONTACT_TO || !env.CONTACT_FROM) {
			return reply(request, 503, {
				error: 'The contact form is not fully configured yet. Please email us directly.',
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
				from: env.CONTACT_FROM,
				to: [env.CONTACT_TO],
				reply_to: email,
				subject: `Cellestial Studio enquiry — ${name}`,
				text: `From: ${name} <${email}>\n\n${message}`,
			}),
		});

		if (!sent.ok) {
			// Say so rather than claiming success; the sender can try again or email.
			return reply(request, 502, {
				error: 'We could not send that just now. Please try again or email us directly.',
			});
		}

		return reply(request, 200, { ok: true });
	},
};
