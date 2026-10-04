-- D1 database: fonthabibi-signups (binding DB)
-- Stores "Follow the drops" email sign-ups from the home page.
CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'subscribed'
);
