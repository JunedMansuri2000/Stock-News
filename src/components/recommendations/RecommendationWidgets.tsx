import { unstable_cache } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RecommendationBadge } from "./RecommendationBadge";
import type { RecommendationCategory } from "@/types/recommendations";

function fmt(n: number | null, d = 2) {
  return n !== null ? n.toFixed(d) : "—";
}

// ── Shared UI ─────────────────────────────────────────────────────────────

function WidgetCard({ title, link, children }: { title: string; link?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-sm text-gray-800">{title}</h3>
        {link && (
          <Link href={link} className="text-xs text-violet-600 hover:text-violet-800">
            View all →
          </Link>
        )}
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="px-4 py-6 text-center text-xs text-gray-400">{message}</div>;
}

function MiniRow({
  rank,
  symbol,
  companyName,
  price,
  change,
  badge,
}: {
  rank: number;
  symbol: string;
  companyName: string;
  price: number | null;
  change: number | null;
  badge: React.ReactNode;
}) {
  const sym = symbol.replace(".NS", "");
  const chgPos = (change ?? 0) >= 0;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="w-5 text-xs text-gray-400 font-mono text-center">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900">{sym}</p>
        <p className="text-xs text-gray-400 truncate">{companyName}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-medium text-gray-800">₹{fmt(price)}</p>
        <p className={`text-xs font-medium ${chgPos ? "text-emerald-600" : "text-red-600"}`}>
          {chgPos ? "+" : ""}{fmt(change)}%
        </p>
      </div>
      <div className="flex-shrink-0">{badge}</div>
    </div>
  );
}

// ── Data fetchers ──────────────────────────────────────────────────────────

async function getLatestBatchCutoff(): Promise<Date | null> {
  const latest = await prisma.aIRecommendation.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!latest) return null;
  return new Date(latest.createdAt.getTime() - 60_000);
}

const getTopStrongBuy = unstable_cache(
  async () => {
    const cutoff = await getLatestBatchCutoff();
    if (!cutoff) return [];
    return prisma.aIRecommendation.findMany({
      where: { recommendation: "Strong Buy", createdAt: { gte: cutoff } },
      orderBy: { overallScore: "desc" },
      take: 5,
    });
  },
  ["top-strong-buy"],
  { revalidate: 300, tags: ["recommendations"] }
);

const getTopBuy = unstable_cache(
  async () => {
    const cutoff = await getLatestBatchCutoff();
    if (!cutoff) return [];
    return prisma.aIRecommendation.findMany({
      where: { recommendation: "Buy", createdAt: { gte: cutoff } },
      orderBy: { overallScore: "desc" },
      take: 5,
    });
  },
  ["top-buy"],
  { revalidate: 300, tags: ["recommendations"] }
);

const getTopMomentum = unstable_cache(
  async () => {
    const cutoff = await getLatestBatchCutoff();
    if (!cutoff) return [];
    return prisma.aIRecommendation.findMany({
      where: {
        recommendation: { in: ["Strong Buy", "Buy", "Accumulate"] },
        createdAt: { gte: cutoff },
      },
      orderBy: { momentumScore: "desc" },
      take: 5,
    });
  },
  ["top-momentum-rec"],
  { revalidate: 300, tags: ["recommendations"] }
);

const getTopNewsDriven = unstable_cache(
  async () => {
    const cutoff = await getLatestBatchCutoff();
    if (!cutoff) return [];
    return prisma.aIRecommendation.findMany({
      where: {
        recommendation: { in: ["Strong Buy", "Buy", "Accumulate"] },
        createdAt: { gte: cutoff },
      },
      orderBy: { sentimentScore: "desc" },
      take: 5,
    });
  },
  ["top-news-driven"],
  { revalidate: 300, tags: ["recommendations"] }
);

const getHighConfidence = unstable_cache(
  async () => {
    const cutoff = await getLatestBatchCutoff();
    if (!cutoff) return [];
    return prisma.aIRecommendation.findMany({
      where: {
        recommendation: { in: ["Strong Buy", "Buy", "Accumulate"] },
        createdAt: { gte: cutoff },
        confidenceScore: { gte: 70 },
      },
      orderBy: { confidenceScore: "desc" },
      take: 5,
    });
  },
  ["high-confidence-rec"],
  { revalidate: 300, tags: ["recommendations"] }
);

// ── Helper: join with stock data ──────────────────────────────────────────

async function withStockData(recs: { symbol: string; recommendation: string; overallScore: number; confidenceScore: number; sentimentScore: number; momentumScore: number }[]) {
  if (recs.length === 0) return [];
  const symbols = recs.map((r) => r.symbol);
  const stocks = await prisma.stock.findMany({
    where: { symbol: { in: symbols } },
    select: { symbol: true, companyName: true, currentPrice: true, changePercent: true },
  });
  const map = new Map(stocks.map((s) => [s.symbol, s]));
  return recs.map((r) => ({ ...r, stock: map.get(r.symbol) }));
}

// ── Widget Components ──────────────────────────────────────────────────────

export async function TopStrongBuyWidget() {
  const recs = await getTopStrongBuy();
  const rows = await withStockData(recs);
  return (
    <WidgetCard title="Top Strong Buy" link="/recommendations?recommendation=Strong+Buy">
      {rows.length === 0 ? (
        <EmptyState message="Generate recommendations to populate this widget." />
      ) : (
        rows.map((r, i) => (
          <MiniRow
            key={r.symbol}
            rank={i + 1}
            symbol={r.symbol}
            companyName={r.stock?.companyName ?? r.symbol}
            price={r.stock?.currentPrice ?? null}
            change={r.stock?.changePercent ?? null}
            badge={<RecommendationBadge recommendation={r.recommendation as RecommendationCategory} size="sm" />}
          />
        ))
      )}
    </WidgetCard>
  );
}

export async function TopBuyWidget() {
  const recs = await getTopBuy();
  const rows = await withStockData(recs);
  return (
    <WidgetCard title="Top Buy" link="/recommendations?recommendation=Buy">
      {rows.length === 0 ? (
        <EmptyState message="No Buy recommendations available." />
      ) : (
        rows.map((r, i) => (
          <MiniRow
            key={r.symbol}
            rank={i + 1}
            symbol={r.symbol}
            companyName={r.stock?.companyName ?? r.symbol}
            price={r.stock?.currentPrice ?? null}
            change={r.stock?.changePercent ?? null}
            badge={
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {r.overallScore.toFixed(0)}/100
              </span>
            }
          />
        ))
      )}
    </WidgetCard>
  );
}

export async function TopMomentumRecsWidget() {
  const recs = await getTopMomentum();
  const rows = await withStockData(recs);
  return (
    <WidgetCard title="Top Momentum Stocks" link="/recommendations?sort=momentumScore">
      {rows.length === 0 ? (
        <EmptyState message="No momentum recommendations yet." />
      ) : (
        rows.map((r, i) => (
          <MiniRow
            key={r.symbol}
            rank={i + 1}
            symbol={r.symbol}
            companyName={r.stock?.companyName ?? r.symbol}
            price={r.stock?.currentPrice ?? null}
            change={r.stock?.changePercent ?? null}
            badge={
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                Mom {r.momentumScore.toFixed(0)}/20
              </span>
            }
          />
        ))
      )}
    </WidgetCard>
  );
}

export async function TopNewsDrivenWidget() {
  const recs = await getTopNewsDriven();
  const rows = await withStockData(recs);
  return (
    <WidgetCard title="Top News-Driven" link="/recommendations?sort=sentimentScore">
      {rows.length === 0 ? (
        <EmptyState message="No news-driven picks yet." />
      ) : (
        rows.map((r, i) => (
          <MiniRow
            key={r.symbol}
            rank={i + 1}
            symbol={r.symbol}
            companyName={r.stock?.companyName ?? r.symbol}
            price={r.stock?.currentPrice ?? null}
            change={r.stock?.changePercent ?? null}
            badge={
              <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-xs font-medium text-violet-700">
                News {r.sentimentScore.toFixed(0)}/40
              </span>
            }
          />
        ))
      )}
    </WidgetCard>
  );
}

export async function HighConfidenceWidget() {
  const recs = await getHighConfidence();
  const rows = await withStockData(recs);
  return (
    <WidgetCard title="Highest Confidence Picks" link="/recommendations?minConfidence=70">
      {rows.length === 0 ? (
        <EmptyState message="No high-confidence picks yet." />
      ) : (
        rows.map((r, i) => (
          <MiniRow
            key={r.symbol}
            rank={i + 1}
            symbol={r.symbol}
            companyName={r.stock?.companyName ?? r.symbol}
            price={r.stock?.currentPrice ?? null}
            change={r.stock?.changePercent ?? null}
            badge={
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
                {r.confidenceScore.toFixed(0)}% conf
              </span>
            }
          />
        ))
      )}
    </WidgetCard>
  );
}
