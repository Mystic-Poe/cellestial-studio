-- Caps that keep R2 inside its free tier: thumbnail bytes count toward the
-- storage total, and one row per UTC day counts photo uploads.
ALTER TABLE photos ADD COLUMN thumb_size INTEGER NOT NULL DEFAULT 0;

CREATE TABLE usage (
	day TEXT PRIMARY KEY,
	uploads INTEGER NOT NULL DEFAULT 0,
	full_mailed INTEGER NOT NULL DEFAULT 0
);
