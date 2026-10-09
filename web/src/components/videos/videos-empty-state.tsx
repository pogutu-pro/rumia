import Link from 'next/link';
import { Play } from 'lucide-react';

export function VideosEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6 text-center bg-background">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-5">
        <Play className="h-8 w-8 text-primary fill-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">No videos yet</h2>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
        Property video tours will appear here once agents publish them. Check
        back soon.
      </p>
      <Link
        href="/hostels"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
      >
        Explore listings
      </Link>
    </div>
  );
}
