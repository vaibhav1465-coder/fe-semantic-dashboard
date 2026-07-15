import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");

test("dashboard has a dedicated anchor recommendation column", () => {
  assert.match(html, /Anchor Text Recommendation/);
  assert.match(html, /anchorRecommendation\(r\)/);
  assert.match(html, /Recommended Anchor/);
});

test("expanded and empty rows span all eight columns", () => {
  assert.match(html, /colspan="8"/);
});
