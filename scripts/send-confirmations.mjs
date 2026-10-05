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

// Through a SQL file, so no value ever passes through a shell command line.
function d1(sql) {
  const file = path.join(os.tmpdir(), `ravenburst-d1-${process.pid}.sql`);
  fs.writeFileSync(file, sql);
  try {
    const out = execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["wrangler", "d1", "execute", "ravenburst-list", "--remote", "--json", "--file", file],
      { encoding: "utf8", shell: process.platform === "win32" },
    );
    return JSON.parse(out.slice(out.indexOf("[")))[0].results;
  } finally {
    fs.rmSync(file, { force: true });
  }
}

const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

const pending = d1("SELECT email, token FROM subscribers WHERE status = 'pending' AND confirm_sent_at IS NULL;");
console.log(`${pending.length} address(es) waiting for a confirmation email.`);

let sent = 0;
for (const { email, token } of pending) {
  const ok = await sendConfirmation(env, email, token);
  if (!ok) {
    console.error(`  ✗ ${email} - Resend refused it; stopping so nothing is double-sent.`);
    break;
  }
  d1(`UPDATE subscribers SET confirm_sent_at = datetime('now'), confirm_sends = confirm_sends + 1 WHERE email = ${sqlString(email)};`);
  sent++;
  console.log(`  ✓ ${email}`);
  await new Promise((r) => setTimeout(r, 600)); // stay well under Resend's rate limit
}
console.log(`Done: ${sent} sent.`);
