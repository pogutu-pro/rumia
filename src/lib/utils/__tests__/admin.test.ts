import { isAdminEmail } from '../admin';

describe('isAdminEmail', () => {
  describe('returns true for admin emails', () => {
    it('returns true for paul@rumia.co.ke (exact canonical admin)', () => {
      expect(isAdminEmail('paul@rumia.co.ke')).toBe(true);
    });

    it('returns true for PAUL@RUMIA.CO.KE (case-insensitive)', () => {
      expect(isAdminEmail('PAUL@RUMIA.CO.KE')).toBe(true);
    });

    it('returns true for Paul@Rumia.co.ke (mixed case)', () => {
      expect(isAdminEmail('Paul@Rumia.co.ke')).toBe(true);
    });

    it('returns true for admin@example.com (contains "admin")', () => {
      expect(isAdminEmail('admin@example.com')).toBe(true);
    });

    it('returns true for ADMIN@EXAMPLE.COM (contains "admin" after lowercasing)', () => {
      expect(isAdminEmail('ADMIN@EXAMPLE.COM')).toBe(true);
    });

    it('returns true for superadmin@domain.com (contains "admin" as substring)', () => {
      expect(isAdminEmail('superadmin@domain.com')).toBe(true);
    });

    it('returns true for test.admin@org.co (contains "admin")', () => {
      expect(isAdminEmail('test.admin@org.co')).toBe(true);
    });
  });

  describe('returns false for non-admin emails', () => {
    it('returns false for a regular user email', () => {
      expect(isAdminEmail('user@example.com')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(isAdminEmail('')).toBe(false);
    });

    it('returns false for paul@rumia.co.ke with extra characters', () => {
      expect(isAdminEmail('paul@rumia.co.ke.extra')).toBe(false);
    });

    it('returns false for agent@rumia.co.ke', () => {
      expect(isAdminEmail('agent@rumia.co.ke')).toBe(false);
    });

    it('returns false for a random email with no admin substring', () => {
      expect(isAdminEmail('john.doe@company.com')).toBe(false);
    });
  });
});
