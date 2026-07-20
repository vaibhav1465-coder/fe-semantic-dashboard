import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  entityVariantScore,
  isMeaningfulEditorialEntity,
  normalizedEntityName,
  sharedEntities
} from "../api/pair-entities.js";

const html = fs.readFileSync("index.html", "utf8");

test("rejects generic or non-editorial Google entities", () => {
  for (const name of ["history", "History", "world", "results", "event", "tournament", "2026"]) {
    assert.equal(isMeaningfulEditorialEntity({ name, type: "OTHER", mentions: 1 }), false, name);
  }
  assert.equal(isMeaningfulEditorialEntity({ name: "FIFA", type: "ORGANIZATION", mentions: 1 }), true);
  assert.equal(isMeaningfulEditorialEntity({ name: "FIFA World Cup", type: "EVENT", mentions: 1 }), true);
  assert.equal(isMeaningfulEditorialEntity({ name: "HDFC Bank", type: "ORGANIZATION", mentions: 1 }), true);
});

test("normalizes years and legal suffixes without weakening named entities", () => {
  assert.equal(normalizedEntityName("FIFA World Cup 2026"), "fifa world cup");
  assert.equal(normalizedEntityName("HDFC Bank Limited"), "hdfc bank");
});

test("matches useful entity variants instead of requiring exact names", () => {
  assert.ok(entityVariantScore(
    { name: "FIFA World Cup", type: "EVENT", mentions: 1 },
    { name: "World Cup", type: "EVENT", mentions: 1 }
  ) >= 0.9);
  assert.ok(entityVariantScore(
    { name: "HDFC Bank", type: "ORGANIZATION", mentions: 1 },
    { name: "HDFC", type: "ORGANIZATION", mentions: 1 }
  ) >= 0.9);
  assert.equal(entityVariantScore(
    { name: "World", type: "OTHER", mentions: 1 },
    { name: "World Bank", type: "ORGANIZATION", mentions: 1 }
  ), 0);
});

test("returns FIFA named entities while excluding history and years", () => {
  const shared = sharedEntities(
    [
      { name: "FIFA World Cup 2026", type: "EVENT", salience: 0.3, mentions: 2 },
      { name: "FIFA", type: "ORGANIZATION", salience: 0.4, mentions: 3 },
      { name: "history", type: "OTHER", salience: 0.5, mentions: 1 },
      { name: "2026", type: "NUMBER", salience: 0.2, mentions: 2 }
    ],
    [
      { name: "World Cup", type: "EVENT", salience: 0.25, mentions: 2 },
      { name: "FIFA", type: "ORGANIZATION", salience: 0.35, mentions: 2 },
      { name: "History", type: "OTHER", salience: 0.6, mentions: 1 }
    ]
  );

  const names = shared.map(entity => entity.name);
  assert.ok(names.includes("FIFA World Cup"));
  assert.ok(names.includes("FIFA"));
  assert.ok(!names.some(name => /history|2026/i.test(name)));
});

test("dashboard bypasses old entity responses and keeps honest entity coverage", () => {
  assert.match(html, /entity_version=58/);
  assert.match(html, /Source article/);
  assert.match(html, /Suggested article/);
  assert.doesNotMatch(html, /detail\.hidden=true/);
});
