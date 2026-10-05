-- Mailing list. One row per address; status moves
--   pending -> confirmed -> unsubscribed  (or pending -> unsubscribed).
-- token is a random secret used in confirm and unsubscribe links.
CREATE TABLE IF NOT EXISTS subscribers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  token            TEXT NOT NULL UNIQUE,
  source           TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at     TEXT,
  unsubscribed_at  TEXT,
  -- When the confirmation email was last sent; NULL means never (e.g. the
  -- signup arrived before an email sender was configured).
  confirm_sent_at  TEXT,
  confirm_sends    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers (status);

-- Simple abuse limit: signup attempts per IP-hash per hour.
CREATE TABLE IF NOT EXISTS signup_attempts (
  ip_hash     TEXT NOT NULL,
  hour        TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, hour)
);
