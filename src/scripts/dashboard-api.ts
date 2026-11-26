// The dashboard's calls to the onboarding Worker. Changes go as JSON (photo
// uploads as forms, from this same page); Cloudflare Access's cookie rides
// along on its own.

import type { Intake, Stage } from '../onboard/intake.ts';
import { type Prepared, sendPhoto } from './photo-prep.ts';

export type Mode = 'live' | 'test';
export type Status = 'active' | 'archived';
export const CHECKLIST = [
	['domain', 'Domain bought'],
	['built', 'Site built'],
	['preview', 'Preview sent'],
	['approved', 'Approved'],
	['live', 'Live'],
	['paid', 'Paid'],
] as const;
export type Checklist = Record<(typeof CHECKLIST)[number][0], boolean>;

export interface Photo {
	id: string;
	kind: 'original' | 'finished';
	of: string | null;
	source: 'studio' | 'client';
	name: string;
	size: number;
	has_thumb: boolean;
	created_at: number;
}
export interface Review {
	id: string;
	verdict: 'ok' | 'changes';
	text: string;
	created_at: number;
}
/** How much of the free-tier photo storage and today's uploads are used. */
export interface Usage {
	bytes: number;
	cap: number;
	uploads_today: number;
	upload_cap: number;
}

export interface AdminClient {
	id: string;
	code: string;
	name: string;
	email: string;
	mode: Mode;
	stage: Stage;
	stage_at: number;
	intake: Intake;
	intake_by: 'client' | 'studio' | null;
	intake_at: number | null;
	preview_url: string;
	live_url: string;
	checklist: Checklist;
	notes: string;
	status: Status;
	created_at: number;
	updated_at: number;
	last_seen_at: number | null;
	link: string;
	/** On the detail only */
	photos?: Photo[];
	reviews?: Review[];
	/** On the list only */
	photo_count?: number;
	to_finish?: number;
}
export type Patch = Partial<{
	name: string;
	email: string;
	mode: Mode;
	stage: Stage;
	intake: Intake;
	preview_url: string;
	live_url: string;
	checklist: Partial<Checklist>;
	notes: string;
	status: Status;
}>;

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly field?: string,
	) {
		super(message);
	}
}

export const BASE = '/api/onboard/admin/clients';

export interface BillingPlan {
	client_id: string;
	name: string;
	stage: string;
	offer: string;
	care: number;
	/** card_pending, card_saved, or Stripe's subscription status once started. */
	status: string;
	/** Next charge, seconds since 1970. */
	next: number | null;
	card_link: string | null;
}
export type BillingView =
	| { connected: false }
	| {
			connected: true;
			mode: 'test' | 'live';
			figures: { monthly: number; owed: number; paid_this_month: number };
			plans: BillingPlan[];
			invoices: {
				id: string;
				date: number;
				name: string;
				amount: number;
				status: string;
				url: string | null;
			}[];
	  };
const enc = encodeURIComponent;

async function call<T>(path: string, method = 'GET', body?: unknown, base = BASE): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${base}${path}`, {
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

export const photoUrl = (
	clientId: string,
	photoId: string,
	size: 'thumb' | 'full',
	download = false,
) => `${BASE}/${enc(clientId)}/photos/${enc(photoId)}?size=${size}${download ? '&download=1' : ''}`;
export const zipUrl = (clientId: string) => `${BASE}/${enc(clientId)}/photos.zip`;

export const api = {
	list: (archived: boolean) =>
		call<{ clients: AdminClient[]; usage?: Usage }>(archived ? '?status=archived' : ''),
	create: (f: { name: string; email: string; mode: Mode }) => call<AdminClient>('', 'POST', f),
	get: (id: string) => call<AdminClient>(`/${enc(id)}`),
	patch: (id: string, p: Patch) => call<AdminClient>(`/${enc(id)}`, 'PATCH', p),
	rotate: (id: string) => call<AdminClient>(`/${enc(id)}/rotate`, 'POST'),
	remove: (id: string) => call<{ ok: true }>(`/${enc(id)}`, 'DELETE'),
	removePhoto: (id: string, pid: string) =>
		call<{ ok: true }>(`/${enc(id)}/photos/${enc(pid)}`, 'DELETE'),
	billing: () => call<BillingView>('', 'GET', undefined, '/api/onboard/admin/billing'),
	startBilling: (id: string, offer: string) =>
		call<{ status: string; card_link: string }>(`/${enc(id)}/billing`, 'POST', { offer }),
	newCardLink: (id: string) =>
		call<{ status: string; card_link: string }>(`/${enc(id)}/billing/link`, 'POST'),
	startCare: (id: string) => call<{ status: string }>(`/${enc(id)}/billing/start`, 'POST'),
	async upload(id: string, p: Prepared, fields: Record<string, string>): Promise<Photo> {
		const r = await sendPhoto(`${BASE}/${enc(id)}/photos`, p, fields);
		if (!r.ok) throw new ApiError(r.status, String(r.data?.error ?? `Error ${r.status}.`));
		return r.data as unknown as Photo;
	},
};
