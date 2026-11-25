// The shape of a client's setup, as the step list reads it. The record itself
// lives in the onboarding Worker's D1 table; the client's link carries only a
// random code (after the #). This repo is public, so no client detail is ever
// committed, logged or built in.

export type Lane = 'ms' | 'g';
export type Tier = 1 | 2;
export type Mode = 'person' | 'remote' | 'test';

export interface ClientConfig {
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

export const LANES: readonly string[] = ['ms', 'g'];
export const TIERS: readonly number[] = [1, 2];
export const MODES: readonly string[] = ['person', 'remote', 'test'];
