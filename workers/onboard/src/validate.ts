// Checks every field the dashboard can send. Each failure names its field so
// the dashboard can point at it.

import { LANES, type Lane, MODES, type Mode, TIERS, type Tier } from '../../../src/onboard/link.ts';
import {
	CHECKLIST_KEYS,
	type Checklist,
	type ClientFields,
	STATUSES,
	type Status,
} from './store.ts';

export type Checked<T> = { ok: true; value: T } | { ok: false; field: string; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseDomain(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/[/?#].*$/, '')
		.replace(/^www\./, '');
}

const text = (v: unknown, max: number): string | null => {
	if (typeof v !== 'string') return null;
	const s = v.trim();
	return s.length > 0 && s.length <= max ? s : null;
};

export interface FieldPatch extends Partial<ClientFields> {
	notes?: string;
	checklist?: Checklist;
	status?: Status;
}

/** The six client fields (all required when `partial` is false), notes, checklist and status. */
export function checkFields(body: Record<string, unknown>, partial: boolean): Checked<FieldPatch> {
	const out: FieldPatch = {};
	const has = (k: string) => k in body && body[k] !== undefined;
	const need = (k: string) => !partial || has(k);

	if (need('name')) {
		const v = text(body.name, 80);
		if (!v) return { ok: false, field: 'name', error: 'Business name: 1 to 80 characters.' };
		out.name = v;
	}
	if (need('email')) {
		const v = text(body.email, 254);
		if (!v || !EMAIL.test(v))
			return { ok: false, field: 'email', error: 'That email doesn’t look right.' };
		out.email = v;
	}
	// Optional: most clients have no domain yet (buying one is part of the job).
	if (need('domain')) {
		const v = typeof body.domain === 'string' ? normaliseDomain(body.domain) : '';
		if (v && (v.length > 253 || !v.includes('.') || /\s/.test(v)))
			return { ok: false, field: 'domain', error: 'Domain: like example.com.' };
		out.domain = v;
	}
	if (need('lane')) {
		if (!LANES.includes(body.lane as string))
			return { ok: false, field: 'lane', error: 'Pick Microsoft or Google.' };
		out.lane = body.lane as Lane;
	}
	if (need('tier')) {
		const v = Number(body.tier);
		if (!TIERS.includes(v)) return { ok: false, field: 'tier', error: 'Pick a tier.' };
		out.tier = v as Tier;
	}
	if (need('mode')) {
		if (!MODES.includes(body.mode as string))
			return { ok: false, field: 'mode', error: 'Pick a mode.' };
		out.mode = body.mode as Mode;
	}
	if (has('notes')) {
		if (typeof body.notes !== 'string' || body.notes.length > 5000)
			return { ok: false, field: 'notes', error: 'Notes: up to 5000 characters.' };
		out.notes = body.notes;
	}
	if (has('checklist')) {
		const c = body.checklist as Record<string, unknown>;
		if (typeof c !== 'object' || c === null || Array.isArray(c))
			return { ok: false, field: 'checklist', error: 'Bad checklist.' };
		const keys = Object.keys(c);
		if (
			keys.some((k) => !(CHECKLIST_KEYS as readonly string[]).includes(k)) ||
			keys.some((k) => typeof c[k] !== 'boolean')
		)
			return { ok: false, field: 'checklist', error: 'Bad checklist.' };
		out.checklist = c as unknown as Checklist; // merged with the stored one by the caller
	}
	if (has('status')) {
		if (!STATUSES.includes(body.status as string))
			return { ok: false, field: 'status', error: 'Bad status.' };
		out.status = body.status as Status;
	}
	return { ok: true, value: out };
}
