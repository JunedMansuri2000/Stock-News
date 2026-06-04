import Image from "next/image";

interface Article {
  id: string;
  title: string;
  description: string | null;
  snippet: string | null;
  url: string;
  imageUrl: string | null;
  source: string | null;
  publishedAt: string | Date;
}

export function NewsCard({ article }: { article: Article }) {
  const published = new Date(article.publishedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      {article.imageUrl && (
        <div className="relative hidden h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg sm:block">
          <Image
            src={article.imageUrl}
            alt={article.title}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex items-center gap-2 text-xs text-gray-400">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              article.source?.startsWith("MoneyControl")
                ? "bg-blue-50 text-blue-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {article.source ?? "Unknown"}
          </span>
          <span>{published}</span>
        </p>
        <h3 className="line-clamp-2 font-medium text-gray-900 group-hover:text-blue-700">
          {article.title}
        </h3>
        {(article.description ?? article.snippet) && (
          <p className="line-clamp-2 text-sm text-gray-500">
            {article.description ?? article.snippet}
          </p>
        )}
      </div>
    </a>
  );
}
