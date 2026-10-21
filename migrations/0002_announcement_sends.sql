-- Which "new version" emails each address has had, so a release email is
-- sent once per address (scripts/send-update-email.mjs creates this too).
CREATE TABLE IF NOT EXISTS announcement_sends (
  release  TEXT NOT NULL,
  email    TEXT NOT NULL COLLATE NOCASE,
  sent_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (release, email)
);
