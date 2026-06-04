import type { TradeDirection, RiskLevel } from "@/types/stocks";

const DIRECTION_STYLES: Record<TradeDirection, string> = {
  "Strong Bullish": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Bullish":        "bg-green-100 text-green-800 border-green-200",
  "Neutral":        "bg-gray-100 text-gray-700 border-gray-200",
  "Bearish":        "bg-orange-100 text-orange-800 border-orange-200",
  "Strong Bearish": "bg-red-100 text-red-800 border-red-200",
};

const DIRECTION_DOT: Record<TradeDirection, string> = {
  "Strong Bullish": "bg-emerald-500",
  "Bullish":        "bg-green-500",
  "Neutral":        "bg-gray-400",
  "Bearish":        "bg-orange-500",
  "Strong Bearish": "bg-red-500",
};

const RISK_STYLES: Record<RiskLevel, string> = {
  Low:    "bg-blue-50 text-blue-700 border-blue-200",
  Medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  High:   "bg-red-50 text-red-700 border-red-200",
};

export function DirectionBadge({ direction }: { direction: TradeDirection | null }) {
  if (!direction) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${DIRECTION_STYLES[direction]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DIRECTION_DOT[direction]}`} />
      {direction}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return <span className="text-gray-400 text-xs">—</span>;
  const style = RISK_STYLES[risk as RiskLevel] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
      {risk}
    </span>
  );
}

export function ScoreBar({ score, max = 100 }: { score: number | null; max?: number }) {
  if (score === null) return <span className="text-gray-400 text-xs">—</span>;
  const pct = Math.min(Math.max((score / max) * 100, 0), 100);
  const color =
    pct >= 75 ? "bg-emerald-500" :
    pct >= 55 ? "bg-green-400" :
    pct >= 35 ? "bg-yellow-400" :
    pct >= 15 ? "bg-orange-400" :
    "bg-red-500";

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-800 w-6 text-right">{Math.round(score)}</span>
    </div>
  );
}

export function ScoreCircle({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400">—</span>;
  const color =
    score >= 75 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    score >= 55 ? "text-green-600 bg-green-50 border-green-200" :
    score >= 35 ? "text-yellow-600 bg-yellow-50 border-yellow-200" :
    score >= 15 ? "text-orange-600 bg-orange-50 border-orange-200" :
    "text-red-600 bg-red-50 border-red-200";

  return (
    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold text-sm ${color}`}>
      {Math.round(score)}
    </div>
  );
}
