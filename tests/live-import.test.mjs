import test from "node:test";
import assert from "node:assert/strict";
import { extractRecommendationsFromHtml } from "../lib/live-import.js";
test("extracts recommendation JSON array from dashboard source",()=>{
  const html='<script>const ALL_DATA = [{"Source URL":"https://example.com/a","Target URL":"https://example.com/b"}];</script>';
  const rows=extractRecommendationsFromHtml(html);
  assert.equal(rows.length,1);
  assert.equal(rows[0]["Target URL"],"https://example.com/b");
});
