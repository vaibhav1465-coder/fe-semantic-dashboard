import { cacheKey, getOrSetCache } from "./cache.js";

const DEFAULT_DIRECTORY = "https://www.financialexpress.com/syndication/";
const FALLBACK_FEEDS = [
  "https://www.financialexpress.com/market/feed/",
  "https://www.financialexpress.com/feed/",
  "https://syndication.financialexpress.com/rss/377/tech.xml"
];

export function decodeXml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function stripHtml(value = "") {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstTag(block, names) {
  for (const name of names) {
    const pattern = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i");
    const match = block.match(pattern);
    if (match) return decodeXml(match[1].trim());
  }
  return "";
}

function atomLink(block) {
  const alternate = block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i);
  if (alternate) return decodeXml(alternate[1]);
  const any = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  return any ? decodeXml(any[1]) : "";
}

export function parseFeedXml(xml = "", feedUrl = "") {
  const isAtom = /<feed\b/i.test(xml);
  const blocks = isAtom
    ? [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(x => x[1])
    : [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(x => x[1]);

  return blocks.map((block, index) => {
    const title = stripHtml(firstTag(block, ["title"]));
    const link = isAtom ? atomLink(block) : stripHtml(firstTag(block, ["link", "guid"]));
    const published = stripHtml(firstTag(block, ["pubDate", "published", "updated", "dc:date"]));
    const publishedDate = published ? new Date(published) : null;
    const publishedIso = publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : null;
    const descriptionHtml = firstTag(block, ["content:encoded", "description", "summary", "content"]);
    const description = stripHtml(descriptionHtml);
    const category = stripHtml(firstTag(block, ["category"]));
    return {
      id: stripHtml(firstTag(block, ["guid", "id"])) || `${feedUrl}#${index}`,
      title,
      url: link,
      datePublished: publishedIso,
      dateModified: publishedIso,
      description,
      articleBody: description,
      category,
      source: "rss",
      source_url: feedUrl
    };
  }).filter(item => item.title && item.url);
}

export function discoverFeedUrlsFromHtml(html = "", directoryUrl = DEFAULT_DIRECTORY) {
  const urls = new Set();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const raw = decodeXml(match[1]);
    let absolute;
    try { absolute = new URL(raw, directoryUrl).toString(); } catch { continue; }
    const lower = absolute.toLowerCase();
    if (lower.includes("syndication.financialexpress") || lower.endsWith(".xml") || lower.includes("/rss/") || lower.includes("/feed/")) {
      urls.add(absolute);
    }
  }
  return [...urls];
}

function configuredFeedUrls() {
  const raw = process.env.FE_RSS_FEED_URLS || "";
  return raw.split(/[\n,]/).map(x => x.trim()).filter(Boolean);
}

async function fetchText(url, timeoutMs = 15000, accept = "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 FE-Semantic-Linking/3.0",
        Accept: accept
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return { text: await response.text(), status: response.status, contentType: response.headers.get("content-type") || "" };
  } finally { clearTimeout(timer); }
}

export async function discoverFinancialExpressFeeds({ force = false } = {}) {
  const directoryUrl = process.env.FE_RSS_DIRECTORY_URL || DEFAULT_DIRECTORY;
  const key = cacheKey("rss-directory", directoryUrl);
  const result = await getOrSetCache(key, async () => {
    const configured = configuredFeedUrls();
    if (configured.length) return { directory_url: directoryUrl, feed_urls: configured, discovery: "configured" };

    const response = await fetchText(directoryUrl, 15000, "text/html,application/xhtml+xml");
    const discovered = discoverFeedUrlsFromHtml(response.text, directoryUrl);
    return {
      directory_url: directoryUrl,
      feed_urls: discovered.length ? discovered : FALLBACK_FEEDS,
      discovery: discovered.length ? "directory" : "fallback-candidates"
    };
  }, { ttlSeconds: 86400, staleIfErrorSeconds: 604800, force, metadata: { type: "rss-directory" } });
  return { ...result.value, cache_status: result.cache_status, cache_source: result.cache_source };
}

export async function fetchRssArticles({ limit = 50, search = "", force = false, feedUrls = null } = {}) {
  const discovery = feedUrls?.length
    ? { feed_urls: feedUrls, discovery: "argument", cache_status: "live", cache_source: "argument" }
    : await discoverFinancialExpressFeeds({ force });
  const urls = discovery.feed_urls.slice(0, Math.max(1, Number(process.env.FE_RSS_MAX_FEEDS || 12)));

  const results = await Promise.all(urls.map(async url => {
    const key = cacheKey("rss-feed", url);
    try {
      const result = await getOrSetCache(key, async () => {
        const response = await fetchText(url, Number(process.env.FE_SOURCE_TIMEOUT_MS || 8000));
        const items = parseFeedXml(response.text, url);
        if (!items.length) throw new Error("No RSS/Atom items found");
        return { url, items, fetched_at: new Date().toISOString(), content_type: response.contentType };
      }, {
        ttlSeconds: Number(process.env.FE_RSS_CACHE_TTL_SECONDS || 300),
        staleIfErrorSeconds: Number(process.env.FE_RSS_STALE_TTL_SECONDS || 86400),
        force,
        metadata: { type: "rss-feed", url }
      });
      return {
        attempt: { url, status: "ok", cache_status: result.cache_status, count: result.value.items.length },
        items: result.value.items.map(item => ({ ...item, cache_status: result.cache_status }))
      };
    } catch (error) {
      return { attempt: { url, status: "failed", error: error.message }, items: [] };
    }
  }));

  const attempts = results.map(x => x.attempt);
  const all = results.flatMap(x => x.items);
  const query = search.trim().toLowerCase();
  const deduped = [...new Map(all.map(item => [item.url.replace(/\/+$/, "").toLowerCase(), item])).values()]
    .filter(item => !query || `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query))
    .sort((a, b) => new Date(b.datePublished || 0) - new Date(a.datePublished || 0))
    .slice(0, Math.max(1, Math.min(100, Number(limit || 50))));

  if (!deduped.length) {
    const detail = attempts.map(x => `${x.url}: ${x.error || "no items"}`).join(" | ");
    throw new Error(`Financial Express RSS unavailable. ${detail}`);
  }

  return {
    source: "rss",
    cache_status: deduped.some(x => x.cache_status === "live") ? "live" : deduped.some(x => x.cache_status === "stale-cache") ? "stale-cache" : "cache",
    discovery,
    attempts,
    items: deduped
  };
}
