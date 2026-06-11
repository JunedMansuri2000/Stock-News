"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { RecommendationCategory } from "@/types/recommendations";

const RECOMMENDATION_OPTIONS: Array<RecommendationCategory | "All"> = [
  "All", "Strong Buy", "Buy", "Accumulate", "Hold", "Reduce", "Sell", "Strong Sell",
];

const CONFIDENCE_OPTIONS = [
  { label: "Any", value: 0 },
  { label: "≥50%", value: 50 },
  { label: "≥70%", value: 70 },
  { label: "≥85%", value: 85 },
];

const SORT_OPTIONS = [
  { label: "Overall Score", value: "overallScore" },
  { label: "Confidence", value: "confidenceScore" },
  { label: "Technical", value: "technicalScore" },
  { label: "Sentiment", value: "sentimentScore" },
  { label: "Momentum", value: "momentumScore" },
];

const HOLDING_OPTIONS = [
  { label: "All", value: "All" },
  { label: "2-3 days", value: "2-3" },
  { label: "3-7 days", value: "3-7" },
  { label: "1-3 weeks", value: "week" },
];

interface Props {
  sectors: string[];
}

export function RecommendationFilters({ sectors }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = {
    recommendation: searchParams.get("recommendation") ?? "All",
    minConfidence: Number(searchParams.get("minConfidence") ?? 0),
    sector: searchParams.get("sector") ?? "All",
    holdingPeriod: searchParams.get("holdingPeriod") ?? "All",
    sort: searchParams.get("sort") ?? "overallScore",
  };

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "All" || value === "0" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-4">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Recommendation */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recommendation</label>
          <div className="flex flex-wrap gap-1.5">
            {RECOMMENDATION_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => update("recommendation", opt)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  current.recommendation === opt
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Confidence</label>
          <div className="flex gap-1.5">
            {CONFIDENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => update("minConfidence", String(opt.value))}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  current.minConfidence === opt.value
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sort By</label>
          <select
            value={current.sort}
            onChange={(e) => update("sort", e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Sector */}
        {sectors.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sector</label>
            <select
              value={current.sector}
              onChange={(e) => update("sector", e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="All">All Sectors</option>
              {sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Holding Period */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Holding Period</label>
          <div className="flex gap-1.5">
            {HOLDING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => update("holdingPeriod", opt.value)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  current.holdingPeriod === opt.value
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
