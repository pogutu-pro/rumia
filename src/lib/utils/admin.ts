/**
 * Admin utility functions for Rumia Admin Panel.
 */

function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Returns true if the given email belongs to an admin.
 * Validates: Requirements 1.3
 */
export function isAdminEmail(email: string): boolean {
  return getAdminEmails().has(email.trim().toLowerCase());
}
