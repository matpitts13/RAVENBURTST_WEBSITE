// Unsubscribing.
//  GET  /api/unsubscribe?token=...  shows a page with an Unsubscribe button
//       and never unsubscribes by itself: mail scanners open every link in a
//       message, and a GET that unsubscribed would silently drop people.
//  POST /api/unsubscribe            does it - from that button, or from the
//       mail app's own one-click button (RFC 8058, token in the query string).
import { isToken, redirect, pageWithToken, tokenFrom } from "../_lib/list.js";

export function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isToken(token)) return redirect("/list/link-expired");
  return pageWithToken(env, request, "/list/unsubscribe/", token);
}

export async function onRequestPost({ request, env }) {
  const token = await tokenFrom(request);
  if (!token) return redirect("/list/link-expired");

  await env.DB.prepare(
    `UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now')
     WHERE token = ?1 AND status != 'unsubscribed'`,
  ).bind(token).run();
  // Same page whether or not the token matched a row: nothing to learn here.
  return redirect("/list/unsubscribed");
}
