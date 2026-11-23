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

// The shared sky (23 Nov, the owner's word: "Build it so it's shared"). With the
// STARS namespace bound, a star claimed by a sent request is lit for every
// visitor, and the public list is GET /api/contact/stars.json. What a visitor
// asked is shown to other visitors only after the owner approves it, from a
// link in the email this Worker already sends him. Without the binding nothing
// of this runs and the Worker is exactly what it was.

/** The part of a KV namespace this needs. */
export interface StarsKV {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
	delete(key: string): Promise<void>;
	list(options: { prefix: string }): Promise<{ keys: { name: string }[] }>;
}

export interface Env {
	TURNSTILE_SECRET_KEY?: string;
	RESEND_API_KEY?: string;
	CONTACT_TO?: string;
	CONTACT_FROM?: string;
	STARS?: StarsKV;
}

/** One lit star in the store. `ask` is what the visitor wrote; it is public only once approved. */
interface Lit {
	ask: string;
	at: string;
	approved: boolean;
}

/** A sent request that has no star yet: kept until its sender chooses one. */
interface Pending {
	ask: string;
	name: string;
	at: string;
}

const SLOT = /^slot-(?:[1-9]\d?|1[0-3]\d|14[0-6])$/;
const CLAIM_KEY = /^[A-Za-z0-9-]{20,64}$/;
/**
 * Every star has a record of its own, `star:slot-N`, so that no write can undo another:
 * a claim of one star, and the owner approving or taking back another, never meet.
 * (KV has no compare-and-set: two requests for the SAME star within the same instant
 * can both be told it was free, and the later text stands. Both messages reach the owner.)
 */
const STAR_PREFIX = 'star:';
const PENDING_TTL = 60 * 60 * 24 * 30;
const ORIGIN = 'https://cellestialstudio.com';

async function readStar(kv: StarsKV, slot: string): Promise<Lit | null> {
	try {
		const v = JSON.parse((await kv.get(STAR_PREFIX + slot)) ?? 'null') as Partial<Lit> | null;
		if (!v || typeof v.ask !== 'string' || typeof v.at !== 'string') return null;
		return { ask: v.ask, at: v.at, approved: v.approved === true };
	} catch {
		return null;
	}
}

const writeStar = (kv: StarsKV, slot: string, lit: Lit) =>
	kv.put(STAR_PREFIX + slot, JSON.stringify(lit));

/** Light a star for everyone. False if it is lit already: the first claim stands. */
async function lightStar(kv: StarsKV, slot: string, ask: string, at: string): Promise<boolean> {
	if (await readStar(kv, slot)) return false;
	await writeStar(kv, slot, { ask, at, approved: false });
	return true;
}

const hex = (bytes: ArrayBuffer) =>
	[...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256(text: string): Promise<string> {
	return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/** The owner's links are signed with a key only this Worker holds. */
async function sign(secret: string, slot: string, at: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(`cellestial stars v1 ${secret}`),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${slot}|${at}`)));
}

async function ownerLink(secret: string, slot: string, at: string): Promise<string> {
	const q = new URLSearchParams({ slot, at, sig: await sign(secret, slot, at) });
	return `${ORIGIN}/api/contact/star?${q}`;
}

const starNote = (link: string) =>
	`\n\nThis star is now lit for every visitor. What was asked is shown to them only after you approve it. To approve the text, or to take the star back:\n${link}`;

const json = (status: number, payload: unknown, cache = 'no-store') =>
	new Response(JSON.stringify(payload), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': cache },
	});

const page = (status: number, body: string) =>
	new Response(
		`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex" /><title>A star</title></head>
<body style="font-family:system-ui,sans-serif;background:#04070a;color:#eef0f3;padding:2rem;max-width:40rem;line-height:1.5">${body}</body></html>`,
		{
			status,
			headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
		},
	);

const safe = (text: string) => text.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** GET /api/contact/stars.json: every lit star, and what was asked where the owner approved it. */
async function listStars(env: Env): Promise<Response> {
	const stars: { slot: string; ask: string | null }[] = [];
	if (env.STARS) {
		const kv = env.STARS;
		const { keys } = await kv.list({ prefix: STAR_PREFIX });
		const slots = keys
			.map((k) => k.name.slice(STAR_PREFIX.length))
			.filter((slot) => SLOT.test(slot));
		const all = await Promise.all(slots.map((slot) => readStar(kv, slot)));
		for (const [i, lit] of all.entries()) {
			if (lit) stars.push({ slot: slots[i] as string, ask: lit.approved ? lit.ask : null });
		}
	}
	return json(200, { stars }, 'public, max-age=30');
}

/**
 * POST /api/contact/place: a request that was sent with no star takes the star
 * its sender has now chosen. `key` is the one the form was sent with; only its
 * hash was kept, with the ask, so nothing can be placed that was not sent.
 */
async function placeStar(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') return json(405, { error: 'POST only.' });
	if (!env.STARS) return json(503, { error: 'The shared sky is not set up.' });
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json(400, { error: 'That could not be read.' });
	}
	const slot = String(form.get('star') ?? '');
	const key = String(form.get('claim-key') ?? '');
	if (!SLOT.test(slot) || !CLAIM_KEY.test(key)) return json(400, { error: 'Not a star.' });
	const pendingKey = `pending:${await sha256(key)}`;
	let pending: Pending;
	try {
		pending = JSON.parse((await env.STARS.get(pendingKey)) ?? 'null') as Pending;
	} catch {
		return json(404, { error: 'Nothing is waiting for a star.' });
	}
	if (!pending || typeof pending.ask !== 'string') {
		return json(404, { error: 'Nothing is waiting for a star.' });
	}
	if (await readStar(env.STARS, slot)) return json(409, { error: 'That star is already lit.' });
	// One request, one star: the waiting record is spent BEFORE the star is lit, so the same
	// key shown twice at once cannot light two. If the star was taken meanwhile it is put back.
	await env.STARS.delete(pendingKey);
	const at = new Date().toISOString();
	if (!(await lightStar(env.STARS, slot, pending.ask, at))) {
		await env.STARS.put(pendingKey, JSON.stringify(pending), { expirationTtl: PENDING_TTL });
		return json(409, { error: 'That star is already lit.' });
	}
	// Tell the owner which star the request took. A mail that fails changes nothing here.
	if (env.RESEND_API_KEY && env.CONTACT_TO && env.CONTACT_FROM) {
		const link = await ownerLink(env.RESEND_API_KEY, slot, at);
		await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				authorization: `Bearer ${env.RESEND_API_KEY}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				from: env.CONTACT_FROM,
				to: [env.CONTACT_TO],
				subject: `Cellestial Studio — star ${slot.slice(5)} claimed`,
				text: `The request from ${pending.name} has taken a star.\n\nClaimed: open star ${slot.slice(5)}\n\n${pending.ask}${starNote(link)}`,
			}),
		}).catch(() => null);
	}
	return json(200, { ok: true });
}

/**
 * /api/contact/star?slot&at&sig: the owner's page for one lit star, reached from
 * his email. GET only shows it (mail scanners follow links); a button POSTs.
 */
async function ownerStar(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const slot = url.searchParams.get('slot') ?? '';
	const at = url.searchParams.get('at') ?? '';
	const sig = url.searchParams.get('sig') ?? '';
	if (!env.STARS || !env.RESEND_API_KEY) return page(503, '<p>The shared sky is not set up.</p>');
	if (!SLOT.test(slot) || sig !== (await sign(env.RESEND_API_KEY, slot, at))) {
		return page(403, '<p>This link is not valid.</p>');
	}
	const n = slot.slice(5);
	let lit = await readStar(env.STARS, slot);
	if (!lit || lit.at !== at) {
		return page(404, `<p>Star ${n} is not lit by this request any more.</p>`);
	}
	let done = '';
	if (request.method === 'POST') {
		const form = await request.formData().catch(() => new FormData());
		const what = String(form.get('do') ?? '');
		if (what === 'approve' || what === 'hide') {
			lit = { ...lit, approved: what === 'approve' };
			await writeStar(env.STARS, slot, lit);
			done =
				what === 'approve'
					? '<p><b>Done.</b> Every visitor can now read this on the star.</p>'
					: '<p><b>Done.</b> The text is hidden again. The star stays lit.</p>';
		} else if (what === 'remove') {
			await env.STARS.delete(STAR_PREFIX + slot);
			return page(200, `<p><b>Done.</b> Star ${n} is empty again for everyone.</p>`);
		}
	} else if (request.method !== 'GET') {
		return page(405, '<p>Not allowed.</p>');
	}
	const button = (what: string, label: string) =>
		`<form method="POST" style="display:inline-block;margin:0 .75rem .75rem 0"><input type="hidden" name="do" value="${what}" /><button style="font:inherit;padding:.6rem 1.1rem;border-radius:999px;border:1px solid #b08d57;background:#111;color:#eef0f3;cursor:pointer">${label}</button></form>`;
	return page(
		200,
		`<h1 style="font-size:1.3rem">Star ${n}</h1>${done}
<p>It is lit for every visitor. ${lit.approved ? 'They can read what was asked:' : 'Only the person who claimed it can read what was asked:'}</p>
<blockquote style="margin:1rem 0;padding:.75rem 1rem;border-left:3px solid #b08d57;white-space:pre-wrap">${safe(lit.ask)}</blockquote>
${lit.approved ? button('hide', 'Hide the text again') : button('approve', 'Show this text to everyone')}${button('remove', 'Take the star back (empty it)')}`,
	);
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
		const { pathname } = new URL(request.url);
		if (pathname === '/api/contact/stars.json') return listStars(env);
		if (pathname === '/api/contact/place') return placeStar(request, env);
		if (pathname === '/api/contact/star') return ownerStar(request, env);
		if (pathname !== '/api/contact') {
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
		// From the homepage's claim-your-star flow. Strictly validated: anything
		// but slot-N, N from 1 to 146 (every star the sky has), is dropped, so the
		// field can never inject into the email.
		const starRaw = String(form.get('star') ?? '');
		const star = SLOT.test(starRaw) ? starRaw : null;
		let starLine = star ? `\n\nClaimed: open star ${star.slice(5)}` : '';

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

		// The shared sky: is the star still free for everyone? The owner's mail says which.
		const at = new Date().toISOString();
		let free = false;
		if (star && env.STARS) {
			try {
				free = !(await readStar(env.STARS, star));
				starLine += free
					? starNote(await ownerLink(env.RESEND_API_KEY, star, at))
					: '\n\n(Another request lit this star first: it is not lit again for this one.)';
			} catch {
				free = false;
			}
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
				text: `From: ${name} <${email}>\n\n${message}${starLine}`,
			}),
		});

		if (!sent.ok) {
			// Say so rather than claiming success; the sender can try again or email.
			return reply(request, 502, {
				error: 'We could not send that just now. Please try again or email us directly.',
			});
		}

		// Only now, the message delivered: the star is lit for everyone, or the ask is kept
		// until its sender chooses a star. Nothing here can turn a sent message into a failure.
		if (env.STARS) {
			try {
				const claimKey = String(form.get('claim-key') ?? '');
				if (star && free) await lightStar(env.STARS, star, message, at);
				else if (!star && CLAIM_KEY.test(claimKey)) {
					const pending: Pending = { ask: message, name, at };
					await env.STARS.put(`pending:${await sha256(claimKey)}`, JSON.stringify(pending), {
						expirationTtl: PENDING_TTL,
					});
				}
			} catch {
				// The sky is one star short for the others; the owner has the message.
			}
		}

		return reply(request, 200, { ok: true });
	},
};
