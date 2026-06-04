import { unstable_cache } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DirectionBadge, ScoreCircle } from "@/components/opportunities/DirectionBadge";
import type { TradeDirection } from "@/types/stocks";

function fmt(n: number | null, d = 2) {
  return n !== null ? n.toFixed(d) : "—";
}

// ── Shared mini-row ────────────────────────────────────────────────────────

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
    <Link
      href={`/stocks/${encodeURIComponent(symbol)}`}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
    >
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
    </Link>
  );
}

function WidgetCard({
  title,
  link,
  children,
}: {
  title: string;
  link?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-sm text-gray-800">{title}</h3>
        {link && (
          <Link href={link} className="text-xs text-blue-600 hover:text-blue-800">
            View all →
          </Link>
        )}
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-6 text-center text-xs text-gray-400">{message}</div>
  );
}

// ── Data fetchers (all cached) ─────────────────────────────────────────────

const getTopSwingTrades = unstable_cache(
  async () =>
    prisma.stockOpportunity.findMany({
      where: { direction: { in: ["Strong Bullish", "Bullish"] } },
      orderBy: { opportunityScore: "desc" },
      take: 10,
      include: { stock: { select: { companyName: true, currentPrice: true, changePercent: true } } },
    }),
  ["top-swing-trades"],
  { revalidate: 60, tags: ["stocks", "opportunities"] }
);

const getTopBreakouts = unstable_cache(
  async () =>
    prisma.stockOpportunity.findMany({
      where: {
        direction: { in: ["Strong Bullish", "Bullish"] },
        volumeScore: { gte: 15 },
        momentumScore: { gte: 12 },
      },
      orderBy: [{ volumeScore: "desc" }, { momentumScore: "desc" }],
      take: 5,
      include: { stock: { select: { companyName: true, currentPrice: true, changePercent: true } } },
    }),
  ["top-breakouts"],
  { revalidate: 60, tags: ["stocks", "opportunities"] }
);

const getHighVolume = unstable_cache(
  async () =>
    prisma.stockOpportunity.findMany({
      where: { volumeScore: { gte: 10 } },
      orderBy: { volumeScore: "desc" },
      take: 5,
      include: { stock: { select: { companyName: true, currentPrice: true, changePercent: true, volume: true } } },
    }),
  ["high-volume-stocks"],
  { revalidate: 60, tags: ["stocks", "opportunities"] }
);

const getHighMomentum = unstable_cache(
  async () =>
    prisma.stockOpportunity.findMany({
      where: { momentumScore: { gte: 12 } },
      orderBy: { momentumScore: "desc" },
      take: 5,
      include: { stock: { select: { companyName: true, currentPrice: true, changePercent: true } } },
    }),
  ["high-momentum-stocks"],
  { revalidate: 60, tags: ["stocks", "opportunities"] }
);

const getHighVolatility = unstable_cache(
  async () =>
    prisma.stockOpportunity.findMany({
      where: { volatilityScore: { gte: 10 } },
      orderBy: { volatilityScore: "desc" },
      take: 5,
      include: { stock: { select: { companyName: true, currentPrice: true, changePercent: true } } },
    }),
  ["high-volatility-stocks"],
  { revalidate: 60, tags: ["stocks", "opportunities"] }
);

// ── Widget Components ──────────────────────────────────────────────────────

export async function TopSwingTradesWidget() {
  const rows = await getTopSwingTrades();
  return (
    <WidgetCard title="Top 10 Swing Trades" link="/opportunities">
      {rows.length === 0 ? (
        <EmptyState message="Run a sync to populate swing trade opportunities." />
      ) : (
        rows.map((r, i) => (
          <MiniRow
            key={r.symbol}
            rank={i + 1}
            symbol={r.symbol}
            companyName={r.stock.companyName}
            price={r.stock.currentPrice}
            change={r.stock.changePercent}
            badge={<ScoreCircle score={r.opportunityScore} />}
          />
        ))
      )}
    </WidgetCard>
  );
}

export async function TopBreakoutsWidget() {
  const rows = await getTopBreakouts();
  return (
    <WidgetCard title="Top Breakouts" link="/opportunities?direction=Bullish">
      {rows.length === 0 ? (
        <EmptyState message="No breakout setups detected yet." />
      ) : (
        rows.map((r, i) => (
          <MiniRow
            key={r.symbol}
            rank={i + 1}
            symbol={r.symbol}
            companyName={r.stock.companyName}
            price={r.stock.currentPrice}
            change={r.stock.changePercent}
            badge={
              <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Vol {r.volumeScore?.toFixed(0)}/20
              </span>
            }
          />
        ))
      )}
    </WidgetCard>
  );
}

export async function HighVolumeWidget() {
  const rows = await getHighVolume();
  return (
    <WidgetCard title="High Volume Stocks">
      {rows.length === 0 ? (
        <EmptyState message="No high-volume stocks detected." />
      ) : (
        rows.map((r, i) => {
          const volRs = r.volatilityScore; // proxy label
          return (
            <MiniRow
              key={r.symbol}
              rank={i + 1}
              symbol={r.symbol}
              companyName={r.stock.companyName}
              price={r.stock.currentPrice}
              change={r.stock.changePercent}
              badge={
                <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Vol {r.volumeScore?.toFixed(0)}/20
                </span>
              }
            />
          );
        })
      )}
    </WidgetCard>
  );
}

export async function HighMomentumWidget() {
  const rows = await getHighMomentum();
  return (
    <WidgetCard title="High Momentum Stocks">
      {rows.length === 0 ? (
        <EmptyState message="No high-momentum stocks detected." />
      ) : (
        rows.map((r, i) => (
          <MiniRow
            key={r.symbol}
            rank={i + 1}
            symbol={r.symbol}
            companyName={r.stock.companyName}
            price={r.stock.currentPrice}
            change={r.stock.changePercent}
            badge={
              <span className="rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-medium text-purple-700">
                Mom {r.momentumScore?.toFixed(0)}/20
              </span>
            }
          />
        ))
      )}
    </WidgetCard>
  );
}

export async function HighVolatilityWidget() {
  const rows = await getHighVolatility();
  return (
    <WidgetCard title="High Volatility Stocks">
      {rows.length === 0 ? (
        <EmptyState message="No high-volatility stocks detected." />
      ) : (
        rows.map((r, i) => (
          <MiniRow
            key={r.symbol}
            rank={i + 1}
            symbol={r.symbol}
            companyName={r.stock.companyName}
            price={r.stock.currentPrice}
            change={r.stock.changePercent}
            badge={
              <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs font-medium text-orange-700">
                ATR {r.volatilityScore?.toFixed(0)}/20
              </span>
            }
          />
        ))
      )}
    </WidgetCard>
  );
}
