// The live mailing-list database (D1), through your `wrangler login`.
// Shared by the scripts that send email.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
// ("Total queries executed": 1) instead of the rows, which a script once
// mistook for a subscriber. Only fixed SQL goes this way, never a value.
export function d1Read(sql) {
  if (/["%^&|<>]/.test(sql)) throw new Error("d1Read takes fixed SQL only");
  // On Windows the shell joins arguments unquoted, so quote the query whole.
  return wrangler(["--command", process.platform === "win32" ? `"${sql}"` : sql]);
}

// Writes carry email addresses, so they go through a SQL file and never pass
// through a shell command line. Their summary result is all we need.
export function d1Write(sql) {
  const file = path.join(os.tmpdir(), `ravenburst-d1-${process.pid}.sql`);
  fs.writeFileSync(file, sql);
  try {
    wrangler(["--file", file]);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

export const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;
