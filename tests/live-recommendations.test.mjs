import test from "node:test";
import assert from "node:assert/strict";
import { buildLiveRecommendationDataset } from "../lib/recommendation-engine.js";

function article(id, day, topic, extra = {}) {
  const articleId = 4_200_000 + id;
  return {
    id: articleId,
    title: `${topic} policy, investment and growth outlook`,
    description: `Financial Express analysis of ${topic}, policy, investment, growth, companies and the market outlook.`,
    url: `https://www.financialexpress.com/business/${topic.replaceAll(" ", "-")}/article-${articleId}/`,
    datePublished: new Date(Date.UTC(2026, 6, 20 - day)).toISOString(),
    dateModified: new Date(Date.UTC(2026, 6, 20 - day)).toISOString(),
    categories: [extra.category || topic],
    tags: [extra.tag || topic],
    source: "wordpress_rest"
  };
}

const articles = [];
let id = 1;
for (let day = 0; day < 18; day += 1) {
  for (const topic of ["airport expansion", "bank credit", "electric vehicle", "stock market"]) {
    articles.push(article(id++, day, topic));
  }
}

test("live engine returns two or three qualified suggestions per included source", () => {
  const result = buildLiveRecommendationDataset(articles, {
    sourceLimit: 12,
    minSuggestions: 2,
    maxSuggestions: 3,
    minScore: 28
  });

  assert.equal(result.summary.sources, 12);
  const approved = result.items.filter(item => item.Status === "Approved");
  const grouped = new Map();
  for (const item of approved) {
    if (!grouped.has(item["Source URL"])) grouped.set(item["Source URL"], []);
    grouped.get(item["Source URL"]).push(item);
  }

  assert.equal(grouped.size, 12);
  for (const suggestions of grouped.values()) {
    assert.ok(suggestions.length >= 2 && suggestions.length <= 3);
  }
});

test("every displayed recommendation has article URLs, a specific anchor, placement, reason and score explanation", () => {
  const result = buildLiveRecommendationDataset(articles, {
    sourceLimit: 8,
    minSuggestions: 2,
    maxSuggestions: 3,
    minScore: 28
  });

  for (const item of result.items) {
    assert.match(item["Source URL"], /\d{6,}\/$/);
    assert.match(item["Target URL"], /\d{6,}\/$/);
    assert.notEqual(item["Source URL"], item["Target URL"]);
    assert.ok(item["Anchor Text Suggestion"]?.trim());
    assert.ok(item["Anchor Text Suggestion"].length <= 80);
    assert.ok(item["Anchor Text Suggestion"].split(/\s+/).length <= 8);
    assert.ok(item["Link Placement Suggestion"]?.trim());
    assert.ok(item.Reason?.trim());
    assert.match(item["Match Score Explanation"], /title similarity/i);
    assert.ok(Array.isArray(item["Shared Topics"]));
  }
});

test("targets are older than source articles", () => {
  const result = buildLiveRecommendationDataset(articles, {
    sourceLimit: 8,
    minSuggestions: 2,
    maxSuggestions: 3,
    minScore: 28
  });

  for (const item of result.items) {
    assert.ok(new Date(item.target_date).getTime() < new Date(item.source_date).getTime());
  }
});
