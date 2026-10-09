'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { LatLng } from '@/lib/rumia/geo';
import type { MapPoint } from './map-types';

/** The map is optional: without a key nothing loads and no Map button is shown. */
export function mapEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}

const MapEmbed = dynamic(() => import('./map-embed'), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-rum-sunken" aria-hidden="true">
      <span className="inline-flex items-center gap-2 text-sm text-rum-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading map…
      </span>
    </div>
  );
}

interface PanelProps {
  points: MapPoint[];
  center: LatLng;
  hoveredId?: string | null;
  onCameraChange?: (center: LatLng) => void;
}

export function MapPanel({ points, center, hoveredId, onCameraChange, className }: PanelProps & { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-rum-media border border-rum-line bg-rum-sunken', className)}>
      <MapEmbed points={points} center={center} hoveredId={hoveredId} onCameraChange={onCameraChange} />
    </div>
  );
}

interface MobileProps extends PanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
}

/** Phones: the map takes the whole screen, with a "List" button back to results. */
export function MobileMap({ open, onClose, title, ...panel }: MobileProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-rum-surface lg:hidden">
      <header className="flex items-center justify-between gap-3 border-b border-rum-line px-4 py-3">
        <p className="text-base font-semibold text-rum-text">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-2 rounded-rum-control border border-rum-line bg-rum-raised px-4 text-sm font-semibold text-rum-text"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          List
        </button>
      </header>
      <div className="relative flex-1">
        <MapPanel {...panel} className="h-full rounded-none border-0" />
      </div>
    </div>
  );
}
