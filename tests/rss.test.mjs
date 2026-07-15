import test from "node:test";
import assert from "node:assert/strict";
import { parseFeedXml, discoverFeedUrlsFromHtml } from "../lib/rss.js";

test("parses RSS 2.0 items", () => {
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <title><![CDATA[Markets rise on policy update]]></title>
    <link>https://www.financialexpress.com/market/example/123/</link>
    <pubDate>Wed, 15 Jul 2026 10:00:00 +0530</pubDate>
    <description><![CDATA[<p>A market update.</p>]]></description>
  </item></channel></rss>`;
  const items = parseFeedXml(xml, "https://example.com/feed.xml");
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Markets rise on policy update");
  assert.equal(items[0].description, "A market update.");
  assert.equal(items[0].source, "rss");
});

test("parses Atom entries", () => {
  const xml = `<feed><entry><title>AI infrastructure</title>
    <link rel="alternate" href="https://www.financialexpress.com/technology/ai/123/" />
    <updated>2026-07-15T10:00:00Z</updated><summary>Latest AI update</summary>
  </entry></feed>`;
  const items = parseFeedXml(xml, "https://example.com/atom.xml");
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://www.financialexpress.com/technology/ai/123/");
});

test("discovers RSS/XML links from FE syndication HTML", () => {
  const html = `<a href="https://syndication.financialexpress.com/rss/377/tech.xml">Tech</a>
    <a href="/market/feed/">Markets</a><a href="/not-a-feed/">Other</a>`;
  const urls = discoverFeedUrlsFromHtml(html, "https://www.financialexpress.com/syndication/");
  assert.ok(urls.includes("https://syndication.financialexpress.com/rss/377/tech.xml"));
  assert.ok(urls.includes("https://www.financialexpress.com/market/feed/"));
});
