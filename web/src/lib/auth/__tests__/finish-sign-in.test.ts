import { errorText } from '../finish-sign-in';

describe('errorText', () => {
  it('reads the API domain error shape', () => {
    expect(errorText({ detail: { code: 'UNAUTHORIZED', message: 'That code has expired. Request a new one.' } }, 'x')).toBe(
      'That code has expired. Request a new one.',
    );
  });

  it('reads the rate-limit shape', () => {
    expect(errorText({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } }, 'x')).toBe(
      'Too many requests. Please try again later.',
    );
  });

  it('falls back for validation lists and empty bodies', () => {
    expect(errorText({ detail: [{ msg: 'bad' }] }, 'fallback')).toBe('fallback');
    expect(errorText(null, 'fallback')).toBe('fallback');
  });
});
