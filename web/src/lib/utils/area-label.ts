/** Area values arrive both as display names ("Embassy Area") and as slugs ("embassy-area"). */
export function normaliseArea(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Display form of an area: slugs become Title Case, names that already read well are left alone. */
export function formatAreaName(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (/[A-Z]/.test(raw) || (/\s/.test(raw) && !/[-_]/.test(raw))) return raw;
  return normaliseArea(raw).replace(/\b\w/g, (c) => c.toUpperCase());
}
