// What the studio needs from a client before building their site, and where
// their site is up to. Shared by the client page, the dashboard and the
// onboarding Worker, so all three check the same rules.
//
// This repo is public: no client detail is ever committed, logged or built in.

export const STAGES = ['intake', 'design', 'building', 'review', 'live'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_TEXT: Record<Stage, { title: string; client: string }> = {
	intake: {
		title: 'Intake',
		client: 'Gabriel has your answers and will start on your design soon.',
	},
	design: { title: 'Design', client: 'Gabriel is designing your site. Nothing needed from you.' },
	building: { title: 'Building', client: 'Your site is being built. Nothing needed from you.' },
	review: { title: 'Review', client: 'Your site is ready for you to look over.' },
	live: { title: 'Live', client: 'Your site is live.' },
};

/** Answers and photos can still change until building starts. */
export const editable = (s: Stage) => s === 'intake' || s === 'design';

export const PAGES = ['Services', 'About', 'Gallery', 'Reviews', 'Contact', 'Booking'] as const;

export interface Intake {
	about: string;
	area: string;
	phone: string;
	contact_email: string;
	hours: string;
	pages: string[];
	extra: string;
	likes: string[];
	has_domain: '' | 'yes' | 'no';
	domain: string;
}

export const emptyIntake = (): Intake => ({
	about: '',
	area: '',
	phone: '',
	contact_email: '',
	hours: '',
	pages: [],
	extra: '',
	likes: [],
	has_domain: '',
	domain: '',
});

export type Cleaned = { ok: true; value: Intake } | { ok: false; field: string; error: string };

const LONG = 1000;
const SHORT = 120;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseDomain(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/[/?#].*$/, '')
		.replace(/^www\./, '');
}

function webAddress(raw: string): string | null {
	const s = raw.trim();
	if (!s) return '';
	try {
		const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
		if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
		if (!u.hostname.includes('.')) return null;
		const out = u.toString();
		return out.length <= 300 ? out.replace(/\/$/, s.endsWith('/') ? '/' : '') : null;
	} catch {
		return null;
	}
}

/** Checks and tidies an intake from either page. Unknown keys are ignored. */
export function cleanIntake(raw: unknown): Cleaned {
	const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const out = emptyIntake();
	const fail = (field: string, error: string): Cleaned => ({ ok: false, field, error });

	const texts: [keyof Intake, number, string][] = [
		['about', LONG, 'What you do'],
		['area', SHORT, 'Area you serve'],
		['phone', SHORT, 'Phone'],
		['contact_email', SHORT, 'Email'],
		['hours', SHORT, 'Hours'],
		['extra', LONG, 'Anything else'],
	];
	for (const [k, max, label] of texts) {
		const v = r[k];
		if (v === undefined || v === null) continue;
		if (typeof v !== 'string') return fail(k, `${label}: text only.`);
		const s = v.trim();
		if (s.length > max) return fail(k, `${label}: up to ${max} characters.`);
		(out as unknown as Record<string, string>)[k] = s;
	}
	if (out.contact_email && !EMAIL.test(out.contact_email))
		return fail('contact_email', 'That email doesn’t look right.');

	if (r.pages !== undefined) {
		if (!Array.isArray(r.pages)) return fail('pages', 'Pick from the list.');
		out.pages = PAGES.filter((p) => (r.pages as unknown[]).includes(p));
	}

	if (r.likes !== undefined) {
		if (!Array.isArray(r.likes)) return fail('likes', 'Web addresses only.');
		const likes: string[] = [];
		for (const v of r.likes) {
			if (typeof v !== 'string') return fail('likes', 'Web addresses only.');
			const w = webAddress(v);
			if (w === null) return fail('likes', `“${v.slice(0, 40)}” isn’t a web address.`);
			if (w) likes.push(w);
		}
		if (likes.length > 3) return fail('likes', 'Up to 3 sites.');
		out.likes = likes;
	}

	if (r.has_domain === 'yes' || r.has_domain === 'no') out.has_domain = r.has_domain;
	if (out.has_domain === 'yes' && typeof r.domain === 'string') {
		const d = normaliseDomain(r.domain);
		if (d.length > 253 || /\s/.test(d)) return fail('domain', 'Like example.com.');
		out.domain = d;
	}
	return { ok: true, value: out };
}

/** Null when the intake can be sent; otherwise what is missing. */
export function readyToSend(i: Intake): string | null {
	return i.about ? null : 'Tell Gabriel a little about your business first.';
}
