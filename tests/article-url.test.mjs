import test from "node:test";
import assert from "node:assert/strict";
import { isFinancialExpressArticleUrl } from "../lib/article-url.js";

test("accepts Financial Express article URLs with numeric article IDs", () => {
  assert.equal(isFinancialExpressArticleUrl("https://www.financialexpress.com/market/stock-insights/example-story/4242292/"), true);
  assert.equal(isFinancialExpressArticleUrl("https://www.financialexpress.com/business/example-story-4242292/"), true);
});

test("rejects section, category and non-article URLs", () => {
  assert.equal(isFinancialExpressArticleUrl("https://www.financialexpress.com/market/"), false);
  assert.equal(isFinancialExpressArticleUrl("https://www.financialexpress.com/tag/markets/"), false);
  assert.equal(isFinancialExpressArticleUrl("https://www.financialexpress.com/shorts/economy/example-4242292/"), false);
  assert.equal(isFinancialExpressArticleUrl("https://example.com/story/4242292/"), false);
});
