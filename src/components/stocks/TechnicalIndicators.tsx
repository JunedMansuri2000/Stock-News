import type { TechnicalIndicatorData } from "@/types/stocks";

function fmt(n: number | null, d = 2) {
  return n !== null ? n.toFixed(d) : "—";
}

function RsiGauge({ rsi }: { rsi: number | null }) {
  if (rsi === null) return <span className="text-gray-400">—</span>;
  const pct = Math.min(Math.max(rsi, 0), 100);
  const color =
    rsi < 30 ? "bg-red-500" :
    rsi > 70 ? "bg-emerald-500" :
    "bg-yellow-400";

  const label =
    rsi < 30 ? "Oversold" :
    rsi > 70 ? "Overbought" :
    "Neutral";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-gray-900 dark:text-white">{rsi.toFixed(1)}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
          rsi < 30 ? "bg-red-100 text-red-700" :
          rsi > 70 ? "bg-emerald-100 text-emerald-700" :
          "bg-yellow-100 text-yellow-700"
        }`}>{label}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>0</span>
        <span>30</span>
        <span>70</span>
        <span>100</span>
      </div>
    </div>
  );
}

function SmaRow({ label, sma, price }: { label: string; sma: number | null; price: number | null }) {
  const signal =
    sma !== null && price !== null
      ? price > sma ? "ABOVE" : "BELOW"
      : null;

  return (
    <div className="flex items-center justify-between py-2 text-sm border-b border-gray-100 last:border-0 dark:border-gray-700">
      <span className="text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900 dark:text-white">₹{fmt(sma)}</span>
        {signal && (
          <span className={`text-xs font-medium ${signal === "ABOVE" ? "text-emerald-600" : "text-red-600"}`}>
            {signal}
          </span>
        )}
      </div>
    </div>
  );
}

interface TechnicalIndicatorsProps {
  indicators: TechnicalIndicatorData;
  currentPrice: number | null;
}

export function TechnicalIndicators({ indicators, currentPrice }: TechnicalIndicatorsProps) {
  const macdSignal =
    indicators.macd !== null && indicators.macdSignal !== null
      ? indicators.macd > indicators.macdSignal ? "Bullish" : "Bearish"
      : null;

  return (
    <div className="space-y-4">
      {/* Moving Averages */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Moving Averages</h3>
        <SmaRow label="SMA 20"  sma={indicators.sma20}  price={currentPrice} />
        <SmaRow label="SMA 50"  sma={indicators.sma50}  price={currentPrice} />
        <SmaRow label="SMA 200" sma={indicators.sma200} price={currentPrice} />
      </div>

      {/* RSI */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">RSI (14)</h3>
        <RsiGauge rsi={indicators.rsi} />
      </div>

      {/* MACD */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MACD (12,26,9)</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">MACD Line</span>
            <span className="font-medium dark:text-white">{fmt(indicators.macd, 4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Signal Line</span>
            <span className="font-medium dark:text-white">{fmt(indicators.macdSignal, 4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Histogram</span>
            <span className={`font-medium ${
              (indicators.macdHist ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
            }`}>{fmt(indicators.macdHist, 4)}</span>
          </div>
          {macdSignal && (
            <div className={`mt-2 rounded-lg p-2 text-center text-xs font-semibold ${
              macdSignal === "Bullish"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30"
                : "bg-red-50 text-red-700 dark:bg-red-900/30"
            }`}>
              {macdSignal} Signal
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
