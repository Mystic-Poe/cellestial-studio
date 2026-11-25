// A stand-in for Cloudflare D1 in tests: the same prepare/bind/first/all/run
// surface, over Node's built-in SQLite, with the real migration applied.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(resolve(here, '../migrations/0001_clients.sql'), 'utf8');

export function fakeD1() {
	const db = new DatabaseSync(':memory:');
	db.exec(migration);
	const statement = (sql, args = []) => ({
		bind: (...a) => statement(sql, a),
		async first() {
			return db.prepare(sql).get(...args) ?? null;
		},
		async all() {
			return { results: db.prepare(sql).all(...args), success: true };
		},
		async run() {
			const r = db.prepare(sql).run(...args);
			return { success: true, meta: { changes: Number(r.changes) } };
		},
	});
	return { prepare: (sql) => statement(sql), raw: db };
}
