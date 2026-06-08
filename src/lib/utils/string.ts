export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Generate a listing slug from hostel name + area keyword.
 * e.g. "Sunrise Court" + "dekut" → "sunrise-court-dekut"
 */
export function generateListingSlug(name: string, area = 'dekut'): string {
  return `${slugify(name)}-${area}`;
}

/**
 * Generate an agent slug from full name.
 * e.g. "James Ogutu" → "james-ogutu"
 */
export function generateAgentSlug(name: string): string {
  return slugify(name);
}

/**
 * Resolve a unique slug by appending -2, -3 … if the base already exists.
 * Pass a checker function that returns true when a slug is already taken.
 */
export async function uniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>
): Promise<string> {
  let candidate = base;
  let n = 2;
  while (await isTaken(candidate)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}
