import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWordPressPost, wordpressEndpoint } from "../lib/wordpress.js";

test("normalizes a WordPress REST post", () => {
  const item = normalizeWordPressPost({
    id: 123,
    slug: "ai-infrastructure",
    date: "2026-07-15T10:00:00",
    modified: "2026-07-15T11:00:00",
    link: "https://www.financialexpress.com/technology/ai-infrastructure/123/",
    title: { rendered: "AI &amp; infrastructure" },
    excerpt: { rendered: "<p>Short summary</p>" },
    content: { rendered: "<p>Full <strong>article</strong> body</p>" },
    categories: [1],
    tags: [2]
  });
  assert.equal(item.title, "AI & infrastructure");
  assert.equal(item.articleBody, "Full article body");
  assert.equal(item.source, "wordpress_rest");
});

test("has a configurable default WordPress posts endpoint", () => {
  assert.match(wordpressEndpoint(), /wp-json\/wp\/v2\/posts/);
});
