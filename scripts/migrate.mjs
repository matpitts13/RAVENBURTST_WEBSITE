// Applies migrations/*.sql to the live database, in order, skipping any
// already recorded in d1_migrations (the table wrangler keeps), so it and
// `wrangler d1 migrations apply` stay interchangeable.
//   npm run db:migrate            -> lists what would run
//   npm run db:migrate -- --apply -> runs it
// Each file and its d1_migrations record go in one request.
import fs from "node:fs";
import { d1Read, d1Write, sqlString } from "./d1.mjs";

const apply = process.argv.includes("--apply");
const dir = new URL("../migrations/", import.meta.url);
const files = fs.readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const done = new Set((await d1Read("SELECT name FROM d1_migrations")).map((r) => r.name));
const pending = files.filter((f) => !done.has(f));

if (!pending.length) {
  console.log("Database is up to date.");
} else if (!apply) {
  console.log(`Would apply:\n${pending.map((f) => `  ${f}`).join("\n")}\nRun with --apply to apply them.`);
} else {
  for (const f of pending) {
    const sql = fs.readFileSync(new URL(f, dir), "utf8");
    await d1Write(`${sql}\nINSERT INTO d1_migrations (name) VALUES (${sqlString(f)});`);
    console.log(`  applied ${f}`);
  }
}
