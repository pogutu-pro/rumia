import { tourRows } from '../photo-tour';

const P = { width: 576, height: 1280 };
const L = { width: 1600, height: 1200 };

describe('tourRows', () => {
  it('pairs tall photos and leaves a lone one on its own', () => {
    expect(tourRows([P, P, P, P, P])).toEqual([
      { kind: 'pair', i: [0, 1] },
      { kind: 'pair', i: [2, 3] },
      { kind: 'single', i: 4 },
    ]);
  });
  it('gives wide photos a full row now and then', () => {
    expect(tourRows([L, P, P, L, L])).toEqual([
      { kind: 'wide', i: 0 },
      { kind: 'pair', i: [1, 2] },
      { kind: 'wide', i: 3 },
      { kind: 'single', i: 4 },
    ]);
  });
});
