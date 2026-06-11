import { DashboardWidgets } from "@/components/DashboardWidgets";
import { StockDashboardWidgets } from "@/components/stocks/StockDashboardWidgets";
import {
  TopSwingTradesWidget,
  TopBreakoutsWidget,
  HighVolumeWidget,
  HighMomentumWidget,
  HighVolatilityWidget,
} from "@/components/stocks/OpportunityWidgets";
import {
  TopStrongBuyWidget,
  HighConfidenceWidget,
} from "@/components/recommendations/RecommendationWidgets";
import { prisma } from "@/lib/prisma";
import { NewsCard } from "@/components/NewsCard";
import Link from "next/link";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 60;

function WidgetSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 animate-pulse">
      <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <div className="h-3 w-4 bg-gray-100 rounded" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-gray-100 rounded w-1/3" />
            <div className="h-2.5 bg-gray-50 rounded w-1/2" />
          </div>
          <div className="h-6 w-10 bg-gray-100 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const recentArticles = await prisma.article.findMany({
    orderBy: { publishedAt: "desc" },
    take: 5,
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Live stats auto-refresh every 15 seconds.
        </p>
      </div>

      {/* News sync widgets */}
      <DashboardWidgets />

      {/* Stock market widgets */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Stock Market</h2>
          <Link href="/stocks" className="text-sm text-blue-600 hover:text-blue-800">
            View all stocks →
          </Link>
        </div>
        <StockDashboardWidgets />
      </div>

      {/* Swing Trade Opportunities */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Swing Trade Opportunities</h2>
            <p className="text-xs text-gray-400 mt-0.5">Nifty 100 stocks with highest opportunity scores</p>
          </div>
          <Link href="/opportunities" className="text-sm text-emerald-600 hover:text-emerald-800 font-medium">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={<WidgetSkeleton />}>
            <TopSwingTradesWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <TopBreakoutsWidget />
          </Suspense>
        </div>
      </div>

      {/* Market Analytics */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Market Analytics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Suspense fallback={<WidgetSkeleton />}>
            <HighVolumeWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <HighMomentumWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <HighVolatilityWidget />
          </Suspense>
        </div>
      </div>

      {/* AI Recommendations */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Recommendations</h2>
            <p className="text-xs text-gray-400 mt-0.5">AI-powered buy/sell picks — top Nifty 100 stocks</p>
          </div>
          <Link href="/recommendations" className="text-sm text-violet-600 hover:text-violet-800 font-medium">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={<WidgetSkeleton />}>
            <TopStrongBuyWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <HighConfidenceWidget />
          </Suspense>
        </div>
      </div>

      {/* Recent articles preview */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Articles</h2>
          <Link href="/news" className="text-sm text-blue-600 hover:text-blue-800">
            View all →
          </Link>
        </div>

        {recentArticles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-500">No articles yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Go to the{" "}
              <Link href="/news" className="text-blue-600">
                News page
              </Link>{" "}
              and hit &ldquo;Sync Now&rdquo; to fetch articles.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentArticles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
