import type { RecommendationCategory } from "@/types/recommendations";

const CONFIG: Record<
  RecommendationCategory,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  "Strong Buy":  { bg: "bg-emerald-700", text: "text-white",         border: "border-emerald-800", dot: "bg-white",         label: "Strong Buy"  },
  "Buy":         { bg: "bg-emerald-500", text: "text-white",         border: "border-emerald-600", dot: "bg-white",         label: "Buy"         },
  "Accumulate":  { bg: "bg-green-100",   text: "text-green-800",     border: "border-green-300",   dot: "bg-green-600",     label: "Accumulate"  },
  "Hold":        { bg: "bg-gray-100",    text: "text-gray-700",      border: "border-gray-300",    dot: "bg-gray-500",      label: "Hold"        },
  "Reduce":      { bg: "bg-orange-100",  text: "text-orange-800",    border: "border-orange-300",  dot: "bg-orange-500",    label: "Reduce"      },
  "Sell":        { bg: "bg-red-500",     text: "text-white",         border: "border-red-600",     dot: "bg-white",         label: "Sell"        },
  "Strong Sell": { bg: "bg-red-800",     text: "text-white",         border: "border-red-900",     dot: "bg-white",         label: "Strong Sell" },
};

export function RecommendationBadge({
  recommendation,
  size = "md",
}: {
  recommendation: RecommendationCategory;
  size?: "sm" | "md" | "lg";
}) {
  const c = CONFIG[recommendation] ?? CONFIG["Hold"];
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : size === "lg" ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${c.bg} ${c.text} ${c.border} ${sizeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function recommendationColor(rec: RecommendationCategory): string {
  return CONFIG[rec]?.bg ?? "bg-gray-100";
}

export function recommendationTextColor(rec: RecommendationCategory): string {
  return CONFIG[rec]?.text ?? "text-gray-700";
}
