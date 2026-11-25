// Every read and write of the onboarding tables. Nothing else in the Worker
// writes SQL.

import { emptyIntake, type Intake, type Stage } from '../../../src/onboard/intake.ts';

export interface D1Statement {
	bind(...values: unknown[]): D1Statement;
	first<T = Record<string, unknown>>(): Promise<T | null>;
	all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
	run(): Promise<{ meta: { changes: number } }>;
}
export interface D1 {
	prepare(sql: string): D1Statement;
	batch(statements: D1Statement[]): Promise<{ meta: { changes: number } }[]>;
}

export type Mode = 'live' | 'test';
export type Status = 'active' | 'archived';
export const MODES: readonly string[] = ['live', 'test'];
export const STATUSES: readonly string[] = ['active', 'archived'];

/** Gabriel's own follow-up ticks. */
export const CHECKLIST_KEYS = ['domain', 'built', 'preview', 'approved', 'live', 'paid'] as const;
export type Checklist = Record<(typeof CHECKLIST_KEYS)[number], boolean>;
const emptyChecklist = (): Checklist =>
	Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, false])) as Checklist;

export interface NewClient {
	name: string;
	email: string;
	mode: Mode;
}

export interface ClientRow extends NewClient {
	id: string;
	code: string;
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
	photo_mail_at: number | null;
	created_at: number;
	updated_at: number;
	last_seen_at: number | null;
}

export interface ListedClient extends ClientRow {
	photo_count: number;
	to_finish: number;
}

export type ClientPatch = Partial<
	Pick<
		ClientRow,
		| 'name'
		| 'email'
		| 'mode'
		| 'stage'
		| 'stage_at'
		| 'intake'
		| 'intake_by'
		| 'intake_at'
		| 'preview_url'
		| 'live_url'
		| 'checklist'
		| 'notes'
		| 'status'
		| 'photo_mail_at'
	>
>;

const EDITABLE = [
	'name',
	'email',
	'mode',
	'stage',
	'stage_at',
	'intake',
	'intake_by',
	'intake_at',
	'preview_url',
	'live_url',
	'checklist',
	'notes',
	'status',
	'photo_mail_at',
] as const;
const JSON_COLS = new Set(['intake', 'checklist']);

export interface PhotoRow {
	id: string;
	client_id: string;
	kind: 'original' | 'finished';
	of: string | null;
	source: 'studio' | 'client';
	name: string;
	type: string;
	size: number;
	has_thumb: boolean;
	created_at: number;
}

export interface ReviewRow {
	id: string;
	client_id: string;
	verdict: 'ok' | 'changes';
	text: string;
	created_at: number;
}

const random = (bytes: number) => {
	const b = crypto.getRandomValues(new Uint8Array(bytes));
	let bin = '';
	for (const x of b) bin += String.fromCharCode(x);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** The client's link secret: 32 random bytes. */
export const newCode = () => random(32);
export const newId = () => random(12);

function toRow(r: Record<string, unknown> | null): ClientRow | null {
	if (!r) return null;
	return {
		...(r as unknown as ClientRow),
		intake: { ...emptyIntake(), ...JSON.parse(String(r.intake || '{}')) },
		checklist: { ...emptyChecklist(), ...JSON.parse(String(r.checklist || '{}')) },
	};
}

const toPhoto = (r: Record<string, unknown>): PhotoRow => ({
	...(r as unknown as PhotoRow),
	has_thumb: Boolean(r.has_thumb),
});

export async function createClient(db: D1, f: NewClient, now = Date.now()): Promise<ClientRow> {
	const id = newId();
	await db
		.prepare(
			`INSERT INTO clients (id, code, name, email, mode, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(id, newCode(), f.name, f.email, f.mode, now, now)
		.run();
	return (await getById(db, id)) as ClientRow;
}

export async function getById(db: D1, id: string): Promise<ClientRow | null> {
	return toRow(await db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first());
}

export async function getByCode(db: D1, code: string): Promise<ClientRow | null> {
	return toRow(await db.prepare('SELECT * FROM clients WHERE code = ?').bind(code).first());
}

/** With how many originals each has, and how many still need a finished version. */
export async function listClients(db: D1, archived: boolean): Promise<ListedClient[]> {
	const sql = `SELECT c.*,
		(SELECT COUNT(*) FROM photos p WHERE p.client_id = c.id AND p.kind = 'original') AS photo_count,
		(SELECT COUNT(*) FROM photos p WHERE p.client_id = c.id AND p.kind = 'original'
			AND NOT EXISTS (SELECT 1 FROM photos f WHERE f.of = p.id)) AS to_finish
		FROM clients c WHERE c.status = ?
		ORDER BY MAX(c.updated_at, COALESCE(c.last_seen_at, 0)) DESC`;
	const { results } = await db
		.prepare(sql)
		.bind(archived ? 'archived' : 'active')
		.all();
	return results.map((r) => ({
		...(toRow(r) as ClientRow),
		photo_count: Number(r.photo_count),
		to_finish: Number(r.to_finish),
	}));
}

export async function updateClient(
	db: D1,
	id: string,
	patch: ClientPatch & Record<string, unknown>,
	now = Date.now(),
): Promise<ClientRow | null> {
	const cols: string[] = [];
	const vals: unknown[] = [];
	for (const k of EDITABLE) {
		if (!(k in patch) || patch[k] === undefined) continue;
		cols.push(`${k} = ?`);
		vals.push(JSON_COLS.has(k) ? JSON.stringify(patch[k]) : patch[k]);
	}
	cols.push('updated_at = ?');
	vals.push(now);
	const { meta } = await db
		.prepare(`UPDATE clients SET ${cols.join(', ')} WHERE id = ?`)
		.bind(...vals, id)
		.run();
	return meta.changes ? getById(db, id) : null;
}

export async function rotateCode(db: D1, id: string, now = Date.now()): Promise<ClientRow | null> {
	const { meta } = await db
		.prepare('UPDATE clients SET code = ?, updated_at = ? WHERE id = ?')
		.bind(newCode(), now, id)
		.run();
	return meta.changes ? getById(db, id) : null;
}

/** Removes the client and every photo and review row (files are the caller's job). */
export async function deleteClient(db: D1, id: string): Promise<boolean> {
	const [c] = await db.batch([
		db.prepare('DELETE FROM clients WHERE id = ?').bind(id),
		db.prepare('DELETE FROM photos WHERE client_id = ?').bind(id),
		db.prepare('DELETE FROM reviews WHERE client_id = ?').bind(id),
	]);
	return c.meta.changes > 0;
}

/** Last seen, written at most once a minute so a polling page costs almost nothing. */
export async function touchSeen(db: D1, id: string, now = Date.now()): Promise<void> {
	await db
		.prepare(
			'UPDATE clients SET last_seen_at = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)',
		)
		.bind(now, id, now - 60_000)
		.run();
}

export async function addPhoto(db: D1, p: Omit<PhotoRow, 'created_at'>, now = Date.now()) {
	await db
		.prepare(
			`INSERT INTO photos (id, client_id, kind, of, source, name, type, size, has_thumb, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			p.id,
			p.client_id,
			p.kind,
			p.of,
			p.source,
			p.name,
			p.type,
			p.size,
			p.has_thumb ? 1 : 0,
			now,
		)
		.run();
	return { ...p, created_at: now } as PhotoRow;
}

export async function listPhotos(db: D1, clientId: string): Promise<PhotoRow[]> {
	const { results } = await db
		.prepare('SELECT * FROM photos WHERE client_id = ? ORDER BY created_at, rowid')
		.bind(clientId)
		.all();
	return results.map(toPhoto);
}

export async function getPhoto(db: D1, clientId: string, id: string): Promise<PhotoRow | null> {
	const r = await db
		.prepare('SELECT * FROM photos WHERE client_id = ? AND id = ?')
		.bind(clientId, id)
		.first();
	return r ? toPhoto(r) : null;
}

/** Deletes a photo, and an original's finished version with it. Returns the rows removed. */
export async function deletePhoto(db: D1, clientId: string, id: string): Promise<PhotoRow[]> {
	const { results } = await db
		.prepare('SELECT * FROM photos WHERE client_id = ? AND (id = ? OR of = ?)')
		.bind(clientId, id, id)
		.all();
	if (!results.length) return [];
	await db
		.prepare('DELETE FROM photos WHERE client_id = ? AND (id = ? OR of = ?)')
		.bind(clientId, id, id)
		.run();
	return results.map(toPhoto);
}

export async function countClientPhotos(db: D1, clientId: string): Promise<number> {
	const r = await db
		.prepare("SELECT COUNT(*) AS n FROM photos WHERE client_id = ? AND source = 'client'")
		.bind(clientId)
		.first<{ n: number }>();
	return Number(r?.n ?? 0);
}

export async function addReview(
	db: D1,
	r: Omit<ReviewRow, 'id' | 'created_at'>,
	now = Date.now(),
): Promise<ReviewRow> {
	const id = newId();
	await db
		.prepare(
			'INSERT INTO reviews (id, client_id, verdict, text, created_at) VALUES (?, ?, ?, ?, ?)',
		)
		.bind(id, r.client_id, r.verdict, r.text, now)
		.run();
	return { ...r, id, created_at: now };
}

export async function listReviews(db: D1, clientId: string): Promise<ReviewRow[]> {
	const { results } = await db
		.prepare('SELECT * FROM reviews WHERE client_id = ? ORDER BY created_at DESC, rowid DESC')
		.bind(clientId)
		.all();
	return results as unknown as ReviewRow[];
}
