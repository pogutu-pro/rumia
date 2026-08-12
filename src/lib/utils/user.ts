/**
 * Generates user initials from a full name.
 * Takes the first letter of each word, up to 2 characters, in uppercase.
 */
export function getUserInitials(name: string): string {
  if (typeof name !== 'string' || !name.trim()) return '';

  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}
