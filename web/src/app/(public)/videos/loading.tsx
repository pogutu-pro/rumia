import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="relative w-full bg-slate-950">
      <div
        className="h-[calc(100dvh-56px)] w-full overflow-y-scroll"
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
            className="snap-start"
            style={{ height: 'calc(100dvh - 56px)', scrollSnapAlign: 'start' }}
          >
            <div className="relative h-full w-full flex-shrink-0 snap-start overflow-hidden bg-slate-950">
              <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
              <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-4 pb-6 md:pb-8">
                <Skeleton className="h-5 w-20 rounded-full mb-3" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
