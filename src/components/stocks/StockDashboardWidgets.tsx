"use client";

import { useEffect, useState, useCallback } from "react";
import type { StockSyncStatus } from "@/types/stocks";

function Widget({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
      {sub && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function StockDashboardWidgets() {
  const [status, setStatus] = useState<StockSyncStatus | null>(null);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stocks/sync/status");
      if (!res.ok) throw new Error("Failed");
      setStatus(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  if (error) return <p className="text-sm text-red-600">Could not load stock status: {error}</p>;

  if (!status) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Widget
        label="Last Stock Sync"
        value={formatDate(status.lastSync?.completedAt ?? status.lastSync?.startedAt)}
        sub={status.isRunning ? "Syncing…" : status.lastSync?.status ?? "never"}
      />
      <Widget
        label="Total Stocks"
        value={status.totalStocks.toLocaleString()}
        sub="Nifty 100"
      />
      <Widget
        label="Market Gainers"
        value={<span className="text-emerald-600">{status.gainers}</span>}
        sub="stocks ▲ today"
      />
      <Widget
        label="Market Losers"
        value={<span className="text-red-600">{status.losers}</span>}
        sub="stocks ▼ today"
      />
    </div>
  );
}
