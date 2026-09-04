import { formatDateInput, isValidDate } from '../tour-helpers';

describe('formatDateInput', () => {
  it('keeps only digits and stops at 8', () => {
    expect(formatDateInput('20260905')).toBe('2026-09-05');
    expect(formatDateInput('2026-09-05')).toBe('2026-09-05');
    expect(formatDateInput('20260905123')).toBe('2026-09-05');
  });

  it('formats incrementally as digits arrive', () => {
    expect(formatDateInput('2026')).toBe('2026');
    expect(formatDateInput('202609')).toBe('2026-09');
    expect(formatDateInput('2026090')).toBe('2026-09-0');
  });

  it('strips non-digit input', () => {
    expect(formatDateInput('20/26/09/05')).toBe('2026-09-05');
  });
});

describe('isValidDate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDate('2026-09-05')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true); // leap year
  });

  it('rejects invalid dates, months, and days', () => {
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-00-10')).toBe(false);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2025-02-29')).toBe(false); // non-leap year
    expect(isValidDate('2026-09-05x')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isValidDate('')).toBe(false);
    expect(isValidDate('2026-9-5')).toBe(false);
    expect(isValidDate('05/09/2026')).toBe(false);
    expect(isValidDate('2026')).toBe(false);
  });
});