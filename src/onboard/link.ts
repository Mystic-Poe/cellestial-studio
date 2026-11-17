// A client's onboarding link carries its own details in the URL fragment
// (after the #). Browsers never send the fragment to a server, and this repo
// is public, so nothing about a client is ever stored, logged or committed.

export type Lane = 'ms' | 'g';
export type Tier = 1 | 2;
export type Mode = 'person' | 'remote' | 'test';

export interface ClientConfig {
	v: 1;
	/** Business name */
	n: string;
	/** Business email */
	e: string;
	/** Agreed domain */
	d: string;
	/** Google or Microsoft lane */
	l: Lane;
	/** 1 = Tier 1 (repo stays in the studio org); 2 = Tier 2/3 */
	t: Tier;
	/** In person (no pings), remote (pings), test (pings marked [TEST]) */
	m: Mode;
}

/** The identity Gabriel is invited as, every time. */
export const STUDIO_EMAIL = 'cellestial.studio@gmail.com';

/** Plain Administrator cannot manage billing or members, so this exact role is required. */
export const CF_ROLE = 'Super Administrator – All Privileges';

const LANES: readonly string[] = ['ms', 'g'];
const TIERS: readonly number[] = [1, 2];
const MODES: readonly string[] = ['person', 'remote', 'test'];

function toBase64Url(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeConfig(c: ClientConfig): string {
	return toBase64Url(new TextEncoder().encode(JSON.stringify(c)));
}

const text = (x: unknown, max: number): x is string =>
	typeof x === 'string' && x.trim().length > 0 && x.length <= max;

export function decodeConfig(s: string): ClientConfig | null {
	if (!s || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
	let raw: unknown;
	try {
		raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fromBase64Url(s)));
	} catch {
		return null;
	}
	if (typeof raw !== 'object' || raw === null) return null;
	const c = raw as Record<string, unknown>;
	if (c.v !== 1) return null;
	if (!text(c.n, 80) || !text(c.e, 254) || !text(c.d, 253)) return null;
	if (!LANES.includes(c.l as string)) return null;
	if (!TIERS.includes(c.t as number)) return null;
	if (!MODES.includes(c.m as string)) return null;
	return { v: 1, n: c.n, e: c.e, d: c.d, l: c.l as Lane, t: c.t as Tier, m: c.m as Mode };
}
