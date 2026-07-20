import fs from "node:fs";
import path from "node:path";

function parseLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separator = trimmed.indexOf("=");
  if (separator <= 0) return null;
  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

export function loadLocalEnvironment(rootPath = process.cwd()) {
  const loadedFiles = [];
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(rootPath, filename);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const entry = parseLine(line);
      if (!entry || process.env[entry.key] !== undefined) continue;
      process.env[entry.key] = entry.value;
    }
    loadedFiles.push(filename);
  }
  return loadedFiles;
}
