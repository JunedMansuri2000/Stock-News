"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { HistoryPeriod, StockHistoryPoint } from "@/types/stocks";

const PERIODS: { label: string; value: HistoryPeriod }[] = [
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
];

function formatXLabel(iso: string, period: HistoryPeriod): string {
  const d = new Date(iso);
  if (period === "1d") return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (period === "1w") return d.toLocaleDateString("en-IN", { weekday: "short" });
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

interface TooltipState {
  x: number;
  y: number;
  price: number;
  timestamp: string;
  visible: boolean;
}

interface SvgChartProps {
  data: StockHistoryPoint[];
  period: HistoryPeriod;
  color: string;
}

function SvgChart({ data, period, color }: SvgChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ x: 0, y: 0, price: 0, timestamp: "", visible: false });

  const W = 800;
  const H = 260;
  const PAD = { top: 10, right: 10, bottom: 36, left: 64 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  if (data.length < 2) return null;

  const prices  = data.map((d) => d.price);
  const minP    = Math.min(...prices);
  const maxP    = Math.max(...prices);
  const rangeP  = maxP - minP || 1;

  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * plotW;
  const toY = (p: number) => PAD.top + (1 - (p - minP) / rangeP) * plotH;

  const linePath  = data.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)},${toY(d.price).toFixed(1)}`).join(" ");
  const fillPath  = `${linePath} L ${toX(data.length - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)} L ${PAD.left.toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;
  const firstPrice = data[0].price;

  // Y-axis ticks (5 levels)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const p = minP + (rangeP / 4) * i;
    return { y: toY(p), label: `₹${p.toFixed(0)}` };
  });

  // X-axis ticks (up to 6 evenly spaced)
  const tickCount = Math.min(6, data.length);
  const xTicks = Array.from({ length: tickCount }, (_, i) => {
    const idx = Math.round((i / (tickCount - 1)) * (data.length - 1));
    return { x: toX(idx), label: formatXLabel(data[idx].timestamp, period) };
  });

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(((mx - PAD.left) / plotW) * (data.length - 1))));
    const pt  = data[idx];
    setTooltip({ x: toX(idx), y: toY(pt.price), price: pt.price, timestamp: pt.timestamp, visible: true });
  }

  const gradId = `grad-${color.replace("#", "")}`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full overflow-visible"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="plot-area">
          <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
        </clipPath>
      </defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <line key={i} x1={PAD.left} x2={PAD.left + plotW} y1={t.y} y2={t.y} stroke="#f0f0f0" strokeWidth="1" />
      ))}

      {/* Reference line at first price */}
      <line
        x1={PAD.left} x2={PAD.left + plotW}
        y1={toY(firstPrice)} y2={toY(firstPrice)}
        stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4"
      />

      {/* Fill area */}
      <path d={fillPath} fill={`url(#${gradId})`} clipPath="url(#plot-area)" />

      {/* Price line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#plot-area)" />

      {/* Y-axis labels */}
      {yTicks.map((t, i) => (
        <text key={i} x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
          {t.label}
        </text>
      ))}

      {/* X-axis labels */}
      {xTicks.map((t, i) => (
        <text key={i} x={t.x} y={H - 6} textAnchor="middle" fontSize="11" fill="#9ca3af">
          {t.label}
        </text>
      ))}

      {/* Tooltip */}
      {tooltip.visible && (
        <>
          <line x1={tooltip.x} x2={tooltip.x} y1={PAD.top} y2={PAD.top + plotH} stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={tooltip.x} cy={tooltip.y} r="4" fill={color} stroke="white" strokeWidth="2" />
          <rect
            x={tooltip.x > W - 140 ? tooltip.x - 134 : tooltip.x + 8}
            y={tooltip.y - 30}
            width="126"
            height="42"
            rx="6"
            fill="white"
            stroke="#e5e7eb"
            strokeWidth="1"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
          />
          <text
            x={tooltip.x > W - 140 ? tooltip.x - 71 : tooltip.x + 71}
            y={tooltip.y - 13}
            textAnchor="middle"
            fontSize="10"
            fill="#6b7280"
          >
            {new Date(tooltip.timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
          </text>
          <text
            x={tooltip.x > W - 140 ? tooltip.x - 71 : tooltip.x + 71}
            y={tooltip.y + 5}
            textAnchor="middle"
            fontSize="13"
            fontWeight="600"
            fill="#111827"
          >
            ₹{tooltip.price.toFixed(2)}
          </text>
        </>
      )}
    </svg>
  );
}

interface StockChartProps {
  symbol: string;
  color?: string;
}

export function StockChart({ symbol, color }: StockChartProps) {
  const [period, setPeriod]   = useState<HistoryPeriod>("1m");
  const [data, setData]       = useState<StockHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [isPositive, setIsPositive] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/history?period=${period}`);
      if (!res.ok) throw new Error("Failed to load chart data");
      const json = await res.json();
      const pts: StockHistoryPoint[] = json.history ?? [];
      setData(pts);
      if (pts.length > 1) setIsPositive(pts[pts.length - 1].price >= pts[0].price);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [symbol, period]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const strokeColor = color ?? (isPositive ? "#16a34a" : "#dc2626");

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Period tabs */}
      <div className="mb-4 flex items-center gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              period === p.value
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      )}

      {error && !loading && (
        <div className="flex h-64 items-center justify-center text-sm text-red-500">{error}</div>
      )}

      {!loading && !error && data.length < 2 && (
        <div className="flex h-64 items-center justify-center text-sm text-gray-400">
          No chart data available for this period.
        </div>
      )}

      {!loading && !error && data.length >= 2 && (
        <SvgChart data={data} period={period} color={strokeColor} />
      )}
    </div>
  );
}
