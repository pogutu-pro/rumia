import { isAdminEmail } from '../admin';

describe('isAdminEmail', () => {
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'admin@rumia.co.ke,ops@rumia.co.ke';
  });

  afterAll(() => {
    process.env.ADMIN_EMAILS = originalAdminEmails;
  });

  describe('returns true for admin emails', () => {
    it('returns true for a configured admin email', () => {
      expect(isAdminEmail('admin@rumia.co.ke')).toBe(true);
    });

    it('returns true case-insensitively', () => {
      expect(isAdminEmail('ADMIN@RUMIA.CO.KE')).toBe(true);
    });

    it('returns true for another configured admin email', () => {
      expect(isAdminEmail('ops@rumia.co.ke')).toBe(true);
    });
  });

  describe('returns false for non-admin emails', () => {
    it('returns false for a regular user email', () => {
      expect(isAdminEmail('user@example.com')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(isAdminEmail('')).toBe(false);
    });

    it('returns false for a configured email with extra characters', () => {
      expect(isAdminEmail('admin@rumia.co.ke.extra')).toBe(false);
    });

    it('returns false for agent@rumia.co.ke', () => {
      expect(isAdminEmail('agent@rumia.co.ke')).toBe(false);
    });

    it('returns false for a random email with no admin substring', () => {
      expect(isAdminEmail('john.doe@company.com')).toBe(false);
    });

    it('returns false when no admin emails are configured', () => {
      process.env.ADMIN_EMAILS = '';
      expect(isAdminEmail('admin@rumia.co.ke')).toBe(false);
    });
  });
});
