import { getLiveRecommendations } from "../lib/live-recommendations.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const query = req.query || {};
  try {
    const payload = await getLiveRecommendations({
      sourceLimit: query.limit,
      candidateLimit: query.candidates,
      minSuggestions: query.min_suggestions,
      maxSuggestions: query.max_suggestions,
      minScore: query.min_score,
      force: query.force === "1"
    });

    res.setHeader(
      "Cache-Control",
      query.force === "1" ? "no-store" : "s-maxage=600, stale-while-revalidate=3600"
    );
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(502).json({
      status: "failed",
      error: "Live recommendations are unavailable",
      detail: error.message,
      checked_at: new Date().toISOString()
    });
  }
}
