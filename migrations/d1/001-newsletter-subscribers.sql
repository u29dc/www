CREATE TABLE IF NOT EXISTS newsletter_subscribers (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL,
	email_normalized TEXT NOT NULL UNIQUE,
	source TEXT NOT NULL DEFAULT '/',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_created_at_idx
ON newsletter_subscribers (created_at DESC);
