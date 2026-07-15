import { fetchLatestArticles, resolveArticle } from "../lib/content-sources.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const query = req.query || {};
    const force = query.force === "1";
    const source = query.source || "auto";
    const limit = Math.max(1, Math.min(100, Number(query.limit || 50)));

    res.setHeader("Cache-Control", force ? "no-store" : "s-maxage=60, stale-while-revalidate=300");
    if (query.url) {
      const item = await resolveArticle(query.url, { force });
      return res.status(200).json({ status: "ok", selected_source: item.source, cache_status: item.cache_status, item });
    }

    const result = await fetchLatestArticles({
      source,
      limit,
      search: query.search || "",
      after: query.after || "",
      before: query.before || "",
      force
    });
    return res.status(200).json({ status: "ok", ...result, count: result.items.length, checked_at: new Date().toISOString() });
  } catch (error) {
    return res.status(502).json({ status: "failed", error: "Content sources unavailable", detail: error.message, checked_at: new Date().toISOString() });
  }
}
