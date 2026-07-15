import test from "node:test";
import assert from "node:assert/strict";
import { sentimentName } from "../lib/google-nlp.js";

test("classifies Google NLP sentiment score", () => {
  assert.equal(sentimentName(0.8), "Positive");
  assert.equal(sentimentName(-0.8), "Negative");
  assert.equal(sentimentName(0.1), "Neutral");
  assert.equal(sentimentName(null), "Unknown");
});
