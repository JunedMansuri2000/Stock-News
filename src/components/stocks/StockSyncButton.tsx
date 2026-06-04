"use client";

import { useState } from "react";

interface SyncResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export function StockSyncButton() {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<SyncResponse | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res  = await fetch("/api/stocks/sync", { method: "POST" });
      const data: SyncResponse = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: "Network error — could not reach server" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Starting…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync Stock Data
          </>
        )}
      </button>

      {result && (
        <p className={`text-sm ${result.success ? "text-emerald-700" : "text-red-700"}`}>
          {result.success
            ? (result.message ?? "Sync started in background")
            : `Error: ${result.error}`}
        </p>
      )}
    </div>
  );
}
