import { isFinancialExpressArticleUrl } from "../lib/article-url.js";
import { resolveArticle } from "../lib/content-sources.js";
import { analyzeEntities, googleNlpDiagnostics } from "../lib/google-nlp.js";

const NON_EDITORIAL_ENTITY_TYPES = new Set([
  "DATE",
  "NUMBER",
  "PRICE",
  "PHONE_NUMBER",
  "ADDRESS"
]);

const PREFERRED_ENTITY_TYPES = new Set([
  "PERSON",
  "LOCATION",
  "ORGANIZATION",
  "EVENT",
  "WORK_OF_ART",
  "CONSUMER_GOOD"
]);

const GENERIC_ENTITY_NAMES = new Set([
  "article",
  "articles",
  "bank",
  "banks",
  "business",
  "company",
  "companies",
  "cup",
  "day",
  "event",
  "events",
  "final",
  "football",
  "growth",
  "history",
  "industry",
  "latest",
  "list",
  "market",
  "markets",
  "match",
  "matches",
  "month",
  "news",
  "page",
  "pages",
  "price",
  "prices",
  "report",
  "reports",
  "result",
  "results",
  "sport",
  "sports",
  "stock",
  "stocks",
  "today",
  "tomorrow",
  "tournament",
  "tournaments",
  "update",
  "updates",
  "world",
  "year",
  "yesterday"
]);

const LEGAL_SUFFIXES = new Set([
  "co",
  "company",
  "corp",
  "corporation",
  "inc",
  "incorporated",
  "ltd",
  "limited",
  "llc",
  "plc"
]);

const TOKEN_STOP_WORDS = new Set(["a", "an", "and", "of", "the"]);

function cleanEntityDisplayName(value = "") {
  return String(value)
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:|\-–—]+|[\s,;:|\-–—]+$/g, "")
    .trim();
}

function isUppercaseAcronym(value = "") {
  const compact = String(value).replace(/[^A-Za-z0-9]/g, "");
  return compact.length >= 2 && compact.length <= 12 && /[A-Z]/.test(compact) && compact === compact.toUpperCase();
}

function hasNamedShape(value = "") {
  const words = String(value).trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return true;
  const word = words[0] || "";
  return isUppercaseAcronym(word) || (/^[A-Z][A-Za-z0-9&.'-]{3,}$/.test(word) && !GENERIC_ENTITY_NAMES.has(word.toLowerCase()));
}

export function isMeaningfulEditorialEntity(entity = {}) {
  const rawName = String(entity.name || "").replace(/\s+/g, " ").trim();
  const name = cleanEntityDisplayName(rawName);
  const type = String(entity.type || "OTHER").toUpperCase();
  const normalized = name.toLowerCase();
  const salience = Number(entity.salience);
  const mentions = Number(entity.mentions || 0);

  if (!name || name.length < 2 || name.length > 100) return false;
  if (NON_EDITORIAL_ENTITY_TYPES.has(type)) return false;
  if (GENERIC_ENTITY_NAMES.has(normalized)) return false;
  if (/^\d{1,4}$/.test(normalized)) return false;
  if (/^(?:19|20)\d{2}$/.test(normalized)) return false;
  if (/^\d+(?:[.,]\d+)?%?$/.test(normalized)) return false;
  if (/^\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?$/.test(normalized)) return false;

  if (PREFERRED_ENTITY_TYPES.has(type)) return true;

  // Google often labels useful named subjects as OTHER. Keep only names that
  // look like a proper name, acronym, or multi-word named phrase.
  if (type === "OTHER") {
    if (!hasNamedShape(name)) return false;
    if (Number.isFinite(salience) && salience > 0) return true;
    if (mentions >= 1) return true;
    return name.split(/\s+/).length >= 2 || isUppercaseAcronym(name);
  }

  return hasNamedShape(name);
}

function analysisText(article = {}) {
  const text = [article.title, article.description, article.articleBody]
    .filter(Boolean)
    .join(". ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, Number(process.env.GOOGLE_NLP_ENTITY_MAX_CHARS || 30000));
}

function entityTokens(value = "") {
  return cleanEntityDisplayName(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !TOKEN_STOP_WORDS.has(token))
    .filter(token => !LEGAL_SUFFIXES.has(token))
    .filter(token => !/^(?:19|20)\d{2}$/.test(token));
}

export function normalizedEntityName(value = "") {
  return entityTokens(value).join(" ");
}

function acronymFor(tokens = []) {
  if (tokens.length < 2) return "";
  return tokens.map(token => token[0]).join("");
}

function intersectionSize(left, right) {
  const rightSet = new Set(right);
  return [...new Set(left)].filter(token => rightSet.has(token)).length;
}

function isSubset(shorter, longer) {
  const longerSet = new Set(longer);
  return shorter.every(token => longerSet.has(token));
}

function compatibleTypes(sourceType = "OTHER", targetType = "OTHER") {
  const left = String(sourceType || "OTHER").toUpperCase();
  const right = String(targetType || "OTHER").toUpperCase();
  if (left === right) return true;
  if (left === "OTHER" || right === "OTHER") return true;
  return false;
}

export function entityVariantScore(source = {}, target = {}) {
  if (!isMeaningfulEditorialEntity(source) || !isMeaningfulEditorialEntity(target)) return 0;
  if (!compatibleTypes(source.type, target.type)) return 0;

  const sourceTokens = entityTokens(source.name);
  const targetTokens = entityTokens(target.name);
  if (!sourceTokens.length || !targetTokens.length) return 0;

  const sourceKey = sourceTokens.join(" ");
  const targetKey = targetTokens.join(" ");
  if (sourceKey === targetKey) return 1;

  const shared = intersectionSize(sourceTokens, targetTokens);
  const union = new Set([...sourceTokens, ...targetTokens]).size;
  const jaccard = union ? shared / union : 0;

  const shorter = sourceTokens.length <= targetTokens.length ? sourceTokens : targetTokens;
  const longer = shorter === sourceTokens ? targetTokens : sourceTokens;

  // Named multi-word variants: "World Cup" ↔ "FIFA World Cup".
  if (shorter.length >= 2 && isSubset(shorter, longer)) return 0.94;

  // Organisation/acronym variants: "HDFC" ↔ "HDFC Bank".
  if (
    shorter.length === 1 &&
    isSubset(shorter, longer) &&
    shorter[0].length >= 4 &&
    (isUppercaseAcronym(source.name) || isUppercaseAcronym(target.name) ||
      String(source.type).toUpperCase() === "ORGANIZATION" ||
      String(target.type).toUpperCase() === "ORGANIZATION")
  ) {
    return 0.9;
  }

  const sourceAcronym = acronymFor(sourceTokens);
  const targetAcronym = acronymFor(targetTokens);
  if (
    sourceAcronym.length >= 2 && sourceAcronym === targetKey.replace(/\s+/g, "") ||
    targetAcronym.length >= 2 && targetAcronym === sourceKey.replace(/\s+/g, "")
  ) {
    return 0.9;
  }

  if (shared >= 2 && jaccard >= 0.66) return 0.82;
  return 0;
}

function entityRank(entity = {}) {
  const salience = Number(entity.salience);
  const mentions = Number(entity.mentions || 0);
  const type = String(entity.type || "OTHER").toUpperCase();
  const typeBoost = PREFERRED_ENTITY_TYPES.has(type) ? 2 : 1;
  const nameBoost = Math.min(entityTokens(entity.name).length, 4) * 0.25;
  return (Number.isFinite(salience) ? salience * 10 : 0) + Math.min(mentions, 5) * 0.2 + typeBoost + nameBoost;
}

function preferredDisplayName(source = {}, target = {}) {
  const sourceName = cleanEntityDisplayName(source.name);
  const targetName = cleanEntityDisplayName(target.name);
  const sourceTokens = entityTokens(sourceName);
  const targetTokens = entityTokens(targetName);

  // Prefer the more descriptive named form, but never keep a year-only suffix.
  if (sourceTokens.length !== targetTokens.length) {
    return sourceTokens.length > targetTokens.length ? sourceName : targetName;
  }
  return entityRank(source) >= entityRank(target) ? sourceName : targetName;
}

function isRedundantEntity(candidate, selected) {
  const candidateTokens = entityTokens(candidate.name);
  return selected.some(existing => {
    if (String(existing.type).toUpperCase() !== String(candidate.type).toUpperCase()) return false;
    const existingTokens = entityTokens(existing.name);
    return isSubset(candidateTokens, existingTokens) || isSubset(existingTokens, candidateTokens);
  });
}

export function sharedEntities(sourceEntities = [], targetEntities = []) {
  const candidates = [];

  for (const source of sourceEntities) {
    if (!isMeaningfulEditorialEntity(source)) continue;
    for (const target of targetEntities) {
      if (!isMeaningfulEditorialEntity(target)) continue;
      const variantScore = entityVariantScore(source, target);
      if (!variantScore) continue;
      const displayName = preferredDisplayName(source, target);
      if (!displayName || GENERIC_ENTITY_NAMES.has(displayName.toLowerCase())) continue;
      candidates.push({
        name: displayName,
        type: String(source.type || target.type || "OTHER").toUpperCase(),
        source_name: cleanEntityDisplayName(source.name),
        target_name: cleanEntityDisplayName(target.name),
        source_salience: source.salience ?? null,
        target_salience: target.salience ?? null,
        match_quality: Number(variantScore.toFixed(2)),
        rank: entityRank(source) + entityRank(target) + variantScore * 3
      });
    }
  }

  const selected = [];
  const seen = new Set();
  for (const candidate of candidates.sort((a, b) => b.rank - a.rank || b.name.length - a.name.length)) {
    const key = normalizedEntityName(candidate.name);
    if (!key || seen.has(key) || isRedundantEntity(candidate, selected)) continue;
    seen.add(key);
    selected.push(candidate);
    if (selected.length >= 8) break;
  }

  return selected.map(({ rank, ...entity }) => entity);
}

export function meaningfulEntityList(entities = []) {
  return entities
    .filter(isMeaningfulEditorialEntity)
    .sort((a, b) => entityRank(b) - entityRank(a))
    .map(entity => ({
      ...entity,
      name: cleanEntityDisplayName(entity.name)
    }))
    .filter(entity => entity.name)
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

    res.setHeader("Cache-Control", force ? "no-store" : "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      status,
      entity_quality_version: "5.8",
      shared_entities: shared,
      source_entities: meaningfulEntityList(sourceNlp.entities),
      target_entities: meaningfulEntityList(targetNlp.entities),
      entity_display_mode: shared.length ? "shared" : "article-level",
      analyzed_at: new Date().toISOString(),
      detail: shared.length
        ? "Meaningful shared Google entities were matched across the two article pages."
        : "Google NLP completed. No reliable shared named entity was found, so the response includes the strongest named entities from each article separately.",
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
