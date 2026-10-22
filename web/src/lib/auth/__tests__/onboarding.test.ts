import { afterSignIn, missingSetup } from '../onboarding';

describe('missingSetup', () => {
  it('asks a new student for phone, campus and name', () => {
    expect(missingSetup({ role: 'student' })).toEqual({ name: true, phone: true, campus: true, required: true });
  });

  it('is done once phone and campus are in, even without a name', () => {
    const m = missingSetup({ role: 'student', phone: '0712345678', home_campus_confirmed_at: '2026-10-01T00:00:00Z' });
    expect(m.required).toBe(false);
  });

  it('treats a blank phone as missing', () => {
    expect(missingSetup({ role: 'student', phone: '  ', home_campus_confirmed_at: '2026-10-01' }).phone).toBe(true);
  });

  it('never asks staff', () => {
    for (const role of ['agent', 'admin', 'manager', 'super_admin']) {
      expect(missingSetup({ role }).required).toBe(false);
    }
  });
});

describe('afterSignIn', () => {
  it('keeps where the person was going when setup is done', () => {
    expect(afterSignIn('/nyeri/apartments/boma/x', false, false)).toBe('/nyeri/apartments/boma/x');
  });

  it('goes through /welcome first and keeps the destination', () => {
    expect(afterSignIn('/saved?tab=a', true, false)).toBe('/welcome?next=%2Fsaved%3Ftab%3Da');
  });

  it('respects "Skip for now"', () => {
    expect(afterSignIn('/saved', true, true)).toBe('/saved');
  });
});
