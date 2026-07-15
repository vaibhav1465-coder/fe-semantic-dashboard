function decodeHtml(text = "") {
  return text.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
}
function findInJson(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findInJson(item); if (found) return found; }
    return null;
  }
  if (typeof value === "object") {
    const type = value["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.some(x => ["Article","NewsArticle","ReportageNewsArticle"].includes(x))) return value;
    for (const item of Object.values(value)) { const found = findInJson(item); if (found) return found; }
  }
  return null;
}
export function parseArticleMetadata(html = "") {
  let article = null;
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try { article = findInJson(JSON.parse(decodeHtml(match[1].trim()))); if (article) break; } catch {}
  }
  const meta = (name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,"i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,"i");
    return decodeHtml((html.match(re1)||html.match(re2)||[])[1] || "");
  };
  return {
    title: article?.headline || meta("og:title") || "",
    datePublished: article?.datePublished || meta("article:published_time") || "",
    dateModified: article?.dateModified || meta("article:modified_time") || "",
    articleBody: article?.articleBody || "",
    description: article?.description || meta("description") || meta("og:description") || ""
  };
}
export async function fetchArticleMetadata(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {headers:{"User-Agent":"Mozilla/5.0 FE-Semantic-Linking/1.0"},signal:controller.signal,redirect:"follow"});
    if (!response.ok) return {reachable:false,status:response.status};
    const html = await response.text();
    return {reachable:true,status:response.status,...parseArticleMetadata(html)};
  } finally { clearTimeout(timer); }
}
