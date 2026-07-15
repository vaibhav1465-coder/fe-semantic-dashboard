import crypto from "node:crypto";
import { cacheKey, getCache, getOrSetCache, setCache } from "./cache.js";
import { buildSentimentReason, sentimentLabel } from "./sentiment-reasoning.js";

const GOOGLE_NLP_STATUS_KEY = "google-nlp-status:last";
const TOKEN_STATE = globalThis.__FE_GOOGLE_TOKEN__ || { token: null, expiresAt: 0 };
globalThis.__FE_GOOGLE_TOKEN__ = TOKEN_STATE;

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function parseCredentials(raw) {
  if (!raw) return null;
  let text = String(raw).trim();
  if (!text.startsWith("{")) {
    try { text = Buffer.from(text, "base64").toString("utf8"); } catch {}
  }
  const parsed = JSON.parse(text);
  if (!parsed.client_email || !parsed.private_key) throw new Error("Google service-account JSON is incomplete");
  parsed.private_key = String(parsed.private_key).replace(/\\n/g, "\n");
  return parsed;
}

function loadCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    || process.env.GCP_SERVICE_ACCOUNT_JSON
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
    || "";
  return parseCredentials(raw);
}

export function googleNlpConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    || process.env.GCP_SERVICE_ACCOUNT_JSON
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
  );
}

async function getAccessToken({ force = false } = {}) {
  if (!force && TOKEN_STATE.token && TOKEN_STATE.expiresAt > Date.now() + 60_000) return TOKEN_STATE.token;
  const credentials = loadCredentials();
  if (!credentials) throw new Error("Google NLP is not configured");

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-language",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(credentials.private_key);
  const assertion = `${unsigned}.${base64url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google OAuth failed: ${response.status}${detail ? ` ${detail.slice(0, 180)}` : ""}`);
  }
  const payload = await response.json();
  TOKEN_STATE.token = payload.access_token;
  TOKEN_STATE.expiresAt = Date.now() + Number(payload.expires_in || 3600) * 1000;
  return TOKEN_STATE.token;
}

async function callLanguage(method, text) {
  const token = await getAccessToken();
  const version = process.env.GOOGLE_NLP_API_VERSION || "v2";
  const response = await fetch(`https://language.googleapis.com/${version}/documents:${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      document: {
        type: "PLAIN_TEXT",
        content: String(text).slice(0, Number(process.env.GOOGLE_NLP_MAX_CHARS || 90000))
      },
      encodingType: "UTF8"
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google NLP ${method} failed: ${response.status}${detail ? ` ${detail.slice(0, 180)}` : ""}`);
  }
  return response.json();
}

export function sentimentName(score) {
  return sentimentLabel(score);
}

async function saveGoogleNlpStatus(payload) {
  try {
    await setCache(
      GOOGLE_NLP_STATUS_KEY,
      { ...payload, updated_at: new Date().toISOString() },
      Number(process.env.GOOGLE_NLP_STATUS_TTL_SECONDS || 7776000),
      { type: "google-nlp-status" }
    );
  } catch {
    // Status reporting must never break NLP analysis.
  }
}

export async function getLastGoogleNlpStatus() {
  try {
    const result = await getCache(GOOGLE_NLP_STATUS_KEY, { allowStale: true });
    if (!result.hit) return null;
    return {
      ...result.value,
      status: result.stale && result.value?.status === "live" ? "stale-cache" : result.value?.status,
      cache_source: result.source,
      cached_at: result.updated_at
    };
  } catch {
    return null;
  }
}

export async function recordGoogleNlpFailure(error) {
  await saveGoogleNlpStatus({
    status: "failed",
    error: error?.message || String(error || "Google NLP failed"),
    configured: googleNlpConfigured()
  });
}

export async function analyzeText(text, { force = false, cacheTtlSeconds = null } = {}) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) throw new Error("Text is required for Google NLP analysis");
  if (!googleNlpConfigured()) {
    const error = new Error("Google NLP is not configured");
    await recordGoogleNlpFailure(error);
    throw error;
  }

  const version = process.env.GOOGLE_NLP_API_VERSION || "v2";
  const key = cacheKey(`google-nlp-${version}`, clean);
  try {
    const result = await getOrSetCache(key, async () => {
      const [sentiment, entities] = await Promise.all([
        callLanguage("analyzeSentiment", clean),
        callLanguage("analyzeEntities", clean)
      ]);
      const score = sentiment.documentSentiment?.score ?? null;
      const magnitude = sentiment.documentSentiment?.magnitude ?? null;
      const sentence_sentiments = (sentiment.sentences || []).slice(0, 80).map(item => ({
        text: item.text?.content || "",
        begin_offset: item.text?.beginOffset ?? item.text?.begin_offset ?? null,
        score: item.sentiment?.score ?? null,
        magnitude: item.sentiment?.magnitude ?? null,
        name: sentimentName(item.sentiment?.score)
      }));
      const sentiment_reason = buildSentimentReason({ score, magnitude, name: sentimentName(score) }, sentence_sentiments);
      return {
        sentiment: {
          sentiment_score: score,
          sentiment_name: sentimentName(score),
          sentiment_magnitude: magnitude,
          score,
          name: sentimentName(score),
          magnitude,
          reasoning: sentiment_reason
        },
        sentiment_reason,
        sentence_sentiments,
        entities: (entities.entities || []).slice(0, 20).map(item => ({
          name: item.name,
          type: item.type,
          salience: item.salience ?? null,
          mentions: Array.isArray(item.mentions) ? item.mentions.length : null
        })),
        language: sentiment.languageCode || sentiment.language || entities.languageCode || entities.language || null,
        api_version: version,
        analyzed_at: new Date().toISOString()
      };
    }, {
      ttlSeconds: Number(cacheTtlSeconds || process.env.GOOGLE_NLP_CACHE_TTL_SECONDS || 2592000),
      staleIfErrorSeconds: Number(process.env.GOOGLE_NLP_STALE_TTL_SECONDS || 7776000),
      force,
      metadata: { type: "google-nlp", api_version: version, chars: clean.length }
    });

    const normalizedStatus = result.cache_status === "live"
      ? "live"
      : result.cache_status === "stale-cache"
        ? "stale-cache"
        : "cache";
    await saveGoogleNlpStatus({
      status: normalizedStatus,
      configured: true,
      api_version: version,
      analyzed_at: result.value.analyzed_at || new Date().toISOString(),
      cache_source: result.cache_source,
      warning: result.error || null
    });

    return {
      ...result.value,
      nlp_status: result.cache_status === "live" ? "live" : result.cache_status,
      cache_status: result.cache_status,
      cache_source: result.cache_source,
      cached_at: result.cached_at,
      warning: result.error || null
    };
  } catch (error) {
    await recordGoogleNlpFailure(error);
    throw error;
  }
}

export async function testGoogleNlp() {
  const result = await analyzeText(
    "Financial Express verifies live Google Cloud Natural Language sentiment and entity extraction.",
    { force: true, cacheTtlSeconds: 60 }
  );
  return {
    status: "live",
    sentiment: result.sentiment,
    entities: result.entities.slice(0, 3),
    api_version: result.api_version,
    analyzed_at: result.analyzed_at
  };
}

export function googleNlpDiagnostics() {
  return {
    configured: googleNlpConfigured(),
    api_version: process.env.GOOGLE_NLP_API_VERSION || "v2",
    cache_ttl_seconds: Number(process.env.GOOGLE_NLP_CACHE_TTL_SECONDS || 2592000),
    max_chars: Number(process.env.GOOGLE_NLP_MAX_CHARS || 90000),
    token_cached: Boolean(TOKEN_STATE.token && TOKEN_STATE.expiresAt > Date.now())
  };
}
