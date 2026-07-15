import { probeContentSources } from "../lib/content-sources.js";
import { googleNlpConfigured, testGoogleNlp } from "../lib/google-nlp.js";
import { cacheDiagnostics } from "../lib/cache.js";

const strict = process.argv.includes("--strict");
const skipNlp = process.argv.includes("--skip-nlp");

console.log("Testing Financial Express content sources...");
const sources = await probeContentSources({ force: true });
console.log(JSON.stringify(sources, null, 2));

let failed = false;
if (sources.status !== "live") {
  console.warn(`WARN External content sources are ${sources.status}; static cache remains available.`);
  if (strict) failed = true;
}

if (!skipNlp) {
  if (!googleNlpConfigured()) {
    console.log("WARN Google NLP credentials are not configured.");
    if (strict) failed = true;
  } else {
    console.log("Testing live Google NLP...");
    try {
      console.log(JSON.stringify(await testGoogleNlp(), null, 2));
    } catch (error) {
      console.error(`FAIL Google NLP: ${error.message}`);
      failed = true;
    }
  }
}

console.log("Cache:", JSON.stringify(cacheDiagnostics(), null, 2));
if (failed) {
  console.error("Strict live source test did not pass. Configure the exact FE WordPress/RSS endpoints and Google credentials, then run again.");
  process.exit(1);
}
console.log("PASS live source test complete");
