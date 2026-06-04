export function ListingSkeleton() {
  return (
    <div className="bg-card rounded-3xl p-4 ring-1 ring-black/5 animate-pulse" aria-hidden>
      <div className="aspect-[3/4] bg-stone-soft rounded-2xl mb-4" />
      <div className="h-4 bg-stone-soft rounded-md mb-2 w-3/4" />
      <div className="h-3 bg-stone-soft rounded-md mb-4 w-1/2" />
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="h-4 bg-stone-soft rounded w-16" />
        <div className="h-3 bg-stone-soft rounded w-10" />
      </div>
    </div>
  );
}

export function ListingsGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      role="status"
      aria-label="جاري تحميل العروض"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ListingSkeleton key={i} />
      ))}
      <span className="sr-only">جاري التحميل…</span>
    </div>
  );
}
