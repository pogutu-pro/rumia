import Link from 'next/link';
import { Play } from 'lucide-react';

export function VideosEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 mb-5">
        <Play className="h-8 w-8 text-emerald-600 fill-emerald-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">No videos yet</h2>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
        Property video tours will appear here once agents publish them. Check
        back soon.
      </p>
      <Link
        href="/hostels"
        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
      >
        Explore listings
      </Link>
    </div>
  );
}
