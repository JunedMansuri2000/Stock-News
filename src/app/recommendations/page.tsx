import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { AIRecommendationService } from "@/lib/ai-recommendation-service";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import { RecommendationFilters } from "@/components/recommendations/RecommendationFilters";
import { GenerateButton } from "@/components/recommendations/GenerateButton";
import {
  TopStrongBuyWidget,
  TopBuyWidget,
  TopMomentumRecsWidget,
  TopNewsDrivenWidget,
  HighConfidenceWidget,
} from "@/components/recommendations/RecommendationWidgets";
import type { RecommendationCategory } from "@/types/recommendations";

export const dynamic = "force-dynamic";

function ProviderBadge({
  provider,
  model,
  generationMs,
  batchCount,
}: {
  provider: string | null;
  model: string | null;
  generationMs: number | null;
  batchCount: number | null;
}) {
  if (!provider) return null;
  const isOllama = provider === "ollama";
  const durationSec = generationMs ? (generationMs / 1000).toFixed(1) : null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${isOllama ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {isOllama ? "Ollama" : provider === "openai" ? "OpenAI" : provider}
        {model && ` · ${model}`}
      </span>
      {durationSec && (
        <span className="text-gray-400">{durationSec}s generation</span>
      )}
      {batchCount !== null && batchCount > 0 && (
        <span className="text-gray-400">{batchCount} AI {batchCount === 1 ? "batch" : "batches"}</span>
      )}
    </div>
  );
}

const RECOMMENDATION_COUNTS: RecommendationCategory[] = [
  "Strong Buy", "Buy", "Accumulate", "Hold", "Reduce", "Sell", "Strong Sell",
];

const COUNT_COLORS: Record<RecommendationCategory, string> = {
  "Strong Buy":  "border-emerald-700 bg-emerald-700 text-white",
  "Buy":         "border-emerald-400 bg-emerald-50 text-emerald-800",
  "Accumulate":  "border-green-300 bg-green-50 text-green-800",
  "Hold":        "border-gray-300 bg-gray-50 text-gray-700",
  "Reduce":      "border-orange-300 bg-orange-50 text-orange-800",
  "Sell":        "border-red-400 bg-red-50 text-red-800",
  "Strong Sell": "border-red-700 bg-red-700 text-white",
};

function WidgetSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 animate-pulse">
      <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <div className="h-3 w-4 bg-gray-100 rounded" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-gray-100 rounded w-1/3" />
            <div className="h-2.5 bg-gray-50 rounded w-1/2" />
          </div>
          <div className="h-6 w-16 bg-gray-100 rounded-full" />
        </div>
      ))}
    </div>
  );
}

interface PageProps {
  searchParams: {
    recommendation?: string;
    minConfidence?: string;
    sector?: string;
    holdingPeriod?: string;
    sort?: string;
  };
}

export default async function RecommendationsPage({ searchParams }: PageProps) {
  const [status, sectors] = await Promise.all([
    AIRecommendationService.getStatus(),
    prisma.stock.findMany({
      where: { sector: { not: null } },
      select: { sector: true },
      distinct: ["sector"],
      orderBy: { sector: "asc" },
    }).then((rows) => rows.map((r) => r.sector!).filter(Boolean)),
  ]);

  const recommendations = await AIRecommendationService.getRecommendations({
    recommendation: searchParams.recommendation,
    minConfidence: searchParams.minConfidence ? Number(searchParams.minConfidence) : undefined,
    sector: searchParams.sector,
    holdingPeriod: searchParams.holdingPeriod,
    sort: searchParams.sort,
    limit: 100,
  });

  // Summary counts by recommendation category (from full latest batch)
  const allRecs = await AIRecommendationService.getRecommendations({ limit: 200 });
  const categoryCounts = RECOMMENDATION_COUNTS.reduce(
    (acc, cat) => {
      acc[cat] = allRecs.filter((r) => r.recommendation === cat).length;
      return acc;
    },
    {} as Record<RecommendationCategory, number>
  );

  const aiCount = allRecs.filter((r) => r.aiGenerated).length;
  const avgScore = allRecs.length
    ? Math.round(allRecs.reduce((s, r) => s + r.overallScore, 0) / allRecs.length)
    : 0;
  const avgConfidence = allRecs.length
    ? Math.round(allRecs.reduce((s, r) => s + r.confidenceScore, 0) / allRecs.length)
    : 0;

  const hasData = allRecs.length > 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">AI Recommendations</h1>
            <span className="rounded-full bg-violet-100 border border-violet-200 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
              Flagship
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            AI-powered buy/sell recommendations for all Nifty 100 stocks — combining technicals, news, and price momentum.
          </p>
        </div>
        <GenerateButton
          isRunning={status.isRunning}
          isStale={status.isStale}
          lastGeneratedAt={status.lastGeneratedAt}
        />
      </div>

      {/* Provider info */}
      {status.lastLog && (
        <ProviderBadge
          provider={status.lastLog.aiProvider}
          model={status.lastLog.modelName}
          generationMs={status.lastLog.generationMs}
          batchCount={status.lastLog.batchCount}
        />
      )}

      {/* Status notice */}
      {status.isRunning && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Generating recommendations in background — this takes 2-5 minutes. Refresh the page when complete.
        </div>
      )}

      {!hasData && !status.isRunning && (
        <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 px-6 py-10 text-center">
          <p className="text-gray-700 font-semibold">No recommendations yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            Click <strong>Generate Now</strong> above to create AI recommendations for all Nifty 100 stocks.
          </p>
          <p className="mt-3 text-xs text-gray-400">
            Requires: stock data (run Stocks sync first). Ollama must be running at{" "}
            <code className="bg-gray-100 rounded px-1">OLLAMA_HOST</code> with model{" "}
            <code className="bg-gray-100 rounded px-1">OLLAMA_MODEL</code> pulled.
            Without Ollama the engine falls back to deterministic rule-based scoring automatically.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {RECOMMENDATION_COUNTS.map((cat) => (
              <div key={cat} className={`rounded-xl border p-3 ${COUNT_COLORS[cat]}`}>
                <p className="text-xl font-bold">{categoryCounts[cat]}</p>
                <p className="text-[11px] font-medium mt-0.5 opacity-80 leading-tight">{cat}</p>
              </div>
            ))}
          </div>

          {/* Meta stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-center">
              <p className="text-2xl font-bold text-violet-800">{aiCount}</p>
              <p className="text-xs text-violet-600 mt-0.5">AI-Analyzed Stocks</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-800">{avgScore}</p>
              <p className="text-xs text-blue-600 mt-0.5">Avg Overall Score</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center">
              <p className="text-2xl font-bold text-indigo-800">{avgConfidence}%</p>
              <p className="text-xs text-indigo-600 mt-0.5">Avg Confidence</p>
            </div>
          </div>

          {/* Dashboard widgets */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Picks</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <Suspense fallback={<WidgetSkeleton />}>
                <TopStrongBuyWidget />
              </Suspense>
              <Suspense fallback={<WidgetSkeleton />}>
                <TopBuyWidget />
              </Suspense>
              <Suspense fallback={<WidgetSkeleton />}>
                <HighConfidenceWidget />
              </Suspense>
              <Suspense fallback={<WidgetSkeleton />}>
                <TopMomentumRecsWidget />
              </Suspense>
              <Suspense fallback={<WidgetSkeleton />}>
                <TopNewsDrivenWidget />
              </Suspense>
            </div>
          </div>

          {/* Filters */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">All Recommendations</h2>
            <RecommendationFilters sectors={sectors} />
          </div>

          {/* Grid */}
          {recommendations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
              <p className="text-gray-500 font-medium">No recommendations match your filters.</p>
              <p className="mt-1 text-sm text-gray-400">Try adjusting the recommendation category or confidence threshold.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                Showing <strong>{recommendations.length}</strong> stocks
                {searchParams.recommendation && searchParams.recommendation !== "All"
                  ? ` — ${searchParams.recommendation}`
                  : ""}
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {recommendations.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} />
                ))}
              </div>
            </>
          )}

          {/* Methodology note */}
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-5 py-4 text-sm text-gray-500 space-y-2">
            <p>
              <strong className="text-gray-700">How it works:</strong> All 100 stocks are pre-scored using a weighted
              formula — <span className="font-medium text-blue-700">40% Technical</span> (opportunity score, RSI, MACD, trend),{" "}
              <span className="font-medium text-violet-700">40% News Sentiment</span> (last 30 days),{" "}
              <span className="font-medium text-amber-700">20% Price Momentum</span>.
              The <strong>top 20 and bottom 20 stocks</strong> by pre-score are sent to{" "}
              <strong className="text-orange-700">Ollama</strong> in batches of 10 (4 requests total).
              The remaining 60 stocks use deterministic rule-based scoring. Recommendations refresh every 6 hours.
            </p>
            <p>
              <strong className="text-gray-700">Setup:</strong> Set <code className="bg-gray-100 rounded px-1">OLLAMA_HOST</code> (default:{" "}
              <code className="bg-gray-100 rounded px-1">http://localhost:11434</code>) and{" "}
              <code className="bg-gray-100 rounded px-1">OLLAMA_MODEL</code> (default:{" "}
              <code className="bg-gray-100 rounded px-1">qwen3:8b</code>) in your{" "}
              <code className="bg-gray-100 rounded px-1">.env.local</code>. Run{" "}
              <code className="bg-gray-100 rounded px-1">ollama pull qwen3:8b</code> if the model isn&apos;t downloaded yet.
              Without Ollama, all stocks fall back to rule-based scoring automatically.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
