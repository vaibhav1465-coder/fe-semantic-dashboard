import fs from "node:fs";
import path from "node:path";
import { validateDataset } from "./validation.js";

const DATA_PATH = path.join(process.cwd(), "data", "recommendations.json");

export function readDataset() {
  const payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const items = Array.isArray(payload) ? payload : (payload.items || []);
  const approved = items.filter(x => x.Status === "Approved");
  const scores = approved.map(x => Number(x["Confidence Score"] || 0));
  const validation = validateDataset(items);
  return {
    ...(!Array.isArray(payload) ? payload : {}),
    items,
    summary: {
      total: items.length,
      approved: approved.length,
      rejected: items.filter(x => x.Status === "Rejected").length,
      approval_rate: items.length ? Number(((approved.length/items.length)*100).toFixed(1)) : 0,
      avg_score: scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0,
      sources: new Set(items.map(x=>x["Source URL"])).size,
      validation_invalid: validation.invalid,
      validation_warnings: validation.warnings
    }
  };
}
