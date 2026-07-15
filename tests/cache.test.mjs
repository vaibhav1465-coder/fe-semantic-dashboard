import test from "node:test";
import assert from "node:assert/strict";
import { cacheKey, getCache, getOrSetCache, setCache } from "../lib/cache.js";

test("writes and reads the application cache", async () => {
  const key = cacheKey("test-cache", "alpha");
  await setCache(key, { value: 42 }, 60);
  const result = await getCache(key, { allowStale: false });
  assert.equal(result.hit, true);
  assert.equal(result.value.value, 42);
});

test("getOrSetCache avoids a second loader call", async () => {
  const key = cacheKey("test-loader", Date.now());
  let calls = 0;
  const first = await getOrSetCache(key, async () => { calls++; return { ok: true }; }, { ttlSeconds: 60 });
  const second = await getOrSetCache(key, async () => { calls++; return { ok: false }; }, { ttlSeconds: 60 });
  assert.equal(calls, 1);
  assert.equal(first.value.ok, true);
  assert.equal(second.value.ok, true);
  assert.equal(second.cache_status, "cache");
});
