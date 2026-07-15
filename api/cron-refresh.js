import { fetchLatestArticles, probeContentSources } from "../lib/content-sources.js";
import { analyzeText, googleNlpConfigured } from "../lib/google-nlp.js";

function authorized(req) {
  const secret = process.env.CRON_SECRET || process.env.REFRESH_SECRET || "";
  if (!secret) return !process.env.VERCEL;
  const supplied = req.headers?.authorization?.replace(/^Bearer\s+/i, "") || req.headers?.["x-refresh-secret"] || "";
  return supplied === secret;
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Method not allowed" });
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const started = Date.now();
  const results = { source_probe: null, content: null, nlp: [] };
  try {
    results.source_probe = await probeContentSources({ force: true });
    const latest = await fetchLatestArticles({ source: "auto", limit: Number(process.env.FE_REFRESH_ARTICLE_LIMIT || 10), force: true });
    results.content = { selected_source: latest.selected_source, cache_status: latest.cache_status, count: latest.items.length };

    if (googleNlpConfigured()) {
      const warmLimit = Math.max(0, Math.min(10, Number(process.env.GOOGLE_NLP_WARM_LIMIT || 3)));
      for (const article of latest.items.slice(0, warmLimit)) {
        const text = article.articleBody || article.description || article.title;
        try {
          const nlp = await analyzeText(text, { force: false });
          results.nlp.push({ url: article.url, status: nlp.nlp_status, sentiment: nlp.sentiment?.sentiment_name || nlp.sentiment?.name || "Unknown" });
        } catch (error) {
          results.nlp.push({ url: article.url, status: "failed", error: error.message });
        }
      }
    }

    return res.status(200).json({ status: "complete", duration_ms: Date.now() - started, results, refreshed_at: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ status: "failed", detail: error.message, duration_ms: Date.now() - started, results });
  }
}
