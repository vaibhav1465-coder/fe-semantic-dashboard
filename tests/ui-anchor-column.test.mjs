import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");

test("dashboard shows specific anchor, placement, reason, topics, Google entities and score explanation", () => {
  const anchor = html.indexOf('<span class="label">Specific anchor text</span>');
  const placement = html.indexOf('<span class="label">Where to add the link</span>');
  const reason = html.indexOf('<span class="label">Why this link is relevant</span>');
  const topics = html.indexOf('<span class="label">Shared topics</span>');
  const entities = html.indexOf('<span class="label">Google entities</span>');
  const score = html.indexOf('<span class="label">Why this score</span>');
  assert.ok(anchor >= 0);
  assert.ok(placement > anchor);
  assert.ok(reason > placement);
  assert.ok(topics > reason);
  assert.ok(entities > topics);
  assert.ok(score > entities);
  assert.doesNotMatch(html, /Status: \$\{esc\(row\.Status/);
  assert.doesNotMatch(html, /How it was matched/);
  assert.doesNotMatch(html, /Article source/);
});

test("dashboard uses URL rows, dropdown details and a load-more button without a carousel or score bar", () => {
  assert.match(html, /details class="article-row"/);
  assert.match(html, /article-summary/);
  assert.match(html, /source-url/);
  assert.match(html, /Load 10 more articles/);
  assert.doesNotMatch(html, /recommendations-grid/);
  assert.doesNotMatch(html, /recommendation-card/);
  assert.doesNotMatch(html, /carousel/i);
  assert.doesNotMatch(html, /score-bar-bg/);
  assert.doesNotMatch(html, /score-bar-fill/);
  assert.doesNotMatch(html, /table-wrap/);
});
