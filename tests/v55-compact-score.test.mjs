import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");

test("score explanation is compact and avoids the full criteria grid", () => {
  assert.match(html, /<span class="label">Why this score<\/span>/);
  assert.match(html, /Why \$\{score\}\/100:/);
  assert.doesNotMatch(html, /score-component/);
  assert.doesNotMatch(html, /score-rule/);
  assert.doesNotMatch(html, /The score uses only the seven criteria shown below/);
});
