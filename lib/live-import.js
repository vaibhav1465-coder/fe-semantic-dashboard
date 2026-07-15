function balancedArray(source, start) {
  let depth=0, quoted=false, quote="", escaped=false;
  for (let i=start;i<source.length;i++) {
    const c=source[i];
    if (quoted) {
      if (escaped) escaped=false;
      else if (c==='\\') escaped=true;
      else if (c===quote) quoted=false;
      continue;
    }
    if (c==='"' || c==="'") { quoted=true; quote=c; continue; }
    if (c==='[') depth++;
    else if (c===']') {
      depth--;
      if (depth===0) return source.slice(start,i+1);
    }
  }
  return "";
}

export function extractRecommendationsFromHtml(html = "") {
  const patterns = [
    /(?:const|let|var)\s+ALL_DATA\s*=\s*/g,
    /(?:const|let|var)\s+DATA\s*=\s*/g,
    /(?:const|let|var)\s+recommendations\s*=\s*/gi
  ];
  for (const pattern of patterns) {
    pattern.lastIndex=0;
    const match=pattern.exec(html);
    if (!match) continue;
    const start=html.indexOf('[',match.index+match[0].length);
    if (start<0) continue;
    const arrayText=balancedArray(html,start);
    if (!arrayText) continue;
    try {
      const parsed=JSON.parse(arrayText);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {}
  }
  throw new Error("Could not find a JSON recommendation array in the live dashboard HTML");
}
