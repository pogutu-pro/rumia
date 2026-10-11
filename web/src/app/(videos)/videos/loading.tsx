import { Skeleton } from '@/components/ui/skeleton';

/** Matches the portrait player layout: header row, 9:16 frame, details, actions. */
export default function Loading() {
  return (
    <div className="mx-auto h-[calc(100dvh-var(--shell-header-h)-var(--bottom-nav-h))] max-w-md overflow-hidden border-x border-line p-3" aria-busy="true">
      <Skeleton className="mb-3 h-8 w-40" />
      <Skeleton className="mx-auto aspect-[9/16] max-h-[60dvh] rounded-2xl" />
      <Skeleton className="mt-3 h-5 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/3" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 flex-1 rounded-xl" />
      </div>
    </div>
  );
}
