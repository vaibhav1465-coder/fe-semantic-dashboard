import { analyzeText, getLastGoogleNlpStatus, googleNlpDiagnostics } from "../lib/google-nlp.js";
import { resolveArticle } from "../lib/content-sources.js";

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", google_nlp: googleNlpDiagnostics(), last_status: await getLastGoogleNlpStatus(), checked_at: new Date().toISOString() });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = await readBody(req);
    let text = String(body.text || "").trim();
    let article = null;
    if (!text && body.url) {
      article = await resolveArticle(body.url, { force: body.force === true });
      text = article.articleBody || article.description || article.title || "";
    }
    if (!text) return res.status(400).json({ error: "Provide text or a Financial Express article URL" });

    const result = await analyzeText(text, { force: body.force === true });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ status: "ok", article: article ? { title: article.title, url: article.url, source: article.source } : null, result });
  } catch (error) {
    return res.status(502).json({ status: "failed", error: error.message, google_nlp: googleNlpDiagnostics() });
  }
}
