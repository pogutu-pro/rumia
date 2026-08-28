import { buildOrderPositions, moveListingWithin } from '../listing-order';

describe('buildOrderPositions', () => {
  it('assigns 1-based positions in list order', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(buildOrderPositions(items)).toEqual([
      { id: 'a', sort_position: 1 },
      { id: 'b', sort_position: 2 },
      { id: 'c', sort_position: 3 },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(buildOrderPositions([])).toEqual([]);
  });

  it('handles a single item', () => {
    expect(buildOrderPositions([{ id: 'x' }])).toEqual([{ id: 'x', sort_position: 1 }]);
  });
});

describe('moveListingWithin', () => {
  const full = [
    { id: '1' },
    { id: '2' },
    { id: '3' },
    { id: '4' },
    { id: '5' },
  ];

  it('moves an item down one step within the visible list', () => {
    const next = moveListingWithin(full, full, '2', 1);
    expect(next.map((l) => l.id)).toEqual(['1', '3', '2', '4', '5']);
  });

  it('moves an item up one step within the visible list', () => {
    const next = moveListingWithin(full, full, '4', -1);
    expect(next.map((l) => l.id)).toEqual(['1', '2', '4', '3', '5']);
  });

  it('does not move the first item up', () => {
    const next = moveListingWithin(full, full, '1', -1);
    expect(next).toBe(full);
  });

  it('does not move the last item down', () => {
    const next = moveListingWithin(full, full, '5', 1);
    expect(next).toBe(full);
  });

  it('ignores unknown target ids', () => {
    const next = moveListingWithin(full, full, 'nope', 1);
    expect(next).toBe(full);
  });

  it('maps moves through a filtered subset back onto the full list', () => {
    // Filtered view only shows 2, 4 and 5. Moving 5 up means swapping with 4.
    const filtered = [full[1], full[3], full[4]]; // ids 2, 4, 5
    const next = moveListingWithin(full, filtered, '5', -1);
    expect(next.map((l) => l.id)).toEqual(['1', '2', '3', '5', '4']);
  });

  it('returns a new array when a move happens and the same array otherwise', () => {
    const moved = moveListingWithin(full, full, '2', 1);
    expect(moved).not.toBe(full);
    expect(full.map((l) => l.id)).toEqual(['1', '2', '3', '4', '5']);
  });
});
