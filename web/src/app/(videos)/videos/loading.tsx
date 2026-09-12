import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="relative w-full bg-muted">
      <div
        className="mx-auto h-[calc(100dvh_-_64px_-_env(safe-area-inset-bottom))] w-full overflow-y-scroll md:h-[100dvh] md:max-w-[480px]"
        style={{
          scrollSnapType: 'y mandatory',
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="snap-start md:py-1"
            style={{ height: '100%', scrollSnapAlign: 'start' }}
          >
            <div className="relative h-full w-full flex-shrink-0 snap-start overflow-hidden bg-card md:rounded-2xl md:shadow-xl md:border md:border-border">
              <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
              {/* Lighter gradient shimmer overlay */}
              <div
                className="absolute inset-x-0 bottom-0 pointer-events-none"
                style={{
                  height: '55%',
                  background:
                    'linear-gradient(to top, hsl(var(--muted) / 0.9) 0%, hsl(var(--muted) / 0.4) 40%, transparent 100%)',
                }}
              />
              <div className="absolute inset-x-0 bottom-0 px-4 pb-6 md:pb-8">
                <Skeleton className="h-5 w-20 rounded-full mb-3" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-48" />
              </div>
              {/* Action buttons skeleton */}
              <div className="absolute right-3 bottom-36 flex flex-col items-center gap-4">
                <Skeleton className="h-11 w-11 rounded-full" />
                <Skeleton className="h-11 w-11 rounded-full" />
                <Skeleton className="h-11 w-11 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
