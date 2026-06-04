import { prisma } from "./prisma";
import { fetchNewsApi } from "./sources/newsapi";
import { fetchMoneyControl } from "./sources/moneycontrol";
import type { NormalizedArticle } from "./sources/types";

export interface SyncResult {
  syncLogId: string;
  articlesFetched: number;
  articlesCreated: number;
  durationMs: number;
}

export interface SyncStatus {
  lastSync: {
    id: string;
    startedAt: Date;
    completedAt: Date | null;
    status: string;
    articlesFetched: number;
    articlesCreated: number;
    errorMessage: string | null;
  } | null;
  totalArticles: number;
  isRunning: boolean;
}

// ---------------------------------------------------------------------------
// NewsSyncService
// All business logic here — can be triggered from:
//   - POST /api/news/sync  (manual button or external HTTP call)
//   - Vercel Cron  (vercel.json crons entry)
//   - GitHub Actions  (.github/workflows/news-sync.yml)
//   - VPS crontab  (curl -X POST http://localhost:3000/api/news/sync)
// ---------------------------------------------------------------------------

export class NewsSyncService {
  private static readonly STALE_RUNNING_MS = 5 * 60 * 1000;

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  static async sync(): Promise<SyncResult> {
    if (await this.isRunning()) {
      throw new SyncAlreadyRunningError("A sync is already in progress");
    }

    const log = await prisma.syncLog.create({ data: { status: "running" } });
    const startedAt = Date.now();
    console.log(`[NewsSyncService] Sync started (logId=${log.id})`);

    try {
      // Fetch from all sources in parallel; a failure in one doesn't abort the other
      const [newsApiResult, moneycontrolResult] = await Promise.allSettled([
        fetchNewsApi(3),     // 3 queries × up to 3 pages × 100 articles
        fetchMoneyControl(), // 5 RSS feeds
      ]);

      const articles: NormalizedArticle[] = [];

      if (newsApiResult.status === "fulfilled") {
        articles.push(...newsApiResult.value);
        console.log(`[NewsSyncService] NewsAPI: ${newsApiResult.value.length} articles fetched`);
      } else {
        console.error(
          "[NewsSyncService] NewsAPI fetch FAILED:",
          newsApiResult.reason instanceof Error
            ? newsApiResult.reason.message
            : newsApiResult.reason
        );
      }

      if (moneycontrolResult.status === "fulfilled") {
        articles.push(...moneycontrolResult.value);
        console.log(
          `[NewsSyncService] RSS feeds: ${moneycontrolResult.value.length} articles fetched`
        );
      } else {
        console.error(
          "[NewsSyncService] RSS feeds FAILED:",
          moneycontrolResult.reason instanceof Error
            ? moneycontrolResult.reason.message
            : moneycontrolResult.reason
        );
      }

      const created = await this.saveArticles(articles);

      // Purge articles older than 30 days
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { count: deleted } = await prisma.article.deleteMany({
        where: { publishedAt: { lt: cutoff } },
      });
      if (deleted > 0) {
        console.log(`[NewsSyncService] Purged ${deleted} articles older than 30 days`);
      }

      const completedLog = await prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: "success",
          completedAt: new Date(),
          articlesFetched: articles.length,
          articlesCreated: created,
        },
      });

      const durationMs = Date.now() - startedAt;
      console.log(
        `[NewsSyncService] Done — fetched=${articles.length} created=${created} duration=${durationMs}ms`
      );

      return { syncLogId: completedLog.id, articlesFetched: articles.length, articlesCreated: created, durationMs };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await prisma.syncLog.update({
        where: { id: log.id },
        data: { status: "failed", completedAt: new Date(), errorMessage },
      });
      console.error("[NewsSyncService] Sync failed:", errorMessage);
      throw err;
    }
  }

  static async getStatus(): Promise<SyncStatus> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [lastSync, totalArticles, running] = await Promise.all([
      prisma.syncLog.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.article.count({ where: { publishedAt: { gte: since24h } } }),
      this.isRunning(),
    ]);
    return { lastSync, totalArticles, isRunning: running };
  }

  static async isRunning(): Promise<boolean> {
    const staleThreshold = new Date(Date.now() - this.STALE_RUNNING_MS);
    const running = await prisma.syncLog.findFirst({
      where: { status: "running", startedAt: { gte: staleThreshold } },
    });
    return running !== null;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private static async saveArticles(articles: NormalizedArticle[]): Promise<number> {
    let created = 0;

    for (const article of articles) {
      // Skip articles with no valid date or clearly malformed URLs
      if (isNaN(article.publishedAt.getTime())) continue;
      if (!article.url.startsWith("http")) continue;

      // Deduplicate: same externalId OR same URL means we already have it
      const exists = await prisma.article.findFirst({
        where: { OR: [{ externalId: article.externalId }, { url: article.url }] },
        select: { id: true },
      });

      if (!exists) {
        await prisma.article.create({ data: article });
        created++;
      }
    }

    return created;
  }
}

export class SyncAlreadyRunningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncAlreadyRunningError";
  }
}
