/** Small geo helpers for the Explore map (client-side only, no Google dependency). */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoPoint {
  slug: string;
  name?: string;
  lat?: number | null;
  lng?: number | null;
}

const R_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Landmark nearest to the map centre, used for the "Search this area" button.
 * Returns null when every candidate is missing coordinates or further than `maxKm`.
 */
export function nearestLandmark(
  center: LatLng,
  landmarks: GeoPoint[],
  maxKm = 15,
): { slug: string; name?: string; km: number } | null {
  let best: { slug: string; name?: string; km: number } | null = null;
  for (const l of landmarks) {
    if (typeof l.lat !== 'number' || typeof l.lng !== 'number') continue;
    const km = haversineKm(center, { lat: l.lat, lng: l.lng });
    if (km > maxKm) continue;
    if (!best || km < best.km) best = { slug: l.slug, name: l.name, km };
  }
  return best;
}

/** Average of the usable coordinates, or null when there are none. */
export function centerOf(points: Array<{ lat?: number | null; lng?: number | null }>): LatLng | null {
  let lat = 0;
  let lng = 0;
  let n = 0;
  for (const p of points) {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
    lat += p.lat;
    lng += p.lng;
    n += 1;
  }
  return n === 0 ? null : { lat: lat / n, lng: lng / n };
}
