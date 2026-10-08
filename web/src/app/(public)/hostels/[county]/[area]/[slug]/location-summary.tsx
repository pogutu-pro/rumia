import { MapPin, ExternalLink } from 'lucide-react';

interface LocationSummaryProps {
  title: string;
  area?: string | null;
  location?: string | null;
  specificLocation?: string | null;
  distanceText?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

function toCoordinate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Where the place is, in words, with a link to open it in Google Maps. Loads no map script. */
export function LocationSummary({
  title,
  area,
  location,
  specificLocation,
  distanceText,
  latitude,
  longitude,
}: LocationSummaryProps) {
  const lat = toCoordinate(latitude);
  const lng = toCoordinate(longitude);
  const line = [area, specificLocation].filter(Boolean).join(' · ') || location || '';
  if (!line && lat === null) return null;

  const mapsHref =
    lat !== null && lng !== null
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${title} ${line}`.trim())}`;

  return (
    <section className="space-y-3" aria-labelledby="location-heading">
      <h2 id="location-heading" className="text-xl font-bold text-slate-950">
        Location
      </h2>
      <p className="flex items-start gap-2 text-slate-700">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span>
          {line}
          {distanceText ? ` · ${distanceText}` : ''}
        </span>
      </p>
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline"
      >
        Open in Google Maps
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </section>
  );
}
