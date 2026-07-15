import { cacheDiagnostics, deleteCachePrefix } from "../lib/cache.js";

function authorized(req) {
  const secret = process.env.REFRESH_SECRET || "";
  if (!secret) return !process.env.VERCEL;
  const supplied = req.headers?.authorization?.replace(/^Bearer\s+/i, "") || req.headers?.["x-refresh-secret"] || "";
  return supplied === secret;
}

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ status: "ok", cache: cacheDiagnostics(), checked_at: new Date().toISOString() });
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
  try {
    const prefix = String(req.query?.prefix || "").trim();
    if (!prefix || prefix.length < 3) return res.status(400).json({ error: "A cache prefix of at least 3 characters is required" });
    await deleteCachePrefix(prefix);
    return res.status(200).json({ status: "cleared", prefix, cache: cacheDiagnostics() });
  } catch (error) {
    return res.status(500).json({ status: "failed", detail: error.message });
  }
}
