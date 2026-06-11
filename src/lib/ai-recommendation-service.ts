import { prisma } from "./prisma";
import { getAIProvider, getRuleBasedProvider } from "./ai-provider";
import type { StockAnalysisInput, AIRecommendationData, RecommendationCategory } from "@/types/recommendations";

const TOP_AI_STOCKS = 20;      // best 20 by pre-score → AI
const BOTTOM_AI_STOCKS = 20;   // worst 20 by pre-score → AI (confirm Sell/Strong Sell)
const BATCH_SIZE = 10;         // stocks per Ollama request → 40 stocks = 4 calls
const STALE_HOURS = 6;
const NEWS_WINDOW_DAYS = 30;
const STALE_RUNNING_MS = 15 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, (i + 1) * size)
  );
}

// ── Sentiment keyword lists ───────────────────────────────────────────────

const POSITIVE_WORDS = [
  "surge", "rally", "gain", "profit", "growth", "outperform", "upgrade",
  "beat", "strong", "bullish", "buy", "record", "high", "breakout",
  "positive", "rise", "jumped", "soared", "boosted", "expansion",
  "order", "win", "award", "acquisition", "dividend", "revenue",
];

const NEGATIVE_WORDS = [
  "drop", "fall", "loss", "decline", "underperform", "downgrade",
  "miss", "weak", "bearish", "sell", "low", "crash", "slump",
  "plunge", "concern", "risk", "warning", "lawsuit", "fraud",
  "delay", "cancel", "cut", "layoff", "debt", "default",
];

function classifySentiment(title: string): "positive" | "negative" | "neutral" {
  const lower = title.toLowerCase();
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE_WORDS) if (lower.includes(w)) pos++;
  for (const w of NEGATIVE_WORDS) if (lower.includes(w)) neg++;
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

// ── Pre-score calculator ──────────────────────────────────────────────────

function calcTechnicalScore(opp: { opportunityScore: number | null; direction: string | null }): number {
  const base = ((opp.opportunityScore ?? 0) / 100) * 36;
  const dirBonus = opp.direction === "Strong Bullish" ? 4 : opp.direction === "Bullish" ? 2 : 0;
  return Math.min(40, base + dirBonus);
}

function calcSentimentScore(
  positive: number,
  negative: number,
  neutral: number
): { score: number; momentum: number; confidence: number } {
  const total = positive + negative + neutral;
  if (total === 0) return { score: 20, momentum: 0, confidence: 0 };
  const momentum = (positive - negative) / total;
  const confidence = Math.min(1, total / 5);
  const score = (20 + momentum * 20) * confidence + 20 * (1 - confidence);
  return { score: Math.max(0, Math.min(40, score)), momentum, confidence };
}

function calcMomentumScore(changePercent: number | null, rsi: number | null): number {
  let score = 10;
  const chg = changePercent ?? 0;
  const r = rsi ?? 50;

  if (chg > 3) score += 5;
  else if (chg > 1) score += 3;
  else if (chg > 0) score += 1;
  else if (chg < -3) score -= 5;
  else if (chg < -1) score -= 3;
  else if (chg < 0) score -= 1;

  if (r >= 55 && r <= 70) score += 5;
  else if (r >= 50 && r < 55) score += 2;
  else if (r > 70 && r <= 80) score += 1;
  else if (r < 45) score -= 5;
  else if (r < 50) score -= 2;

  return Math.max(0, Math.min(20, score));
}

// ── News matcher ──────────────────────────────────────────────────────────

function articleMatchesStock(
  title: string,
  description: string | null,
  keywords: string | null,
  symbol: string,
  companyName: string
): boolean {
  const symbolClean = symbol.replace(".NS", "").toLowerCase();
  const company = companyName.toLowerCase();
  const companyShort = company.split(" ")[0];
  const text = `${title} ${description ?? ""} ${keywords ?? ""}`.toLowerCase();

  return (
    text.includes(symbolClean) ||
    (companyShort.length >= 4 && text.includes(companyShort)) ||
    text.includes(company.slice(0, Math.min(company.length, 20)))
  );
}

// ── Error classes ──────────────────────────────────────────────────────────

export class RecommendationAlreadyRunningError extends Error {
  constructor() {
    super("Recommendation generation is already in progress");
    this.name = "RecommendationAlreadyRunningError";
  }
}

// ── Main Service ──────────────────────────────────────────────────────────

export class AIRecommendationService {
  static async isRunning(): Promise<boolean> {
    const threshold = new Date(Date.now() - STALE_RUNNING_MS);
    const running = await prisma.aIRecommendationLog.findFirst({
      where: { status: "running", startedAt: { gte: threshold } },
    });
    return running !== null;
  }

  static async isStale(): Promise<boolean> {
    const latest = await prisma.aIRecommendation.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (!latest) return true;
    const ageMs = Date.now() - new Date(latest.createdAt).getTime();
    return ageMs > STALE_HOURS * 60 * 60 * 1000;
  }

  static async getStatus() {
    const [lastLog, totalRecommendations, stale, running, latest] = await Promise.all([
      prisma.aIRecommendationLog.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.aIRecommendation.count(),
      this.isStale(),
      this.isRunning(),
      prisma.aIRecommendation.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return {
      lastLog: lastLog
        ? {
            id: lastLog.id,
            startedAt: lastLog.startedAt.toISOString(),
            completedAt: lastLog.completedAt?.toISOString() ?? null,
            status: lastLog.status,
            stocksAnalyzed: lastLog.stocksAnalyzed,
            recommendationsCreated: lastLog.recommendationsCreated,
            aiStocksProcessed: lastLog.aiStocksProcessed,
            aiProvider: lastLog.aiProvider ?? null,
            modelName: lastLog.modelName ?? null,
            generationMs: lastLog.generationMs ?? null,
            batchCount: lastLog.batchCount ?? null,
            errorMessage: lastLog.errorMessage,
          }
        : null,
      totalRecommendations,
      isRunning: running,
      isStale: stale,
      lastGeneratedAt: latest?.createdAt.toISOString() ?? null,
    };
  }

  // ── Generation entrypoint ─────────────────────────────────────────────

  static async generate(): Promise<{ logId: string }> {
    if (await this.isRunning()) {
      throw new RecommendationAlreadyRunningError();
    }

    const log = await prisma.aIRecommendationLog.create({ data: { status: "running" } });
    console.log(`[AIRecommendation] Started (logId=${log.id})`);

    void this.runGeneration(log.id).catch(console.error);
    return { logId: log.id };
  }

  // ── Core generation pipeline ──────────────────────────────────────────

  private static async runGeneration(logId: string): Promise<void> {
    const t0 = Date.now();

    try {
      // 1. Load stocks + indicators + opportunities
      const stocks = await prisma.stock.findMany({ include: { indicators: true, opportunity: true } });

      // 2. Load all news from last 30 days once
      const cutoff = new Date(Date.now() - NEWS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const allArticles = await prisma.article.findMany({
        where: { publishedAt: { gte: cutoff } },
        select: { title: true, description: true, keywords: true, source: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
      });

      console.log(`[AIRecommendation] ${stocks.length} stocks, ${allArticles.length} articles`);

      // 3. Build pre-scored analysis input for every stock (no AI at this stage)
      const analysisInputs: StockAnalysisInput[] = stocks.map((stock) => {
        const ind = stock.indicators;
        const opp = stock.opportunity;

        const matched = allArticles.filter((a) =>
          articleMatchesStock(a.title, a.description, a.keywords, stock.symbol, stock.companyName)
        );
        const classified = matched.map((a) => ({
          title: a.title,
          source: a.source,
          publishedAt: a.publishedAt.toISOString(),
          sentiment: classifySentiment(a.title),
        }));

        const pos = classified.filter((a) => a.sentiment === "positive").length;
        const neg = classified.filter((a) => a.sentiment === "negative").length;
        const neu = classified.filter((a) => a.sentiment === "neutral").length;

        const { score: sentimentScore, momentum: newsMomentumScore, confidence: newsConfidenceScore } =
          calcSentimentScore(pos, neg, neu);
        const technicalScore = calcTechnicalScore({ opportunityScore: opp?.opportunityScore ?? null, direction: opp?.direction ?? null });
        const momentumScore = calcMomentumScore(stock.changePercent, ind?.rsi ?? null);
        const overall = technicalScore + sentimentScore + momentumScore;

        return {
          symbol: stock.symbol,
          companyName: stock.companyName,
          sector: stock.sector,
          currentPrice: stock.currentPrice,
          changePercent: stock.changePercent,
          marketCap: stock.marketCap,
          volume: stock.volume !== null ? Number(stock.volume) : null,
          week52High: stock.week52High,
          week52Low: stock.week52Low,
          rsi: ind?.rsi ?? null,
          macd: ind?.macd ?? null,
          macdSignal: ind?.macdSignal ?? null,
          sma20: ind?.sma20 ?? null,
          sma50: ind?.sma50 ?? null,
          sma200: ind?.sma200 ?? null,
          adx: ind?.adx ?? null,
          atr: ind?.atr ?? null,
          opportunityScore: opp?.opportunityScore ?? null,
          direction: opp?.direction ?? null,
          momentumScore: opp?.momentumScore ?? null,
          trendScore: opp?.trendScore ?? null,
          volumeScore: opp?.volumeScore ?? null,
          volatilityScore: opp?.volatilityScore ?? null,
          technicalScore: opp?.technicalScore ?? null,
          recentNews: classified,
          positiveNewsCount: pos,
          negativeNewsCount: neg,
          neutralNewsCount: neu,
          newsMomentumScore,
          newsConfidenceScore,
          preScore: { technicalScore, sentimentScore, momentumScore, overall },
        };
      });

      // 4. Split into AI tier (top 20 + bottom 20) and rule-based middle
      const sorted = [...analysisInputs].sort((a, b) => b.preScore.overall - a.preScore.overall);
      const n = sorted.length;
      const topCount = Math.min(TOP_AI_STOCKS, n);
      const bottomCount = Math.min(BOTTOM_AI_STOCKS, Math.max(0, n - topCount));

      const topStocks = sorted.slice(0, topCount);
      const bottomStocks = sorted.slice(n - bottomCount);
      const middleStocks = sorted.slice(topCount, n - bottomCount);
      const aiStocks = [...topStocks, ...bottomStocks]; // 40 stocks

      console.log(
        `[AIRecommendation] AI tier: ${aiStocks.length} (top=${topCount} bottom=${bottomCount}), rule-based: ${middleStocks.length}`
      );

      // 5. Clear stale recommendations
      await prisma.aIRecommendation.deleteMany({});

      const aiProvider = getAIProvider();
      const ruleProvider = getRuleBasedProvider();
      const providerInfo = aiProvider.getProviderInfo();

      let aiProcessed = 0;
      let batchCount = 0;
      let totalCreated = 0;

      // 6. Process AI stocks in batches of BATCH_SIZE (10)
      //    → 40 stocks / 10 = 4 Ollama calls
      const batches = chunk(aiStocks, BATCH_SIZE);
      console.log(`[AIRecommendation] Processing ${batches.length} AI batches via ${providerInfo.name}/${providerInfo.model}`);

      for (const batch of batches) {
        batchCount++;
        try {
          const results = await aiProvider.generateBatch(batch);
          for (let i = 0; i < batch.length; i++) {
            const input = batch[i];
            const result = results[i];
            await this.saveRecommendation(input, result, true);
            aiProcessed++;
            totalCreated++;
            console.log(`[AIRecommendation] Batch${batchCount}: ${input.symbol} → ${result.recommendation} (${result.confidenceScore}%)`);
          }
        } catch (err) {
          console.error(`[AIRecommendation] Batch ${batchCount} failed, using rule-based:`, err instanceof Error ? err.message : err);
          for (const input of batch) {
            const result = ruleProvider.generateRecommendationSync(input);
            await this.saveRecommendation(input, result, false);
            totalCreated++;
          }
        }
      }

      // 7. Process middle 60 with rule-based (zero AI cost)
      for (const input of middleStocks) {
        const result = ruleProvider.generateRecommendationSync(input);
        await this.saveRecommendation(input, result, false);
        totalCreated++;
      }

      const generationMs = Date.now() - t0;

      await prisma.aIRecommendationLog.update({
        where: { id: logId },
        data: {
          status: "success",
          completedAt: new Date(),
          stocksAnalyzed: stocks.length,
          recommendationsCreated: totalCreated,
          aiStocksProcessed: aiProcessed,
          aiProvider: providerInfo.name,
          modelName: providerInfo.model,
          generationMs,
          batchCount,
        },
      });

      // Bust widget caches so the next page load shows fresh recommendations immediately
      try {
        const { revalidateTag } = await import("next/cache");
        revalidateTag("recommendations");
      } catch {
        // Outside Next.js context — safe to ignore
      }

      console.log(
        `[AIRecommendation] Done — total=${totalCreated} aiProcessed=${aiProcessed} batches=${batchCount} ` +
        `provider=${providerInfo.name}/${providerInfo.model} duration=${generationMs}ms`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.aIRecommendationLog
        .update({ where: { id: logId }, data: { status: "failed", completedAt: new Date(), errorMessage: msg, generationMs: Date.now() - t0 } })
        .catch(console.error);
      console.error("[AIRecommendation] Generation failed:", msg);
    }
  }

  private static async saveRecommendation(
    input: StockAnalysisInput,
    result: {
      recommendation: RecommendationCategory;
      confidenceScore: number;
      bullCase: string;
      bearCase: string;
      risks: string[];
      catalysts: string[];
      summary: string;
      holdingPeriod: string;
    },
    aiGenerated: boolean
  ): Promise<void> {
    await prisma.aIRecommendation.create({
      data: {
        symbol: input.symbol,
        recommendation: result.recommendation,
        confidenceScore: result.confidenceScore,
        overallScore: input.preScore.overall,
        technicalScore: input.preScore.technicalScore,
        sentimentScore: input.preScore.sentimentScore,
        momentumScore: input.preScore.momentumScore,
        bullCase: result.bullCase,
        bearCase: result.bearCase,
        risks: JSON.stringify(result.risks),
        catalysts: JSON.stringify(result.catalysts),
        summary: result.summary,
        holdingPeriod: result.holdingPeriod,
        positiveNewsCount: input.positiveNewsCount,
        negativeNewsCount: input.negativeNewsCount,
        neutralNewsCount: input.neutralNewsCount,
        newsMomentumScore: input.newsMomentumScore,
        newsConfidenceScore: input.newsConfidenceScore,
        aiGenerated,
      },
    });
  }

  // ── Query ─────────────────────────────────────────────────────────────

  static async getRecommendations(opts?: {
    recommendation?: string;
    minConfidence?: number;
    sector?: string;
    holdingPeriod?: string;
    sort?: string;
    limit?: number;
  }): Promise<AIRecommendationData[]> {
    const limit = Math.min(opts?.limit ?? 100, 200);
    const validSorts = ["overallScore", "confidenceScore", "technicalScore", "sentimentScore", "momentumScore"];
    const sortBy = validSorts.includes(opts?.sort ?? "") ? opts!.sort! : "overallScore";

    const latestBatch = await prisma.aIRecommendation.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (!latestBatch) return [];

    const batchCutoff = new Date(latestBatch.createdAt.getTime() - 60_000);

    const rows = await prisma.aIRecommendation.findMany({
      where: {
        createdAt: { gte: batchCutoff },
        ...(opts?.recommendation && opts.recommendation !== "All" ? { recommendation: opts.recommendation } : {}),
        ...(opts?.minConfidence ? { confidenceScore: { gte: opts.minConfidence } } : {}),
      },
      orderBy: { [sortBy]: "desc" },
      take: limit,
    });

    const symbols = rows.map((r) => r.symbol);
    const stocks = await prisma.stock.findMany({
      where: { symbol: { in: symbols } },
      select: { symbol: true, companyName: true, sector: true, currentPrice: true, changePercent: true, marketCap: true },
    });
    const stockMap = new Map(stocks.map((s) => [s.symbol, s]));

    let result: AIRecommendationData[] = rows.map((r) => {
      const stock = stockMap.get(r.symbol);
      return {
        id: r.id,
        symbol: r.symbol,
        companyName: stock?.companyName ?? r.symbol,
        sector: stock?.sector ?? null,
        currentPrice: stock?.currentPrice ?? null,
        changePercent: stock?.changePercent ?? null,
        marketCap: stock?.marketCap ?? null,
        recommendation: r.recommendation as RecommendationCategory,
        confidenceScore: r.confidenceScore,
        overallScore: r.overallScore,
        technicalScore: r.technicalScore,
        sentimentScore: r.sentimentScore,
        momentumScore: r.momentumScore,
        bullCase: r.bullCase,
        bearCase: r.bearCase,
        risks: this.parseJsonArray(r.risks),
        catalysts: this.parseJsonArray(r.catalysts),
        summary: r.summary,
        holdingPeriod: r.holdingPeriod,
        positiveNewsCount: r.positiveNewsCount,
        negativeNewsCount: r.negativeNewsCount,
        neutralNewsCount: r.neutralNewsCount,
        newsMomentumScore: r.newsMomentumScore,
        newsConfidenceScore: r.newsConfidenceScore,
        aiGenerated: r.aiGenerated,
        createdAt: r.createdAt.toISOString(),
      };
    });

    if (opts?.sector && opts.sector !== "All") {
      result = result.filter((r) => r.sector === opts.sector);
    }
    if (opts?.holdingPeriod && opts.holdingPeriod !== "All") {
      result = result.filter((r) =>
        r.holdingPeriod.toLowerCase().includes(opts.holdingPeriod!.toLowerCase())
      );
    }

    return result;
  }

  private static parseJsonArray(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
