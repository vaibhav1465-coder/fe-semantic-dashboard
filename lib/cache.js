import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TABLE = process.env.SUPABASE_CACHE_TABLE || "fe_semantic_cache";
const MEMORY = globalThis.__FE_SEMANTIC_CACHE__ || new Map();
globalThis.__FE_SEMANTIC_CACHE__ = MEMORY;

function nowMs() { return Date.now(); }
function localPath() { return path.join(process.cwd(), "data", "runtime-cache.local.json"); }
function canUseLocalFile() { return !process.env.VERCEL && process.env.ALLOW_LOCAL_CACHE_STORAGE !== "false"; }

function readLocalFile() {
  if (!canUseLocalFile()) return {};
  try {
    const file = localPath();
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch { return {}; }
}

function writeLocalFile(data) {
  if (!canUseLocalFile()) return;
  const file = localPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function cacheKey(prefix, value) {
  const hash = crypto.createHash("sha256").update(String(value)).digest("hex");
  return `${prefix}:${hash}`;
}

export function cacheMode() {
  if (SUPABASE_URL && SUPABASE_KEY) return "supabase+memory";
  if (canUseLocalFile()) return "local-file+memory";
  return "memory";
}

function normalizeRecord(record, source) {
  if (!record) return null;
  const expiresAt = record.expires_at ? new Date(record.expires_at).getTime() : 0;
  const stale = expiresAt > 0 && expiresAt <= nowMs();
  return {
    hit: true,
    stale,
    value: record.payload ?? record.value,
    metadata: record.metadata || {},
    updated_at: record.updated_at || null,
    expires_at: record.expires_at || null,
    source
  };
}

async function readSupabase(key) {
  if (!(SUPABASE_URL && SUPABASE_KEY)) return null;
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?cache_key=eq.${encodeURIComponent(key)}&select=cache_key,payload,metadata,expires_at,updated_at&limit=1`;
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!response.ok) throw new Error(`Supabase cache read failed: ${response.status}`);
  const rows = await response.json();
  return rows[0] || null;
}

async function writeSupabase(record) {
  if (!(SUPABASE_URL && SUPABASE_KEY)) return;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=cache_key`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(record)
  });
  if (!response.ok) throw new Error(`Supabase cache write failed: ${response.status}`);
}

export async function getCache(key, { allowStale = true } = {}) {
  const memoryRecord = MEMORY.get(key);
  if (memoryRecord) {
    const result = normalizeRecord(memoryRecord, "memory");
    if (!result.stale || allowStale) return result;
  }

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const record = await readSupabase(key);
      if (record) {
        MEMORY.set(key, record);
        const result = normalizeRecord(record, "supabase");
        if (!result.stale || allowStale) return result;
      }
    } catch (error) {
      if (!allowStale) throw error;
    }
  }

  if (canUseLocalFile()) {
    const data = readLocalFile();
    const record = data[key];
    if (record) {
      MEMORY.set(key, record);
      const result = normalizeRecord(record, "local-file");
      if (!result.stale || allowStale) return result;
    }
  }

  return { hit: false, stale: false, value: null, metadata: {}, source: cacheMode() };
}

export async function setCache(key, value, ttlSeconds = 300, metadata = {}) {
  const updatedAt = new Date().toISOString();
  const expiresAt = new Date(nowMs() + Math.max(1, Number(ttlSeconds || 300)) * 1000).toISOString();
  const record = {
    cache_key: key,
    payload: value,
    metadata,
    updated_at: updatedAt,
    expires_at: expiresAt
  };
  MEMORY.set(key, record);

  const writes = [];
  if (SUPABASE_URL && SUPABASE_KEY) writes.push(writeSupabase(record));
  if (canUseLocalFile()) {
    const data = readLocalFile();
    data[key] = record;
    writeLocalFile(data);
  }
  if (writes.length) await Promise.all(writes);
  return normalizeRecord(record, cacheMode());
}

export async function getOrSetCache(key, loader, {
  ttlSeconds = 300,
  staleIfErrorSeconds = 86400,
  force = false,
  metadata = {}
} = {}) {
  const cached = await getCache(key, { allowStale: true });
  if (!force && cached.hit && !cached.stale) {
    return { value: cached.value, cache_status: "cache", cache_source: cached.source, cached_at: cached.updated_at };
  }

  try {
    const value = await loader();
    const saved = await setCache(key, value, ttlSeconds, metadata);
    return { value, cache_status: "live", cache_source: saved.source, cached_at: saved.updated_at };
  } catch (error) {
    if (cached.hit && staleIfErrorSeconds > 0) {
      const ageMs = cached.updated_at ? nowMs() - new Date(cached.updated_at).getTime() : 0;
      if (!ageMs || ageMs <= staleIfErrorSeconds * 1000) {
        return {
          value: cached.value,
          cache_status: "stale-cache",
          cache_source: cached.source,
          cached_at: cached.updated_at,
          error: error.message
        };
      }
    }
    throw error;
  }
}

export async function deleteCachePrefix(prefix) {
  for (const key of [...MEMORY.keys()]) if (key.startsWith(prefix)) MEMORY.delete(key);

  if (canUseLocalFile()) {
    const data = readLocalFile();
    for (const key of Object.keys(data)) if (key.startsWith(prefix)) delete data[key];
    writeLocalFile(data);
  }

  if (SUPABASE_URL && SUPABASE_KEY) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?cache_key=like.${encodeURIComponent(prefix + "*")}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error(`Supabase cache delete failed: ${response.status}`);
  }
}

export function cacheDiagnostics() {
  return {
    mode: cacheMode(),
    memory_entries: MEMORY.size,
    persistent: Boolean(SUPABASE_URL && SUPABASE_KEY) || canUseLocalFile(),
    supabase_configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    table: SUPABASE_URL && SUPABASE_KEY ? TABLE : null
  };
}
