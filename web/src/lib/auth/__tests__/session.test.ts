import { isFresh, sessionCookies, sessionFromToken } from '../session';

function token(claims: Record<string, unknown>) {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256' })}.${enc(claims)}.sig`;
}

describe('session helpers', () => {
  const future = Math.floor(Date.now() / 1000) + 600;

  it('decodes claims into a session', () => {
    const s = sessionFromToken(token({ sub: 'u1', email: 'a@b.co', exp: future, user_metadata: { full_name: 'Zoë' } }));
    expect(s?.user).toEqual({ id: 'u1', email: 'a@b.co', user_metadata: { full_name: 'Zoë' } });
    expect(isFresh(s)).toBe(true);
  });

  it('rejects malformed tokens and treats near-expiry as stale', () => {
    expect(sessionFromToken('garbage')).toBeNull();
    expect(sessionFromToken(undefined)).toBeNull();
    expect(sessionFromToken(token({ email: 'x' }))).toBeNull();
    const soon = sessionFromToken(token({ sub: 'u', exp: Math.floor(Date.now() / 1000) + 10 }));
    expect(isFresh(soon)).toBe(false);
    expect(isFresh(soon, 0)).toBe(true);
  });

  it('keeps the refresh token httpOnly and the access token readable', () => {
    const c = Object.fromEntries(
      sessionCookies({ access_token: 'a', refresh_token: 'r', expires_in: 1800, user_id: 'u' }).map((x) => [x.name, x.options.httpOnly]),
    );
    expect(c).toEqual({ rumia_at: false, rumia_rt: true, rumia_s: false });
  });
});
