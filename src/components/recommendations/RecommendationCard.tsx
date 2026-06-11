import type { AIRecommendationData } from "@/types/recommendations";
import { RecommendationBadge } from "./RecommendationBadge";

function fmt(n: number | null, decimals = 2): string {
  return n !== null ? n.toFixed(decimals) : "—";
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{value.toFixed(0)}</span>
    </div>
  );
}

function SentimentDots({ pos, neg, neu }: { pos: number; neg: number; neu: number }) {
  const total = pos + neg + neu;
  if (total === 0) return <span className="text-xs text-gray-400">No news</span>;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {pos > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />+{pos}
        </span>
      )}
      {neg > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />−{neg}
        </span>
      )}
      {neu > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />{neu}
        </span>
      )}
    </div>
  );
}

export function RecommendationCard({ rec }: { rec: AIRecommendationData }) {
  const sym = rec.symbol.replace(".NS", "");
  const chgPos = (rec.changePercent ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-base">{sym}</span>
            {rec.aiGenerated && (
              <span className="text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5">
                AI
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{rec.companyName}</p>
          {rec.sector && <p className="text-[11px] text-gray-400 mt-0.5">{rec.sector}</p>}
        </div>
        <RecommendationBadge recommendation={rec.recommendation} size="md" />
      </div>

      {/* Price + confidence */}
      <div className="px-4 py-3 flex items-center justify-between gap-4 bg-gray-50/50">
        <div>
          <p className="text-lg font-bold text-gray-900">₹{fmt(rec.currentPrice)}</p>
          <p className={`text-xs font-semibold ${chgPos ? "text-emerald-600" : "text-red-600"}`}>
            {chgPos ? "+" : ""}{fmt(rec.changePercent)}% today
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-xl font-bold text-gray-900">{rec.confidenceScore.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-gray-400">Confidence</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">{rec.overallScore.toFixed(0)}</p>
          <p className="text-xs text-gray-400">Score /100</p>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-sm text-gray-700 leading-relaxed">{rec.summary}</p>
      </div>

      {/* Bull / Bear */}
      <div className="grid grid-cols-2 gap-0 border-t border-gray-100">
        <div className="px-4 py-3 border-r border-gray-100">
          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">Bull Case</p>
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{rec.bullCase}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-1">Bear Case</p>
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{rec.bearCase}</p>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="px-4 py-3 border-t border-gray-100 space-y-2">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Score Breakdown</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24">Technical (40%)</span>
            <ScoreBar value={rec.technicalScore} max={40} color="bg-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24">Sentiment (40%)</span>
            <ScoreBar value={rec.sentimentScore} max={40} color="bg-violet-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24">Momentum (20%)</span>
            <ScoreBar value={rec.momentumScore} max={20} color="bg-amber-500" />
          </div>
        </div>
      </div>

      {/* News + holding period */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">News (30d)</p>
          <SentimentDots pos={rec.positiveNewsCount} neg={rec.negativeNewsCount} neu={rec.neutralNewsCount} />
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Holding Period</p>
          <p className="text-xs font-medium text-gray-700">{rec.holdingPeriod}</p>
        </div>
      </div>

      {/* Catalysts */}
      {rec.catalysts.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">Key Catalysts</p>
          <ul className="space-y-1">
            {rec.catalysts.slice(0, 3).map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {rec.risks.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-1.5">Key Risks</p>
          <ul className="space-y-1">
            {rec.risks.slice(0, 3).map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
