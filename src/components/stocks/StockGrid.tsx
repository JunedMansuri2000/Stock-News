"use client";

import { useState, useMemo } from "react";
import { StockCard } from "./StockCard";
import type { StockData, SortField, SortOrder } from "@/types/stocks";

interface StockGridProps {
  stocks: StockData[];
}

type SortOption = { label: string; field: SortField; order: SortOrder };

const SORT_OPTIONS: SortOption[] = [
  { label: "Market Cap ↓",  field: "marketCap",     order: "desc" },
  { label: "Market Cap ↑",  field: "marketCap",     order: "asc"  },
  { label: "Change % ↓",    field: "changePercent", order: "desc" },
  { label: "Change % ↑",    field: "changePercent", order: "asc"  },
  { label: "Price ↓",       field: "currentPrice",  order: "desc" },
  { label: "Price ↑",       field: "currentPrice",  order: "asc"  },
  { label: "Volume ↓",      field: "volume",        order: "desc" },
  { label: "Volume ↑",      field: "volume",        order: "asc"  },
];

export function StockGrid({ stocks }: StockGridProps) {
  const [query, setQuery]       = useState("");
  const [sortIdx, setSortIdx]   = useState(0);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = q
      ? stocks.filter(
          (s) =>
            s.symbol.toLowerCase().includes(q) ||
            s.companyName.toLowerCase().includes(q) ||
            (s.sector ?? "").toLowerCase().includes(q)
        )
      : [...stocks];

    const { field, order } = SORT_OPTIONS[sortIdx];
    list.sort((a, b) => {
      const av = (a[field] as number | null) ?? (order === "asc" ? Infinity : -Infinity);
      const bv = (b[field] as number | null) ?? (order === "asc" ? Infinity : -Infinity);
      return order === "asc" ? av - bv : bv - av;
    });

    return list;
  }, [stocks, query, sortIdx]);

  const gainers = stocks.filter((s) => (s.changePercent ?? 0) > 0).length;
  const losers  = stocks.filter((s) => (s.changePercent ?? 0) < 0).length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-gray-500">{stocks.length} stocks</span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          {gainers} ▲ gaining
        </span>
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          {losers} ▼ declining
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <svg className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search company or symbol…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
        </div>

        {/* Sort */}
        <select
          value={sortIdx}
          onChange={(e) => setSortIdx(Number(e.target.value))}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {SORT_OPTIONS.map((opt, i) => (
            <option key={i} value={i}>
              Sort by: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-600">
          <p className="text-gray-500 dark:text-gray-400">
            {query ? `No stocks matching "${query}"` : "No stock data yet — click Sync Stock Data to fetch."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((stock) => (
            <StockCard key={stock.symbol} stock={stock} />
          ))}
        </div>
      )}
    </div>
  );
}
