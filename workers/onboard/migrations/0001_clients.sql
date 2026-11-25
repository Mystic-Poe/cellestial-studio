-- One row per client Gabriel is onboarding. JSON columns hold small arrays and
-- objects that are always read and written whole.
CREATE TABLE clients (
	id TEXT PRIMARY KEY,
	code TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	email TEXT NOT NULL,
	domain TEXT NOT NULL,
	lane TEXT NOT NULL CHECK (lane IN ('ms', 'g')),
	tier INTEGER NOT NULL CHECK (tier IN (1, 2)),
	mode TEXT NOT NULL CHECK (mode IN ('person', 'remote', 'test')),
	step INTEGER NOT NULL DEFAULT 0,
	done TEXT NOT NULL DEFAULT '[]',
	checklist TEXT NOT NULL DEFAULT '{"invites":false,"billing":false,"domain":false,"card":false}',
	notes TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'archived')),
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	last_seen_at INTEGER
);

CREATE INDEX clients_status ON clients (status, updated_at);
