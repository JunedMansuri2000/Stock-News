export function StockCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-36 rounded bg-gray-100 dark:bg-gray-600" />
        </div>
        <div className="h-6 w-16 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="mt-3 h-9 w-full rounded bg-gray-100 dark:bg-gray-700" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="h-3 rounded bg-gray-100 dark:bg-gray-700" />
        <div className="h-3 rounded bg-gray-100 dark:bg-gray-700" />
        <div className="h-3 rounded bg-gray-100 dark:bg-gray-700" />
        <div className="h-3 rounded bg-gray-100 dark:bg-gray-700" />
      </div>
    </div>
  );
}

export function StockGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <StockCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StockDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}
