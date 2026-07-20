import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnvironment } from "../lib/local-env.js";

import health from "../api/health.js";
import recommendations from "../api/recommendations.js";
import liveRecommendations from "../api/live-recommendations.js";
import actions from "../api/actions.js";
import selfTest from "../api/self-test.js";
import content from "../api/content.js";
import nlp from "../api/nlp.js";
import sources from "../api/sources.js";
import cache from "../api/cache.js";
import cronRefresh from "../api/cron-refresh.js";
import provenance from "../api/provenance.js";
import pairEntities from "../api/pair-entities.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const loadedEnvFiles = loadLocalEnvironment(root);
const handlers = new Map([
  ["/api/health", health],
  ["/api/recommendations", recommendations],
  ["/api/live-recommendations", liveRecommendations],
  ["/api/actions", actions],
  ["/api/self-test", selfTest],
  ["/api/content", content],
  ["/api/nlp", nlp],
  ["/api/sources", sources],
  ["/api/cache", cache],
  ["/api/cron-refresh", cronRefresh],
  ["/api/provenance", provenance],
  ["/api/pair-entities", pairEntities]
]);

function attachHelpers(req, res, url) {
  req.query = Object.fromEntries(url.searchParams.entries());
  res.status = code => { res.statusCode = code; return res; };
  res.json = value => {
    if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(value, null, 2));
    return res;
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  attachHelpers(req, res, url);
  try {
    if (handlers.has(url.pathname)) return await handlers.get(url.pathname)(req, res);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(fs.readFileSync(path.join(root, "index.html")));
    }
    res.status(404).json({ error: "Not found" });
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
    else res.end();
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`FE Semantic operational dashboard: http://localhost:${port}`);
  console.log(`Local environment: ${loadedEnvFiles.length ? loadedEnvFiles.join(", ") : "no .env.local or .env file loaded"}`);
  console.log(`Health: http://localhost:${port}/api/health`);
  console.log(`Live test: http://localhost:${port}/api/self-test?live=1`);
});
