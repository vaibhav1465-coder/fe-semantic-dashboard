import { cacheKey, getOrSetCache } from "./cache.js";
import { buildLiveRecommendationDataset } from "./recommendation-engine.js";
import { fetchWordPressRecommendationPool } from "./wordpress.js";

export async function getLiveRecommendations(options = {}) {
  const sourceLimit = Math.max(1, Math.min(60, Number(options.sourceLimit || 60)));
  const candidateLimit = Math.max(100, Math.min(500, Number(options.candidateLimit || 500)));
  const minSuggestions = Math.max(1, Math.min(3, Number(options.minSuggestions || 2)));
  const maxSuggestions = Math.max(minSuggestions, Math.min(3, Number(options.maxSuggestions || 3)));
  const minScore = Math.max(10, Math.min(90, Number(options.minScore || process.env.FE_LIVE_RECOMMENDATION_MIN_SCORE || 50)));
  const force = options.force === true;

  const identity = JSON.stringify({ sourceLimit, candidateLimit, minSuggestions, maxSuggestions, minScore });
  const key = cacheKey("live-recommendations", identity);

  const result = await getOrSetCache(key, async () => {
    const pool = await fetchWordPressRecommendationPool({ limit: candidateLimit, force });
    const dataset = buildLiveRecommendationDataset(pool.items, {
      sourceLimit,
      minSuggestions,
      maxSuggestions,
      minScore
    });

    dataset.summary.applied_min_score = minScore;
    dataset.summary.quality_threshold_fixed = true;
    dataset.summary.requested_source_range = "50–60";
    dataset.summary.quality_note = dataset.summary.sources >= Math.min(50, sourceLimit)
      ? "The requested source range was met without lowering the quality threshold."
      : "Fewer than 50 source articles qualified. The quality threshold was not lowered to inflate the count.";

    return {
      ...dataset,
      article_source: {
        key: "wordpress_rest",
        label: "WordPress REST API",
        status: pool.cache_status === "live" ? "live" : pool.cache_status,
        detail: `${pool.items.length} recent Financial Express articles were checked.`
      },
      pool: {
        count: pool.items.length,
        requested: pool.requested_limit,
        pages: pool.page_count,
        fetched_at: pool.fetched_at,
        cache_status: pool.cache_status,
        cache_source: pool.cache_source,
        endpoint: pool.endpoint
      }
    };
  }, {
    ttlSeconds: Number(process.env.FE_LIVE_RECOMMENDATION_CACHE_TTL_SECONDS || 600),
    staleIfErrorSeconds: Number(process.env.FE_LIVE_RECOMMENDATION_STALE_TTL_SECONDS || 86400),
    force,
    metadata: { type: "live-recommendations", sourceLimit, candidateLimit }
  });

  return {
    ...result.value,
    delivery: result.cache_status,
    cache_source: result.cache_source,
    cache_policy: "600s + 3600s stale-while-revalidate"
  };
}
