import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");

test("dashboard loads health and provenance APIs without changing the approved layout", () => {
  assert.match(html, /fetch\("\/api\/health"/);
  assert.match(html, /fetch\("\/api\/provenance\?live=1"/);
  assert.match(html, /Live Data Provenance/);
  assert.match(html, /Anchor Text Recommendation/);
});

test("expanded API status shows NLP, source and cache provenance", () => {
  assert.match(html, /source_content_source/);
  assert.match(html, /nlp_cache_status/);
  assert.match(html, /WordPress REST:/);
});
