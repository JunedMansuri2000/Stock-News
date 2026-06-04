import { prisma } from "@/lib/prisma";
import { NewsCard } from "@/components/NewsCard";
import { SyncButton } from "@/components/SyncButton";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 20;

export default async function NewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1"));

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.article.count({ where: { publishedAt: { gte: since } } }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">News</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} article{total !== 1 ? "s" : ""} in the last 24 hours
          </p>
        </div>
        <SyncButton />
      </div>

      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500">No articles in the last 24 hours.</p>
          <p className="mt-2 text-sm text-gray-400">
            Hit <strong>Sync Now</strong> to pull the latest news from NewsAPI and MoneyControl.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {articles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2">
          {page > 1 && (
            <a
              href={`/news?page=${page - 1}`}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ← Previous
            </a>
          )}
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/news?page=${page + 1}`}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Next →
            </a>
          )}
        </nav>
      )}
    </div>
  );
}
