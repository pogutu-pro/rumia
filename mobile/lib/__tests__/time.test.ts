import { timeAgo } from '../time';

describe('timeAgo', () => {
  const now = new Date('2026-08-30T12:00:00Z');

  it('returns just now for fresh timestamps', () => {
    expect(timeAgo('2026-08-30T11:59:45Z', now)).toBe('just now');
  });

  it('returns minutes ago', () => {
    expect(timeAgo('2026-08-30T11:30:00Z', now)).toBe('30m ago');
  });

  it('returns hours ago', () => {
    expect(timeAgo('2026-08-30T09:00:00Z', now)).toBe('3h ago');
  });

  it('returns days ago', () => {
    expect(timeAgo('2026-08-27T12:00:00Z', now)).toBe('3d ago');
  });

  it('returns a short date for older timestamps', () => {
    const older = new Date(now);
    older.setDate(older.getDate() - 30);
    expect(timeAgo(older.toISOString(), now)).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });
});