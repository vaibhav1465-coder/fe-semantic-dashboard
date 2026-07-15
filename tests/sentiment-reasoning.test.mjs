import test from "node:test";
import assert from "node:assert/strict";
import { buildSentimentReason, sentimentLabel } from "../lib/sentiment-reasoning.js";

test("classifies sentiment with dashboard thresholds", () => {
  assert.equal(sentimentLabel(0.26), "Positive");
  assert.equal(sentimentLabel(0.25), "Neutral");
  assert.equal(sentimentLabel(-0.26), "Negative");
});

test("explains high-magnitude neutral sentiment as balanced or mixed", () => {
  const reason = buildSentimentReason({ score: 0.02, magnitude: 5.6 }, []);
  assert.match(reason.summary, /Neutral but emotionally active/i);
  assert.match(reason.summary, /5\.600/);
});

test("uses sentence-level evidence when available", () => {
  const reason = buildSentimentReason(
    { score: 0.4, magnitude: 1.7 },
    [
      { text: "Strong growth supports the outlook.", score: 0.8, magnitude: 0.9 },
      { text: "Costs remain a concern.", score: -0.4, magnitude: 0.5 }
    ]
  );
  assert.equal(reason.evidence.length, 2);
  assert.equal(reason.evidence[0].label, "Positive");
});
