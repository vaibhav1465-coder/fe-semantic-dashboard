import test from "node:test";
import assert from "node:assert/strict";
import { buildProvenance } from "../lib/provenance.js";

const dataset = {
  batch_id: "batch-1",
  generated_at: "2026-07-15T00:00:00.000Z",
  items: [{ Entities:["India"], "Source Sentiment":{score:0,name:"Neutral",magnitude:1}, nlp_status:"cached" }]
};

test("uses WordPress REST when live", () => {
  const result = buildProvenance({
    sourceStatus:{tests:{wordpress_rest:{status:"live",cache_status:"live"},rss:{status:"live"},static_cache:{status:"ready",count:2}}},
    nlpStatus:{status:"live"}, nlpDiagnostics:{configured:true}, dataset
  });
  assert.equal(result.article_source.label, "WordPress REST API");
  assert.equal(result.entity_source.label, "Google NLP API");
});

test("falls back to RSS when WordPress fails", () => {
  const result = buildProvenance({
    sourceStatus:{tests:{wordpress_rest:{status:"failed"},rss:{status:"live",cache_status:"live"},static_cache:{status:"ready",count:2}}},
    nlpStatus:{status:"cache"}, nlpDiagnostics:{configured:true}, dataset
  });
  assert.equal(result.article_source.label, "RSS Feed");
  assert.match(result.fallback_message, /WordPress REST API failed/i);
  assert.equal(result.entity_source.label, "Google NLP Cache");
});

test("falls back to packaged cache and then last crawl", () => {
  const cacheResult = buildProvenance({
    sourceStatus:{tests:{wordpress_rest:{status:"failed"},rss:{status:"failed"},static_cache:{status:"ready",count:2}}},
    nlpDiagnostics:{configured:false}, dataset
  });
  assert.equal(cacheResult.article_source.label, "Fallback Cache");

  const crawlResult = buildProvenance({
    sourceStatus:{tests:{wordpress_rest:{status:"failed"},rss:{status:"failed"},static_cache:{status:"empty",count:0}}},
    nlpDiagnostics:{configured:false}, dataset
  });
  assert.equal(crawlResult.article_source.label, "Last Crawl");
  assert.equal(crawlResult.last_crawl.batch_id, "batch-1");
});
