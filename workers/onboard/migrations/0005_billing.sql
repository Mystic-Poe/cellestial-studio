-- Billing (Nov 25): which offer each client is on and their Stripe ids.
-- Card details never come here; Stripe holds them.
CREATE TABLE billing (
	client_id TEXT PRIMARY KEY,
	offer TEXT NOT NULL,
	care INTEGER NOT NULL,
	customer TEXT NOT NULL,
	setup_session TEXT,
	setup_url TEXT,
	payment_method TEXT,
	subscription TEXT,
	status TEXT NOT NULL DEFAULT 'card_pending'
		CHECK (status IN ('card_pending', 'card_saved', 'started')),
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);
