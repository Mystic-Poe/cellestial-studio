// Keeps R2, the one thing on the account that bills past its free tier, inside
// that tier: a cap on everything stored and a cap on uploads per day. Photo
// reads are capped separately (a rate limit per link plus the edge cache).

import { json } from './http.ts';
import { type MailEnv, sendNotice } from './notify.ts';
import type { D1 } from './store.ts';

/** R2's free tier is 10 GB-month; stop well short of it. */
export const STORAGE_CAP = 8 * 1024 ** 3;
/** About 3,000 R2 writes a day at most (photo + thumbnail), under a tenth of the free 1M a month. */
export const DAILY_UPLOADS = 1500;

export const FULL_MESSAGE = 'Photo storage is full right now. Gabriel’s been told.';
export const BUSY_MESSAGE = 'Too many photos today. Try again tomorrow, or send them to Gabriel.';

const today = (now: number) => new Date(now).toISOString().slice(0, 10);

export async function storageUsed(db: D1): Promise<number> {
	const r = await db
		.prepare('SELECT COALESCE(SUM(size + thumb_size), 0) AS n FROM photos')
		.first<{ n: number }>();
	return Number(r?.n ?? 0);
}

export async function uploadsToday(db: D1, now = Date.now()): Promise<number> {
	const r = await db
		.prepare('SELECT uploads FROM usage WHERE day = ?')
		.bind(today(now))
		.first<{ uploads: number }>();
	return Number(r?.uploads ?? 0);
}

export type Admit = { ok: true } | { ok: false; reason: 'full' | 'busy' };

/**
 * May an upload of this many bytes go in? Counts it against today when it may.
 * The count is taken in one statement, so two uploads at once can't both slip
 * past the last slot.
 */
export async function admitUpload(db: D1, bytes: number, now = Date.now()): Promise<Admit> {
	if ((await storageUsed(db)) + bytes > STORAGE_CAP) return { ok: false, reason: 'full' };
	const r = await db
		.prepare(
			`INSERT INTO usage (day, uploads) VALUES (?, 1)
			 ON CONFLICT (day) DO UPDATE SET uploads = uploads + 1 WHERE uploads < ?
			 RETURNING uploads`,
		)
		.bind(today(now), DAILY_UPLOADS)
		.first<{ uploads: number }>();
	return r ? { ok: true } : { ok: false, reason: 'busy' };
}

/** True the first time it's called on a given day: Gabriel hears about a full store once a day. */
export async function firstFullToday(db: D1, now = Date.now()): Promise<boolean> {
	const r = await db
		.prepare(
			`INSERT INTO usage (day, full_mailed) VALUES (?, 1)
			 ON CONFLICT (day) DO UPDATE SET full_mailed = 1 WHERE full_mailed = 0
			 RETURNING day`,
		)
		.bind(today(now))
		.first<{ day: string }>();
	return Boolean(r);
}

export async function usageView(db: D1, now = Date.now()) {
	return {
		bytes: await storageUsed(db),
		cap: STORAGE_CAP,
		uploads_today: await uploadsToday(db, now),
		upload_cap: DAILY_UPLOADS,
	};
}

/**
 * The answer when an upload isn't admitted. A full store emails Gabriel, at
 * most once a day; nothing else does.
 */
export async function refuseUpload(
	db: D1,
	env: MailEnv,
	reason: 'full' | 'busy',
	now = Date.now(),
): Promise<Response> {
	if (reason === 'full') {
		if (await firstFullToday(db, now))
			await sendNotice(
				env,
				'Onboarding: photo storage is full',
				[
					`Photo uploads are paused: everything stored has reached ${STORAGE_CAP / 1024 ** 3} GB,`,
					'the cap that keeps R2 inside its free tier. Delete photos you no longer need',
					'(or archived clients) from the dashboard and uploads start again.',
					'',
					'https://cellestialstudio.com/dashboard/',
				].join('\n'),
			);
		return json(409, { error: FULL_MESSAGE });
	}
	return json(409, { error: BUSY_MESSAGE });
}
