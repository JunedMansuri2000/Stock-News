import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StockChart } from "@/components/stocks/StockChart";
import { TechnicalIndicators } from "@/components/stocks/TechnicalIndicators";
import { TradeSetupTab } from "@/components/stocks/TradeSetupTab";
import type { StockDetailData, TechnicalIndicatorData, OpportunityData, TradeDirection } from "@/types/stocks";

export const revalidate = 60;

function fmt(n: number | null, d = 2) {
  return n !== null ? n.toFixed(d) : "—";
}

function fmtMarketCap(n: number | null) {
  if (!n) return "—";
  if (n >= 1e12) return `₹${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `₹${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e7)  return `₹${(n / 1e7).toFixed(2)}Cr`;
  return `₹${n.toLocaleString()}`;
}

function fmtVolume(n: number | null) {
  if (!n) return "—";
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  return n.toLocaleString();
}

async function getStock(symbol: string): Promise<StockDetailData | null> {
  const fetch = unstable_cache(
    async (sym: string) =>
      prisma.stock.findUnique({
        where: { symbol: sym },
        include: { indicators: true, opportunity: true },
      }),
    [`stock-${symbol}`],
    { revalidate: 60, tags: ["stocks", `stock-${symbol}`] }
  );
  const stock = await fetch(symbol.toUpperCase());
  if (!stock) return null;

  const indicators: TechnicalIndicatorData | null = stock.indicators
    ? {
        symbol:          stock.indicators.symbol,
        sma20:           stock.indicators.sma20,
        sma50:           stock.indicators.sma50,
        sma200:          stock.indicators.sma200,
        ema20:           stock.indicators.ema20,
        rsi:             stock.indicators.rsi,
        macd:            stock.indicators.macd,
        macdSignal:      stock.indicators.macdSignal,
        macdHist:        stock.indicators.macdHist,
        bollingerUpper:  stock.indicators.bollingerUpper,
        bollingerMiddle: stock.indicators.bollingerMiddle,
        bollingerLower:  stock.indicators.bollingerLower,
        atr:             stock.indicators.atr,
        adx:             stock.indicators.adx,
        volumeRs:        stock.indicators.volumeRs,
        updatedAt:       new Date(stock.indicators.updatedAt).toISOString(),
      }
    : null;

  const opportunity: OpportunityData | null = stock.opportunity
    ? {
        symbol:          stock.opportunity.symbol,
        companyName:     stock.companyName,
        sector:          stock.sector,
        currentPrice:    stock.currentPrice,
        changePercent:   stock.changePercent,
        opportunityScore: stock.opportunity.opportunityScore,
        direction:       stock.opportunity.direction as TradeDirection | null,
        riskLevel:       stock.opportunity.riskLevel as OpportunityData["riskLevel"],
        entryZoneLow:    stock.opportunity.entryZoneLow,
        entryZoneHigh:   stock.opportunity.entryZoneHigh,
        stopLoss:        stock.opportunity.stopLoss,
        target1:         stock.opportunity.target1,
        target2:         stock.opportunity.target2,
        holdingPeriod:   stock.opportunity.holdingPeriod,
        momentumScore:   stock.opportunity.momentumScore,
        trendScore:      stock.opportunity.trendScore,
        volumeScore:     stock.opportunity.volumeScore,
        volatilityScore: stock.opportunity.volatilityScore,
        technicalScore:  stock.opportunity.technicalScore,
        greeksScore:     stock.opportunity.greeksScore,
        updatedAt:       new Date(stock.opportunity.updatedAt).toISOString(),
      }
    : null;

  return {
    id:            stock.id,
    symbol:        stock.symbol,
    companyName:   stock.companyName,
    sector:        stock.sector,
    currentPrice:  stock.currentPrice,
    marketCap:     stock.marketCap,
    peRatio:       stock.peRatio,
    pbRatio:       stock.pbRatio,
    dividendYield: stock.dividendYield,
    dayHigh:       stock.dayHigh,
    dayLow:        stock.dayLow,
    week52High:    stock.week52High,
    week52Low:     stock.week52Low,
    volume:        stock.volume !== null ? Number(stock.volume) : null,
    changePercent: stock.changePercent,
    sparklineData: stock.sparklineData,
    updatedAt:     new Date(stock.updatedAt).toISOString(),
    indicators,
    opportunity,
  };
}

function MetricCard({ label, value, sub, highlight }: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "positive" | "negative";
}) {
  const valueColor =
    highlight === "positive" ? "text-emerald-600" :
    highlight === "negative" ? "text-red-600" :
    "text-gray-900";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default async function StockDetailPage({
  params,
  searchParams,
}: {
  params: { symbol: string };
  searchParams: { tab?: string };
}) {
  const decodedSymbol = decodeURIComponent(params.symbol).toUpperCase();
  const stock = await getStock(decodedSymbol);

  if (!stock) notFound();

  const activeTab = searchParams.tab === "trade-setup" ? "trade-setup" : "overview";
  const isPositive   = (stock.changePercent ?? 0) >= 0;
  const changeBg     = isPositive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800";
  const displaySymbol = stock.symbol.replace(".NS", "");

  return (
    <div className="flex flex-col gap-6">
      {/* Back breadcrumb */}
      <Link href="/stocks" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Stocks
      </Link>

      {/* Hero header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-gray-900">{displaySymbol}</h1>
            {stock.sector && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {stock.sector}
              </span>
            )}
            {stock.opportunity?.direction && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                stock.opportunity.direction === "Strong Bullish" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                stock.opportunity.direction === "Bullish" ? "bg-green-100 text-green-800 border-green-200" :
                stock.opportunity.direction === "Bearish" ? "bg-orange-100 text-orange-800 border-orange-200" :
                stock.opportunity.direction === "Strong Bearish" ? "bg-red-100 text-red-800 border-red-200" :
                "bg-gray-100 text-gray-700 border-gray-200"
              }`}>
                {stock.opportunity.direction}
              </span>
            )}
          </div>
          <p className="mt-1 text-lg text-gray-600">{stock.companyName}</p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <p className="text-4xl font-bold text-gray-900">₹{fmt(stock.currentPrice)}</p>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${changeBg}`}>
              {isPositive ? "+" : ""}{fmt(stock.changePercent)}%
            </span>
            {stock.opportunity?.opportunityScore !== null && stock.opportunity?.opportunityScore !== undefined && (
              <span className="rounded-full bg-blue-100 border border-blue-200 px-3 py-1 text-sm font-bold text-blue-800">
                Score: {Math.round(stock.opportunity.opportunityScore)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Day High"   value={`₹${fmt(stock.dayHigh)}`} />
        <MetricCard label="Day Low"    value={`₹${fmt(stock.dayLow)}`} />
        <MetricCard label="52W High"   value={`₹${fmt(stock.week52High)}`} />
        <MetricCard label="52W Low"    value={`₹${fmt(stock.week52Low)}`} />
        <MetricCard label="Market Cap" value={fmtMarketCap(stock.marketCap)} />
        <MetricCard label="Volume"     value={fmtVolume(stock.volume)} />
      </div>

      {/* Fundamental metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          label="PE Ratio"
          value={fmt(stock.peRatio)}
          sub={stock.peRatio ? (stock.peRatio > 30 ? "Premium" : stock.peRatio < 15 ? "Value" : "Fair") : undefined}
        />
        <MetricCard label="PB Ratio"       value={fmt(stock.pbRatio)} />
        <MetricCard label="Dividend Yield" value={stock.dividendYield ? `${(stock.dividendYield * 100).toFixed(2)}%` : "—"} />
      </div>

      {/* Chart */}
      <StockChart symbol={stock.symbol} />

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          <Link
            href={`/stocks/${encodeURIComponent(stock.symbol)}`}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === "overview"
                ? "bg-white border border-b-white border-gray-200 text-gray-900 -mb-px"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Technical Indicators
          </Link>
          <Link
            href={`/stocks/${encodeURIComponent(stock.symbol)}?tab=trade-setup`}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === "trade-setup"
                ? "bg-white border border-b-white border-gray-200 text-gray-900 -mb-px"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Trade Setup
            {stock.opportunity?.opportunityScore !== null && stock.opportunity?.opportunityScore !== undefined && (
              <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-700">
                {Math.round(stock.opportunity.opportunityScore)}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "overview" ? (
        stock.indicators ? (
          <TechnicalIndicators indicators={stock.indicators} currentPrice={stock.currentPrice} />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            Technical indicators will appear after the first sync.
          </div>
        )
      ) : (
        <TradeSetupTab
          opportunity={stock.opportunity}
          indicators={stock.indicators}
          currentPrice={stock.currentPrice}
        />
      )}

      {/* Last updated */}
      <p className="text-right text-xs text-gray-400">
        Last updated: {new Date(stock.updatedAt).toLocaleString("en-IN")}
      </p>
    </div>
  );
}
