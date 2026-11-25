// A stand-in for Cloudflare D1 in tests: the same prepare/bind/first/all/run/
// batch surface, over Node's built-in SQLite, with every migration applied in
// order (as `wrangler d1 migrations apply` does).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations');
const migrations = readdirSync(dir)
	.filter((f) => f.endsWith('.sql'))
	.sort()
	.map((f) => readFileSync(resolve(dir, f), 'utf8'));

export function fakeD1() {
	const db = new DatabaseSync(':memory:');
	for (const m of migrations) db.exec(m);
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
		runNow() {
			return db.prepare(sql).run(...args);
		},
	});
	return {
		prepare: (sql) => statement(sql),
		// D1 runs a batch as one transaction.
		async batch(stmts) {
			db.exec('BEGIN');
			try {
				const out = stmts.map((s) => ({
					success: true,
					meta: { changes: Number(s.runNow().changes) },
				}));
				db.exec('COMMIT');
				return out;
			} catch (e) {
				db.exec('ROLLBACK');
				throw e;
			}
		},
		raw: db,
	};
}
