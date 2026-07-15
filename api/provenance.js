import { readDataset } from "../lib/data.js";
import { getLastSourceStatus, probeContentSources } from "../lib/content-sources.js";
import { getLastGoogleNlpStatus, googleNlpDiagnostics } from "../lib/google-nlp.js";
import { buildProvenance } from "../lib/provenance.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const live = req.query?.live === "1";
  try {
    const dataset = readDataset();
    let sourceStatus = null;
    try {
      sourceStatus = live
        ? await probeContentSources({ force: req.query?.force === "1" })
        : await getLastSourceStatus();
    } catch (error) {
      sourceStatus = { status: "failed", tests: {}, error: error.message, checked_at: new Date().toISOString() };
    }
    const nlpStatus = await getLastGoogleNlpStatus();
    const payload = buildProvenance({
      sourceStatus,
      nlpStatus,
      nlpDiagnostics: googleNlpDiagnostics(),
      dataset
    });
    res.setHeader("Cache-Control", live ? "no-store" : "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ ...payload, live_probe: live });
  } catch (error) {
    return res.status(500).json({
      status: "failed",
      detail: error.message,
      checked_at: new Date().toISOString()
    });
  }
}
