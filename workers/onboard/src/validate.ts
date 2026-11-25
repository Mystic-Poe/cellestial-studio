// Checks every field the dashboard can send. Each failure names its field so
// the dashboard can point at it.

import { cleanIntake, type Intake, STAGES, type Stage } from '../../../src/onboard/intake.ts';
import {
	CHECKLIST_KEYS,
	type Checklist,
	MODES,
	type Mode,
	type NewClient,
	STATUSES,
	type Status,
} from './store.ts';

export type Checked<T> = { ok: true; value: T } | { ok: false; field: string; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (v: unknown, max: number): string | null => {
	if (typeof v !== 'string') return null;
	const s = v.trim();
	return s.length > 0 && s.length <= max ? s : null;
};

/** '' or an https address (preview and live links). */
function siteAddress(v: unknown): string | null {
	if (typeof v !== 'string') return null;
	const s = v.trim();
	if (!s) return '';
	try {
		const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
		return u.protocol === 'https:' && u.hostname.includes('.') && s.length <= 500
			? u.toString()
			: null;
	} catch {
		return null;
	}
}

export interface FieldPatch {
	name?: string;
	email?: string;
	mode?: Mode;
	stage?: Stage;
	intake?: Intake;
	preview_url?: string;
	live_url?: string;
	checklist?: Partial<Checklist>;
	notes?: string;
	status?: Status;
}

/** Name, email and mode for a new client (mode defaults to live). */
export function checkNew(body: Record<string, unknown>): Checked<NewClient> {
	const r = checkPatch({ mode: 'live', ...body, name: body.name ?? '', email: body.email ?? '' });
	if (!r.ok) return r;
	return {
		ok: true,
		value: { name: r.value.name, email: r.value.email, mode: r.value.mode } as NewClient,
	};
}

/** Any subset of the editable fields; unknown keys are ignored. */
export function checkPatch(body: Record<string, unknown>): Checked<FieldPatch> {
	const out: FieldPatch = {};
	const has = (k: string) => k in body && body[k] !== undefined;
	const fail = (field: string, error: string): Checked<FieldPatch> => ({ ok: false, field, error });

	if (has('name')) {
		const v = text(body.name, 80);
		if (!v) return fail('name', 'Business name: 1 to 80 characters.');
		out.name = v;
	}
	if (has('email')) {
		const v = text(body.email, 254);
		if (!v || !EMAIL.test(v)) return fail('email', 'That email doesn’t look right.');
		out.email = v;
	}
	if (has('mode')) {
		if (!MODES.includes(body.mode as string)) return fail('mode', 'Live or test.');
		out.mode = body.mode as Mode;
	}
	if (has('stage')) {
		if (!STAGES.includes(body.stage as Stage)) return fail('stage', 'Unknown stage.');
		out.stage = body.stage as Stage;
	}
	if (has('intake')) {
		const r = cleanIntake(body.intake);
		if (!r.ok) return fail(r.field, r.error);
		out.intake = r.value;
	}
	for (const k of ['preview_url', 'live_url'] as const) {
		if (!has(k)) continue;
		const v = siteAddress(body[k]);
		if (v === null) return fail(k, 'A web address starting https://');
		out[k] = v;
	}
	if (has('checklist')) {
		const c = body.checklist;
		if (typeof c !== 'object' || c === null || Array.isArray(c))
			return fail('checklist', 'Bad checklist.');
		const picked: Partial<Checklist> = {};
		for (const k of CHECKLIST_KEYS) {
			const v = (c as Record<string, unknown>)[k];
			if (v === undefined) continue;
			if (typeof v !== 'boolean') return fail('checklist', 'Bad checklist.');
			picked[k] = v;
		}
		out.checklist = picked;
	}
	if (has('notes')) {
		if (typeof body.notes !== 'string' || body.notes.length > 5000)
			return fail('notes', 'Notes: up to 5000 characters.');
		out.notes = body.notes;
	}
	if (has('status')) {
		if (!STATUSES.includes(body.status as string)) return fail('status', 'Bad status.');
		out.status = body.status as Status;
	}
	return { ok: true, value: out };
}
