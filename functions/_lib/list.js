// Shared helpers for the mailing-list Functions (functions/api/*).

export const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

export function redirect(url, status = 303) {
  return new Response(null, { status, headers: { Location: url, "Cache-Control": "no-store" } });
}

/** 32 random bytes, URL-safe. Used in confirm and unsubscribe links. */
export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isToken(t) {
  return typeof t === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(t);
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Serves a static /list/* page with the link's token filled into its form,
 *  so the button works without JavaScript. GETs never act on the token
 *  themselves: mail scanners open every link in a message. */
export async function pageWithToken(env, request, pagePath, token) {
  const page = await env.ASSETS.fetch(new URL(pagePath, request.url));
  return new HTMLRewriter()
    .on('input[name="token"]', {
      element(el) {
        el.setAttribute("value", token); // isToken() already limited it to [A-Za-z0-9_-]
      },
    })
    .transform(new Response(page.body, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    }));
}

/** Reads a token from the query string or a submitted form. */
export async function tokenFrom(request) {
  const fromQuery = new URL(request.url).searchParams.get("token");
  if (isToken(fromQuery)) return fromQuery;
  try {
    const form = await request.formData();
    const t = String(form.get("token") || "");
    return isToken(t) ? t : null;
  } catch {
    return null;
  }
}

/** Sends the confirm-your-address email through Resend. Returns true if it
 *  was accepted. Without RESEND_API_KEY, or if Resend can't be reached, it
 *  returns false and the address waits for scripts/send-confirmations.mjs. */
export async function sendConfirmation(env, email, token) {
  if (!env.RESEND_API_KEY) return false;
  try {
    return await sendConfirmationNow(env, email, token);
  } catch {
    return false;
  }
}

async function sendConfirmationNow(env, email, token) {
  const site = env.SITE_URL || "https://ravenburst.com";
  const confirmUrl = `${site}/api/confirm?token=${token}`;
  const unsubscribeUrl = `${site}/api/unsubscribe?token=${token}`;

  const text = [
    "Thanks for joining the Ravenburst list.",
    "",
    "Please confirm your address so we can email you when the Kickstarter launches:",
    confirmUrl,
    "",
    "If you didn't sign up, ignore this email and you won't hear from us again.",
    "",
    "— Ravenburst",
    site,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f5f2;font-family:Georgia,serif;color:#252422">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e0da;border-radius:12px;padding:32px">
<h1 style="font-size:24px;margin:0 0 16px">Confirm your address</h1>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin:0 0 24px">Thanks for joining the Ravenburst list. Please confirm your address so we can email you when the Kickstarter launches.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#4A7CFF;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;padding:12px 24px;border-radius:8px">Confirm my address</a></p>
<p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#6a6865;margin:0">If you didn’t sign up, ignore this email and you won’t hear from us again.</p>
</div></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM || "Ravenburst <hello@ravenburst.com>",
      to: [email],
      subject: "Confirm your Ravenburst signup",
      text,
      html,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:support@ravenburst.com?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  return res.ok;
}
