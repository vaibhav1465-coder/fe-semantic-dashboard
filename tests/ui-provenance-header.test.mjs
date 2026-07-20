import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");

test("dashboard shows honest live and fallback provenance labels", () => {
  assert.match(html, /Live data provenance/);
  assert.match(html, /Articles: Last Crawl/);
  assert.match(html, /Entities: Google NLP Cache/);
  assert.match(html, /RSS Feed/);
  assert.match(html, /Fallback Cache/);
  assert.match(html, /\/api\/provenance\?live=1/);
});

test("dashboard uses simple newsroom language", () => {
  assert.match(html, /Contextual, relevant, and meaningful for readers/);
  assert.match(html, /Expand any row to review all recommendation details in one place/);
  assert.match(html, /The dashboard does not force weak links/);
  assert.doesNotMatch(html, /atleast/i);
  assert.doesNotMatch(html, /meanigful/i);
});
