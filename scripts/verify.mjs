import fs from "node:fs";
import { readDataset } from "../lib/data.js";
import { validateDataset } from "../lib/validation.js";

const required = [
  "index.html",
  "api/health.js",
  "api/recommendations.js",
  "api/live-recommendations.js",
  "api/actions.js",
  "api/self-test.js",
  "api/content.js",
  "api/nlp.js",
  "api/sources.js",
  "api/cache.js",
  "api/cron-refresh.js",
  "api/provenance.js",
  "api/pair-entities.js",
  "lib/cache.js",
  "lib/rss.js",
  "lib/wordpress.js",
  "lib/content-sources.js",
  "lib/recommendation-engine.js",
  "lib/live-recommendations.js",
  "lib/google-nlp.js",
  "lib/sentiment-reasoning.js",
  "lib/provenance.js",
  "lib/article-url.js",
  "data/recommendations.json",
  "data/content-cache.json",
  "supabase/001_editorial_actions.sql",
  "supabase/002_semantic_cache.sql",
  "vercel.json"
];

let failed = false;
for (const file of required) {
  const ok = fs.existsSync(file);
  console.log(`${ok ? "PASS" : "FAIL"} ${file}`);
  if (!ok) failed = true;
}

const data = readDataset();
const validation = validateDataset(data.items);
console.log(`INFO fallback_records=${data.items.length} invalid=${validation.invalid} warnings=${validation.warnings}`);
if (!data.items.length) failed = true;

const html = fs.readFileSync("index.html", "utf8");
const htmlChecks = [
  ["Specific anchor text", "specific anchor text"],
  ["Where to add the link", "placement guidance"],
  ["Why this link is relevant", "simple-English reason"],
  ["Why this score", "compact match-score reason"],
  ["Google entities", "Google entities"],
  ["/api/pair-entities", "on-demand Google entity API"],
  ["/api/live-recommendations?limit=60", "60-article live recommendation API"],
  ["/api/provenance?live=1", "live source provenance API"],
  ["WordPress REST API", "WordPress REST source"],
  ["RSS Feed", "RSS fallback label"],
  ["Fallback Cache", "fallback cache label"],
  ["Last Crawl", "last crawl label"],
  ["Contextual, relevant, and meaningful for readers", "editorial reader-value language"],
  ["details class=\"article-row\"", "URL dropdown rows"],
  ["Only article-to-article links are shown", "complete quality rule"],
  ["Load 10 more articles", "10-article load-more control"],
  ["Qualified article URLs", "clear metrics label"]
];
for (const [needle, label] of htmlChecks) {
  const ok = html.includes(needle);
  console.log(`${ok ? "PASS" : "FAIL"} UI ${label}`);
  if (!ok) failed = true;
}

const hiddenUiChecks = [
  ["Status: ${esc(row.Status", "approved status badge"],
  ["How it was matched", "match-method field"],
  ["Article source", "article-source field"]
];
for (const [needle, label] of hiddenUiChecks) {
  const ok = !html.includes(needle);
  console.log(`${ok ? "PASS" : "FAIL"} hidden ${label}`);
  if (!ok) failed = true;
}

const removedUiChecks = [
  ["score-bar-bg", "old score progress bar"],
  ["table-wrap", "old horizontal table layout"],
  ["recommendations-grid", "old suggestion card grid"],
  ["recommendation-card", "old suggestion cards"],
  ["carousel", "carousel UI"]
];
for (const [needle, label] of removedUiChecks) {
  const ok = !html.toLowerCase().includes(needle.toLowerCase());
  console.log(`${ok ? "PASS" : "FAIL"} removed ${label}`);
  if (!ok) failed = true;
}

const forbiddenInHtml = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "BEGIN PRIVATE KEY"
];
for (const secret of forbiddenInHtml) {
  const ok = !html.includes(secret);
  console.log(`${ok ? "PASS" : "FAIL"} no secret in index: ${secret}`);
  if (!ok) failed = true;
}

const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const cronOk = Array.isArray(vercel.crons) && vercel.crons.some(item => item.path === "/api/cron-refresh");
console.log(`${cronOk ? "PASS" : "FAIL"} Vercel cron refresh`);
if (!cronOk) failed = true;

const runtimeRemoved = !vercel.functions?.["api/*.js"]?.runtime;
console.log(`${runtimeRemoved ? "PASS" : "FAIL"} invalid Vercel runtime removed`);
if (!runtimeRemoved) failed = true;

if (failed) process.exit(1);
console.log("PASS operational package verification complete");
