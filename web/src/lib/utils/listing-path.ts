/** Turn free text ("Near Gate A") into a URL segment ("near-gate-a"). */
export function slugifySegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ListingPathInput {
  county?: string | null;
  area?: string | null;
  slug?: string | null;
}

/**
 * Canonical public path for a property. Lowercase and hyphenated so links survive
 * WhatsApp, copy/paste and search engines. The slug alone identifies the listing.
 */
export function listingPath(listing: ListingPathInput): string {
  const county = slugifySegment(listing.county || 'nyeri') || 'nyeri';
  const area = slugifySegment(listing.area || 'dekut') || 'dekut';
  return `/hostels/${county}/${area}/${listing.slug ?? ''}`;
}
