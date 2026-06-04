import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StockChart } from "@/components/stocks/StockChart";
import { TechnicalIndicators } from "@/components/stocks/TechnicalIndicators";
import type { StockDetailData } from "@/types/stocks";

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
    async (sym: string) => prisma.stock.findUnique({ where: { symbol: sym }, include: { indicators: true } }),
    [`stock-${symbol}`],
    { revalidate: 60, tags: ["stocks", `stock-${symbol}`] }
  );
  const stock = await fetch(symbol.toUpperCase());

  if (!stock) return null;

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
    updatedAt:     stock.updatedAt.toISOString(),
    indicators: stock.indicators
      ? {
          symbol:     stock.indicators.symbol,
          sma20:      stock.indicators.sma20,
          sma50:      stock.indicators.sma50,
          sma200:     stock.indicators.sma200,
          rsi:        stock.indicators.rsi,
          macd:       stock.indicators.macd,
          macdSignal: stock.indicators.macdSignal,
          macdHist:   stock.indicators.macdHist,
          updatedAt:  stock.indicators.updatedAt.toISOString(),
        }
      : null,
  };
}

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: "positive" | "negative";
}

function MetricCard({ label, value, sub, highlight }: MetricCardProps) {
  const valueColor =
    highlight === "positive" ? "text-emerald-600" :
    highlight === "negative" ? "text-red-600" :
    "text-gray-900 dark:text-white";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default async function StockDetailPage({
  params,
}: {
  params: { symbol: string };
}) {
  const decodedSymbol = decodeURIComponent(params.symbol).toUpperCase();
  const stock = await getStock(decodedSymbol);

  if (!stock) {
    notFound();
  }

  const isPositive   = (stock.changePercent ?? 0) >= 0;
  const changeColor  = isPositive ? "text-emerald-600" : "text-red-600";
  const changeBg     = isPositive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800";
  const displaySymbol = stock.symbol.replace(".NS", "");

  return (
    <div className="flex flex-col gap-6">
      {/* Back breadcrumb */}
      <Link href="/stocks" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Stocks
      </Link>

      {/* Hero header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">{displaySymbol}</h1>
            {stock.sector && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {stock.sector}
              </span>
            )}
          </div>
          <p className="mt-1 text-lg text-gray-600 dark:text-gray-400">{stock.companyName}</p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <p className="text-4xl font-bold text-gray-900 dark:text-white">
            ₹{fmt(stock.currentPrice)}
          </p>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${changeBg}`}>
            {isPositive ? "+" : ""}{fmt(stock.changePercent)}%
          </span>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Day High"    value={`₹${fmt(stock.dayHigh)}`} />
        <MetricCard label="Day Low"     value={`₹${fmt(stock.dayLow)}`} />
        <MetricCard label="52W High"    value={`₹${fmt(stock.week52High)}`} />
        <MetricCard label="52W Low"     value={`₹${fmt(stock.week52Low)}`} />
        <MetricCard label="Market Cap"  value={fmtMarketCap(stock.marketCap)} />
        <MetricCard label="Volume"      value={fmtVolume(stock.volume)} />
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

      {/* Technical Indicators */}
      {stock.indicators ? (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Technical Indicators</h2>
          <TechnicalIndicators indicators={stock.indicators} currentPrice={stock.currentPrice} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 dark:border-gray-600">
          Technical indicators will appear after the first sync.
        </div>
      )}

      {/* Last updated */}
      <p className="text-right text-xs text-gray-400">
        Last updated: {new Date(stock.updatedAt).toLocaleString("en-IN")}
      </p>
    </div>
  );
}
