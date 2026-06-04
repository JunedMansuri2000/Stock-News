import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { OpportunitiesTable } from "@/components/opportunities/OpportunitiesTable";
import type { OpportunityData, TradeDirection } from "@/types/stocks";

export const revalidate = 60;

async function getOpportunities(): Promise<{ opportunities: OpportunityData[]; updatedAt: string | null }> {
  const fetch = unstable_cache(
    async () =>
      prisma.stockOpportunity.findMany({
        where: { direction: { not: "Neutral" } },
        orderBy: { opportunityScore: "desc" },
        include: {
          stock: {
            select: {
              companyName: true,
              sector: true,
              currentPrice: true,
              changePercent: true,
            },
          },
        },
      }),
    ["all-opportunities"],
    { revalidate: 60, tags: ["stocks", "opportunities"] }
  );

  const rows = await fetch();

  const opportunities: OpportunityData[] = rows.map((r) => ({
    symbol:          r.symbol,
    companyName:     r.stock.companyName,
    sector:          r.stock.sector,
    currentPrice:    r.stock.currentPrice,
    changePercent:   r.stock.changePercent,
    opportunityScore: r.opportunityScore,
    direction:       r.direction as TradeDirection | null,
    riskLevel:       r.riskLevel as OpportunityData["riskLevel"],
    entryZoneLow:    r.entryZoneLow,
    entryZoneHigh:   r.entryZoneHigh,
    stopLoss:        r.stopLoss,
    target1:         r.target1,
    target2:         r.target2,
    holdingPeriod:   r.holdingPeriod,
    momentumScore:   r.momentumScore,
    trendScore:      r.trendScore,
    volumeScore:     r.volumeScore,
    volatilityScore: r.volatilityScore,
    technicalScore:  r.technicalScore,
    greeksScore:     r.greeksScore,
    updatedAt:       new Date(r.updatedAt).toISOString(),
  }));

  const latest = rows[0]?.updatedAt ? new Date(rows[0].updatedAt).toISOString() : null;
  return { opportunities, updatedAt: latest };
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

export default async function OpportunitiesPage() {
  const { opportunities, updatedAt } = await getOpportunities();

  const counts = {
    strongBullish: opportunities.filter((o) => o.direction === "Strong Bullish").length,
    bullish:       opportunities.filter((o) => o.direction === "Bullish").length,
    bearish:       opportunities.filter((o) => o.direction === "Bearish").length,
    strongBearish: opportunities.filter((o) => o.direction === "Strong Bearish").length,
  };

  const topScore = opportunities[0]?.opportunityScore ?? 0;
  const avgScore = opportunities.length
    ? Math.round(opportunities.reduce((s, o) => s + (o.opportunityScore ?? 0), 0) / opportunities.length)
    : 0;
  const highMomentum = opportunities.filter((o) => (o.momentumScore ?? 0) >= 15).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Swing Trade Opportunities</h1>
          <p className="mt-1 text-sm text-gray-500">
            Nifty 100 stocks ranked by opportunity score — updated each sync cycle.
          </p>
        </div>
        {updatedAt && (
          <p className="text-xs text-gray-400">
            Last updated: {new Date(updatedAt).toLocaleString("en-IN")}
          </p>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <SummaryCard
          label="Strong Bullish"
          count={counts.strongBullish}
          color="border-emerald-200 bg-emerald-50 text-emerald-800"
        />
        <SummaryCard
          label="Bullish"
          count={counts.bullish}
          color="border-green-200 bg-green-50 text-green-800"
        />
        <SummaryCard
          label="Bearish"
          count={counts.bearish}
          color="border-orange-200 bg-orange-50 text-orange-800"
        />
        <SummaryCard
          label="Strong Bearish"
          count={counts.strongBearish}
          color="border-red-200 bg-red-50 text-red-800"
        />
        <SummaryCard
          label="Top Score"
          count={Math.round(topScore)}
          color="border-blue-200 bg-blue-50 text-blue-800"
        />
        <SummaryCard
          label="Avg Score"
          count={avgScore}
          color="border-purple-200 bg-purple-50 text-purple-800"
        />
        <SummaryCard
          label="High Momentum"
          count={highMomentum}
          color="border-indigo-200 bg-indigo-50 text-indigo-800"
        />
      </div>

      {/* Options module notice */}
      <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-3 text-sm text-blue-700">
        <strong>Greeks Module</strong> — Architecture in place. Connect a provider (NSE, Upstox, Angel One, or Dhan)
        by implementing the <code className="bg-blue-100 px-1 rounded text-xs">OptionsDataProvider</code> interface
        in <code className="bg-blue-100 px-1 rounded text-xs">src/lib/options-provider.ts</code>.
        Greeks scores will auto-populate once a provider is wired up.
      </div>

      {/* Main table */}
      {opportunities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-24 text-center">
          <p className="text-gray-500 font-medium">No opportunity data yet.</p>
          <p className="mt-2 text-sm text-gray-400">
            Go to <strong>/stocks</strong> and click <strong>Sync Now</strong> to calculate scores.
          </p>
        </div>
      ) : (
        <OpportunitiesTable opportunities={opportunities} />
      )}
    </div>
  );
}
