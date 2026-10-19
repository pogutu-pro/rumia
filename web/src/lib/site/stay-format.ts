import type { BnbStay } from './bnb-api';
import { BNB_DEFAULT_HOST_NAME } from './bnb';

/** Small helpers that turn a stay from the API into what a guest reads. */

export interface StayImage {
  url: string;
  blur?: string | null;
  width?: number | null;
  height?: number | null;
}

export function stayImages(stay: BnbStay): StayImage[] {
  return [...(stay.images ?? [])]
    .map((img) => img as Record<string, unknown>)
    .sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0))
    .map((img) => ({
      url: String(img.r2_url ?? img.url ?? ''),
      blur: (img.blur_data_url as string | null) ?? null,
      width: (img.width as number | null) ?? null,
      height: (img.height as number | null) ?? null,
    }))
    .filter((img) => img.url);
}

/** The picture for a card: the first photo, else the video's thumbnail. */
export function stayCover(stay: BnbStay): string | null {
  const first = stayImages(stay)[0];
  if (first) return first.url;
  return stay.youtube_id ? `https://img.youtube.com/vi/${stay.youtube_id}/hqdefault.jpg` : null;
}

export function stayPlace(stay: BnbStay): string {
  const area = (stay.area ?? '').trim();
  const county = (stay.county ?? '').trim();
  const nice = (s: string) => s.replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());
  if (area && county && area.toLowerCase() !== county.toLowerCase()) return `${nice(area)}, ${nice(county)}`;
  return nice(area || county || stay.location);
}

/** The name guests see as the host: the listing's own host name, else the site default (never the lister's account). */
export function stayHost(stay: BnbStay): string {
  return stay.bnb?.host_name?.trim() || BNB_DEFAULT_HOST_NAME;
}

const KINDS: Record<string, string> = {
  entire_place: 'Entire place',
  private_room: 'Private room',
  shared_space: 'Shared space',
};

export function stayKind(stay: BnbStay): string | null {
  return KINDS[stay.bnb?.listing_type ?? ''] ?? null;
}

export function kes(amount: number): string {
  return `KSh ${Math.round(amount).toLocaleString('en-KE')}`;
}

/** "4 guests, 2 bedrooms, 1 bathroom": only the facts the host filled in. */
export function stayFacts(stay: BnbStay): string[] {
  const b = stay.bnb;
  if (!b) return [];
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const beds = (b.bed_config ?? []).reduce((n, bed) => n + Number((bed as Record<string, unknown>).qty ?? 0), 0);
  return [
    b.max_guests ? plural(b.max_guests, 'guest') : null,
    b.bedrooms != null ? plural(b.bedrooms, 'bedroom') : null,
    beds > 0 ? plural(beds, 'bed') : null,
    b.bathrooms != null ? plural(b.bathrooms, 'bathroom') : null,
  ].filter((f): f is string => !!f);
}

export function stayPath(stay: BnbStay): string {
  return `/stay/${stay.slug ?? stay.id}`;
}
