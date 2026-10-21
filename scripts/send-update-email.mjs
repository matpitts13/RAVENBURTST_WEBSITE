// Emails everyone who confirmed their address that a new version is out.
// The text is in scripts/announcements/<release>.mjs. From this folder:
//
//   npm run list:send-update -- v1.0.0-beta.3            (a dry run: counts and a preview, sends nothing)
//   $env:RESEND_API_KEY = "re_..."
//   $env:MAIL_POSTAL_ADDRESS = "Your mailing address"
//   npm run list:send-update -- v1.0.0-beta.3 --send
//
// Each address gets each release's email once: sends are recorded in D1, so
// running it again (after a stop, or for new confirmations) only sends to
// whoever hasn't had it. Uses your `wrangler login` for the database.
import { d1Read, d1Write, sqlString } from "./d1.mjs";

const release = process.argv[2];
const send = process.argv.includes("--send");
if (!/^v[0-9][0-9a-z.-]*$/.test(release ?? "")) {
  console.error("Usage: npm run list:send-update -- v1.0.0-beta.3 [--send]");
  process.exit(1);
}
let mail;
try {
  mail = (await import(`./announcements/${release}.mjs`)).default;
} catch {
  console.error(`No email written for ${release} - add scripts/announcements/${release}.mjs`);
  process.exit(1);
}

const SITE = "https://ravenburst.com";
const FROM = "Ravenburst <hello@ravenburst.com>";
const postal = (process.env.MAIL_POSTAL_ADDRESS ?? "").trim();
const key = process.env.RESEND_API_KEY;
if (send && !key) {
  console.error('Set RESEND_API_KEY first, e.g.  $env:RESEND_API_KEY = "re_..."');
  process.exit(1);
}
// Marketing email must carry a postal address (CAN-SPAM).
if (send && !postal) {
  console.error('Set MAIL_POSTAL_ADDRESS first (required in announcement email), e.g.  $env:MAIL_POSTAL_ADDRESS = "PO Box 1, Town, ST 00000"');
  process.exit(1);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const changelogUrl = `${SITE}/changelog#v-${release}`;

function build(token) {
  const unsubscribeUrl = `${SITE}/api/unsubscribe?token=${token}`;
  const text = [
    mail.intro,
    "",
    "What's new:",
    ...mail.items.map((i) => `- ${i}`),
    "",
    ...mail.howToGet,
    "",
    `Everything in this release: ${changelogUrl}`,
    "",
    "— Ravenburst",
    SITE,
    "",
    postal || "[postal address]",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
  const p = 'style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin:0 0 16px"';
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f5f2;font-family:Georgia,serif;color:#252422">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e0da;border-radius:12px;padding:32px">
<h1 style="font-size:24px;margin:0 0 16px">${esc(mail.heading)}</h1>
<p ${p}>${esc(mail.intro)}</p>
<ul style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin:0 0 16px;padding-left:20px">${mail.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
${mail.howToGet.map((l) => `<p ${p}>${esc(l)}</p>`).join("\n")}
<p style="margin:8px 0 24px"><a href="${esc(changelogUrl)}" style="display:inline-block;background:#4A7CFF;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;padding:12px 24px;border-radius:8px">See everything that's new</a></p>
<p style="font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#6a6865;margin:0">${esc(postal || "[postal address]")}<br>You're getting this because you joined the Ravenburst list. <a href="${esc(unsubscribeUrl)}" style="color:#6a6865">Unsubscribe</a></p>
</div></body></html>`;
  return { text, html, unsubscribeUrl };
}

// Who's had which release's email (migrations/0002). Created here on the
// first real send, so there's no separate step; a dry run changes nothing.
const tableExists = d1Read("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'announcement_sends'").length > 0;
if (send && !tableExists) {
  d1Write(`CREATE TABLE IF NOT EXISTS announcement_sends (
  release  TEXT NOT NULL,
  email    TEXT NOT NULL COLLATE NOCASE,
  sent_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (release, email)
);`);
}
const alreadySent = tableExists
  ? ` AND NOT EXISTS (SELECT 1 FROM announcement_sends a WHERE a.release = '${release}' AND a.email = s.email)`
  : "";

// `release` passed the pattern above, so it is safe in fixed SQL.
const due = d1Read(
  `SELECT s.email, s.token FROM subscribers s WHERE s.status = 'confirmed'${alreadySent} ORDER BY s.confirmed_at`,
);
if (due.some((r) => typeof r.email !== "string" || typeof r.token !== "string")) {
  console.error("Unexpected rows from the database; nothing sent.", due);
  process.exit(1);
}
console.log(`${due.length} confirmed address(es) haven't had the ${release} email yet.`);

if (!send) {
  console.log(`\nSubject: ${mail.subject}\n\n${build("PREVIEW-TOKEN").text}\n`);
  console.log("Dry run - nothing sent. Add --send to send it.");
  process.exit(0);
}

let sent = 0;
for (const { email, token } of due) {
  const { text, html, unsubscribeUrl } = build(token);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: mail.subject,
      text,
      html,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:support@ravenburst.com?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  }).catch((err) => ({ ok: false, status: 0, text: async () => String(err) }));
  if (!res.ok) {
    console.error(`  ✗ ${email} - Resend said ${res.status}: ${(await res.text()).slice(0, 200)}`);
    console.error("Stopping. Run it again later; it only sends to whoever hasn't had it.");
    break;
  }
  d1Write(`INSERT OR IGNORE INTO announcement_sends (release, email) VALUES (${sqlString(release)}, ${sqlString(email)});`);
  sent++;
  console.log(`  ✓ ${email}`);
  await new Promise((r) => setTimeout(r, 600)); // stay well under Resend's rate limit
}
console.log(`Done: ${sent} sent.`);
