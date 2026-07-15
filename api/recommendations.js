import crypto from "node:crypto";
import { readDataset } from "../lib/data.js";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const data = readDataset();
    const etag = `W/\"${crypto.createHash("sha1").update(JSON.stringify([data.batch_id, data.generated_at, data.summary])).digest("hex")}\"`;
    if (req.headers?.["if-none-match"] === etag) return res.status(304).end();
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).json({ ...data, delivery: "processed-cache", cache_policy: "300s + 3600s stale-while-revalidate" });
  } catch (error) {
    return res.status(500).json({ error: "Recommendations unavailable", detail: error.message });
  }
}
