// Sends the confirm-your-address email to everyone who signed up before an
// email sender was configured (status 'pending', never sent). Run once after
// connecting Resend, from this folder:
//
//   $env:RESEND_API_KEY = "re_..."; npm run list:send-confirmations
//
// Uses your `wrangler login` to read and update the live D1 database, and the
// same email template the live signup endpoint sends.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sendConfirmation } from "../functions/_lib/list.js";

const key = process.env.RESEND_API_KEY;
if (!key) {
  console.error('Set RESEND_API_KEY first, e.g.  $env:RESEND_API_KEY = "re_..."');
  process.exit(1);
}
const env = {
  RESEND_API_KEY: key,
  SITE_URL: "https://ravenburst.com",
  MAIL_FROM: "Ravenburst <hello@ravenburst.com>",
};

function wrangler(args) {
  const out = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler", "d1", "execute", "ravenburst-list", "--remote", "--json", ...args],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  const [result] = JSON.parse(out.slice(out.indexOf("[")));
  if (!result?.success) throw new Error("D1 query failed");
  return result.results;
}

// Reads go inline: with --file, wrangler returns only a summary row
// ("Total queries executed": 1) instead of the rows, which this script once
// mistook for a subscriber. Only fixed SQL goes this way, never a value.
function d1Read(sql) {
  if (/["%^&|<>]/.test(sql)) throw new Error("d1Read takes fixed SQL only");
  // On Windows the shell joins arguments unquoted, so quote the query whole.
  return wrangler(["--command", process.platform === "win32" ? `"${sql}"` : sql]);
}

// Writes carry email addresses, so they go through a SQL file and never pass
// through a shell command line. Their summary result is all we need.
function d1Write(sql) {
  const file = path.join(os.tmpdir(), `ravenburst-d1-${process.pid}.sql`);
  fs.writeFileSync(file, sql);
  try {
    wrangler(["--file", file]);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

const pending = d1Read("SELECT email, token FROM subscribers WHERE status = 'pending' AND confirm_sent_at IS NULL");
if (pending.some((r) => typeof r.email !== "string" || typeof r.token !== "string")) {
  console.error("Unexpected rows from the database; nothing sent.", pending);
  process.exit(1);
}
console.log(`${pending.length} address(es) waiting for a confirmation email.`);

let sent = 0;
for (const { email, token } of pending) {
  const ok = await sendConfirmation(env, email, token);
  if (!ok) {
    console.error(`  ✗ ${email} - Resend refused it; stopping so nothing is double-sent.`);
    break;
  }
  d1Write(`UPDATE subscribers SET confirm_sent_at = datetime('now'), confirm_sends = confirm_sends + 1 WHERE email = ${sqlString(email)};`);
  sent++;
  console.log(`  ✓ ${email}`);
  await new Promise((r) => setTimeout(r, 600)); // stay well under Resend's rate limit
}
console.log(`Done: ${sent} sent.`);
