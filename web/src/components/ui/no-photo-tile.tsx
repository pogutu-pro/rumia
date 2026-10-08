import { ImageOff } from 'lucide-react';

/** Neutral placeholder for a listing that has no photo yet. Fills its relatively positioned parent. */
export function NoPhotoTile({ className = '' }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="No photo yet"
      className={`absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-500 ${className}`}
    >
      <ImageOff className="h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
      <span className="text-xs font-medium">No photo yet</span>
    </div>
  );
}
