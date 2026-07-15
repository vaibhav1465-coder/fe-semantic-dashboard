import { generateAnchorText, generatePlacementSuggestion } from "./anchor.js";

export function normalizeUrl(value = "") {
  try {
    const url = new URL(String(value).trim());
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "").toLowerCase();
  } catch { return ""; }
}

export function recordKey(item) {
  return `${normalizeUrl(item["Source URL"])}||${normalizeUrl(item["Target URL"])}`;
}

export function validateRecommendation(item, seen = new Set()) {
  const errors = [];
  const warnings = [];
  const source = normalizeUrl(item["Source URL"]);
  const target = normalizeUrl(item["Target URL"]);
  const key = `${source}||${target}`;

  if (!source) errors.push("invalid_source_url");
  if (!target) errors.push("invalid_target_url");
  if (source && target && source === target) errors.push("same_url");
  if (seen.has(key)) errors.push("duplicate_pair");
  seen.add(key);

  const sourceDate = item.source_date ? new Date(item.source_date) : null;
  const targetDate = item.target_date ? new Date(item.target_date) : null;
  if (sourceDate && targetDate && !Number.isNaN(sourceDate) && !Number.isNaN(targetDate)) {
    if (sourceDate <= targetDate) errors.push("target_not_older_than_source");
  } else {
    warnings.push("publication_date_missing");
  }

  if (item.Status === "Approved" && Number(item["Confidence Score"] || 0) < 75) errors.push("approved_below_threshold");
  if (item.Status === "Approved" && !String(item["Anchor Text Suggestion"] || "").trim()) errors.push("approved_anchor_missing");
  if (!String(item.Reason || "").trim()) errors.push("reason_missing");

  return { valid: errors.length === 0, errors, warnings, key };
}

export function enrichRecommendation(item) {
  const copy = structuredClone(item);
  const entities = copy.Entities || [];
  if (!String(copy["Anchor Text Suggestion"] || "").trim() && copy.Status === "Approved") {
    copy["Anchor Text Suggestion"] = generateAnchorText(copy["Target Title"], entities);
  }
  if (!String(copy["Link Placement Suggestion"] || "").trim() && copy.Status === "Approved") {
    copy["Link Placement Suggestion"] = generatePlacementSuggestion(copy.source_body || "", copy["Target Title"], entities);
  }
  return copy;
}

export function validateDataset(items = []) {
  const seen = new Set();
  const results = items.map(item => ({item, validation:validateRecommendation(item, seen)}));
  return {
    total: results.length,
    valid: results.filter(x => x.validation.valid).length,
    invalid: results.filter(x => !x.validation.valid).length,
    warnings: results.reduce((n,x)=>n+x.validation.warnings.length,0),
    results
  };
}
