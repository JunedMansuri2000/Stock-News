import Link from "next/link";
import { Sparkline } from "./Sparkline";
import type { StockData } from "@/types/stocks";

function fmt(n: number | null, decimals = 2) {
  if (n === null || n === undefined) return "—";
  return n.toFixed(decimals);
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
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

interface StockCardProps {
  stock: StockData;
}

export function StockCard({ stock }: StockCardProps) {
  const isPositive = (stock.changePercent ?? 0) >= 0;
  const changeColor = isPositive ? "text-emerald-600" : "text-red-600";
  const changeBg    = isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  const symbolPath  = `/stocks/${encodeURIComponent(stock.symbol)}`;

  return (
    <Link href={symbolPath} className="block">
      <div className="group h-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {stock.symbol.replace(".NS", "")}
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {stock.companyName}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${changeBg}`}>
            {isPositive ? "+" : ""}{fmt(stock.changePercent)}%
          </span>
        </div>

        {/* Price */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            ₹{fmt(stock.currentPrice)}
          </span>
        </div>

        {/* Sparkline */}
        <div className="mt-2">
          <Sparkline data={stock.sparklineData} width={150} height={36} positive={isPositive} />
        </div>

        {/* Stats grid */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <StatRow label="High"    value={`₹${fmt(stock.dayHigh)}`} />
          <StatRow label="Low"     value={`₹${fmt(stock.dayLow)}`} />
          <StatRow label="Vol"     value={fmtVolume(stock.volume)} />
          <StatRow label="Mkt Cap" value={fmtMarketCap(stock.marketCap)} />
        </div>

        {/* Sector + updated time */}
        <div className="mt-3 flex items-center justify-between">
          {stock.sector && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              {stock.sector}
            </span>
          )}
          <span className="ml-auto text-xs text-gray-400">{fmtTime(stock.updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-700 dark:text-gray-300">{value}</span>
    </div>
  );
}
