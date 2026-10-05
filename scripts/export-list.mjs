// Downloads the mailing list from the live D1 database as a CSV.
//   npm run list:export            -> list-export-YYYY-MM-DD.csv (confirmed only)
//   npm run list:export -- --all   -> every row, any status
// Uses your `wrangler login`. The CSV holds email addresses: keep it private.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const all = process.argv.includes("--all");
const where = all ? "" : "WHERE status = 'confirmed'";
const out = execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "d1", "execute", "ravenburst-list", "--remote", "--json", "--command",
    `"SELECT email, status, source, created_at, confirmed_at, unsubscribed_at FROM subscribers ${where} ORDER BY created_at"`],
  { encoding: "utf8", shell: process.platform === "win32" },
);
const rows = JSON.parse(out.slice(out.indexOf("[")))[0].results;
const cols = ["email", "status", "source", "created_at", "confirmed_at", "unsubscribed_at"];
const cell = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
const file = `list-export-${new Date().toISOString().slice(0, 10)}.csv`;
fs.writeFileSync(file, csv);
console.log(`${rows.length} row(s) -> ${file}`);
