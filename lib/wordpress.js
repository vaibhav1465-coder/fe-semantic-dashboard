import { cacheKey, getOrSetCache } from "./cache.js";
import { stripHtml, decodeXml } from "./rss.js";
import { isFinancialExpressArticleUrl } from "./article-url.js";

const DEFAULT_ENDPOINT = "https://www.financialexpress.com/wp-json/wp/v2/posts";

export function wordpressEndpoint() {
  return process.env.FE_WORDPRESS_REST_URL || DEFAULT_ENDPOINT;
}

export function wordpressConfigured() {
  return process.env.FE_WORDPRESS_ENABLED !== "false" && Boolean(wordpressEndpoint());
}

export function normalizeWordPressPost(post = {}) {
  const rendered = value => typeof value === "object" && value ? value.rendered || "" : value || "";
  const contentHtml = rendered(post.content);
  const excerptHtml = rendered(post.excerpt);
  return {
    id: post.id ?? post.slug ?? post.link,
    slug: post.slug || "",
    title: stripHtml(rendered(post.title)),
    url: post.link || "",
    datePublished: post.date_gmt || post.date || null,
    dateModified: post.modified_gmt || post.modified || post.date_gmt || post.date || null,
    description: stripHtml(excerptHtml),
    articleBody: stripHtml(contentHtml) || stripHtml(excerptHtml),
    contentHtml: decodeXml(contentHtml),
    categories: Array.isArray(post.categories) ? post.categories : [],
    tags: Array.isArray(post.tags) ? post.tags : [],
    source: "wordpress_rest",
    raw_status: post.status || "publish"
  };
}

async function fetchJson(url, timeoutMs = Number(process.env.FE_SOURCE_TIMEOUT_MS || 8000)) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 FE-Semantic-Linking/3.0",
        Accept: "application/json"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`WordPress REST returned ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error("WordPress REST response is not a post array");
    return { payload, headers: Object.fromEntries(response.headers.entries()) };
  } finally { clearTimeout(timer); }
}

function queryUrl(params = {}) {
  const url = new URL(wordpressEndpoint());
  const fields = params.summaryOnly
    ? "id,slug,status,date,date_gmt,modified,modified_gmt,link,title,excerpt,categories,tags"
    : "id,slug,status,date,date_gmt,modified,modified_gmt,link,title,excerpt,content,categories,tags";
  url.searchParams.set("_fields", fields);
  url.searchParams.set("per_page", String(Math.max(1, Math.min(100, Number(params.limit || 50)))));
  if (params.page) url.searchParams.set("page", String(Math.max(1, Number(params.page || 1))));
  url.searchParams.set("orderby", params.search ? "relevance" : "date");
  url.searchParams.set("order", "desc");
  if (params.search) url.searchParams.set("search", params.search);
  if (params.slug) url.searchParams.set("slug", params.slug);
  if (params.after) url.searchParams.set("after", params.after);
  if (params.before) url.searchParams.set("before", params.before);
  return url.toString();
}

export async function fetchWordPressArticles({ limit = 50, search = "", after = "", before = "", page = 1, summaryOnly = false, force = false } = {}) {
  if (!wordpressConfigured()) throw new Error("WordPress REST is disabled");
  const url = queryUrl({ limit, search, after, before, page, summaryOnly });
  const key = cacheKey("wordpress-list", url);
  const result = await getOrSetCache(key, async () => {
    const response = await fetchJson(url);
    const items = response.payload.map(normalizeWordPressPost).filter(item => item.title && item.url);
    if (!items.length) throw new Error("WordPress REST returned no posts");
    return { url, items, fetched_at: new Date().toISOString(), response_headers: response.headers };
  }, {
    ttlSeconds: Number(process.env.FE_WORDPRESS_CACHE_TTL_SECONDS || 300),
    staleIfErrorSeconds: Number(process.env.FE_WORDPRESS_STALE_TTL_SECONDS || 86400),
    force,
    metadata: { type: "wordpress-list", url }
  });

  return {
    source: "wordpress_rest",
    cache_status: result.cache_status,
    cache_source: result.cache_source,
    endpoint: wordpressEndpoint(),
    items: result.value.items
  };
}

function slugFromArticleUrl(articleUrl) {
  try {
    const parts = new URL(articleUrl).pathname.split("/").filter(Boolean);
    const last = parts.at(-1) || "";
    return last.replace(/-\d+$/, "");
  } catch { return ""; }
}

export async function fetchWordPressArticleByUrl(articleUrl, { force = false } = {}) {
  if (!wordpressConfigured()) throw new Error("WordPress REST is disabled");
  const slug = slugFromArticleUrl(articleUrl);
  if (!slug) throw new Error("Could not derive WordPress slug from article URL");
  const url = queryUrl({ limit: 5, slug });
  const key = cacheKey("wordpress-article", articleUrl);
  const result = await getOrSetCache(key, async () => {
    const response = await fetchJson(url);
    let items = response.payload.map(normalizeWordPressPost);
    const normalizedInput = articleUrl.replace(/\/+$/, "").toLowerCase();
    const exact = items.find(item => item.url.replace(/\/+$/, "").toLowerCase() === normalizedInput);
    const item = exact || items[0];
    if (!item) throw new Error(`WordPress REST found no post for slug: ${slug}`);
    return item;
  }, {
    ttlSeconds: Number(process.env.FE_ARTICLE_CACHE_TTL_SECONDS || 21600),
    staleIfErrorSeconds: Number(process.env.FE_ARTICLE_STALE_TTL_SECONDS || 604800),
    force,
    metadata: { type: "wordpress-article", articleUrl }
  });
  return { ...result.value, cache_status: result.cache_status, cache_source: result.cache_source };
}


export async function fetchWordPressRecommendationPool({ limit = 500, force = false } = {}) {
  if (!wordpressConfigured()) throw new Error("WordPress REST is disabled");

  const safeLimit = Math.max(60, Math.min(500, Number(limit || 500)));
  const perPage = 100;
  const pageCount = Math.ceil(safeLimit / perPage);
  const cacheIdentity = `${wordpressEndpoint()}|${safeLimit}|summary`;
  const key = cacheKey("wordpress-recommendation-pool", cacheIdentity);

  const result = await getOrSetCache(key, async () => {
    const requests = Array.from({ length: pageCount }, (_, index) => {
      const page = index + 1;
      const url = queryUrl({ limit: perPage, page, summaryOnly: true });
      return fetchJson(url).then(response => ({ page, url, ...response }));
    });

    const settled = await Promise.allSettled(requests);
    const successful = settled
      .filter(entry => entry.status === "fulfilled")
      .map(entry => entry.value);

    if (!successful.length) {
      const errors = settled
        .filter(entry => entry.status === "rejected")
        .map(entry => entry.reason?.message || "Unknown WordPress error");
      throw new Error(`WordPress recommendation pool failed: ${errors.join(" | ")}`);
    }

    const seen = new Set();
    const items = [];
    for (const response of successful.sort((a, b) => a.page - b.page)) {
      for (const post of response.payload) {
        const item = normalizeWordPressPost(post);
        const identity = String(item.url || item.id || "").toLowerCase();
        if (!item.title || !item.url || !isFinancialExpressArticleUrl(item.url) || seen.has(identity)) continue;
        seen.add(identity);
        items.push(item);
        if (items.length >= safeLimit) break;
      }
      if (items.length >= safeLimit) break;
    }

    if (items.length < 2) throw new Error("WordPress recommendation pool returned too few articles");

    return {
      items,
      fetched_at: new Date().toISOString(),
      page_count: successful.length,
      requested_limit: safeLimit
    };
  }, {
    ttlSeconds: Number(process.env.FE_LIVE_RECOMMENDATION_CACHE_TTL_SECONDS || 600),
    staleIfErrorSeconds: Number(process.env.FE_LIVE_RECOMMENDATION_STALE_TTL_SECONDS || 86400),
    force,
    metadata: { type: "wordpress-recommendation-pool", limit: safeLimit }
  });

  return {
    source: "wordpress_rest",
    endpoint: wordpressEndpoint(),
    cache_status: result.cache_status,
    cache_source: result.cache_source,
    items: result.value.items,
    fetched_at: result.value.fetched_at,
    page_count: result.value.page_count,
    requested_limit: result.value.requested_limit
  };
}
