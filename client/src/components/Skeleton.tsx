export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} aria-hidden="true" />
  );
}

export function SlotSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-20 shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}
