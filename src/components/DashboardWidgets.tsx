"use client";

import { useEffect, useState, useCallback } from "react";

interface SyncStatus {
  lastSync: {
    id: string;
    startedAt: string;
    completedAt: string | null;
    status: string;
    articlesFetched: number;
    articlesCreated: number;
    errorMessage: string | null;
  } | null;
  totalArticles: number;
  isRunning: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    running: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        styles[status] ?? "bg-gray-100 text-gray-800"
      }`}
    >
      {status === "running" && (
        <svg
          className="mr-1 h-2 w-2 animate-spin"
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
      )}
      {status}
    </span>
  );
}

function Widget({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardWidgets() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/news/sync/status");
      if (!res.ok) throw new Error("Failed to load status");
      setStatus(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, []);

  useEffect(() => {
    load();
    // Poll every 15 s while mounted (e.g. during a running sync)
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, [load]);

  if (error) {
    return (
      <p className="text-sm text-red-600">Could not load sync status: {error}</p>
    );
  }

  if (!status) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  const { lastSync, totalArticles, isRunning } = status;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Widget
        label="Sync Status"
        value={
          <StatusBadge status={isRunning ? "running" : (lastSync?.status ?? "never")} />
        }
        sub={isRunning ? "In progress…" : undefined}
      />
      <Widget
        label="Last Sync"
        value={formatDate(lastSync?.completedAt ?? lastSync?.startedAt)}
        sub={lastSync?.completedAt ? "completed" : lastSync ? "started" : "no syncs yet"}
      />
      <Widget
        label="Total Articles"
        value={totalArticles.toLocaleString()}
      />
      <Widget
        label="Added Last Sync"
        value={lastSync?.articlesCreated ?? "—"}
        sub={
          lastSync?.errorMessage ? (
            <span className="text-red-500">{lastSync.errorMessage}</span>
          ) : lastSync ? (
            `of ${lastSync.articlesFetched} fetched`
          ) : undefined
        }
      />
    </div>
  );
}
