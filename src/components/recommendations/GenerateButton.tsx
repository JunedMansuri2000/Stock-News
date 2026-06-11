"use client";

import { useState } from "react";

interface Props {
  isRunning: boolean;
  isStale: boolean;
  lastGeneratedAt: string | null;
}

export function GenerateButton({ isRunning: initialRunning, isStale, lastGeneratedAt }: Props) {
  const [running, setRunning] = useState(initialRunning);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (running) return;
    setRunning(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/recommendations/generate", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? "Generation failed");
        setRunning(false);
        return;
      }

      setMessage("Generating recommendations in background — refresh in 1-2 minutes.");

      // Poll status until done
      const interval = setInterval(async () => {
        const statusRes = await fetch("/api/recommendations/status");
        const status = await statusRes.json();
        if (!status.isRunning) {
          clearInterval(interval);
          setRunning(false);
          setMessage("Done! Refresh the page to see updated recommendations.");
        }
      }, 5000);
    } catch {
      setError("Network error — please try again.");
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={running}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            running
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : isStale
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {running ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generating…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {isStale ? "Generate Now" : "Regenerate"}
            </>
          )}
        </button>

        {lastGeneratedAt && !running && (
          <span className="text-xs text-gray-400">
            Last generated: {new Date(lastGeneratedAt).toLocaleString("en-IN")}
          </span>
        )}
      </div>

      {message && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}
