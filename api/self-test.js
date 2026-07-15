import { readDataset } from "../lib/data.js";
import { validateDataset } from "../lib/validation.js";
import { persistenceMode } from "../lib/storage.js";
import { googleNlpConfigured, googleNlpDiagnostics, testGoogleNlp } from "../lib/google-nlp.js";
import { cacheDiagnostics, cacheKey, getCache, setCache } from "../lib/cache.js";
import { contentSourceConfiguration, probeContentSources } from "../lib/content-sources.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const tests = [];
  const live = req.query?.live === "1";

  try {
    const data = readDataset();
    tests.push({ name: "dataset_load", status: data.items.length ? "pass" : "fail", detail: `${data.items.length} records` });

    const validation = validateDataset(data.items);
    tests.push({
      name: "schema_and_quality_validation",
      status: validation.invalid === 0 ? "pass" : "warn",
      detail: `${validation.invalid} invalid, ${validation.warnings} warnings`
    });

    tests.push({
      name: "editorial_action_storage",
      status: persistenceMode() === "supabase" ? "pass" : "warn",
      detail: persistenceMode()
    });

    const cacheTestKey = cacheKey("self-test", Date.now());
    await setCache(cacheTestKey, { ok: true }, 60, { type: "self-test" });
    const cacheRead = await getCache(cacheTestKey, { allowStale: false });
    tests.push({
      name: "cache_read_write",
      status: cacheRead.hit && cacheRead.value?.ok ? "pass" : "fail",
      detail: cacheDiagnostics()
    });

    tests.push({
      name: "content_source_configuration",
      status: "pass",
      detail: contentSourceConfiguration()
    });

    tests.push({
      name: "google_nlp_configuration",
      status: googleNlpConfigured() ? "pass" : "warn",
      detail: googleNlpDiagnostics()
    });

    if (live) {
      try {
        const sourceResult = await probeContentSources({ force: true });
        tests.push({
          name: "wordpress_rss_live_probe",
          status: sourceResult.status === "live" ? "pass" : sourceResult.status === "fallback" ? "warn" : "fail",
          detail: sourceResult
        });
      } catch (error) {
        tests.push({ name: "wordpress_rss_live_probe", status: "fail", detail: error.message });
      }

      if (googleNlpConfigured()) {
        try {
          tests.push({ name: "google_nlp_live_call", status: "pass", detail: await testGoogleNlp() });
        } catch (error) {
          tests.push({ name: "google_nlp_live_call", status: "fail", detail: error.message });
        }
      } else {
        tests.push({ name: "google_nlp_live_call", status: "warn", detail: "Credentials not configured" });
      }
    }

    const overall = tests.some(x => x.status === "fail") ? "fail" : tests.some(x => x.status === "warn") ? "warn" : "pass";
    return res.status(overall === "fail" ? 500 : 200).json({ status: overall, live, tests, checked_at: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({
      status: "fail",
      tests: [...tests, { name: "unexpected_error", status: "fail", detail: error.message }],
      checked_at: new Date().toISOString()
    });
  }
}
