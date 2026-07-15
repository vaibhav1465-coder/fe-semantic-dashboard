import test from "node:test";
import assert from "node:assert/strict";
import { generateAnchorText, generatePlacementSuggestion } from "../lib/anchor.js";
test("anchor prefers a useful multi-word entity",()=>{
  assert.equal(generateAnchorText("A long title",["Google Cloud","AI"]),"Google Cloud");
});
test("anchor is generated from title when entities are absent",()=>{
  assert.equal(generateAnchorText("How India plans to expand airport capacity",[]),"India plans expand airport capacity");
});
test("placement uses a related source sentence",()=>{
  const body="The market opened lower. India is expanding airport capacity across major cities. Investors remained cautious.";
  assert.match(generatePlacementSuggestion(body,"Airport capacity expansion",["India"]),/India is expanding airport capacity/);
});
