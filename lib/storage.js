import fs from "node:fs";
import path from "node:path";

const TABLE = process.env.SUPABASE_ACTIONS_TABLE || "fe_editorial_actions";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function localPath() {
  if (process.env.VERCEL) return "/tmp/fe-editorial-actions.json";
  return path.join(process.cwd(), "data", "editorial-actions.local.json");
}
function readLocal() {
  const p = localPath();
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p,"utf8")); } catch { return {}; }
}
function writeLocal(data) {
  fs.writeFileSync(localPath(), JSON.stringify(data,null,2));
}

export function persistenceMode() {
  if (SUPABASE_URL && SUPABASE_KEY) return "supabase";
  return process.env.VERCEL ? "ephemeral" : "local-file";
}

export async function listActions() {
  if (persistenceMode() === "supabase") {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=record_key,action,editor_name,notes,updated_at&order=updated_at.desc`, {
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
    });
    if (!response.ok) throw new Error(`Supabase read failed: ${response.status}`);
    return response.json();
  }
  return Object.values(readLocal());
}

export async function saveAction(input) {
  const item = {
    record_key:String(input.record_key || "").slice(0,1500),
    action:String(input.action || "").slice(0,30),
    editor_name:String(input.editor_name || "").slice(0,120),
    notes:String(input.notes || "").slice(0,1000),
    updated_at:new Date().toISOString()
  };
  if (!item.record_key || !["used","ignore","reject","cleared"].includes(item.action)) {
    throw new Error("Invalid editorial action payload");
  }
  if (persistenceMode() === "supabase") {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=record_key`, {
      method:"POST",
      headers:{
        apikey:SUPABASE_KEY,
        Authorization:`Bearer ${SUPABASE_KEY}`,
        "Content-Type":"application/json",
        Prefer:"resolution=merge-duplicates,return=representation"
      },
      body:JSON.stringify(item)
    });
    if (!response.ok) throw new Error(`Supabase write failed: ${response.status}`);
    const rows = await response.json();
    return rows[0] || item;
  }
  const data = readLocal();
  if (item.action === "cleared") delete data[item.record_key];
  else data[item.record_key] = item;
  writeLocal(data);
  return item;
}
