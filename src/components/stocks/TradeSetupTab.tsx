import type { TechnicalIndicatorData, OpportunityData, TradeDirection } from "@/types/stocks";
import { DirectionBadge, RiskBadge, ScoreBar, ScoreCircle } from "@/components/opportunities/DirectionBadge";

function fmt(n: number | null, d = 2) {
  return n !== null ? n.toFixed(d) : "—";
}
function fmtPrice(n: number | null) {
  return n !== null ? `₹${n.toFixed(2)}` : "—";
}

function InfoRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${accent ?? "text-gray-900"}`}>{value}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

interface TradeSetupTabProps {
  opportunity: OpportunityData | null;
  indicators: TechnicalIndicatorData | null;
  currentPrice: number | null;
}

export function TradeSetupTab({ opportunity, indicators, currentPrice }: TradeSetupTabProps) {
  if (!opportunity && !indicators) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
        Trade setup will appear after the first stock sync.
      </div>
    );
  }

  const rsi = indicators?.rsi ?? null;
  const macd = indicators?.macd ?? null;
  const macdSig = indicators?.macdSignal ?? null;
  const adx = indicators?.adx ?? null;
  const atr = indicators?.atr ?? null;
  const volumeRs = indicators?.volumeRs ?? null;
  const bbUpper = indicators?.bollingerUpper ?? null;
  const bbLower = indicators?.bollingerLower ?? null;
  const bbMiddle = indicators?.bollingerMiddle ?? null;

  const rsiLabel =
    rsi === null ? "—" :
    rsi >= 80 ? "Overbought" :
    rsi >= 70 ? "Strong" :
    rsi >= 55 ? "Bullish" :
    rsi >= 45 ? "Neutral" :
    rsi >= 30 ? "Bearish" : "Oversold";

  const macdLabel =
    macd !== null && macdSig !== null
      ? macd > macdSig ? "Bullish crossover" : "Bearish crossover"
      : "—";

  const adxLabel =
    adx === null ? "—" :
    adx >= 40 ? "Very Strong Trend" :
    adx >= 25 ? "Strong Trend" :
    adx >= 15 ? "Weak Trend" : "No Trend";

  const volLabel =
    volumeRs === null ? "—" :
    volumeRs >= 2.0 ? `${volumeRs.toFixed(1)}x — Surge` :
    volumeRs >= 1.5 ? `${volumeRs.toFixed(1)}x — High` :
    volumeRs >= 1.0 ? `${volumeRs.toFixed(1)}x — Normal` :
    `${volumeRs.toFixed(1)}x — Low`;

  const bbWidthPct =
    bbUpper && bbLower && bbMiddle && bbMiddle > 0
      ? ((bbUpper - bbLower) / bbMiddle * 100).toFixed(1)
      : null;

  const atrPct =
    atr && currentPrice && currentPrice > 0
      ? ((atr / currentPrice) * 100).toFixed(2)
      : null;

  return (
    <div className="space-y-4">
      {/* Opportunity Score hero */}
      {opportunity && (
        <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <ScoreCircle score={opportunity.opportunityScore} />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Opportunity Score</p>
                <DirectionBadge direction={opportunity.direction as TradeDirection | null} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RiskBadge risk={opportunity.riskLevel} />
              {opportunity.holdingPeriod && (
                <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-0.5 text-xs font-medium text-blue-700">
                  {opportunity.holdingPeriod}
                </span>
              )}
            </div>
          </div>

          {/* Sub-scores */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Momentum",   value: opportunity.momentumScore },
              { label: "Trend",      value: opportunity.trendScore },
              { label: "Volume",     value: opportunity.volumeScore },
              { label: "Volatility", value: opportunity.volatilityScore },
              { label: "Technical",  value: opportunity.technicalScore },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-white border border-gray-100 p-3">
                <p className="text-xs text-gray-400 mb-1.5">{s.label}</p>
                <ScoreBar score={s.value} max={20} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Why this setup */}
      <TechnicalReasonsBlock
        opportunity={opportunity}
        indicators={indicators}
        currentPrice={currentPrice}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Trend Analysis */}
        <Panel title="Trend Analysis">
          <InfoRow label="Price vs SMA20"
            value={indicators?.sma20 && currentPrice
              ? currentPrice > indicators.sma20 ? "Above (Bullish)" : "Below (Bearish)"
              : "—"}
            accent={indicators?.sma20 && currentPrice
              ? currentPrice > indicators.sma20 ? "text-emerald-600" : "text-red-600"
              : undefined}
          />
          <InfoRow label="SMA20 vs SMA50"
            value={indicators?.sma20 && indicators?.sma50
              ? indicators.sma20 > indicators.sma50 ? "Uptrend" : "Downtrend"
              : "—"}
            accent={indicators?.sma20 && indicators?.sma50
              ? indicators.sma20 > indicators.sma50 ? "text-emerald-600" : "text-red-600"
              : undefined}
          />
          <InfoRow label="SMA50 vs SMA200"
            value={indicators?.sma50 && indicators?.sma200
              ? indicators.sma50 > indicators.sma200 ? "Golden Cross" : "Death Cross"
              : "—"}
            accent={indicators?.sma50 && indicators?.sma200
              ? indicators.sma50 > indicators.sma200 ? "text-emerald-600" : "text-red-600"
              : undefined}
          />
          <InfoRow label="ADX (Trend Strength)" value={adx ? `${adx.toFixed(1)} — ${adxLabel}` : "—"} />
          <InfoRow label="EMA 20" value={fmtPrice(indicators?.ema20 ?? null)} />
        </Panel>

        {/* Momentum */}
        <Panel title="Momentum">
          <InfoRow
            label="RSI (14)"
            value={rsi ? `${rsi.toFixed(1)} — ${rsiLabel}` : "—"}
            accent={
              rsi !== null
                ? rsi >= 55 && rsi <= 75 ? "text-emerald-600"
                : rsi < 45 ? "text-red-600"
                : rsi > 75 ? "text-orange-600"
                : "text-gray-900"
              : undefined
            }
          />
          <InfoRow label="MACD Signal" value={macdLabel}
            accent={macd !== null && macdSig !== null
              ? macd > macdSig ? "text-emerald-600" : "text-red-600"
              : undefined}
          />
          <InfoRow label="MACD Line"   value={fmt(macd, 4)} />
          <InfoRow label="Signal Line" value={fmt(macdSig, 4)} />
          <InfoRow label="Histogram"   value={fmt(indicators?.macdHist ?? null, 4)}
            accent={(indicators?.macdHist ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}
          />
        </Panel>

        {/* Volatility */}
        <Panel title="Volatility">
          <InfoRow label="ATR (14)" value={atr ? `₹${atr.toFixed(2)} (${atrPct}%)` : "—"} />
          <InfoRow label="BB Upper"  value={fmtPrice(bbUpper)} />
          <InfoRow label="BB Middle" value={fmtPrice(bbMiddle)} />
          <InfoRow label="BB Lower"  value={fmtPrice(bbLower)} />
          <InfoRow label="BB Width"  value={bbWidthPct ? `${bbWidthPct}%` : "—"} />
        </Panel>

        {/* Volume */}
        <Panel title="Volume">
          <InfoRow label="Relative Volume"
            value={volumeRs ? volLabel : "—"}
            accent={
              volumeRs !== null
                ? volumeRs >= 1.5 ? "text-emerald-600"
                : volumeRs >= 1.0 ? "text-gray-900"
                : "text-red-500"
              : undefined
            }
          />
          {volumeRs !== null && (
            <div className="pt-2">
              <div className="text-xs text-gray-400 mb-1">Vs 20-day average</div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${volumeRs >= 1.5 ? "bg-emerald-500" : volumeRs >= 1.0 ? "bg-blue-400" : "bg-red-400"}`}
                  style={{ width: `${Math.min(volumeRs * 40, 100)}%` }}
                />
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Trade Levels */}
      {opportunity && (
        <Panel title="Trade Levels">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <LevelCard label="Entry Zone Low"  value={fmtPrice(opportunity.entryZoneLow)}  color="bg-blue-50 border-blue-200 text-blue-800" />
            <LevelCard label="Entry Zone High" value={fmtPrice(opportunity.entryZoneHigh)} color="bg-blue-50 border-blue-200 text-blue-800" />
            <LevelCard label="Stop Loss"       value={fmtPrice(opportunity.stopLoss)}       color="bg-red-50 border-red-200 text-red-800" />
            <LevelCard label="Target 1"        value={fmtPrice(opportunity.target1)}        color="bg-emerald-50 border-emerald-200 text-emerald-800" />
            <LevelCard label="Target 2"        value={fmtPrice(opportunity.target2)}        color="bg-emerald-50 border-emerald-300 text-emerald-900" />
          </div>
        </Panel>
      )}

      {/* Greeks placeholder */}
      <Panel title="Options Greeks">
        <div className="py-4 text-center text-sm text-gray-400">
          <p className="font-medium text-gray-500 mb-1">Greeks data not yet available</p>
          <p className="text-xs">
            Implement an{" "}
            <code className="bg-gray-100 px-1 rounded">OptionsDataProvider</code> to enable
            live Delta, Gamma, Theta, Vega, and IV data.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 opacity-40">
            {["Δ Delta", "Γ Gamma", "Θ Theta", "ν Vega", "IV", "OI"].map((g) => (
              <div key={g} className="rounded border border-dashed border-gray-300 py-2 text-xs text-gray-500">
                {g}
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <p className="text-right text-xs text-gray-400">
        Scores recalculated on each sync. Not financial advice.
      </p>
    </div>
  );
}

function LevelCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${color}`}>
      <p className="text-xs opacity-70 mb-1">{label}</p>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}

type SignalType = "bullish" | "bearish" | "neutral";

interface Signal {
  type: SignalType;
  text: string;
}

function buildSignals(
  indicators: TechnicalIndicatorData | null,
  currentPrice: number | null,
  direction: string | null
): Signal[] {
  const signals: Signal[] = [];
  if (!indicators) return signals;

  const p   = currentPrice;
  const s20 = indicators.sma20;
  const s50 = indicators.sma50;
  const s200= indicators.sma200;
  const e20 = indicators.ema20;
  const rsi = indicators.rsi;
  const macd= indicators.macd;
  const sig = indicators.macdSignal;
  const hist= indicators.macdHist;
  const adx = indicators.adx;
  const vrs = indicators.volumeRs;
  const atr = indicators.atr;
  const bbU = indicators.bollingerUpper;
  const bbM = indicators.bollingerMiddle;
  const bbL = indicators.bollingerLower;

  // Price vs moving averages
  if (p && s20) {
    if (p > s20)
      signals.push({ type: "bullish", text: `Price ₹${p.toFixed(0)} is above SMA20 (₹${s20.toFixed(0)}) — short-term trend is up.` });
    else
      signals.push({ type: "bearish", text: `Price ₹${p.toFixed(0)} is below SMA20 (₹${s20.toFixed(0)}) — short-term trend is down.` });
  }

  if (p && e20) {
    if (p > e20)
      signals.push({ type: "bullish", text: `Price is above EMA20 (₹${e20.toFixed(0)}) — momentum-weighted trend is bullish.` });
    else
      signals.push({ type: "bearish", text: `Price is below EMA20 (₹${e20.toFixed(0)}) — momentum-weighted trend is bearish.` });
  }

  if (s20 && s50) {
    if (s20 > s50)
      signals.push({ type: "bullish", text: `SMA20 (₹${s20.toFixed(0)}) is above SMA50 (₹${s50.toFixed(0)}) — medium-term uptrend intact.` });
    else
      signals.push({ type: "bearish", text: `SMA20 (₹${s20.toFixed(0)}) has crossed below SMA50 (₹${s50.toFixed(0)}) — medium-term trend turning bearish.` });
  }

  if (s50 && s200) {
    if (s50 > s200)
      signals.push({ type: "bullish", text: `Golden Cross confirmed — SMA50 (₹${s50.toFixed(0)}) is above SMA200 (₹${s200.toFixed(0)}), signalling a long-term bull trend.` });
    else
      signals.push({ type: "bearish", text: `Death Cross in play — SMA50 (₹${s50.toFixed(0)}) is below SMA200 (₹${s200.toFixed(0)}), a long-term bearish signal.` });
  }

  // RSI
  if (rsi !== null) {
    if (rsi >= 55 && rsi <= 75)
      signals.push({ type: "bullish", text: `RSI at ${rsi.toFixed(1)} is in the bullish sweet spot (55–75) — strong momentum without being overbought.` });
    else if (rsi > 75 && rsi <= 85)
      signals.push({ type: "neutral", text: `RSI at ${rsi.toFixed(1)} is elevated and approaching overbought territory — watch for pullback.` });
    else if (rsi > 85)
      signals.push({ type: "bearish", text: `RSI at ${rsi.toFixed(1)} is overbought — high risk of a short-term reversal or consolidation.` });
    else if (rsi >= 45 && rsi < 55)
      signals.push({ type: "neutral", text: `RSI at ${rsi.toFixed(1)} is neutral — no strong directional momentum yet.` });
    else if (rsi >= 30 && rsi < 45)
      signals.push({ type: "bearish", text: `RSI at ${rsi.toFixed(1)} is in bearish territory — selling pressure is dominant.` });
    else if (rsi < 30)
      signals.push({ type: "neutral", text: `RSI at ${rsi.toFixed(1)} is oversold — potential for a short-term bounce, but trend remains weak.` });
  }

  // MACD
  if (macd !== null && sig !== null) {
    if (macd > sig)
      signals.push({ type: "bullish", text: `MACD (${macd.toFixed(3)}) is above the signal line (${sig.toFixed(3)}) — bullish momentum crossover active.` });
    else
      signals.push({ type: "bearish", text: `MACD (${macd.toFixed(3)}) is below the signal line (${sig.toFixed(3)}) — bearish momentum crossover active.` });

    if (hist !== null) {
      if (hist > 0)
        signals.push({ type: "bullish", text: `MACD histogram is positive (${hist.toFixed(3)}) — bullish momentum is accelerating.` });
      else if (hist < 0)
        signals.push({ type: "bearish", text: `MACD histogram is negative (${hist.toFixed(3)}) — bearish momentum is accelerating.` });
    }
  }

  // ADX
  if (adx !== null) {
    if (adx >= 40)
      signals.push({ type: "bullish", text: `ADX at ${adx.toFixed(1)} indicates a very strong trend — high conviction move underway.` });
    else if (adx >= 25)
      signals.push({ type: "bullish", text: `ADX at ${adx.toFixed(1)} confirms a strong directional trend — suitable for swing entries.` });
    else if (adx >= 15)
      signals.push({ type: "neutral", text: `ADX at ${adx.toFixed(1)} shows a weak trend — price may be ranging or consolidating.` });
    else
      signals.push({ type: "neutral", text: `ADX at ${adx.toFixed(1)} indicates no clear trend — avoid directional trades until trend strengthens.` });
  }

  // Volume
  if (vrs !== null) {
    if (vrs >= 2.0)
      signals.push({ type: "bullish", text: `Volume is ${vrs.toFixed(1)}x the 20-day average — significant surge suggesting institutional interest.` });
    else if (vrs >= 1.5)
      signals.push({ type: "bullish", text: `Volume is ${vrs.toFixed(1)}x above average — above-normal activity supports the current move.` });
    else if (vrs >= 1.0)
      signals.push({ type: "neutral", text: `Volume is roughly in line with the 20-day average (${vrs.toFixed(1)}x) — move is not yet volume-confirmed.` });
    else
      signals.push({ type: "bearish", text: `Volume is below average (${vrs.toFixed(1)}x) — low conviction, current move may lack follow-through.` });
  }

  // Bollinger Bands
  if (p && bbU && bbM && bbL) {
    const bbWidth = ((bbU - bbL) / bbM * 100);
    if (p > bbU)
      signals.push({ type: "neutral", text: `Price has broken above the upper Bollinger Band (₹${bbU.toFixed(0)}) — extended move, possible reversion risk.` });
    else if (p > bbM)
      signals.push({ type: "bullish", text: `Price is in the upper half of the Bollinger Bands (above ₹${bbM.toFixed(0)}) — bullish bias within the band.` });
    else if (p < bbL)
      signals.push({ type: "neutral", text: `Price is below the lower Bollinger Band (₹${bbL.toFixed(0)}) — oversold stretch, watch for mean reversion.` });
    else
      signals.push({ type: "bearish", text: `Price is in the lower half of the Bollinger Bands (below ₹${bbM.toFixed(0)}) — bearish bias within the band.` });

    if (bbWidth > 5)
      signals.push({ type: "bullish", text: `Bollinger Band width at ${bbWidth.toFixed(1)}% — bands are expanding, indicating increasing volatility and a developing trend.` });
    else
      signals.push({ type: "neutral", text: `Bollinger Bands are narrow (${bbWidth.toFixed(1)}% width) — price is squeezing, a breakout move may be imminent.` });
  }

  // ATR
  if (atr && p && p > 0) {
    const atrPct = (atr / p) * 100;
    if (atrPct >= 3)
      signals.push({ type: "neutral", text: `ATR is ${atrPct.toFixed(1)}% of price — high daily range stock, suitable for short 2–3 day holds with wider stops.` });
    else if (atrPct >= 1.5)
      signals.push({ type: "neutral", text: `ATR is ${atrPct.toFixed(1)}% of price — healthy volatility for a 3–5 day swing trade.` });
    else
      signals.push({ type: "neutral", text: `ATR is ${atrPct.toFixed(1)}% of price — low volatility, may need a longer holding period for meaningful gains.` });
  }

  return signals;
}

function TechnicalReasonsBlock({
  opportunity,
  indicators,
  currentPrice,
}: {
  opportunity: OpportunityData | null;
  indicators: TechnicalIndicatorData | null;
  currentPrice: number | null;
}) {
  const signals = buildSignals(indicators, currentPrice, opportunity?.direction ?? null);
  if (signals.length === 0) return null;

  const direction = opportunity?.direction as TradeDirection | null;

  const headerColor =
    direction === "Strong Bullish" ? "from-emerald-50 border-emerald-200" :
    direction === "Bullish"        ? "from-green-50 border-green-200" :
    direction === "Bearish"        ? "from-orange-50 border-orange-200" :
    direction === "Strong Bearish" ? "from-red-50 border-red-200" :
    "from-gray-50 border-gray-200";

  const bullish = signals.filter(s => s.type === "bullish");
  const bearish = signals.filter(s => s.type === "bearish");
  const neutral = signals.filter(s => s.type === "neutral");

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${headerColor} to-white p-5 shadow-sm`}>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Why this setup?</h3>
        {direction && <DirectionBadge direction={direction} />}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bullish.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              Bullish signals ({bullish.length})
            </p>
            <ul className="space-y-1.5">
              {bullish.map((s, i) => (
                <li key={i} className="text-xs text-gray-700 leading-relaxed pl-3 border-l-2 border-emerald-300">
                  {s.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {bearish.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              Bearish signals ({bearish.length})
            </p>
            <ul className="space-y-1.5">
              {bearish.map((s, i) => (
                <li key={i} className="text-xs text-gray-700 leading-relaxed pl-3 border-l-2 border-red-300">
                  {s.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {neutral.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
              Context ({neutral.length})
            </p>
            <ul className="space-y-1.5">
              {neutral.map((s, i) => (
                <li key={i} className="text-xs text-gray-600 leading-relaxed pl-3 border-l-2 border-gray-200">
                  {s.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
