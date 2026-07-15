import test from "node:test";
import assert from "node:assert/strict";
import { validateRecommendation, validateDataset, normalizeUrl } from "../lib/validation.js";
const base={"Source URL":"https://example.com/new","Target URL":"https://example.com/old",Status:"Approved","Confidence Score":90,Reason:"Relevant", "Anchor Text Suggestion":"older background",source_date:"2026-07-10",target_date:"2026-07-01"};
test("normalizes tracking parameters and trailing slash",()=>{
  assert.equal(normalizeUrl("https://Example.com/x/?utm_source=a#b"),"https://example.com/x");
});
test("passes a valid newer-to-older recommendation",()=>{
  assert.equal(validateRecommendation(base,new Set()).valid,true);
});
test("rejects same source and target URL",()=>{
  const result=validateRecommendation({...base,"Target URL":base["Source URL"]},new Set());
  assert.ok(result.errors.includes("same_url"));
});
test("flags newer target article",()=>{
  const result=validateRecommendation({...base,target_date:"2026-07-12"},new Set());
  assert.ok(result.errors.includes("target_not_older_than_source"));
});
test("detects duplicate pairs",()=>{
  const result=validateDataset([base,{...base}]);
  assert.equal(result.invalid,1);
});
