// Confirming a signup.
//  GET  /api/confirm?token=...  the link in the email: shows a page with a
//       Confirm button and never confirms by itself - mail scanners open
//       every link, and a GET that confirmed would sign people up who never
//       clicked anything.
//  POST /api/confirm            the button: confirms.
import { isToken, redirect, pageWithToken, tokenFrom } from "../_lib/list.js";

export function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isToken(token)) return redirect("/list/link-expired");
  return pageWithToken(env, request, "/list/confirm/", token);
}

export async function onRequestPost({ request, env }) {
  const token = await tokenFrom(request);
  if (!token) return redirect("/list/link-expired");

  const row = await env.DB.prepare("SELECT status FROM subscribers WHERE token = ?1").bind(token).first();
  if (!row) return redirect("/list/link-expired");
  if (row.status === "pending") {
    await env.DB.prepare(
      "UPDATE subscribers SET status = 'confirmed', confirmed_at = datetime('now') WHERE token = ?1 AND status = 'pending'",
    ).bind(token).run();
  }
  // Already confirmed is fine; an unsubscribed address stays unsubscribed.
  return redirect(row.status === "unsubscribed" ? "/list/unsubscribed" : "/list/confirmed");
}
