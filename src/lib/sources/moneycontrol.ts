import type { NormalizedArticle } from "./types";

// Confirmed-working Indian financial news RSS feeds.
// ET and Business Standard block server-side requests (403). These all return 200.
const FEEDS = [
  // Livemint — 35 articles each, highly reliable
  { url: "https://www.livemint.com/rss/markets", label: "Livemint Markets" },
  { url: "https://www.livemint.com/rss/companies", label: "Livemint Companies" },
  // NDTV Profit via FeedBurner — 20 articles
  { url: "https://feeds.feedburner.com/ndtvprofit-latest", label: "NDTV Profit" },
  // The Hindu BusinessLine — 8 articles
  { url: "https://www.thehindubusinessline.com/markets/?service=rss", label: "BusinessLine Markets" },
  // MoneyControl — only latestnews and business endpoints return 200 server-side
  { url: "https://www.moneycontrol.com/rss/latestnews.xml", label: "MC Latest" },
  { url: "https://www.moneycontrol.com/rss/business.xml", label: "MC Business" },
];

// ---------------------------------------------------------------------------
// Minimal RSS parser — handles CDATA sections, attribute-less tags
// ---------------------------------------------------------------------------

function tagContent(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    "i"
  );
  const m = xml.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

function extractImageUrl(itemXml: string): string | null {
  // <enclosure url="..." type="image/..."/>
  const enc = itemXml.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image/);
  if (enc) return enc[1];

  // <media:content url="..." medium="image"/>
  const media = itemXml.match(/<media:content[^>]+url="([^"]+)"/);
  if (media) return media[1];

  // <media:thumbnail url="..."/>
  const thumb = itemXml.match(/<media:thumbnail[^>]+url="([^"]+)"/);
  if (thumb) return thumb[1];

  return null;
}

function parseItems(xml: string) {
  const results: {
    guid: string;
    title: string;
    link: string;
    description: string;
    pubDate: string;
    imageUrl: string | null;
  }[] = [];

  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const item = m[1];
    const link = tagContent(item, "link") || tagContent(item, "guid");
    const guid = tagContent(item, "guid") || link;
    if (!link) continue;
    results.push({
      guid,
      title: tagContent(item, "title"),
      link,
      description: tagContent(item, "description"),
      pubDate: tagContent(item, "pubDate"),
      imageUrl: extractImageUrl(item),
    });
  }

  return results;
}

async function fetchFeed(feedUrl: string, label: string): Promise<NormalizedArticle[]> {
  const res = await fetch(feedUrl, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Referer: "https://www.moneycontrol.com/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
    },
  });

  if (!res.ok) {
    throw new Error(`MoneyControl RSS (${label}) responded with ${res.status}`);
  }

  const xml = await res.text();
  const items = parseItems(xml);

  const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return items
    .map((item): NormalizedArticle | null => {
      let publishedAt: Date;
      try {
        publishedAt = new Date(item.pubDate);
        if (isNaN(publishedAt.getTime())) publishedAt = new Date();
      } catch {
        publishedAt = new Date();
      }

      // Discard articles older than 30 days
      if (publishedAt < cutoff30d) return null;

      return {
        externalId: `rss_${Buffer.from(item.guid).toString("base64").slice(0, 96)}`,
        title: item.title,
        description: item.description || null,
        snippet: null,
        url: item.link,
        imageUrl: item.imageUrl,
        source: `MoneyControl · ${label}`,
        language: "en",
        keywords: null,
        publishedAt,
      };
    })
    .filter((a): a is NormalizedArticle => a !== null);
}

export async function fetchMoneyControl(): Promise<NormalizedArticle[]> {
  const results = await Promise.allSettled(
    FEEDS.map((f) => fetchFeed(f.url, f.label))
  );

  const articles: NormalizedArticle[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      articles.push(...r.value);
    } else {
      console.warn("[MoneyControl] Feed failed:", r.reason);
    }
  }

  // Deduplicate by URL within this batch (same story can appear in multiple feeds)
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}
