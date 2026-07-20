import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");

test("dashboard loads 60 live article groups and keeps clear provenance", () => {
  assert.match(html, /\/api\/live-recommendations\?limit=60/);
  assert.match(html, /fetch\("\/api\/health"/);
  assert.match(html, /fetch\("\/api\/provenance\?live=1"/);
  assert.match(html, /Live data provenance/);
  assert.match(html, /WordPress REST API/);
  assert.match(html, /Qualified article URLs/);
  assert.match(html, /Review up to 60 recent Financial Express article URLs/);
});

test("dashboard filters out recommendations without required details", () => {
  assert.match(html, /validAnchor\(row\)/);
  assert.match(html, /validDetail\(row\["Link Placement Suggestion"\]\)/);
  assert.match(html, /validDetail\(row\.Reason\)/);
  assert.match(html, /Only article-to-article links are shown/);
});
