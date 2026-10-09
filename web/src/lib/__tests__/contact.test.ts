/** @jest-environment jsdom */
import { clearFollowUp, dueFollowUp, fallbackWhatsAppUrl, rememberFollowUp, waNumber } from '../contact';

describe('waNumber', () => {
  it('normalises Kenyan number formats to wa.me digits', () => {
    expect(waNumber('0712 345 678')).toBe('254712345678');
    expect(waNumber('+254 712-345-678')).toBe('254712345678');
    expect(waNumber('712345678')).toBe('254712345678');
    expect(waNumber('254712345678')).toBe('254712345678');
    expect(waNumber(null)).toBe('');
  });
});

describe('fallbackWhatsAppUrl', () => {
  it('builds a plain link with the place name, or nothing without a number', () => {
    expect(fallbackWhatsAppUrl('0712345678', 'Kamakwa Heights')).toBe(
      'https://wa.me/254712345678?text=' + encodeURIComponent('Hi, I found *Kamakwa Heights* on Rumia. Is it still available?'),
    );
    expect(fallbackWhatsAppUrl('', 'x')).toBeNull();
  });
});

describe('follow-up prompt window', () => {
  beforeEach(() => window.localStorage.clear());

  it('offers the latest contact within 30 minutes only', () => {
    const t0 = 1_000_000;
    rememberFollowUp({ ref: 'AAAAA', name: 'Mary', at: t0 });
    rememberFollowUp({ ref: 'BBBBB', name: 'Joseph', at: t0 + 60_000 });
    expect(dueFollowUp(t0 + 120_000)?.ref).toBe('BBBBB');
    expect(dueFollowUp(t0 + 31 * 60_000 + 60_000)).toBeNull();
  });

  it('forgets a contact once it was answered', () => {
    rememberFollowUp({ ref: 'AAAAA', name: 'Mary', at: 1000 });
    clearFollowUp('AAAAA');
    expect(dueFollowUp(2000)).toBeNull();
  });
});
