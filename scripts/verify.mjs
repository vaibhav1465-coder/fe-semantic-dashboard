import fs from "node:fs";
import { readDataset } from "../lib/data.js";
import { validateDataset } from "../lib/validation.js";

const required = [
  "index.html",
  "api/health.js",
  "api/recommendations.js",
  "api/actions.js",
  "api/self-test.js",
  "api/content.js",
  "api/nlp.js",
  "api/sources.js",
  "api/cache.js",
  "api/cron-refresh.js",
  "api/provenance.js",
  "lib/cache.js",
  "lib/rss.js",
  "lib/wordpress.js",
  "lib/content-sources.js",
  "lib/google-nlp.js",
  "lib/sentiment-reasoning.js",
  "lib/provenance.js",
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
console.log(`INFO records=${data.items.length} invalid=${validation.invalid} warnings=${validation.warnings}`);
if (!data.items.length) failed = true;

const html = fs.readFileSync("index.html", "utf8");
const htmlChecks = [
  ["Anchor Text Recommendation", "anchor recommendation column"],
  ["/api/provenance?live=1", "live source provenance API"],
  ["WordPress REST:", "WordPress REST status"],
  ["RSS:", "RSS status"],
  ["nlp_cache_status", "NLP cache provenance"],
  ["Live Data Provenance", "provenance header"],
  ["/api/provenance?live=1", "live provenance API"],
  ["RSS Feed", "RSS fallback label"],
  ["Fallback Cache", "fallback cache label"],
  ["Last Crawl", "last crawl label"],
  ["Why this score:", "sentiment reasoning"]
];
for (const [needle, label] of htmlChecks) {
  const ok = html.includes(needle);
  console.log(`${ok ? "PASS" : "FAIL"} UI ${label}`);
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
const cronOk = Array.isArray(vercel.crons) && vercel.crons.some(x => x.path === "/api/cron-refresh");
console.log(`${cronOk ? "PASS" : "FAIL"} Vercel cron refresh`);
if (!cronOk) failed = true;

if (failed) process.exit(1);
console.log("PASS operational package verification complete");
