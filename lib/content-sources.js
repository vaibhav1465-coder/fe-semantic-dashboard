import fs from "node:fs";
import path from "node:path";
import { cacheKey, getCache, getOrSetCache, setCache } from "./cache.js";
import { fetchRssArticles } from "./rss.js";
import { fetchWordPressArticles, fetchWordPressArticleByUrl, wordpressConfigured, wordpressEndpoint } from "./wordpress.js";
import { fetchArticleMetadata } from "./metadata.js";

const STATUS_CACHE_KEY = "source-status:last";

function staticCachePath() {
  return path.join(process.cwd(), "data", "content-cache.json");
}

function readStaticContentCache() {
  try {
    const payload = JSON.parse(fs.readFileSync(staticCachePath(), "utf8"));
    return Array.isArray(payload) ? payload : (payload.items || []);
  } catch { return []; }
}

function sourcePriority() {
  const configured = String(process.env.FE_CONTENT_SOURCE_PRIORITY || "wordpress,rss,html,static-cache")
    .split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  return [...new Set(configured)];
}

function normalizeUrl(value = "") {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\/+$/, "").toLowerCase();
  } catch { return String(value).replace(/\/+$/, "").toLowerCase(); }
}

function articleMatchesUrl(item, url) {
  return normalizeUrl(item.url || item.link || "") === normalizeUrl(url);
}

function staticArticleByUrl(url) {
  return readStaticContentCache().find(item => articleMatchesUrl(item, url)) || null;
}

export function contentSourceConfiguration() {
  return {
    priority: sourcePriority(),
    wordpress_rest: {
      enabled: wordpressConfigured(),
      endpoint: wordpressEndpoint()
    },
    rss: {
      enabled: process.env.FE_RSS_ENABLED !== "false",
      directory: process.env.FE_RSS_DIRECTORY_URL || "https://www.financialexpress.com/syndication/",
      configured_feeds: String(process.env.FE_RSS_FEED_URLS || "").split(/[\n,]/).map(x => x.trim()).filter(Boolean).length
    },
    html_fallback: { enabled: process.env.FE_HTML_FALLBACK_ENABLED !== "false" },
    static_cache: { enabled: true, items: readStaticContentCache().length }
  };
}

async function fetchFromSingleSource(source, options) {
  if (source === "wordpress") return fetchWordPressArticles(options);
  if (source === "rss") return fetchRssArticles(options);
  if (source === "static-cache") {
    const query = String(options.search || "").toLowerCase();
    const items = readStaticContentCache()
      .filter(item => !query || `${item.title} ${item.description || ""}`.toLowerCase().includes(query))
      .slice(0, Math.max(1, Number(options.limit || 50)))
      .map(item => ({ ...item, source: "static-cache", cache_status: "static-fallback" }));
    if (!items.length) throw new Error("Static content cache is empty");
    return { source: "static-cache", cache_status: "static-fallback", items };
  }
  throw new Error(`Unsupported list content source: ${source}`);
}

export async function fetchLatestArticles({ source = "auto", limit = 50, search = "", after = "", before = "", force = false } = {}) {
  const sources = source === "auto" ? sourcePriority().filter(x => ["wordpress", "rss", "static-cache"].includes(x)) : [source];
  const attempts = [];
  for (const candidate of sources) {
    try {
      const result = await fetchFromSingleSource(candidate, { limit, search, after, before, force });
      attempts.push({ source: candidate, status: "ok", cache_status: result.cache_status, count: result.items.length });
      return { ...result, attempts, selected_source: candidate };
    } catch (error) {
      attempts.push({ source: candidate, status: "failed", error: error.message });
    }
  }
  throw new Error(`All content sources failed: ${attempts.map(x => `${x.source}: ${x.error || "failed"}`).join(" | ")}`);
}

async function resolveFromRss(url, force) {
  const result = await fetchRssArticles({ limit: 100, force });
  const item = result.items.find(article => articleMatchesUrl(article, url));
  if (!item) throw new Error("Article not present in current RSS feed window");
  return { ...item, cache_status: result.cache_status, source: "rss" };
}

async function resolveFromHtml(url) {
  if (process.env.FE_HTML_FALLBACK_ENABLED === "false") throw new Error("HTML fallback disabled");
  const metadata = await fetchArticleMetadata(url);
  if (!metadata.reachable) throw new Error(`Article HTML returned ${metadata.status || "unreachable"}`);
  return {
    id: url,
    title: metadata.title,
    url,
    datePublished: metadata.datePublished || null,
    dateModified: metadata.dateModified || null,
    description: metadata.description || "",
    articleBody: metadata.articleBody || metadata.description || "",
    source: "html",
    cache_status: "live",
    status: metadata.status
  };
}

export async function resolveArticle(url, { force = false } = {}) {
  const key = cacheKey("content-article", normalizeUrl(url));
  const result = await getOrSetCache(key, async () => {
    const attempts = [];
    for (const source of sourcePriority()) {
      try {
        let item;
        if (source === "wordpress") item = await fetchWordPressArticleByUrl(url, { force });
        else if (source === "rss") item = await resolveFromRss(url, force);
        else if (source === "html") item = await resolveFromHtml(url);
        else if (source === "static-cache") {
          item = staticArticleByUrl(url);
          if (!item) throw new Error("Article missing from static cache");
          item = { ...item, source: "static-cache", cache_status: "static-fallback" };
        } else continue;
        return { item, attempts: [...attempts, { source, status: "ok" }] };
      } catch (error) {
        attempts.push({ source, status: "failed", error: error.message });
      }
    }
    throw new Error(`Article resolution failed: ${attempts.map(x => `${x.source}: ${x.error}`).join(" | ")}`);
  }, {
    ttlSeconds: Number(process.env.FE_ARTICLE_CACHE_TTL_SECONDS || 21600),
    staleIfErrorSeconds: Number(process.env.FE_ARTICLE_STALE_TTL_SECONDS || 604800),
    force,
    metadata: { type: "content-article", url }
  });

  return {
    ...result.value.item,
    attempts: result.value.attempts,
    cache_status: result.cache_status === "live" ? (result.value.item.cache_status || "live") : result.cache_status,
    cache_source: result.cache_source
  };
}

export async function probeContentSources({ force = false } = {}) {
  const started = Date.now();
  const tests = {};

  try {
    const wp = await fetchWordPressArticles({ limit: 1, force });
    tests.wordpress_rest = { status: "live", cache_status: wp.cache_status, endpoint: wp.endpoint, count: wp.items.length };
  } catch (error) {
    tests.wordpress_rest = { status: "failed", configured: wordpressConfigured(), endpoint: wordpressEndpoint(), error: error.message };
  }

  try {
    const rss = await fetchRssArticles({ limit: 1, force });
    tests.rss = { status: "live", cache_status: rss.cache_status, count: rss.items.length, discovery: rss.discovery.discovery };
  } catch (error) {
    tests.rss = { status: "failed", error: error.message };
  }

  const staticItems = readStaticContentCache();
  tests.static_cache = { status: staticItems.length ? "ready" : "empty", count: staticItems.length };

  const payload = {
    status: [tests.wordpress_rest, tests.rss].some(x => x.status === "live") ? "live" : staticItems.length ? "fallback" : "failed",
    tests,
    checked_at: new Date().toISOString(),
    duration_ms: Date.now() - started
  };
  await setCache(STATUS_CACHE_KEY, payload, Number(process.env.FE_SOURCE_STATUS_TTL_SECONDS || 600), { type: "source-status" });
  return payload;
}

export async function getLastSourceStatus() {
  const result = await getCache(STATUS_CACHE_KEY, { allowStale: true });
  return result.hit ? { ...result.value, cache_status: result.stale ? "stale-cache" : "cache" } : null;
}
