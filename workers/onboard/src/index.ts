// Client onboarding helper — /api/onboard/*
//
// GET  /api/onboard/invites  Gabriel's own pending GitHub org and Cloudflare
//                            account invites, as salted hashes. The client page
//                            diffs these to notice the moment its invite lands.
//                            Hashes only: no client or org name ever leaves here.
// POST /api/onboard/ping     Emails Gabriel that a client finished a step
//                            (remote and test modes only).
//
// Every secret is optional. Without them the page falls back to its
// "Done → Next" prompt, so a half-configured Worker never breaks a client's flow.

export interface Env {
	INVITE_SALT?: string;
	CF_USER_TOKEN?: string;
	GH_TOKEN?: string;
	RESEND_API_KEY?: string;
	NOTIFY_TO?: string;
	NOTIFY_FROM?: string;
	RATE?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
}

interface Ctx {
	waitUntil(p: Promise<unknown>): void;
}

const json = (status: number, payload: unknown, cache = 'no-store') =>
	new Response(JSON.stringify(payload), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': cache },
	});

async function hash(salt: string, id: string): Promise<string> {
	const data = new TextEncoder().encode(`${salt}:${id}`);
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
	return [...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function cloudflareIds(token?: string): Promise<string[]> {
	if (!token) return [];
	try {
		const res = await fetch('https://api.cloudflare.com/client/v4/memberships?status=pending', {
			headers: { authorization: `Bearer ${token}` },
		});
		if (!res.ok) return [];
		const body = (await res.json()) as { result?: { id?: string }[] };
		return (body.result ?? []).map((m) => String(m.id ?? '')).filter(Boolean);
	} catch {
		return [];
	}
}

async function githubIds(token?: string): Promise<string[]> {
	if (!token) return [];
	try {
		const res = await fetch('https://api.github.com/user/memberships/orgs?state=pending', {
			headers: {
				authorization: `Bearer ${token}`,
				accept: 'application/vnd.github+json',
				'user-agent': 'cellestial-onboard',
			},
		});
		if (!res.ok) return [];
		const body = (await res.json()) as { organization?: { id?: number } }[];
		return body.map((m) => String(m.organization?.id ?? '')).filter(Boolean);
	} catch {
		return [];
	}
}

async function invites(request: Request, env: Env, ctx: Ctx): Promise<Response> {
	if (!env.INVITE_SALT) return json(503, { error: 'Invite detection is not configured.' });
	const salt = env.INVITE_SALT;

	// Edge cache, 10 s: many polling pages cost one pair of API calls.
	const cache = (globalThis as { caches?: { default: Cache } }).caches?.default;
	const key = new Request(new URL('/api/onboard/invites', request.url).toString());
	const hit = await cache?.match(key);
	if (hit) return hit;

	const [cf, gh] = await Promise.all([cloudflareIds(env.CF_USER_TOKEN), githubIds(env.GH_TOKEN)]);
	const res = json(
		200,
		{
			cloudflare: await Promise.all(cf.map((id) => hash(salt, `cf:${id}`))),
			github: await Promise.all(gh.map((id) => hash(salt, `gh:${id}`))),
		},
		'public, max-age=10',
	);
	if (cache) ctx.waitUntil(cache.put(key, res.clone()));
	return res;
}

const MODES = ['remote', 'test'];
const EVENTS = { done: 'marked a step done', invite: 'sent your invite' } as const;

async function ping(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') return json(405, { error: 'POST only.' });

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json(400, { error: 'Unreadable body.' });
	}
	const client = typeof body.client === 'string' ? body.client.trim() : '';
	const step = body.step;
	const mode = body.mode;
	const event = body.event;
	if (!client || client.length > 60) return json(400, { error: 'Bad client.' });
	if (typeof step !== 'number' || !Number.isInteger(step) || step < 1 || step > 5)
		return json(400, { error: 'Bad step.' });
	if (typeof mode !== 'string' || !MODES.includes(mode)) return json(400, { error: 'Bad mode.' });
	if (typeof event !== 'string' || !(event in EVENTS)) return json(400, { error: 'Bad event.' });

	if (!env.RESEND_API_KEY || !env.NOTIFY_TO || !env.NOTIFY_FROM)
		return json(503, { error: 'Notifications are not configured.' });

	if (env.RATE) {
		const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
		const { success } = await env.RATE.limit({ key: ip });
		if (!success) return json(429, { error: 'Slow down.' });
	}

	const name = client.replace(/[^\p{L}\p{N} .'&-]/gu, '').slice(0, 60) || 'A client';
	const action = EVENTS[event as keyof typeof EVENTS];
	const prefix = mode === 'test' ? '[TEST] ' : '';
	const sent = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
		body: JSON.stringify({
			from: env.NOTIFY_FROM,
			to: [env.NOTIFY_TO],
			subject: `${prefix}Onboarding: ${name} ${action} (step ${step})`,
			text:
				event === 'invite'
					? `${name} just sent you an invite at step ${step}. Accept it from your email or dashboard.`
					: `${name} marked step ${step} done.`,
		}),
	});
	if (!sent.ok) return json(502, { error: 'Could not send.' });
	return json(200, { ok: true });
}

export default {
	async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (pathname === '/api/onboard/invites') return invites(request, env, ctx);
		if (pathname === '/api/onboard/ping') return ping(request, env);
		return new Response('Not found.', { status: 404, headers: { 'content-type': 'text/plain' } });
	},
};
