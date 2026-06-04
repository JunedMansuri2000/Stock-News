import type { NormalizedArticle } from "./types";

interface NewsApiArticle {
  source: { id: string | null; name: string | null };
  author: string | null;
  title: string | null;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
  message?: string;
  code?: string;
}

// Domains confirmed to be indexed by NewsAPI with recent articles.
// Tested 2026-06-04: livemint=1469 total / 5 per 25h, businessline=5350 / 8, moneycontrol=3814 / 12.
// ET and Business Standard return 403 on direct RSS; NewsAPI's own crawl of those works fine.
const DOMAIN_BATCHES = [
  { domains: "moneycontrol.com", label: "MoneyControl" },
  { domains: "thehindubusinessline.com", label: "BusinessLine" },
  { domains: "livemint.com", label: "Livemint" },
  // Keyword fallback to catch anything missed by domain queries
  { domains: "", q: "india stock market OR sensex OR nifty OR BSE OR NSE", label: "Keyword" },
];

export async function fetchNewsApi(maxPagesPerBatch = 3): Promise<NormalizedArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) throw new Error("NEWSAPI_KEY is not set");

  const pageSize = 100;
  const from = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

  const articles: NormalizedArticle[] = [];
  const seen = new Set<string>(); // deduplicate across batches

  for (const batch of DOMAIN_BATCHES) {
    for (let page = 1; page <= maxPagesPerBatch; page++) {
      const url = new URL("https://newsapi.org/v2/everything");
      url.searchParams.set("language", "en");
      url.searchParams.set("sortBy", "publishedAt");
      url.searchParams.set("pageSize", String(pageSize));
      url.searchParams.set("page", String(page));
      url.searchParams.set("from", from);
      url.searchParams.set("apiKey", apiKey);

      if (batch.domains) url.searchParams.set("domains", batch.domains);
      if (batch.q) url.searchParams.set("q", batch.q);

      const res = await fetch(url.toString(), { cache: "no-store" });

      if (!res.ok && res.status !== 426) {
        const body = await res.text();
        console.error(`[NewsAPI] (${batch.label}) HTTP ${res.status}: ${body.slice(0, 200)}`);
        break;
      }

      const json: NewsApiResponse = await res.json();

      if (json.status !== "ok") {
        console.warn(`[NewsAPI] (${batch.label}) page=${page} ${json.code}: ${json.message}`);
        break;
      }

      let added = 0;
      for (const a of json.articles ?? []) {
        if (!a.url || a.url.includes("[Removed]")) continue;
        if (!a.title || a.title === "[Removed]") continue;
        if (seen.has(a.url)) continue;
        seen.add(a.url);

        articles.push({
          externalId: `napi_${Buffer.from(a.url).toString("base64").slice(0, 100)}`,
          title: a.title,
          description: a.description ?? null,
          snippet: a.content ? a.content.replace(/\[\+\d+ chars\]$/, "").trim() : null,
          url: a.url,
          imageUrl: a.urlToImage ?? null,
          source: a.source?.name ?? batch.label,
          language: "en",
          keywords: batch.q ?? batch.domains ?? null,
          publishedAt: new Date(a.publishedAt),
        });
        added++;
      }

      console.log(
        `[NewsAPI] (${batch.label}) page=${page} added=${added} total=${json.totalResults}`
      );

      if ((json.articles?.length ?? 0) < pageSize) break;
    }
  }

  return articles;
}
