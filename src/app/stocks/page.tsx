import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { StockGrid } from "@/components/stocks/StockGrid";
import { StockSyncButton } from "@/components/stocks/StockSyncButton";
import { StockGridSkeleton } from "@/components/stocks/LoadingSkeleton";
import { Suspense } from "react";
import type { StockData } from "@/types/stocks";

// ISR: serve from cache, revalidate in background every 60 s.
// The sync service also calls revalidateTag("stocks") after each successful sync
// so the page reflects fresh data immediately without waiting for the 60 s window.
export const revalidate = 60;

const getCachedStocks = unstable_cache(
  async (): Promise<StockData[]> => {
    const stocks = await prisma.stock.findMany({
      orderBy: { marketCap: "desc" },
    });
    return stocks.map((s) => ({
      id:            s.id,
      symbol:        s.symbol,
      companyName:   s.companyName,
      sector:        s.sector,
      currentPrice:  s.currentPrice,
      marketCap:     s.marketCap,
      peRatio:       s.peRatio,
      pbRatio:       s.pbRatio,
      dividendYield: s.dividendYield,
      dayHigh:       s.dayHigh,
      dayLow:        s.dayLow,
      week52High:    s.week52High,
      week52Low:     s.week52Low,
      volume:        s.volume !== null ? Number(s.volume) : null,
      changePercent: s.changePercent,
      sparklineData: s.sparklineData,
      updatedAt:     s.updatedAt.toISOString(),
    }));
  },
  ["stocks-list"],
  { revalidate: 60, tags: ["stocks"] }
);

async function StocksContent() {
  const stocks = await getCachedStocks();
  return <StockGrid stocks={stocks} />;
}

export default function StocksPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nifty 100 Stocks</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Data synced from Yahoo Finance every 10 minutes · served from database
          </p>
        </div>
        <StockSyncButton />
      </div>

      <Suspense fallback={<StockGridSkeleton />}>
        <StocksContent />
      </Suspense>
    </div>
  );
}
