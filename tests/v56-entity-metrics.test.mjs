import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isMeaningfulEditorialEntity } from "../api/pair-entities.js";

const html = fs.readFileSync("index.html", "utf8");

test("filters years, dates, numbers and other non-editorial entities", () => {
  assert.equal(isMeaningfulEditorialEntity({ name: "2026", type: "NUMBER" }), false);
  assert.equal(isMeaningfulEditorialEntity({ name: "2025", type: "DATE" }), false);
  assert.equal(isMeaningfulEditorialEntity({ name: "15/07/2026", type: "OTHER" }), false);
  assert.equal(isMeaningfulEditorialEntity({ name: "HDFC Bank", type: "ORGANIZATION" }), true);
  assert.equal(isMeaningfulEditorialEntity({ name: "FIFA World Cup", type: "EVENT" }), true);
});

test("dashboard displays only shared meaningful Google entities", () => {
  assert.match(html, /detail\.hidden=true/);
  assert.doesNotMatch(html, /No meaningful shared Google entities were found for this article pair/);
  assert.doesNotMatch(html, /Key entities from the two articles are shown below/);
});

test("dashboard uses clear team-facing metrics and removes rejected-match controls", () => {
  assert.match(html, /Qualified article URLs/);
  assert.match(html, /Recommended links/);
  assert.match(html, /Links per article/);
  assert.match(html, /Articles checked/);
  assert.doesNotMatch(html, /Rejected matches/);
  assert.doesNotMatch(html, /id="statusFilter"/);
});

test("dashboard states the complete fixed quality rule", () => {
  assert.match(html, /score at least 50\/100/);
  assert.match(html, /share two meaningful topics/);
  assert.match(html, /link a newer article to an older article/);
  assert.match(html, /specific anchor text, placement, and a clear reason/);
});
