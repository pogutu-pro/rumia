import { affinity, forgetSearches, personalise, readTaste, rememberInterest, rememberSearch } from '../personalisation';

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe('recent searches', () => {
  it('keeps the newest first, without duplicates, and caps the list', () => {
    const s = memory();
    ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'].forEach((q) => rememberSearch(q, s));
    rememberSearch('C3', s);
    const list = readTaste(s).searches;
    expect(list[0]).toBe('C3');
    expect(list).toHaveLength(6);
    expect(list.filter((x) => x.toLowerCase() === 'c3')).toHaveLength(1);
  });
  it('ignores empty or one-letter searches and can be cleared', () => {
    const s = memory();
    rememberSearch('  ', s);
    rememberSearch('x', s);
    expect(readTaste(s).searches).toEqual([]);
    rememberSearch('bedsitter', s);
    forgetSearches(s);
    expect(readTaste(s).searches).toEqual([]);
  });
  it('survives corrupt storage', () => {
    const s = memory();
    s.setItem('rumia_taste_v1', '{not json');
    expect(readTaste(s).searches).toEqual([]);
  });
});

describe('personalise', () => {
  const items = [
    { id: 1, kind: 'apartment', place_name: 'Town', from_price: 20000 },
    { id: 2, kind: 'hostel', place_name: 'Gate A', from_price: 6000 },
    { id: 3, kind: 'hostel', place_name: 'Gate B', from_price: 7000 },
  ];

  it('leaves the order alone when nothing is known', () => {
    expect(personalise(items, readTaste(memory())).map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('moves places that match recent interest up', () => {
    const s = memory();
    rememberInterest({ kind: 'hostel', place: 'Gate A', price: 6000 }, s);
    rememberInterest({ kind: 'hostel', place: 'Gate A', price: 6500 }, s);
    expect(personalise(items, readTaste(s)).map((i) => i.id)).toEqual([2, 3, 1]);
  });

  it('lets recent interest outweigh older interest', () => {
    const s = memory();
    for (let i = 0; i < 3; i++) rememberInterest({ kind: 'apartment' }, s);
    for (let i = 0; i < 6; i++) rememberInterest({ kind: 'hostel' }, s);
    const t = readTaste(s);
    expect(affinity(items[1], t)).toBeGreaterThan(affinity(items[0], t));
  });

  it('does not bury a much better server position for a weak signal', () => {
    const s = memory();
    rememberInterest({ place: 'Gate B' }, s);
    const many = Array.from({ length: 30 }, (_, i) => ({ id: i, kind: 'hostel', place_name: i === 29 ? 'Gate B' : 'Other', from_price: null }));
    const out = personalise(many, readTaste(s));
    expect(out[0].id).toBe(29); // a clear match rises
    expect(out.slice(1, 4).map((x) => x.id)).toEqual([0, 1, 2]); // the rest keep server order
  });
});
