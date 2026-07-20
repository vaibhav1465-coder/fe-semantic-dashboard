import { isFinancialExpressArticleUrl } from "../lib/article-url.js";
import { resolveArticle } from "../lib/content-sources.js";
import { analyzeEntities, googleNlpDiagnostics } from "../lib/google-nlp.js";


const NON_EDITORIAL_ENTITY_TYPES = new Set(["DATE", "NUMBER", "PRICE", "PHONE_NUMBER", "ADDRESS"]);
const GENERIC_ENTITY_NAMES = new Set(["year", "month", "day", "today", "tomorrow", "yesterday", "article", "news", "report"]);

export function isMeaningfulEditorialEntity(entity = {}) {
  const name = String(entity.name || "").replace(/\s+/g, " ").trim();
  const type = String(entity.type || "OTHER").toUpperCase();
  const normalized = name.toLowerCase();

  if (!name || name.length < 2 || name.length > 100) return false;
  if (NON_EDITORIAL_ENTITY_TYPES.has(type)) return false;
  if (GENERIC_ENTITY_NAMES.has(normalized)) return false;
  if (/^\d{1,4}$/.test(normalized)) return false;
  if (/^(19|20)\d{2}$/.test(normalized)) return false;
  if (/^\d+(?:[.,]\d+)?%?$/.test(normalized)) return false;
  if (/^\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?$/.test(normalized)) return false;
  return true;
}

function analysisText(article = {}) {
  const text = [article.title, article.description, article.articleBody]
    .filter(Boolean)
    .join(". ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, Number(process.env.GOOGLE_NLP_ENTITY_MAX_CHARS || 30000));
}

function normalizedEntityName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/s$/, "");
}

function sharedEntities(sourceEntities = [], targetEntities = []) {
  const targetMap = new Map();
  for (const entity of targetEntities) {
    if (!isMeaningfulEditorialEntity(entity)) continue;
    const key = normalizedEntityName(entity.name);
    if (key) targetMap.set(key, entity);
  }

  const shared = [];
  const seen = new Set();
  for (const entity of sourceEntities) {
    if (!isMeaningfulEditorialEntity(entity)) continue;
    const key = normalizedEntityName(entity.name);
    const target = targetMap.get(key);
    if (!key || !target || seen.has(key)) continue;
    seen.add(key);
    shared.push({
      name: entity.name || target.name,
      type: entity.type || target.type || "OTHER",
      source_salience: entity.salience ?? null,
      target_salience: target.salience ?? null
    });
  }

  return shared
    .sort((a, b) => ((b.source_salience || 0) + (b.target_salience || 0)) - ((a.source_salience || 0) + (a.target_salience || 0)))
    .slice(0, 8);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const sourceUrl = String(req.query?.source_url || "").trim();
  const targetUrl = String(req.query?.target_url || "").trim();
  const force = req.query?.force === "1";

  if (!isFinancialExpressArticleUrl(sourceUrl) || !isFinancialExpressArticleUrl(targetUrl)) {
    return res.status(400).json({
      status: "failed",
      error: "Both URLs must be Financial Express article pages"
    });
  }

  try {
    const [sourceArticle, targetArticle] = await Promise.all([
      resolveArticle(sourceUrl, { force }),
      resolveArticle(targetUrl, { force })
    ]);

    const [sourceNlp, targetNlp] = await Promise.all([
      analyzeEntities(analysisText(sourceArticle), { force }),
      analyzeEntities(analysisText(targetArticle), { force })
    ]);

    const shared = sharedEntities(sourceNlp.entities, targetNlp.entities);
    const statuses = [sourceNlp.cache_status, targetNlp.cache_status];
    const status = statuses.includes("live") ? "live" : statuses.includes("stale-cache") ? "stale-cache" : "cache";

    res.setHeader("Cache-Control", force ? "no-store" : "s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({
      status,
      shared_entities: shared,
      source_entities: sourceNlp.entities.filter(isMeaningfulEditorialEntity).slice(0, 8),
      target_entities: targetNlp.entities.filter(isMeaningfulEditorialEntity).slice(0, 8),
      analyzed_at: new Date().toISOString(),
      detail: "Google Cloud Natural Language entities were extracted from the two article pages.",
      google_nlp: googleNlpDiagnostics()
    });
  } catch (error) {
    return res.status(502).json({
      status: "failed",
      error: "Google entities are unavailable for this recommendation",
      detail: error.message,
      google_nlp: googleNlpDiagnostics(),
      checked_at: new Date().toISOString()
    });
  }
}
