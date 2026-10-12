/** Turn free text ("Near Gate A") into a URL segment ("near-gate-a"). */
export function slugifySegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '') // King'ong'o -> kingongo, the same as the API and the place slug
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** URL segment for each property type, as in /nyeri/apartments/kamakwa/oserian. */
export const TYPE_SEGMENT: Record<string, string> = {
  hostel: 'student-hostels',
  apartment: 'apartments',
  short_stay: 'short-stays',
};

export interface ListingPathInput {
  county?: string | null;
  area?: string | null;
  slug?: string | null;
  /** hostel | apartment | short_stay. Missing means hostel; the page redirects to the right URL if that was a guess. */
  property_type?: string | null;
}

/**
 * Canonical public path of a property: /{market}/{type}/{place}/{name}. Lowercase and hyphenated so links survive
 * WhatsApp, copy/paste and search engines. The slug alone identifies the listing.
 */
export function listingPath(listing: ListingPathInput): string {
  const market = slugifySegment(listing.county || '');
  const area = slugifySegment(listing.area || '');
  // No county or area means no canonical place yet: use the short link, which resolves wherever the listing lives.
  if (!market || !area) return `/p/${listing.slug ?? ''}`;
  const type = TYPE_SEGMENT[listing.property_type || 'hostel'] ?? TYPE_SEGMENT.hostel;
  return `/${market}/${type}/${area}/${listing.slug ?? ''}`;
}
