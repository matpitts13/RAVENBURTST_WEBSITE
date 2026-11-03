// The live mailing-list database (D1), through your `wrangler login`.
// Shared by the scripts that send email and by db:migrate. Talks to
// Cloudflare's REST API directly: `wrangler d1` answers 403 (code 7403) for
// this account while the same login works over REST.
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ACCOUNT = "df5433f43795add54e813c01e62e6c18";
const DATABASE = "841c120f-a8aa-4276-a0a1-a3b9ee0d0ffa"; // ravenburst-list
const QUERY_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DATABASE}/query`;

let token;
function getToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  if (token) return token;
  // whoami refreshes an expired OAuth token in wrangler's config.
  execSync("npx wrangler whoami", { stdio: "ignore" });
  const base = process.platform === "win32"
    ? path.join(process.env.APPDATA, "xdg.config")
    : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  const config = fs.readFileSync(path.join(base, ".wrangler", "config", "default.toml"), "utf8");
  token = config.match(/^oauth_token = "(.*)"$/m)?.[1];
  if (!token) throw new Error("No wrangler login found. Run `npx wrangler login`.");
  return token;
}

// Runs one or more statements; returns the rows of each.
async function query(sql) {
  const res = await fetch(QUERY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    const why = body.errors?.map((e) => `${e.message} [${e.code}]`).join("; ") || `HTTP ${res.status}`;
    throw new Error(`D1 query failed: ${why}`);
  }
  return body.result.map((r) => r.results);
}

export async function d1Read(sql) {
  return (await query(sql)).at(-1);
}

export async function d1Write(sql) {
  await query(sql);
}

export const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;
