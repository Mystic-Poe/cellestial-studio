// Every read and write of the clients table. Nothing else in the Worker
// writes SQL.

import type { Lane, Mode, Tier } from '../../../src/onboard/link.ts';
import type { StepId } from '../../../src/onboard/steps.ts';

export interface D1Statement {
	bind(...values: unknown[]): D1Statement;
	first<T = Record<string, unknown>>(): Promise<T | null>;
	all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
	run(): Promise<{ meta: { changes: number } }>;
}
export interface D1 {
	prepare(sql: string): D1Statement;
}

export type Status = 'active' | 'done' | 'archived';
export interface Checklist {
	invites: boolean;
	billing: boolean;
	domain: boolean;
	card: boolean;
}
export const CHECKLIST_KEYS = ['invites', 'billing', 'domain', 'card'] as const;
export const STATUSES: readonly string[] = ['active', 'done', 'archived'];

export interface ClientFields {
	name: string;
	email: string;
	domain: string;
	lane: Lane;
	tier: Tier;
	mode: Mode;
}

export interface ClientRow extends ClientFields {
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
}

export type ClientPatch = Partial<
	ClientFields & Pick<ClientRow, 'step' | 'done' | 'checklist' | 'notes' | 'status'>
>;

const EDITABLE = [
	'name',
	'email',
	'domain',
	'lane',
	'tier',
	'mode',
	'step',
	'done',
	'checklist',
	'notes',
	'status',
] as const;
const JSON_COLS = new Set(['done', 'checklist']);

const random = (bytes: number) => {
	const b = crypto.getRandomValues(new Uint8Array(bytes));
	let bin = '';
	for (const x of b) bin += String.fromCharCode(x);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** The client's link secret: 32 random bytes. */
export const newCode = () => random(32);
const newId = () => random(12);

function toRow(r: Record<string, unknown> | null): ClientRow | null {
	if (!r) return null;
	return {
		...(r as unknown as ClientRow),
		done: JSON.parse(String(r.done)),
		checklist: JSON.parse(String(r.checklist)),
	};
}

export async function createClient(db: D1, f: ClientFields, now = Date.now()): Promise<ClientRow> {
	const id = newId();
	await db
		.prepare(
			`INSERT INTO clients (id, code, name, email, domain, lane, tier, mode, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(id, newCode(), f.name, f.email, f.domain, f.lane, f.tier, f.mode, now, now)
		.run();
	return (await getById(db, id)) as ClientRow;
}

export async function getById(db: D1, id: string): Promise<ClientRow | null> {
	return toRow(await db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first());
}

export async function getByCode(db: D1, code: string): Promise<ClientRow | null> {
	return toRow(await db.prepare('SELECT * FROM clients WHERE code = ?').bind(code).first());
}

export async function listClients(db: D1, archived: boolean): Promise<ClientRow[]> {
	const sql = archived
		? "SELECT * FROM clients WHERE status = 'archived' ORDER BY updated_at DESC"
		: "SELECT * FROM clients WHERE status != 'archived' ORDER BY MAX(updated_at, COALESCE(last_seen_at, 0)) DESC";
	const { results } = await db.prepare(sql).all();
	return results.map((r) => toRow(r) as ClientRow);
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

export async function deleteClient(db: D1, id: string): Promise<boolean> {
	const { meta } = await db.prepare('DELETE FROM clients WHERE id = ?').bind(id).run();
	return meta.changes > 0;
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
