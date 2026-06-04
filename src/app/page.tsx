import { DashboardWidgets } from "@/components/DashboardWidgets";
import { prisma } from "@/lib/prisma";
import { NewsCard } from "@/components/NewsCard";
import Link from "next/link";

// Revalidate every 60 s so the server-rendered article count stays fresh
export const revalidate = 60;

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

      {/* Sync widgets — client component, polls /api/news/sync/status */}
      <DashboardWidgets />

      {/* Recent articles preview */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Articles</h2>
          <Link
            href="/news"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
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
