// POST /api/subscribe  - mailing-list signup (double opt-in).
// Accepts the site's form (multipart/urlencoded) or JSON. Answers JSON when
// the request asks for it (the page's script), otherwise redirects to a
// page, so the form also works without JavaScript.
import { EMAIL_RE, json, redirect, newToken, sha256Hex, sendConfirmation } from "../_lib/list.js";
import { BURNER_REASON, blockReasonFor } from "../_lib/blocking.js";

const MAX_ATTEMPTS_PER_HOUR = 10;
const RESEND_COOLDOWN_MINUTES = 10;
const MAX_CONFIRM_SENDS = 5; // per day, for one pending address

export async function onRequestPost({ request, env, waitUntil }) {
  const wantsJson = (request.headers.get("Accept") || "").includes("application/json");
  const reply = (ok, message, status = 200) =>
    wantsJson ? json({ ok, message }, status) : redirect(ok ? "/list/check-inbox" : "/list/problem");

  let email = "", website = "", source = "";
  try {
    const type = request.headers.get("Content-Type") || "";
    const body = type.includes("application/json") ? await request.json() : null;
    const form = body ? null : await request.formData();
    const field = (name) => String((body ? body?.[name] : form.get(name)) ?? "");
    email = field("email");
    website = field("website");
    source = field("source");
  } catch {
    return reply(false, "That didn’t look like a signup. Please try again.", 400);
  }

  // The same answer, in about the same time, whatever the address's state,
  // so the form can't be used to find out who is on the list: emails are
  // sent after the reply (waitUntil), never while the visitor waits.
  // Until an email sender is configured, signups are stored and their
  // confirmation emails go out later (scripts/send-confirmations.mjs).
  const done = () =>
    reply(true, env.RESEND_API_KEY
      ? "Almost done — check your inbox to confirm your address."
      : "Thanks — you’re on the list. We’ll email you shortly to confirm your address.");

  // Honeypot filled in: a bot. Answer exactly as for a person, so it neither
  // retries nor learns there was a trap.
  if (website) return done();

  // A trailing dot ("a@b.com.") still delivers; drop it so the stored address
  // and the block check see the plain domain.
  email = email.trim().toLowerCase().replace(/\.+$/, "");
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return reply(false, "Please enter a valid email address.", 400);
  }
  source = source.slice(0, 40).replace(/[^a-z0-9-]/gi, "") || "site";

  // Rate limit per network, stored only as a salted hash, per hour. IPv6
  // users get a whole /64 each, so limit by that prefix, not the address.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const network = ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip;
  const ipHash = await sha256Hex(`${env.IP_SALT || "ravenburst-list"}:${network}`);
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const attempt = await env.DB.prepare(
    `INSERT INTO signup_attempts (ip_hash, hour, attempts) VALUES (?1, ?2, 1)
     ON CONFLICT(ip_hash, hour) DO UPDATE SET attempts = attempts + 1
     RETURNING attempts`,
  ).bind(ipHash, hour).first();
  // Old hours are only needed for the hour they cover.
  const dayAgo = new Date(now.getTime() - 24 * 3600_000).toISOString().slice(0, 13);
  waitUntil(env.DB.prepare("DELETE FROM signup_attempts WHERE hour < ?1").bind(dayAgo).run().catch(() => {}));
  if (attempt && attempt.attempts > MAX_ATTEMPTS_PER_HOUR) {
    return reply(false, "Too many signups from your connection. Please try again in an hour.", 429);
  }

  const existing = await env.DB.prepare(
    "SELECT status, confirm_sent_at, confirm_sends, block_reason FROM subscribers WHERE email = ?1",
  ).bind(email).first();

  // A disposable or hand-blocked domain: kept, unsubscribed and tagged, so it
  // shows in the admin app - and never emailed. A reason already on the row
  // (perhaps edited in the admin app) is kept.
  const blockReason = await blockReasonFor(env, email);
  if (blockReason) {
    await env.DB.prepare(
      `INSERT INTO subscribers (email, token, source, status, unsubscribed_at, block_reason, blocked_at)
       VALUES (?1, ?2, ?3, 'unsubscribed', datetime('now'), ?4, datetime('now'))
       ON CONFLICT(email) DO UPDATE SET status = 'unsubscribed',
         unsubscribed_at = COALESCE(unsubscribed_at, datetime('now')),
         block_reason = COALESCE(block_reason, excluded.block_reason),
         blocked_at = COALESCE(blocked_at, excluded.blocked_at)`,
    ).bind(email, newToken(), source, blockReason).run();
    return reply(
      false,
      blockReason === BURNER_REASON
        ? "Please use a permanent email address. Temporary and disposable addresses can’t join the list."
        : "That email address can’t join the list.",
      400,
    );
  }

  // Blocked by hand (the address, not its domain): nothing changes and
  // nothing is sent. The same answer as anyone else, so it can't be probed.
  if (existing?.block_reason) return done();

  if (existing && existing.status === "confirmed") return done();

  const token = newToken();
  if (existing) {
    // Pending or unsubscribed: treat as a fresh request to join, with a new
    // token - but don't let one address be emailed over and over.
    const lastSent = existing.confirm_sent_at ? Date.parse(existing.confirm_sent_at.replace(" ", "T") + "Z") : 0;
    const sinceLast = now.getTime() - lastSent;
    const coolingDown = sinceLast < RESEND_COOLDOWN_MINUTES * 60_000;
    const capped = existing.confirm_sends >= MAX_CONFIRM_SENDS && sinceLast < 24 * 3600_000;
    if (existing.status === "pending" && (coolingDown || capped)) return done();

    // block_reason IS NULL: blocked in the admin app since the read above -
    // nothing changes (the trigger would refuse it anyway) and nothing is sent.
    const updated = await env.DB.prepare(
      `UPDATE subscribers SET status = 'pending', token = ?2, unsubscribed_at = NULL,
           source = CASE WHEN status = 'unsubscribed' THEN ?3 ELSE source END,
           confirm_sends = CASE WHEN ?4 THEN 0 ELSE confirm_sends END
       WHERE email = ?1 AND block_reason IS NULL`,
    ).bind(email, token, source, sinceLast >= 24 * 3600_000 ? 1 : 0).run();
    if (!updated.meta.changes) return done();
  } else {
    // Two submissions of a new address at once: the second is a no-op.
    const inserted = await env.DB.prepare(
      "INSERT INTO subscribers (email, token, source) VALUES (?1, ?2, ?3) ON CONFLICT(email) DO NOTHING RETURNING id",
    ).bind(email, token, source).first();
    if (!inserted) return done();
  }

  waitUntil(
    // Re-checked just before sending, in case the address was blocked meanwhile.
    env.DB.prepare("SELECT block_reason FROM subscribers WHERE email = ?1").bind(email).first()
      .then((row) => (row && !row.block_reason ? sendConfirmation(env, email, token) : false))
      .then((sent) => sent && env.DB.prepare(
        "UPDATE subscribers SET confirm_sent_at = datetime('now'), confirm_sends = confirm_sends + 1 WHERE email = ?1",
      ).bind(email).run())
      .catch(() => {}), // left unsent; scripts/send-confirmations.mjs picks it up
  );
  return done();
}

export function onRequestGet() {
  return redirect("/#join");
}
