import { contentSourceConfiguration, getLastSourceStatus, probeContentSources } from "../lib/content-sources.js";
import { cacheDiagnostics } from "../lib/cache.js";
import { googleNlpDiagnostics } from "../lib/google-nlp.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const live = req.query?.live === "1";
    const sourceStatus = live ? await probeContentSources({ force: req.query?.force === "1" }) : await getLastSourceStatus();
    res.setHeader("Cache-Control", live ? "no-store" : "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      status: sourceStatus?.status || "not_tested",
      configuration: contentSourceConfiguration(),
      source_status: sourceStatus,
      google_nlp: googleNlpDiagnostics(),
      cache: cacheDiagnostics(),
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ status: "failed", detail: error.message, checked_at: new Date().toISOString() });
  }
}
