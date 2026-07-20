const NON_ARTICLE_PATHS = [
  "/author/",
  "/authors/",
  "/category/",
  "/tag/",
  "/topic/",
  "/syndication/",
  "/feed/",
  "/shorts/",
  "/videos/",
  "/video/",
  "/photos/",
  "/photo-gallery/",
  "/web-stories/",
  "/podcast/",
  "/podcasts/"
];

export function isFinancialExpressArticleUrl(value = "") {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "financialexpress.com") return false;

    const pathname = url.pathname.replace(/\/{2,}/g, "/").toLowerCase();
    if (NON_ARTICLE_PATHS.some(segment => pathname.includes(segment))) return false;

    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return false;

    const last = parts.at(-1) || "";
    return /(?:^|-)\d{6,}$/.test(last);
  } catch {
    return false;
  }
}
