// Sends the confirm-your-address email to everyone who signed up before an
// email sender was configured (status 'pending', never sent). Run once after
// connecting Resend, from this folder:
//
//   $env:RESEND_API_KEY = "re_..."; npm run list:send-confirmations
//
// Uses your `wrangler login` to read and update the live D1 database, and the
// same email template the live signup endpoint sends.
import { d1Read, d1Write, sqlString } from "./d1.mjs";
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
