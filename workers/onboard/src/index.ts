// Client onboarding — /api/onboard/*
//
// GET  /api/onboard/invites           Gabriel's own pending GitHub org and
//                                     Cloudflare account invites, as salted
//                                     hashes. The client page diffs these to
//                                     notice the moment its invite lands.
// /api/onboard/client/<code>[/progress]  the client's own record (client.ts)
// /api/onboard/admin/...              Gabriel's dashboard (admin.ts)
//
// Client records live in D1 (store.ts). Every invite and mail secret is
// optional: without them the page falls back to its "Done → Next" button.

import { adminRoute } from './admin.ts';
import { clientRoute } from './client.ts';
import { type Ctx, json, type Limiter } from './http.ts';
import type { D1 } from './store.ts';

export interface Env {
	INVITE_SALT?: string;
	CF_USER_TOKEN?: string;
	GH_TOKEN?: string;
	RESEND_API_KEY?: string;
	NOTIFY_TO?: string;
	NOTIFY_FROM?: string;
	ACCESS_TEAM?: string;
	ACCESS_AUD?: string;
	DB?: D1;
	RATE?: Limiter;
	RATE_PROGRESS?: Limiter;
}

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
	const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
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

export default {
	async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (pathname === '/api/onboard/invites') return invites(request, env, ctx);
		const parts = pathname.split('/').filter(Boolean); // api, onboard, ...
		if (parts[0] === 'api' && parts[1] === 'onboard') {
			if (parts[2] === 'client' && parts[3] && parts.length <= 5)
				return clientRoute(request, env, ctx, parts[3], parts[4]);
			if (parts[2] === 'admin') return adminRoute(request, env, parts.slice(3));
		}
		return new Response('Not found.', { status: 404, headers: { 'content-type': 'text/plain' } });
	},
};
