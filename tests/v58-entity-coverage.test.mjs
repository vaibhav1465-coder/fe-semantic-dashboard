import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  meaningfulEntityList,
  sharedEntities
} from "../api/pair-entities.js";

const html = fs.readFileSync("index.html", "utf8");
const apiSource = fs.readFileSync("api/pair-entities.js", "utf8");

test("keeps strong article-level entities when there is no shared entity", () => {
  const source = meaningfulEntityList([
    { name: "HDFC Bank", type: "ORGANIZATION", salience: 0.45, mentions: 3 },
    { name: "India", type: "LOCATION", salience: 0.2, mentions: 2 },
    { name: "history", type: "OTHER", salience: 0.9, mentions: 5 },
    { name: "2026", type: "NUMBER", salience: 0.3, mentions: 2 }
  ]);

  const target = meaningfulEntityList([
    { name: "ICICI Bank", type: "ORGANIZATION", salience: 0.4, mentions: 3 },
    { name: "Reserve Bank of India", type: "ORGANIZATION", salience: 0.25, mentions: 1 },
    { name: "results", type: "OTHER", salience: 0.8, mentions: 4 }
  ]);

  assert.deepEqual(source.map(item => item.name), ["HDFC Bank", "India"]);
  assert.deepEqual(target.map(item => item.name), ["ICICI Bank", "Reserve Bank of India"]);
  assert.equal(sharedEntities(source, target).length, 0);
});

test("API clearly distinguishes shared and article-level entity display modes", () => {
  assert.match(apiSource, /entity_quality_version:\s*"5\.8"/);
  assert.match(apiSource, /entity_display_mode:\s*shared\.length\s*\?\s*"shared"\s*:\s*"article-level"/);
  assert.match(apiSource, /strongest named entities from each article separately/);
});

test("dashboard shows article-level Google entities instead of hiding the field", () => {
  assert.match(html, /entity_version=58/);
  assert.match(html, /Source article/);
  assert.match(html, /Suggested article/);
  assert.match(html, /Shared by both/);
  assert.match(html, /Google NLP completed but did not find a reliable named entity in either article/);
  assert.doesNotMatch(html, /detail\.hidden=true/);
});

test("dashboard retries one transient entity failure and loads suggestions sequentially", () => {
  assert.match(html, /fetchPairEntityPayload\(sourceUrl,targetUrl,true\)/);
  assert.match(html, /for\(const block of blocks\)/);
  assert.doesNotMatch(html, /Promise\.all\(blocks\.map/);
});
