const STOP_WORDS = new Set([
  "the","a","an","and","or","but","for","to","of","in","on","at","by","with","from","as","is","are","was","were","be","been","being","this","that","these","those","how","why","what","when","where","who","all","you","need","know","says","report"
]);

export function cleanWords(text = "") {
  return String(text)
    .replace(/&[^;]+;/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .map(x => x.trim())
    .filter(Boolean);
}

export function generateAnchorText(targetTitle = "", entities = []) {
  const entity = (entities || []).find(x => cleanWords(x).length >= 2 && cleanWords(x).length <= 8);
  if (entity) return cleanWords(entity).slice(0, 8).join(" ");

  const words = cleanWords(targetTitle)
    .filter(w => !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 8);
  return words.join(" ") || "related coverage";
}

export function generatePlacementSuggestion(sourceBody = "", targetTitle = "", entities = []) {
  const keywords = new Set([
    ...cleanWords(targetTitle),
    ...(entities || []).flatMap(cleanWords)
  ].map(x => x.toLowerCase()).filter(x => !STOP_WORDS.has(x)));

  const sentences = String(sourceBody || "").split(/(?<=[.!?])\s+/).filter(s => s.length > 35);
  let best = "";
  let bestScore = 0;
  for (const sentence of sentences) {
    const sentenceWords = new Set(cleanWords(sentence).map(x => x.toLowerCase()));
    const score = [...keywords].filter(k => sentenceWords.has(k)).length;
    if (score > bestScore) { best = sentence; bestScore = score; }
  }
  if (best) return `Place the link after: “${best.slice(0, 220)}${best.length > 220 ? "…" : ""}”`;
  const topic = generateAnchorText(targetTitle, entities);
  return `Place the link in the paragraph discussing ${topic}.`;
}
