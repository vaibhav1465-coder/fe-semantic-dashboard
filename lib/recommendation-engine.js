import { isFinancialExpressArticleUrl } from "./article-url.js";

const STOPWORDS = new Set([
  "a","about","after","again","against","all","also","am","an","and","any","are","as","at","be","because","been","before","being","between","both","but","by","can","could","did","do","does","doing","down","during","each","for","from","further","had","has","have","having","he","her","here","hers","herself","him","himself","his","how","i","if","in","into","is","it","its","itself","just","me","more","most","my","myself","no","nor","not","now","of","off","on","once","only","or","other","our","ours","ourselves","out","over","own","same","she","should","so","some","such","than","that","the","their","theirs","them","themselves","then","there","these","they","this","those","through","to","too","under","until","up","very","was","we","were","what","when","where","which","while","who","why","will","with","would","you","your","yours","yourself","yourselves",
  "financial","express","latest","live","update","updates","news","today","india","indian","says","said","new","year","years","report","reports","read","know","explained","details","everything","top","big","key","may","amid","set","gets","get"
]);

const GENERIC_ANCHOR_WORDS = new Set([
  "article","analysis","coverage","development","developments","explainer","growth","investment","latest","news","outlook","policy","report","story","update"
]);

function decodeText(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(token) {
  if (token.length <= 4 || /(sis|ss|us)$/i.test(token)) return token;
  return token
    .replace(/(ies)$/i, "y")
    .replace(/(ing|ers|er|ed|es)$/i, "")
    .replace(/s$/i, "")
    .replace(/(.)\1+$/i, "$1");
}

export function meaningfulTokens(value = "") {
  const clean = decodeText(value).toLowerCase();
  const tokens = clean.match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
  return [...new Set(tokens
    .map(token => token.replace(/^[-']+|[-']+$/g, ""))
    .filter(token => token.length >= 3 && !STOPWORDS.has(token) && !/^\d+$/.test(token))
    .map(stem)
    .filter(token => token.length >= 3 && !STOPWORDS.has(token)))];
}

function intersection(a, b) {
  const right = new Set(b);
  return a.filter(value => right.has(value));
}

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter(value => right.has(value)).length;
  const union = new Set([...left, ...right]).size;
  return union ? shared / union : 0;
}

function overlapRatio(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const shared = intersection(a.map(String), b.map(String)).length;
  return shared / Math.max(1, Math.min(a.length, b.length));
}

function articleSection(url = "") {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.slice(0, 2).join("/").toLowerCase();
  } catch {
    return "";
  }
}

function dateMs(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleCase(value = "") {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function humanList(values = []) {
  const list = values.filter(Boolean);
  if (list.length <= 1) return list[0] || "the same topic";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list.at(-1)}`;
}

function compactTitle(value = "", maxLength = 110) {
  let title = decodeText(value)
    .replace(/^(live|explained|breaking|watch|photos?|video)\s*[:|–—-]\s*/i, "")
    .replace(/\s*[|–—-]\s*financial express\s*$/i, "")
    .trim();
  if (title.length > maxLength) {
    title = title.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
  }
  return title;
}

function originalWords(value = "") {
  return compactTitle(value)
    .replace(/[“”"‘’]/g, "")
    .replace(/[^a-zA-Z0-9&'-]+/g, " ")
    .split(/\s+/)
    .map(word => word.replace(/^[-']+|[-']+$/g, ""))
    .filter(Boolean);
}

function wordStem(word = "") {
  const clean = String(word).toLowerCase().replace(/[^a-z0-9'-]/g, "");
  if (!clean || STOPWORDS.has(clean)) return "";
  return stem(clean);
}

function topicLabel(stemmedTopic, source, target) {
  const words = [...originalWords(target.title), ...originalWords(source.title), ...originalWords(target.description), ...originalWords(source.description)];
  const match = words.find(word => wordStem(word) === stemmedTopic);
  return match ? match.toLowerCase() : stemmedTopic;
}

function scoreAnchorCandidate(words, sharedTopics) {
  const phrase = words.join(" ").replace(/\s+/g, " ").trim();
  if (phrase.length < 12 || phrase.length > 78) return null;

  const stems = words.map(wordStem).filter(Boolean);
  const sharedCount = intersection(stems, sharedTopics).length;
  const meaningfulCount = [...new Set(stems)].length;
  const specificCount = stems.filter(token => !sharedTopics.includes(token) && !GENERIC_ANCHOR_WORDS.has(token)).length;
  const genericCount = stems.filter(token => GENERIC_ANCHOR_WORDS.has(token)).length;
  const stopwordCount = words.filter(word => STOPWORDS.has(word.toLowerCase())).length;

  if (sharedCount < 1 || meaningfulCount < 2) return null;
  if (sharedCount < 2 && specificCount < 1) return null;

  const score = (sharedCount * 14) + (Math.min(meaningfulCount, 5) * 2) + (specificCount * 3)
    - (genericCount * 1.5) - (stopwordCount * 0.8) - (Math.abs(words.length - 4) * 1.4);

  return { phrase, score, sharedCount, meaningfulCount };
}

function buildAnchorText(source, target, sharedTopics) {
  const words = originalWords(target.title);
  if (words.length < 2 || sharedTopics.length < 1) return "";

  const verbLike = new Set([
    "aim","back","become","bring","clear","focus","get","give","lead","move","plan","say","set","take","warn"
  ]);

  const entries = words.map((word, index) => ({
    word,
    index,
    stem: wordStem(word),
    proper: /^[A-Z]/.test(word)
  })).filter(entry => entry.stem);

  const sharedEntries = entries.filter(entry => sharedTopics.includes(entry.stem));
  if (!sharedEntries.length) return "";

  const selected = new Set(sharedEntries.slice(0, 4).map(entry => entry.index));
  const firstSharedIndex = sharedEntries[0].index;

  const nearbyProper = entries
    .filter(entry => entry.proper && entry.index < firstSharedIndex && firstSharedIndex - entry.index <= 3)
    .at(-1);
  if (nearbyProper) selected.add(nearbyProper.index);

  const contextCandidates = entries
    .filter(entry => !selected.has(entry.index))
    .filter(entry => !GENERIC_ANCHOR_WORDS.has(entry.stem))
    .filter(entry => !verbLike.has(entry.stem))
    .filter(entry => entry.word.length >= 4)
    .sort((a, b) => {
      const aDistance = Math.min(...sharedEntries.map(shared => Math.abs(shared.index - a.index)));
      const bDistance = Math.min(...sharedEntries.map(shared => Math.abs(shared.index - b.index)));
      const aEndBonus = a.index >= words.length - 2 ? -5 : 0;
      const bEndBonus = b.index >= words.length - 2 ? -5 : 0;
      const aProperPenalty = a.proper ? 3 : 0;
      const bProperPenalty = b.proper ? 3 : 0;
      return (aDistance + aEndBonus + aProperPenalty) - (bDistance + bEndBonus + bProperPenalty);
    });

  const maximumWords = sharedEntries.length >= 3 ? 5 : sharedEntries.length === 2 ? 4 : 3;
  for (const candidate of contextCandidates) {
    if (selected.size >= maximumWords) break;
    selected.add(candidate.index);
  }

  let anchor = [...selected]
    .sort((a, b) => a - b)
    .map(index => words[index])
    .join(" ")
    .replace(/^(the|a|an|latest|new)\s+/i, "")
    .replace(/\s+(and|or|to|for|with|of)$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (anchor.split(/\s+/).length > 5) {
    anchor = anchor.split(/\s+/).slice(0, 5).join(" ");
  }

  const cleanTitle = compactTitle(target.title).toLowerCase();
  if (!anchor || anchor.toLowerCase() === cleanTitle) return "";
  if (anchor.length < 10 || anchor.length > 70) return "";
  if (meaningfulTokens(anchor).length < 2) return "";
  return anchor;
}

function buildApprovedReason(sharedTopicLabels, target, anchor) {
  if (sharedTopicLabels.length < 2 || !anchor) return "";
  const topics = sharedTopicLabels.slice(0, 3).map(titleCase);
  return `The articles both cover ${humanList(topics)}. The suggested article adds useful context about “${anchor}”, giving readers a clear next step for deeper Financial Express coverage.`;
}

function buildRejectedReason(sharedTopicLabels) {
  if (!sharedTopicLabels.length) return "";
  const topics = sharedTopicLabels.slice(0, 2).map(titleCase);
  return `The articles mention ${humanList(topics)}, but the connection is too broad to recommend as a useful internal link.`;
}

function buildPlacement(sharedTopicLabels) {
  if (!sharedTopicLabels.length) return "";
  const topics = sharedTopicLabels.slice(0, 2).map(titleCase);
  return `Add the link in the paragraph that discusses ${humanList(topics)}.`;
}

function buildScoreExplanation(score, components) {
  return `The ${score}/100 match score combines title similarity (${components.title_similarity}/34), shared title terms (${components.shared_title_terms}/24), description similarity (${components.description_similarity}/16), shared description terms (${components.shared_description_terms}/8), category overlap (${components.category_overlap}/8), tag overlap (${components.tag_overlap}/6), and section relevance (${components.section_relevance}/4).`;
}

function candidateScore(source, target) {
  const sourceTitleTokens = meaningfulTokens(source.title);
  const targetTitleTokens = meaningfulTokens(target.title);
  const sourceDescriptionTokens = meaningfulTokens(source.description);
  const targetDescriptionTokens = meaningfulTokens(target.description);

  const sharedTitle = intersection(sourceTitleTokens, targetTitleTokens);
  const sharedDescription = intersection(sourceDescriptionTokens, targetDescriptionTokens)
    .filter(token => !sharedTitle.includes(token));
  const sharedTopics = [...sharedTitle, ...sharedDescription].slice(0, 6);
  const sharedTopicLabels = sharedTopics.map(topic => topicLabel(topic, source, target));

  const categoryOverlap = overlapRatio(source.categories, target.categories);
  const tagOverlap = overlapRatio(source.tags, target.tags);
  const sectionMatch = articleSection(source.url) && articleSection(source.url) === articleSection(target.url) ? 1 : 0;

  const components = {
    title_similarity: Math.round(jaccard(sourceTitleTokens, targetTitleTokens) * 34),
    shared_title_terms: Math.round(Math.min(sharedTitle.length / 3, 1) * 24),
    description_similarity: Math.round(jaccard(sourceDescriptionTokens, targetDescriptionTokens) * 16),
    shared_description_terms: Math.round(Math.min(sharedDescription.length / 5, 1) * 8),
    category_overlap: Math.round(categoryOverlap * 8),
    tag_overlap: Math.round(tagOverlap * 6),
    section_relevance: Math.round(sectionMatch * 4)
  };

  const score = Math.min(100, Object.values(components).reduce((sum, value) => sum + value, 0));
  const strongContext = sharedTitle.length >= 2 ||
    (sharedTitle.length >= 1 && sharedDescription.length >= 2) ||
    (sharedTopics.length >= 2 && (categoryOverlap > 0 || tagOverlap > 0 || sectionMatch));

  return {
    score,
    components,
    scoreExplanation: buildScoreExplanation(score, components),
    sharedTopics,
    sharedTopicLabels,
    sharedTitle,
    sharedDescription,
    categoryOverlap,
    tagOverlap,
    sectionMatch,
    strongContext
  };
}

function recommendationRecord(source, target, match, status, index) {
  const anchor = buildAnchorText(source, target, match.sharedTopics);
  const reason = status === "Approved"
    ? buildApprovedReason(match.sharedTopicLabels, target, anchor)
    : buildRejectedReason(match.sharedTopicLabels);
  const placement = buildPlacement(match.sharedTopicLabels);

  if (!anchor || !reason || !placement) return null;

  return {
    id: `live-${source.id || "source"}-${target.id || "target"}-${index}`,
    "Source URL": source.url,
    "Source Title": decodeText(source.title),
    "Target URL": target.url,
    "Target Title": decodeText(target.title),
    Status: status,
    "Confidence Score": match.score,
    "Match Score Explanation": match.scoreExplanation,
    "Score Components": match.components,
    Reason: reason,
    "Anchor Text Suggestion": anchor,
    "Link Placement Suggestion": placement,
    "Source Tag": articleSection(source.url) || "Financial Express",
    "Shared Topics": match.sharedTopicLabels.slice(0, 5).map(titleCase),
    "Google Entities": [],
    Entities: [],
    source_date: source.datePublished || source.dateModified || null,
    target_date: target.datePublished || target.dateModified || null,
    source_content_source: source.source || "wordpress_rest",
    target_content_source: target.source || "wordpress_rest",
    source_cache_status: source.cache_status || "live",
    target_cache_status: target.cache_status || "live",
    metadata_status: "complete",
    source_reachable: true,
    target_reachable: true,
    nlp_status: "not_analyzed",
    match_method: "WordPress metadata and semantic term overlap",
    shared_title_terms: match.sharedTitle,
    shared_description_terms: match.sharedDescription
  };
}

export function buildLiveRecommendationDataset(articles = [], options = {}) {
  const sourceLimit = Math.max(1, Math.min(60, Number(options.sourceLimit || 60)));
  const minSuggestions = Math.max(1, Math.min(3, Number(options.minSuggestions || 2)));
  const maxSuggestions = Math.max(minSuggestions, Math.min(3, Number(options.maxSuggestions || 3)));
  const minScore = Math.max(10, Math.min(90, Number(options.minScore || 28)));
  const rejectedFloor = Math.max(8, Math.min(minScore - 1, Number(options.rejectedFloor || 18)));

  let excludedNonArticleUrls = 0;
  const pool = articles
    .filter(article => {
      const valid = article && article.url && article.title && isFinancialExpressArticleUrl(article.url);
      if (article?.url && !valid) excludedNonArticleUrls += 1;
      return valid;
    })
    .map(article => ({
      ...article,
      title: decodeText(article.title),
      description: decodeText(article.description || article.excerpt || ""),
      categories: Array.isArray(article.categories) ? article.categories : [],
      tags: Array.isArray(article.tags) ? article.tags : []
    }))
    .sort((a, b) => dateMs(b.datePublished || b.dateModified) - dateMs(a.datePublished || a.dateModified));

  const items = [];
  const includedSources = [];
  let evaluatedPairs = 0;
  let excludedMissingDetails = 0;
  let excludedWeakMatches = 0;

  for (const source of pool) {
    if (includedSources.length >= sourceLimit) break;
    const sourceTime = dateMs(source.datePublished || source.dateModified);

    const ranked = [];
    for (const target of pool) {
      if (source.url === target.url) continue;
      const targetTime = dateMs(target.datePublished || target.dateModified);
      if (sourceTime && targetTime && targetTime >= sourceTime) continue;

      evaluatedPairs += 1;
      const match = candidateScore(source, target);
      if (!match.strongContext || match.sharedTopics.length < 2) {
        excludedWeakMatches += 1;
        continue;
      }
      ranked.push({ target, match });
    }

    ranked.sort((a, b) => b.match.score - a.match.score || dateMs(b.target.datePublished) - dateMs(a.target.datePublished));

    const approved = [];
    for (const entry of ranked) {
      if (entry.match.score < minScore) continue;
      const record = recommendationRecord(source, entry.target, entry.match, "Approved", approved.length + 1);
      if (!record) {
        excludedMissingDetails += 1;
        continue;
      }
      approved.push(record);
      if (approved.length >= maxSuggestions) break;
    }

    if (approved.length < minSuggestions) continue;

    includedSources.push(source.url);
    items.push(...approved);

    const rejectedEntry = ranked.find(entry => entry.match.score < minScore && entry.match.score >= rejectedFloor);
    if (rejectedEntry) {
      const rejected = recommendationRecord(source, rejectedEntry.target, rejectedEntry.match, "Rejected", 1);
      if (rejected) items.push(rejected);
      else excludedMissingDetails += 1;
    }
  }

  const approvedItems = items.filter(item => item.Status === "Approved");
  const rejectedItems = items.filter(item => item.Status === "Rejected");
  const approvedScores = approvedItems.map(item => Number(item["Confidence Score"] || 0));
  const generatedAt = new Date().toISOString();

  return {
    status: "ok",
    generated_at: generatedAt,
    batch_id: `live-${generatedAt.slice(0, 10).replaceAll("-", "")}`,
    source: "wordpress_rest_live_recommendation_pool",
    recommendation_method: "WordPress metadata and semantic term overlap",
    items,
    summary: {
      total: items.length,
      approved: approvedItems.length,
      rejected: rejectedItems.length,
      sources: includedSources.length,
      requested_sources: sourceLimit,
      min_suggestions_per_source: minSuggestions,
      max_suggestions_per_source: maxSuggestions,
      average_suggestions_per_source: includedSources.length
        ? Number((approvedItems.length / includedSources.length).toFixed(1))
        : 0,
      avg_score: approvedScores.length
        ? Math.round(approvedScores.reduce((sum, score) => sum + score, 0) / approvedScores.length)
        : 0,
      candidate_pool: pool.length,
      evaluated_pairs: evaluatedPairs,
      excluded_non_article_urls: excludedNonArticleUrls,
      excluded_missing_anchor_or_reason: excludedMissingDetails,
      excluded_weak_matches: excludedWeakMatches
    }
  };
}
