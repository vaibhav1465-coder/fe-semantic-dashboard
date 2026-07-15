import fs from "node:fs";
import path from "node:path";
import { resolveArticle } from "../lib/content-sources.js";
import { analyzeText, googleNlpConfigured } from "../lib/google-nlp.js";
import { enrichRecommendation, validateDataset, recordKey } from "../lib/validation.js";
import { buildSentimentReason } from "../lib/sentiment-reasoning.js";

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const headers = (rows.shift() || []).map(x => x.trim());
  return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

function field(row, names, fallback = "") {
  for (const name of names) {
    if (row[name] != null && String(row[name]).trim() !== "") return row[name];
  }
  return fallback;
}

function normalizeSentiment(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function normalizeRow(row, index) {
  const entitiesRaw = field(row, ["Entities", "Google NLP Entities", "common_entities", "Shared Entities"], "");
  const entities = Array.isArray(entitiesRaw)
    ? entitiesRaw
    : String(entitiesRaw).split(/[|;,]/).map(x => x.trim()).filter(Boolean);
  return {
    id: field(row, ["id", "ID"], `fe-${index + 1}`),
    "Source URL": field(row, ["Source URL", "source_url", "SourceURL"]),
    "Source Title": field(row, ["Source Title", "source_title", "SourceTitle"]),
    "Target URL": field(row, ["Target URL", "target_url", "TargetURL", "Recommended URL"]),
    "Target Title": field(row, ["Target Title", "target_title", "TargetTitle", "Recommended Title"]),
    Status: field(row, ["Status", "status", "Decision"], "Approved"),
    "Confidence Score": Number(field(row, ["Confidence Score", "confidence_score", "Score", "Similarity Score"], 0)),
    Reason: field(row, ["Reason", "reason", "Recommendation Reason"]),
    "Anchor Text Suggestion": field(row, ["Anchor Text Suggestion", "anchor_text", "Suggested Anchor Text"]),
    "Link Placement Suggestion": field(row, ["Link Placement Suggestion", "placement", "Suggested Placement"]),
    "Source Tag": field(row, ["Source Tag", "source_tag", "Cluster"], "FE Article"),
    Entities: entities,
    source_date: field(row, ["source_date", "Source Date", "Source Published Date"], null),
    target_date: field(row, ["target_date", "Target Date", "Target Published Date"], null),
    source_body: field(row, ["source_body", "Source Body", "Source Content"], ""),
    target_body: field(row, ["target_body", "Target Body", "Target Content"], ""),
    "Source Sentiment": normalizeSentiment(row["Source Sentiment"] || row.source_sentiment),
    "Target Sentiment": normalizeSentiment(row["Target Sentiment"] || row.target_sentiment),
    "Source Sentiment Reason": normalizeSentiment(row["Source Sentiment Reason"] || row.source_sentiment_reason),
    "Target Sentiment Reason": normalizeSentiment(row["Target Sentiment Reason"] || row.target_sentiment_reason),
    nlp_status: field(row, ["nlp_status", "NLP Status"], (row["Source Sentiment"] || row.source_sentiment) ? "cached" : "not_configured")
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const args = process.argv.slice(2);
const noFetch = args.includes("--no-fetch");
const noNlp = args.includes("--no-nlp");
const forceNlp = args.includes("--force-nlp");
const forceSources = args.includes("--force-sources");
const inputArg = args.find(x => !x.startsWith("--"));
const defaultInput = fs.existsSync("input/recommendations.json") ? "input/recommendations.json" : "input/recommendations.csv";
const inputPath = path.resolve(inputArg || defaultInput);

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  console.error("Run npm run import-live, or place the FE export at input/recommendations.csv.");
  process.exit(1);
}

let rawRows;
if (inputPath.toLowerCase().endsWith(".json")) {
  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  rawRows = Array.isArray(payload) ? payload : (payload.items || []);
} else {
  rawRows = parseCsv(fs.readFileSync(inputPath, "utf8"));
}
let items = rawRows.map(normalizeRow);

const urls = [...new Set(items.flatMap(x => [x["Source URL"], x["Target URL"]]).filter(Boolean))];
const articleMap = new Map();
if (!noFetch) {
  console.log(`Resolving ${urls.length} unique FE URLs through WordPress REST → RSS → HTML → static cache...`);
  await mapLimit(urls, 4, async url => {
    try {
      articleMap.set(url, await resolveArticle(url, { force: forceSources }));
    } catch (error) {
      articleMap.set(url, { url, source: "unavailable", cache_status: "miss", error: error.message });
    }
  });
}

const nlpByUrl = new Map();
async function nlpFor(url, text, existingSentiment) {
  if (!forceNlp && existingSentiment) {
    return {
      sentiment: existingSentiment,
      sentiment_reason: existingSentiment.reasoning || buildSentimentReason(existingSentiment, []),
      sentence_sentiments: [],
      entities: [],
      nlp_status: "cached",
      cache_status: "processed-cache"
    };
  }
  if (nlpByUrl.has(url)) return nlpByUrl.get(url);
  if (noNlp || !googleNlpConfigured()) {
    const result = {
      sentiment: existingSentiment || null,
      sentiment_reason: existingSentiment ? (existingSentiment.reasoning || buildSentimentReason(existingSentiment, [])) : null,
      sentence_sentiments: [],
      entities: [],
      nlp_status: existingSentiment ? "cached" : "not_configured",
      cache_status: existingSentiment ? "processed-cache" : "not_configured"
    };
    nlpByUrl.set(url, result);
    return result;
  }
  try {
    const result = await analyzeText(text, { force: forceNlp });
    nlpByUrl.set(url, result);
    return result;
  } catch (error) {
    const result = {
      sentiment: existingSentiment || null,
      sentiment_reason: existingSentiment ? (existingSentiment.reasoning || buildSentimentReason(existingSentiment, [])) : null,
      sentence_sentiments: [],
      entities: [],
      nlp_status: "failed",
      cache_status: existingSentiment ? "processed-cache" : "miss",
      error: error.message
    };
    nlpByUrl.set(url, result);
    return result;
  }
}

items = await mapLimit(items, 3, async item => {
  const sourceArticle = articleMap.get(item["Source URL"]) || {};
  const targetArticle = articleMap.get(item["Target URL"]) || {};

  item["Source Title"] = item["Source Title"] || sourceArticle.title || "";
  item["Target Title"] = item["Target Title"] || targetArticle.title || "";
  item.source_date = item.source_date || sourceArticle.datePublished || null;
  item.target_date = item.target_date || targetArticle.datePublished || null;
  item.source_body = item.source_body || sourceArticle.articleBody || sourceArticle.description || "";
  item.target_body = item.target_body || targetArticle.articleBody || targetArticle.description || "";
  item.source_reachable = sourceArticle.source !== "unavailable" && Boolean(sourceArticle.url || sourceArticle.title);
  item.target_reachable = targetArticle.source !== "unavailable" && Boolean(targetArticle.url || targetArticle.title);
  item.source_content_source = sourceArticle.source || "input";
  item.target_content_source = targetArticle.source || "input";
  item.source_cache_status = sourceArticle.cache_status || "input";
  item.target_cache_status = targetArticle.cache_status || "input";
  item.metadata_status = item.source_date && item.target_date ? "complete" : "partial";

  const sourceNlp = await nlpFor(item["Source URL"], item.source_body || item["Source Title"], item["Source Sentiment"]);
  const targetNlp = await nlpFor(item["Target URL"], item.target_body || item["Target Title"], item["Target Sentiment"]);
  item["Source Sentiment"] = sourceNlp.sentiment;
  item["Target Sentiment"] = targetNlp.sentiment;
  item["Source Sentiment Reason"] = sourceNlp.sentiment_reason || buildSentimentReason(sourceNlp.sentiment, sourceNlp.sentence_sentiments || []);
  item["Target Sentiment Reason"] = targetNlp.sentiment_reason || buildSentimentReason(targetNlp.sentiment, targetNlp.sentence_sentiments || []);
  item["Source Sentence Sentiments"] = sourceNlp.sentence_sentiments || [];
  item["Target Sentence Sentiments"] = targetNlp.sentence_sentiments || [];

  if ((sourceNlp.entities || []).length || (targetNlp.entities || []).length) {
    item.Entities = [...new Set([
      ...(sourceNlp.entities || []).slice(0, 8).map(x => x.name),
      ...(targetNlp.entities || []).slice(0, 8).map(x => x.name)
    ])].slice(0, 12);
  }

  const statuses = [sourceNlp.nlp_status, targetNlp.nlp_status];
  item.nlp_status = statuses.includes("failed")
    ? "failed"
    : statuses.includes("live")
      ? "live"
      : statuses.some(x => ["cache", "cached", "stale-cache"].includes(x))
        ? "cached"
        : "not_configured";
  item.nlp_cache_status = [sourceNlp.cache_status, targetNlp.cache_status].filter(Boolean).join("+") || "unknown";
  if (sourceNlp.error || targetNlp.error) item.nlp_error = sourceNlp.error || targetNlp.error;
  return enrichRecommendation(item);
});

const seen = new Set();
for (const item of items) {
  const singleValidation = validateDataset([item]).results[0].validation;
  const key = recordKey(item);
  const duplicate = seen.has(key);
  seen.add(key);
  const blocking = [...singleValidation.errors];
  if (duplicate) blocking.push("duplicate_pair");
  if (blocking.some(x => [
    "same_url", "duplicate_pair", "target_not_older_than_source",
    "invalid_source_url", "invalid_target_url"
  ].includes(x))) {
    item.Status = "Rejected";
    item.automatic_rejection_reasons = [...new Set(blocking)];
  }
}

const report = validateDataset(items);
const now = new Date().toISOString();
const batch = `fe-${now.slice(0, 10).replaceAll("-", "")}-${Date.now().toString().slice(-6)}`;
for (const item of items) {
  item.generated_at = now;
  item.batch_id = batch;
}

const sourceSummary = {
  wordpress_rest: items.filter(x => [x.source_content_source, x.target_content_source].includes("wordpress_rest")).length,
  rss: items.filter(x => [x.source_content_source, x.target_content_source].includes("rss")).length,
  html: items.filter(x => [x.source_content_source, x.target_content_source].includes("html")).length,
  static_cache: items.filter(x => [x.source_content_source, x.target_content_source].includes("static-cache")).length,
  nlp_live: items.filter(x => x.nlp_status === "live").length,
  nlp_cached: items.filter(x => x.nlp_status === "cached").length,
  nlp_failed: items.filter(x => x.nlp_status === "failed").length
};

const output = {
  batch_id: batch,
  generated_at: now,
  source: path.basename(inputPath),
  content_source_priority: "WordPress REST → RSS → HTML → static cache",
  source_summary: sourceSummary,
  items
};
fs.writeFileSync("data/recommendations.json", JSON.stringify(output, null, 2));
fs.writeFileSync("data/quality-report.json", JSON.stringify({
  generated_at: now,
  batch_id: batch,
  total: report.total,
  valid: report.valid,
  invalid: report.invalid,
  warnings: report.warnings,
  source_summary: sourceSummary,
  invalid_records: report.results
    .filter(x => !x.validation.valid)
    .map(x => ({ key: recordKey(x.item), errors: x.validation.errors }))
}, null, 2));
console.log(`Processed ${items.length} recommendations. Valid=${report.valid}, Invalid=${report.invalid}, Warnings=${report.warnings}`);
console.log("Content pipeline: WordPress REST → RSS → HTML → static cache");
console.log(`NLP: live=${sourceSummary.nlp_live}, cached=${sourceSummary.nlp_cached}, failed=${sourceSummary.nlp_failed}`);
console.log("Updated data/recommendations.json and data/quality-report.json");
