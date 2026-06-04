"use client";

import { useState } from "react";
import Link from "next/link";
import type { OpportunityData, OpportunityFilter, OpportunitySortField, TradeDirection } from "@/types/stocks";
import { DirectionBadge, RiskBadge, ScoreBar, ScoreCircle } from "./DirectionBadge";

function fmt(n: number | null, d = 2) {
  return n !== null ? n.toFixed(d) : "—";
}

function fmtPrice(n: number | null) {
  return n !== null ? `₹${n.toFixed(2)}` : "—";
}

const DIRECTION_FILTERS: OpportunityFilter[] = [
  "All", "Strong Bullish", "Bullish", "Bearish", "Strong Bearish",
];

const SORT_OPTIONS: { label: string; value: OpportunitySortField }[] = [
  { label: "Score",       value: "opportunityScore" },
  { label: "Momentum",    value: "momentumScore" },
  { label: "Trend",       value: "trendScore" },
  { label: "Volume",      value: "volumeScore" },
  { label: "Volatility",  value: "volatilityScore" },
  { label: "Technical",   value: "technicalScore" },
];

interface Props {
  opportunities: OpportunityData[];
}

export function OpportunitiesTable({ opportunities }: Props) {
  const [filter, setFilter]   = useState<OpportunityFilter>("All");
  const [sort, setSort]       = useState<OpportunitySortField>("opportunityScore");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = opportunities
    .filter((o) => filter === "All" || o.direction === filter)
    .sort((a, b) => ((b[sort] ?? 0) - (a[sort] ?? 0)));

  return (
    <div className="space-y-4">
      {/* Filters + Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Direction filter chips */}
        <div className="flex flex-wrap gap-2">
          {DIRECTION_FILTERS.map((d) => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors border ${
                filter === d
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {d}
              {d !== "All" && (
                <span className="ml-1 opacity-60">
                  ({opportunities.filter((o) => o.direction === d).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sort select */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Sort by:</span>
          <div className="flex gap-1">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  sort === s.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-gray-500">
        Showing {filtered.length} of {opportunities.length} stocks
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No opportunities found for this filter. Run a stock sync to populate data.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-2 py-3 text-left">#</th>
                <th className="px-2 py-3 text-left">Symbol</th>
                <th className="px-2 py-3 text-right">Price</th>
                <th className="px-2 py-3 text-center">Score</th>
                <th className="px-2 py-3 text-left">Direction</th>
                <th className="px-2 py-3 text-center">Risk</th>
                <th className="px-2 py-3 text-right hidden md:table-cell">Entry Zone</th>
                <th className="px-2 py-3 text-right hidden md:table-cell">Stop Loss</th>
                <th className="px-2 py-3 text-right hidden lg:table-cell">Target 1</th>
                <th className="px-2 py-3 text-right hidden lg:table-cell">Target 2</th>
                <th className="px-2 py-3 text-center hidden xl:table-cell">Holding</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((opp, idx) => {
                const isOpen = expanded === opp.symbol;
                const sym = opp.symbol.replace(".NS", "");
                const chgPos = (opp.changePercent ?? 0) >= 0;

                return (
                  <>
                    <tr
                      key={opp.symbol}
                      className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${isOpen ? "bg-blue-50/40" : ""}`}
                      onClick={() => setExpanded(isOpen ? null : opp.symbol)}
                    >
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>

                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{sym}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[120px]">{opp.companyName}</div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="font-medium">{fmtPrice(opp.currentPrice)}</div>
                        <div className={`text-xs font-medium ${chgPos ? "text-emerald-600" : "text-red-600"}`}>
                          {chgPos ? "+" : ""}{fmt(opp.changePercent)}%
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <ScoreCircle score={opp.opportunityScore} />
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <DirectionBadge direction={opp.direction as TradeDirection | null} />
                      </td>

                      <td className="px-4 py-3 text-center">
                        <RiskBadge risk={opp.riskLevel} />
                      </td>

                      <td className="px-4 py-3 text-right hidden md:table-cell text-xs text-gray-600">
                        {fmtPrice(opp.entryZoneLow)} – {fmtPrice(opp.entryZoneHigh)}
                      </td>

                      <td className="px-4 py-3 text-right hidden md:table-cell text-xs text-red-600 font-medium">
                        {fmtPrice(opp.stopLoss)}
                      </td>

                      <td className="px-4 py-3 text-right hidden lg:table-cell text-xs text-emerald-600 font-medium">
                        {fmtPrice(opp.target1)}
                      </td>

                      <td className="px-4 py-3 text-right hidden lg:table-cell text-xs text-emerald-700 font-medium">
                        {fmtPrice(opp.target2)}
                      </td>

                      <td className="px-4 py-3 text-center hidden xl:table-cell text-xs text-gray-500">
                        {opp.holdingPeriod ?? "—"}
                      </td>
                    </tr>

                    {/* Expanded sub-scores row */}
                    {isOpen && (
                      <tr key={`${opp.symbol}-expand`} className="bg-blue-50/30 border-b border-gray-100">
                        <td colSpan={11} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                            <SubScore label="Momentum"   value={opp.momentumScore}   max={20} />
                            <SubScore label="Trend"      value={opp.trendScore}      max={20} />
                            <SubScore label="Volume"     value={opp.volumeScore}     max={20} />
                            <SubScore label="Volatility" value={opp.volatilityScore} max={20} />
                            <SubScore label="Technical"  value={opp.technicalScore}  max={20} />
                            <SubScore label="Greeks"     value={opp.greeksScore}     max={20} note="Coming soon" />
                          </div>

                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 sm:text-sm">
                            <span>Entry: <strong className="text-gray-700">{fmtPrice(opp.entryZoneLow)} – {fmtPrice(opp.entryZoneHigh)}</strong></span>
                            <span>Stop: <strong className="text-red-600">{fmtPrice(opp.stopLoss)}</strong></span>
                            <span>T1: <strong className="text-emerald-600">{fmtPrice(opp.target1)}</strong></span>
                            <span>T2: <strong className="text-emerald-700">{fmtPrice(opp.target2)}</strong></span>
                            <span>Hold: <strong className="text-gray-700">{opp.holdingPeriod ?? "—"}</strong></span>
                            <Link
                              href={`/stocks/${encodeURIComponent(opp.symbol)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              View full analysis →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubScore({ label, value, max, note }: { label: string; value: number | null; max: number; note?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        {note && <span className="text-xs text-gray-400 italic">{note}</span>}
      </div>
      <ScoreBar score={value} max={max} />
      <div className="text-xs text-gray-400">{value ?? 0}/{max}</div>
    </div>
  );
}
