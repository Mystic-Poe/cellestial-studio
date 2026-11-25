// The dashboard's calls to the onboarding Worker. Every request is JSON (the
// Worker refuses changes that aren't), and Cloudflare Access's cookie rides
// along on its own.

import type { Lane, Mode, Tier } from '../onboard/link.ts';
import type { StepId } from '../onboard/steps.ts';

export type Status = 'active' | 'done' | 'archived';
export interface Checklist {
	invites: boolean;
	billing: boolean;
	domain: boolean;
	card: boolean;
}
export interface ClientFields {
	name: string;
	email: string;
	domain: string;
	lane: Lane;
	tier: Tier;
	mode: Mode;
}
export interface AdminClient extends ClientFields {
	id: string;
	code: string;
	step: number;
	done: StepId[];
	checklist: Checklist;
	notes: string;
	status: Status;
	created_at: number;
	updated_at: number;
	last_seen_at: number | null;
	link: string;
	steps: { id: StepId; title: string }[];
}
export type Patch = Partial<
	ClientFields & {
		step: number;
		done: StepId[];
		checklist: Partial<Checklist>;
		notes: string;
		status: Status;
	}
>;

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly field?: string,
	) {
		super(message);
	}
}

const BASE = '/api/onboard/admin/clients';

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${BASE}${path}`, {
			method,
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			credentials: 'same-origin',
			body: body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body),
		});
	} catch {
		throw new ApiError(0, 'No connection.');
	}
	// Access answers an expired session with a redirect to its login page.
	if (res.redirected || res.type === 'opaqueredirect') throw new ApiError(401, 'Sign in again.');
	const data = (await res.json().catch(() => null)) as { error?: string; field?: string } | null;
	if (!res.ok) throw new ApiError(res.status, data?.error ?? `Error ${res.status}.`, data?.field);
	if (data === null) throw new ApiError(401, 'Sign in again.');
	return data as T;
}

export const api = {
	list: (archived: boolean) =>
		call<{ clients: AdminClient[] }>(archived ? '?status=archived' : '').then((r) => r.clients),
	create: (f: ClientFields) => call<AdminClient>('', 'POST', f),
	get: (id: string) => call<AdminClient>(`/${encodeURIComponent(id)}`),
	patch: (id: string, p: Patch) => call<AdminClient>(`/${encodeURIComponent(id)}`, 'PATCH', p),
	rotate: (id: string) => call<AdminClient>(`/${encodeURIComponent(id)}/rotate`, 'POST'),
	remove: (id: string) => call<{ ok: true }>(`/${encodeURIComponent(id)}`, 'DELETE'),
};
