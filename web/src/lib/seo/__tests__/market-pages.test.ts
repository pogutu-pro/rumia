import { buildMetadata, pathFor, type PageData } from '../market-pages';
import { KIND_BY_SLUG } from '../kinds';

const card = (price: number) => ({ id: String(price), slug: 's', name: 'n', kind: 'hostel', status: 'live', from_price: price, price_period: 'month', flags: {} }) as never;
const base = (n: number, over: Partial<PageData> = {}): PageData => ({
  market: { slug: 'nyeri', name: 'Nyeri' }, cards: Array.from({ length: n }, (_, i) => card(5000 + i * 1000)),
  total: n, places: [], landmarks: [], ...over,
});

describe('market page SEO', () => {
  it('builds clean paths', () => {
    expect(pathFor(base(0))).toBe('/nyeri');
    expect(pathFor(base(0, { kind: KIND_BY_SLUG['apartments'] }))).toBe('/nyeri/apartments');
    expect(pathFor(base(0, { place: { slug: 'boma', name: 'Boma' }, kind: KIND_BY_SLUG['bedsitters'] }))).toBe('/nyeri/bedsitters/boma');
  });

  it('indexes pages with enough places and noindexes thin ones', () => {
    expect(buildMetadata(base(3)).robots).toEqual({ index: true, follow: true });
    expect(buildMetadata(base(2)).robots).toEqual({ index: false, follow: true });
  });

  it('puts the real price floor and canonical in the metadata', () => {
    const m = buildMetadata(base(4, { kind: KIND_BY_SLUG['student-hostels'] }));
    expect(m.description).toContain('KES 5,000');
    expect(m.alternates?.canonical).toBe('https://rumia.co.ke/nyeri/student-hostels');
    expect(m.title).toBe('Student hostels in Nyeri');
  });
});
