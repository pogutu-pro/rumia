import { bnbRedirectFor } from '../separation';

const B = 'https://rumiabnb.rumia.co.ke';

describe('bnbRedirectFor', () => {
  it('sends /bnb to the RumiaBnB home and keeps campaign parameters', () => {
    expect(bnbRedirectFor('/bnb')).toBe(`${B}/`);
    expect(bnbRedirectFor('/bnb/', '?utm_source=tiktok')).toBe(`${B}/?utm_source=tiktok`);
  });

  it('maps the short-stay pages by market, place and name', () => {
    expect(bnbRedirectFor('/nyeri/short-stays')).toBe(`${B}/stays?where=nyeri`);
    expect(bnbRedirectFor('/nyeri/short-stays/kamakwa')).toBe(`${B}/stays?where=kamakwa`);
    expect(bnbRedirectFor('/nyeri/short-stays/kamakwa/regal-cottage', '?utm_campaign=x')).toBe(`${B}/stay/regal-cottage?utm_campaign=x`);
    expect(bnbRedirectFor('/nyeri/short-stays/near-gate-a')).toBe(`${B}/stays?where=near+gate+a`);
  });

  it('leaves every other Rumia path alone', () => {
    for (const p of ['/', '/hostels', '/nyeri', '/nyeri/student-hostels', '/nyeri/apartments/kamakwa/oserian', '/bnb/abc', '/p/regal', '/bnb-site/short-stays/x']) {
      expect(bnbRedirectFor(p)).toBeNull();
    }
  });
});
