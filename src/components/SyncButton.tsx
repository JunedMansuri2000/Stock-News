"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SyncResult {
  success: boolean;
  articlesFetched?: number;
  articlesCreated?: number;
  durationMs?: number;
  error?: string;
}

export function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/news/sync", { method: "POST" });
      const data: SyncResult = await res.json();

      setResult(data);

      if (res.ok && data.success) {
        // Refresh server components on this page so article list updates
        router.refresh();
      }
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
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Syncing…
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Sync Now
          </>
        )}
      </button>

      {result && (
        <p
          className={`text-sm ${
            result.success ? "text-green-700" : "text-red-700"
          }`}
        >
          {result.success
            ? `Done — ${result.articlesCreated} new article${result.articlesCreated === 1 ? "" : "s"} added (${result.durationMs}ms)`
            : `Error: ${result.error}`}
        </p>
      )}
    </div>
  );
}
