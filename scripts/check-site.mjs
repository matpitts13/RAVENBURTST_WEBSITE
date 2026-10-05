// Checks the built site (dist/) before it ships. No dependencies.
//   npm run check   (runs after `npm run build`)
//
// Fails on:
//  - banned terms: AI features are hidden in the app, so the site must not
//    promise or mention them (word-boundary matches, case-insensitive)
//  - internal links / assets that don't resolve to a built file
//  - pages without a <title> or meta description
//  - docs pages missing from the docs menu, or menu entries with no page
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");
const BANNED = [
  /\bA\.?I\b/, // "AI", "A.I" (but not words like "maintain")
  /\bartificial intelligence\b/i,
  /\bmachine learning\b/i,
  /\bLLMs?\b/,
  /\b(Ollama|Claude|Anthropic|OpenAI|ChatGPT|GPT-?\d|Gemini|Copilot)\b/i,
  /\b(Story Bible|Writing Coach|Continuity Check|Reference Assistant)\b/i,
  /\bTypewriter Mode\b/i, // shelved in the app
  /\bOneDrive\b/i, // removed from the app
];

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? htmlFiles(p) : e.name.endsWith(".html") ? [p] : [];
  });
}

// Visible text only: drop scripts/styles/tags so class names and code
// don't trigger the banned-term check, but keep alt/title/aria text.
function visibleText(html) {
  const attrs = [...html.matchAll(/\s(?:alt|title|aria-label|content)="([^"]*)"/g)].map((m) => m[1]);
  const body = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
  return body + " " + attrs.join(" ");
}

function resolves(href, fromFile) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return true;
  const base = clean.startsWith("/") ? DIST : path.dirname(fromFile);
  const target = path.join(base, decodeURI(clean));
  return [target, target + ".html", path.join(target, "index.html")].some(
    (t) => fs.existsSync(t) && fs.statSync(t).isFile(),
  );
}

if (!fs.existsSync(DIST)) {
  console.error("dist/ not found - run `npm run build` first.");
  process.exit(1);
}

const problems = [];
const files = htmlFiles(DIST);
for (const file of files) {
  const rel = path.relative(DIST, file).replace(/\\/g, "/");
  const html = fs.readFileSync(file, "utf8");
  const text = visibleText(html);

  for (const re of BANNED) {
    const m = text.match(re);
    if (m) {
      const at = text.indexOf(m[0]);
      problems.push(`${rel}: banned term "${m[0]}" in "…${text.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, " ").trim()}…"`);
    }
  }

  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(url)) continue;
    if (url.startsWith("/api/")) continue; // Pages Functions, not files
    if (!resolves(url, file)) problems.push(`${rel}: broken link ${url}`);
  }

  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${rel}: missing <title>`);
  if (!/<meta name="description" content="[^"]+"/.test(html)) problems.push(`${rel}: missing meta description`);
}

// Every docs page is in the docs menu (src/data/docsNav.ts), and every menu
// entry is a real page - so no page is unreachable and no link goes nowhere.
const navSource = fs.readFileSync(path.resolve("src/data/docsNav.ts"), "utf8");
const navHrefs = new Set([...navSource.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]));
const docPages = files
  .map((f) => "/" + path.relative(DIST, f).replace(/\\/g, "/").replace(/(^|\/)index\.html$/, "").replace(/\.html$/, ""))
  .map((p) => p.replace(/\/$/, ""))
  .filter((p) => p === "/docs" || p.startsWith("/docs/"));
for (const page of docPages) {
  if (!navHrefs.has(page)) problems.push(`${page}: docs page missing from src/data/docsNav.ts`);
}
for (const href of navHrefs) {
  if (!docPages.includes(href)) problems.push(`src/data/docsNav.ts: ${href} has no page`);
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s) in ${files.length} pages:\n` + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log(`✓ ${files.length} pages: no banned terms, links resolve, titles and descriptions present.`);
