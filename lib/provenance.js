

function normalizeTestStatus(test = {}) {
  if (!test || test.status === "failed") return "failed";
  if (test.cache_status === "stale-cache") return "stale-cache";
  if (test.cache_status === "cache") return "cache";
  if (test.status === "ready") return "ready";
  if (test.status === "live") return "live";
  return test.status || "unknown";
}

function hasEntityData(items = []) {
  return items.some(item => Array.isArray(item.Entities) && item.Entities.length > 0);
}

function hasSentimentData(items = []) {
  return items.some(item => item["Source Sentiment"] || item["Target Sentiment"]);
}

function nlpDatasetState(items = []) {
  const statuses = items.map(item => String(item.nlp_status || "").toLowerCase()).filter(Boolean);
  if (statuses.includes("live")) return "live";
  if (statuses.some(value => ["cached", "cache", "stale-cache"].includes(value))) return "cache";
  if (statuses.includes("failed")) return "failed";
  return "unknown";
}

function articleSourceFromTests(tests = {}, dataset = {}) {
  const wordpress = tests.wordpress_rest || {};
  const rss = tests.rss || {};
  const staticCache = tests.static_cache || {};
  const wpStatus = normalizeTestStatus(wordpress);
  const rssStatus = normalizeTestStatus(rss);

  if (["live", "cache", "stale-cache"].includes(wpStatus)) {
    return {
      key: "wordpress_rest",
      label: "WordPress REST API",
      status: wpStatus,
      detail: wpStatus === "live" ? "Articles fetched from the live API" : `Articles served from WordPress ${wpStatus}`
    };
  }
  if (["live", "cache", "stale-cache"].includes(rssStatus)) {
    return {
      key: "rss",
      label: "RSS Feed",
      status: rssStatus,
      detail: wordpress.status === "failed" ? "WordPress REST failed; RSS Feed selected automatically" : "Articles fetched from Financial Express RSS"
    };
  }
  if (staticCache.status === "ready" && Number(staticCache.count || 0) > 0) {
    return {
      key: "static_cache",
      label: "Fallback Cache",
      status: "fallback",
      detail: "Live sources unavailable; packaged fallback cache selected"
    };
  }
  return {
    key: "last_crawl",
    label: "Last Crawl",
    status: "last-crawl",
    detail: dataset.generated_at ? `Recommendations generated ${dataset.generated_at}` : "Showing the last processed crawl"
  };
}

function nlpSource({ nlpStatus = null, nlpDiagnostics = {}, dataset = {}, kind = "Entities" } = {}) {
  const items = dataset.items || [];
  const latestStatus = String(nlpStatus?.status || "").toLowerCase();
  const datasetState = nlpDatasetState(items);
  const hasData = kind === "Sentiment" ? hasSentimentData(items) : hasEntityData(items);

  if (latestStatus === "live") {
    return {
      key: "google_nlp",
      label: "Google NLP API",
      status: "live",
      detail: `${kind} fetched from Google Cloud Natural Language API`
    };
  }
  if (["cache", "cached"].includes(latestStatus)) {
    return {
      key: "google_nlp_cache",
      label: "Google NLP Cache",
      status: "cache",
      detail: `${kind} served from the latest successful Google NLP cache`
    };
  }
  if (latestStatus === "stale-cache") {
    return {
      key: "google_nlp_cache",
      label: "Google NLP Stale Cache",
      status: "stale-cache",
      detail: `Google NLP call failed; ${kind.toLowerCase()} served from stale cache`
    };
  }
  if (datasetState === "live") {
    return {
      key: "google_nlp_last_crawl",
      label: "Google NLP · Last Crawl",
      status: "last-crawl",
      detail: `${kind} was fetched from Google NLP during the last processed crawl`
    };
  }
  if (datasetState === "cache" && hasData) {
    return {
      key: "google_nlp_cache",
      label: "Google NLP Cache",
      status: "cache",
      detail: `${kind} loaded from the processed Google NLP cache`
    };
  }
  if (hasData) {
    return {
      key: "last_crawl",
      label: "Last Crawl",
      status: "last-crawl",
      detail: `${kind} loaded from the last processed crawl`
    };
  }
  if (nlpDiagnostics.configured) {
    return {
      key: "google_nlp_configured",
      label: "Google NLP Configured",
      status: latestStatus === "failed" ? "failed" : "configured",
      detail: latestStatus === "failed" ? `Google NLP failed: ${nlpStatus?.error || "live call unavailable"}` : `Google NLP is configured; ${kind.toLowerCase()} will populate on refresh`
    };
  }
  return {
    key: "not_configured",
    label: "Google NLP Not Configured",
    status: "failed",
    detail: `${kind} API credentials are not configured`
  };
}

export function buildProvenance({ sourceStatus = null, nlpStatus = null, nlpDiagnostics = {}, dataset = {} } = {}) {
  const tests = sourceStatus?.tests || {};
  const articleSource = articleSourceFromTests(tests, dataset);
  const entitySource = nlpSource({ nlpStatus, nlpDiagnostics, dataset, kind: "Entities" });
  const sentimentSource = nlpSource({ nlpStatus, nlpDiagnostics, dataset, kind: "Sentiment" });
  const items = dataset.items || [];
  const wpFailed = tests.wordpress_rest?.status === "failed";
  const rssFailed = tests.rss?.status === "failed";

  let fallbackMessage = "Live source priority: WordPress REST → RSS Feed → Fallback Cache → Last Crawl";
  if (articleSource.key === "rss" && wpFailed) fallbackMessage = "WordPress REST API failed; RSS Feed is active.";
  else if (articleSource.key === "static_cache") fallbackMessage = "WordPress REST and RSS Feed are unavailable; Fallback Cache is active.";
  else if (articleSource.key === "last_crawl") fallbackMessage = "Live article sources are unavailable; Last Crawl is active.";
  else if (wpFailed && rssFailed) fallbackMessage = "Live APIs failed; the safest available fallback is active.";

  return {
    status: [articleSource.status, entitySource.status, sentimentSource.status].includes("failed") ? "degraded" : articleSource.status === "live" && entitySource.status === "live" ? "live" : "fallback",
    article_source: articleSource,
    entity_source: entitySource,
    sentiment_source: sentimentSource,
    fallback_message: fallbackMessage,
    last_crawl: {
      batch_id: dataset.batch_id || null,
      generated_at: dataset.generated_at || items[0]?.generated_at || null,
      record_count: items.length,
      source: dataset.source || null
    },
    checks: {
      wordpress_rest: tests.wordpress_rest || { status: "not_tested" },
      rss: tests.rss || { status: "not_tested" },
      static_cache: tests.static_cache || { status: "unknown" },
      google_nlp: nlpStatus || { status: nlpDiagnostics.configured ? "configured" : "not_configured" }
    },
    checked_at: new Date().toISOString()
  };
}
