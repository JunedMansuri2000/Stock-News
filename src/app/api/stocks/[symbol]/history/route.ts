import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { HistoryPeriod } from "@/types/stocks";

// History data only changes when the sync script runs, so 10-minute edge cache is safe.
// No force-dynamic — let Next.js / CDN cache this.

const PERIOD_TO_DAYS: Record<HistoryPeriod, number> = {
  "1d":  1,
  "1w":  7,
  "1m":  30,
  "3m":  90,
  "6m":  180,
  "1y":  365,
};

const fetchHistory = unstable_cache(
  async (symbol: string, period: HistoryPeriod) => {
    const days  = PERIOD_TO_DAYS[period] ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await prisma.stockHistory.findMany({
      where:   { symbol, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
      select:  { timestamp: true, price: true, volume: true },
    });

    return rows.map((h) => ({
      timestamp: h.timestamp.toISOString(),
      price:     h.price,
      volume:    h.volume !== null ? Number(h.volume) : null,
    }));
  },
  ["stock-history"],
  { revalidate: 600, tags: ["stocks"] } // 10 min — busted by revalidateTag("stocks") after sync
);

export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol      = decodeURIComponent(params.symbol).toUpperCase();
  const periodParam = (req.nextUrl.searchParams.get("period") ?? "1m") as HistoryPeriod;

  try {
    const history = await fetchHistory(symbol, periodParam);

    return NextResponse.json(
      { symbol, history, period: periodParam },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" } }
    );
  } catch (err) {
    console.error(`[GET /api/stocks/${symbol}/history]`, err);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
