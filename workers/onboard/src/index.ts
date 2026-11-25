// Client onboarding — /api/onboard/*
//
// /api/onboard/client/<code>/...   the client's own record (client.ts)
// /api/onboard/admin/...           Gabriel's dashboard (admin.ts)
//
// Records live in D1 (store.ts), photo files in R2 (files.ts).

import { adminRoute } from './admin.ts';
import { clientRoute } from './client.ts';
import type { R2Like } from './files.ts';
import type { Ctx, Limiter } from './http.ts';
import type { D1 } from './store.ts';

export interface Env {
	RESEND_API_KEY?: string;
	NOTIFY_TO?: string;
	NOTIFY_FROM?: string;
	ACCESS_TEAM?: string;
	ACCESS_AUD?: string;
	DB?: D1;
	PHOTOS?: R2Like;
	RATE?: Limiter;
	RATE_CLIENT?: Limiter;
	RATE_READ?: Limiter;
}

const notFound = () =>
	new Response('Not found.', { status: 404, headers: { 'content-type': 'text/plain' } });

export default {
	async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
		const parts = new URL(request.url).pathname.split('/').filter(Boolean); // api, onboard, ...
		if (parts[0] !== 'api' || parts[1] !== 'onboard') return notFound();
		if (parts[2] === 'client' && parts[3] && parts.length <= 6)
			return clientRoute(request, env, ctx, parts[3], parts.slice(4));
		if (parts[2] === 'admin') return adminRoute(request, env, parts.slice(3));
		return notFound();
	},
};
