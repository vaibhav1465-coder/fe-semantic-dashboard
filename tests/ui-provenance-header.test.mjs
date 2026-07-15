import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");

test("dashboard shows live provenance header and fallback labels", () => {
  assert.match(html, /Live Data Provenance/);
  assert.match(html, /Articles: Last Crawl/);
  assert.match(html, /Entities: Google NLP Cache/);
  assert.match(html, /RSS Feed/);
  assert.match(html, /Fallback Cache/);
  assert.match(html, /\/api\/provenance\?live=1/);
});

test("success metrics are deferred from production UI", () => {
  assert.doesNotMatch(html, /success-metrics\.html/);
  assert.doesNotMatch(html, /Success Metrics & Scorecard/);
});
