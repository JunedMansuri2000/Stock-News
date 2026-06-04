import type { TechnicalIndicatorData } from "@/types/stocks";

function fmt(n: number | null, d = 2) {
  return n !== null ? n.toFixed(d) : "—";
}

function RsiGauge({ rsi }: { rsi: number | null }) {
  if (rsi === null) return <span className="text-gray-400">—</span>;
  const pct = Math.min(Math.max(rsi, 0), 100);
  const color =
    rsi < 30  ? "bg-red-500" :
    rsi > 70  ? "bg-emerald-500" :
    rsi >= 55 ? "bg-green-400" :
    "bg-yellow-400";

  const label =
    rsi < 30 ? "Oversold" :
    rsi > 80 ? "Overbought" :
    rsi > 70 ? "Strong" :
    rsi >= 55 ? "Bullish" :
    rsi >= 45 ? "Neutral" : "Bearish";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-gray-900">{rsi.toFixed(1)}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
          rsi < 30  ? "bg-red-100 text-red-700" :
          rsi > 70  ? "bg-emerald-100 text-emerald-700" :
          rsi >= 55 ? "bg-green-100 text-green-700" :
          "bg-yellow-100 text-yellow-700"
        }`}>{label}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>0</span><span>30</span><span>55</span><span>70</span><span>100</span>
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
    <div className="flex items-center justify-between py-2 text-sm border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900">₹{fmt(sma)}</span>
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

  const bbWidthPct =
    indicators.bollingerUpper && indicators.bollingerLower && indicators.bollingerMiddle && indicators.bollingerMiddle > 0
      ? ((indicators.bollingerUpper - indicators.bollingerLower) / indicators.bollingerMiddle * 100).toFixed(1)
      : null;

  const bbPosition =
    currentPrice && indicators.bollingerUpper && indicators.bollingerLower
      ? currentPrice > indicators.bollingerUpper ? "Above Upper" :
        currentPrice < indicators.bollingerLower ? "Below Lower" :
        currentPrice > (indicators.bollingerMiddle ?? 0) ? "Upper Half" : "Lower Half"
      : null;

  const adxLabel =
    indicators.adx === null ? null :
    indicators.adx >= 40 ? "Very Strong" :
    indicators.adx >= 25 ? "Strong" :
    indicators.adx >= 15 ? "Weak" : "No Trend";

  return (
    <div className="space-y-4">
      {/* Moving Averages */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Moving Averages</h3>
        <SmaRow label="EMA 20"  sma={indicators.ema20}  price={currentPrice} />
        <SmaRow label="SMA 20"  sma={indicators.sma20}  price={currentPrice} />
        <SmaRow label="SMA 50"  sma={indicators.sma50}  price={currentPrice} />
        <SmaRow label="SMA 200" sma={indicators.sma200} price={currentPrice} />
      </div>

      {/* RSI */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">RSI (14)</h3>
        <RsiGauge rsi={indicators.rsi} />
        <p className="mt-2 text-xs text-gray-400">Sweet spot for swing trades: 55–75</p>
      </div>

      {/* MACD */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">MACD (12,26,9)</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">MACD Line</span>
            <span className="font-medium">{fmt(indicators.macd, 4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Signal Line</span>
            <span className="font-medium">{fmt(indicators.macdSignal, 4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Histogram</span>
            <span className={`font-medium ${(indicators.macdHist ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fmt(indicators.macdHist, 4)}
            </span>
          </div>
          {macdSignal && (
            <div className={`mt-2 rounded-lg p-2 text-center text-xs font-semibold ${
              macdSignal === "Bullish"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}>
              {macdSignal} Signal
            </div>
          )}
        </div>
      </div>

      {/* Bollinger Bands */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Bollinger Bands (20, 2σ)</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Upper Band</span>
            <span className="font-medium">₹{fmt(indicators.bollingerUpper)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Middle Band</span>
            <span className="font-medium">₹{fmt(indicators.bollingerMiddle)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Lower Band</span>
            <span className="font-medium">₹{fmt(indicators.bollingerLower)}</span>
          </div>
          {bbWidthPct && (
            <div className="flex justify-between">
              <span className="text-gray-500">Band Width</span>
              <span className={`font-medium ${parseFloat(bbWidthPct) > 5 ? "text-orange-600" : "text-gray-700"}`}>
                {bbWidthPct}%
              </span>
            </div>
          )}
          {bbPosition && (
            <div className={`mt-2 rounded-lg p-2 text-center text-xs font-semibold ${
              bbPosition === "Above Upper" ? "bg-orange-50 text-orange-700" :
              bbPosition === "Below Lower" ? "bg-red-50 text-red-700" :
              bbPosition === "Upper Half"  ? "bg-emerald-50 text-emerald-700" :
              "bg-gray-50 text-gray-600"
            }`}>
              Price: {bbPosition}
            </div>
          )}
        </div>
      </div>

      {/* ATR + ADX */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">ATR (14) — Volatility</h3>
          <p className="text-2xl font-bold text-gray-900">
            {indicators.atr !== null ? `₹${indicators.atr.toFixed(2)}` : "—"}
          </p>
          {indicators.atr && currentPrice && currentPrice > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {((indicators.atr / currentPrice) * 100).toFixed(2)}% of price
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">ADX (14) — Trend Strength</h3>
          <p className="text-2xl font-bold text-gray-900">
            {indicators.adx !== null ? indicators.adx.toFixed(1) : "—"}
          </p>
          {adxLabel && (
            <p className={`text-xs font-medium mt-1 ${
              indicators.adx! >= 25 ? "text-emerald-600" : "text-gray-400"
            }`}>
              {adxLabel}
            </p>
          )}
        </div>
      </div>

      {/* Volume RS */}
      {indicators.volumeRs !== null && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Volume Relative Strength</h3>
          <div className="flex items-end gap-3">
            <span className={`text-2xl font-bold ${
              indicators.volumeRs >= 1.5 ? "text-emerald-600" :
              indicators.volumeRs >= 1.0 ? "text-gray-900" : "text-red-600"
            }`}>
              {indicators.volumeRs.toFixed(2)}x
            </span>
            <span className="text-sm text-gray-500 pb-0.5">vs 20-day average</span>
          </div>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                indicators.volumeRs >= 1.5 ? "bg-emerald-500" :
                indicators.volumeRs >= 1.0 ? "bg-blue-400" : "bg-red-400"
              }`}
              style={{ width: `${Math.min(indicators.volumeRs * 40, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>0x</span><span>1x avg</span><span>1.5x</span><span>2.5x+</span>
          </div>
        </div>
      )}
    </div>
  );
}
