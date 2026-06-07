/**
 * Admin utility functions for Rumia Admin Panel.
 */

// Hard-coded allowlist — never derived from user input or DB
const ADMIN_EMAILS = new Set(['paul.katam025@gmail.com']);

/**
 * Returns true if the given email belongs to an admin.
 * Validates: Requirements 1.3
 */
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}
