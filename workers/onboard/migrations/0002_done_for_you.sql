-- Done-for-you onboarding (Nov 24): the client no longer makes accounts, so the
-- step columns go. Only test rows existed in the old table.
DROP INDEX IF EXISTS clients_status;
DROP TABLE IF EXISTS clients;

CREATE TABLE clients (
	id TEXT PRIMARY KEY,
	code TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	email TEXT NOT NULL,
	mode TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'test')),
	stage TEXT NOT NULL DEFAULT 'intake'
		CHECK (stage IN ('intake', 'design', 'building', 'review', 'live')),
	stage_at INTEGER NOT NULL DEFAULT 0,
	intake TEXT NOT NULL DEFAULT '{}',
	intake_by TEXT CHECK (intake_by IN ('client', 'studio')),
	intake_at INTEGER,
	preview_url TEXT NOT NULL DEFAULT '',
	live_url TEXT NOT NULL DEFAULT '',
	checklist TEXT NOT NULL DEFAULT '{}',
	notes TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
	photo_mail_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	last_seen_at INTEGER
);
CREATE INDEX clients_status ON clients (status, updated_at);

-- Files live in R2 at c/<client_id>/<id> (and <id>.thumb when has_thumb).
CREATE TABLE photos (
	id TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('original', 'finished')),
	of TEXT,
	source TEXT NOT NULL CHECK (source IN ('studio', 'client')),
	name TEXT NOT NULL,
	type TEXT NOT NULL,
	size INTEGER NOT NULL,
	has_thumb INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL
);
CREATE INDEX photos_client ON photos (client_id, created_at);

CREATE TABLE reviews (
	id TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	verdict TEXT NOT NULL CHECK (verdict IN ('ok', 'changes')),
	text TEXT NOT NULL DEFAULT '',
	created_at INTEGER NOT NULL
);
CREATE INDEX reviews_client ON reviews (client_id, created_at);
