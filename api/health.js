import { readDataset } from "../lib/data.js";
import { persistenceMode } from "../lib/storage.js";
import { getLastGoogleNlpStatus, googleNlpDiagnostics } from "../lib/google-nlp.js";
import { cacheDiagnostics } from "../lib/cache.js";
import { contentSourceConfiguration, getLastSourceStatus } from "../lib/content-sources.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const data = readDataset();
    const sourceStatus = await getLastSourceStatus();
    const googleNlpStatus = await getLastGoogleNlpStatus();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      status: "healthy",
      service: "fe-semantic-interlinking",
      version: "5.0.0",
      batch_id: data.batch_id || null,
      generated_at: data.generated_at || null,
      recommendations: data.summary,
      persistence: persistenceMode(),
      google_nlp: googleNlpDiagnostics(),
      google_nlp_status: googleNlpStatus,
      cache: cacheDiagnostics(),
      content_sources: contentSourceConfiguration(),
      last_source_status: sourceStatus,
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ status: "unhealthy", detail: error.message, checked_at: new Date().toISOString() });
  }
}
