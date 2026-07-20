import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadLocalEnvironment } from "../lib/local-env.js";
import { buildProvenance } from "../lib/provenance.js";

test("local development loads .env.local without overwriting existing process values", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fe-env-"));
  fs.writeFileSync(path.join(root, ".env.local"), "FE_TEST_LOCAL_ENV=loaded\nFE_TEST_KEEP=file\n");
  const originalKeep = process.env.FE_TEST_KEEP;
  process.env.FE_TEST_KEEP = "shell";
  delete process.env.FE_TEST_LOCAL_ENV;
  const files = loadLocalEnvironment(root);
  assert.deepEqual(files, [".env.local"]);
  assert.equal(process.env.FE_TEST_LOCAL_ENV, "loaded");
  assert.equal(process.env.FE_TEST_KEEP, "shell");
  delete process.env.FE_TEST_LOCAL_ENV;
  if (originalKeep === undefined) delete process.env.FE_TEST_KEEP;
  else process.env.FE_TEST_KEEP = originalKeep;
  fs.rmSync(root, { recursive: true, force: true });
});

test("provenance keeps the true processed-crawl timestamp instead of relabelling a one-article source probe", () => {
  const payload = buildProvenance({
    sourceStatus: {
      checked_at: "2026-07-20T08:00:00.000Z",
      tests: {
        wordpress_rest: { status: "live", cache_status: "live", count: 1 },
        rss: { status: "failed" },
        static_cache: { status: "ready", count: 18 }
      }
    },
    nlpDiagnostics: { configured: true },
    dataset: {
      batch_id: "preview-20260715",
      generated_at: "2026-07-15T00:00:00.000Z",
      source: "approved-ui-preview-fallback",
      items: []
    }
  });
  assert.equal(payload.last_crawl.generated_at, "2026-07-15T00:00:00.000Z");
  assert.equal(payload.last_crawl.source, "approved-ui-preview-fallback");
});

test("dashboard gives only a compact reason for each match score", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /Why \$\{score\}\/100:/);
  assert.match(html, /strong shared title terms/);
  assert.match(html, /closely related categories/);
  assert.match(html, /The score is reduced by/);
  assert.doesNotMatch(html, /score-components/);
  assert.doesNotMatch(html, /seven criteria shown below/i);
  assert.doesNotMatch(html, /Quality gate:/);
  assert.doesNotMatch(html, /new Date\(\)\.toISOString\(\)\);\n    LIVE_DELIVERY/);
});

test("live recommendation service does not lower the quality threshold to reach a count", () => {
  const source = fs.readFileSync("lib/live-recommendations.js", "utf8");
  assert.doesNotMatch(source, /minScore - 4|minScore - 8|thresholds =/);
  assert.match(source, /quality_threshold_fixed = true/);
  assert.match(source, /FE_LIVE_RECOMMENDATION_MIN_SCORE \|\| 40/);
});
