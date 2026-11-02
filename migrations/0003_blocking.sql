-- Blocking: addresses that may never be on the list (disposable "burner"
-- domains, spam, abuse). block_reason is a short tag such as BURNER-EMAIL,
-- shown and edited in the admin app; NULL means not blocked.
ALTER TABLE subscribers ADD COLUMN block_reason TEXT;
ALTER TABLE subscribers ADD COLUMN blocked_at TEXT;

-- Domains blocked by hand, on top of the bundled disposable list
-- (functions/_lib/disposable-domains.js). A subdomain matches its parent.
CREATE TABLE IF NOT EXISTS blocked_domains (
  domain    TEXT PRIMARY KEY COLLATE NOCASE,
  reason    TEXT NOT NULL DEFAULT 'BURNER-EMAIL',
  added_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Domains the bundled list gets wrong. Only overrides the bundled list,
-- never blocked_domains.
CREATE TABLE IF NOT EXISTS allowed_domains (
  domain    TEXT PRIMARY KEY COLLATE NOCASE,
  added_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A blocked address is always unsubscribed. Enforced here, not just in the
-- code, so no path (signup, confirm, scripts, the admin app) can put it back
-- on the list. Clearing block_reason - the admin app's Unblock - is the only
-- way to lift it, and even then the address stays unsubscribed until its
-- owner signs up and confirms again.
CREATE TRIGGER IF NOT EXISTS subscribers_blocked_insert
BEFORE INSERT ON subscribers
WHEN NEW.block_reason IS NOT NULL AND NEW.status <> 'unsubscribed'
BEGIN
  SELECT RAISE(ABORT, 'blocked address must stay unsubscribed');
END;

CREATE TRIGGER IF NOT EXISTS subscribers_blocked_update
BEFORE UPDATE ON subscribers
WHEN NEW.block_reason IS NOT NULL AND NEW.status <> 'unsubscribed'
BEGIN
  SELECT RAISE(ABORT, 'blocked address must stay unsubscribed');
END;

-- The disposable signup that prompted this.
UPDATE subscribers
SET status = 'unsubscribed',
    unsubscribed_at = COALESCE(unsubscribed_at, datetime('now')),
    block_reason = 'BURNER-EMAIL',
    blocked_at = datetime('now')
WHERE email LIKE '%@maxxspace.com';
