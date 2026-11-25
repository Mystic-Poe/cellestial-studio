-- Uploads per client link per UTC day, so one leaked link can't use up the
-- whole day's allowance and lock Gabriel's own uploads out.
CREATE TABLE link_uploads (
	client_id TEXT NOT NULL,
	day TEXT NOT NULL,
	uploads INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (client_id, day)
);
