import { getStartingPrice, pickBestRoomType } from '../starting-price';

describe('getStartingPrice', () => {
  it('uses the cheapest shared room type when one exists', () => {
    const rts = [
      { price: 9300, occupancy: 1 },
      { price: 5800, occupancy: 2 },
      { price: 7000, occupancy: 2 },
    ];
    expect(getStartingPrice({ price: 9300 }, rts)).toBe(5800);
  });

  it('falls back to the cheapest available room type', () => {
    const rts = [
      { price: 9300, occupancy: 1 },
      { price: 11300, occupancy: 1 },
    ];
    expect(getStartingPrice({ price: 12000 }, rts)).toBe(9300);
  });

  it('ignores unavailable room types', () => {
    const rts = [
      { price: 4000, occupancy: 2, is_available: false },
      { price: 8000, occupancy: 1 },
    ];
    expect(pickBestRoomType(rts)?.price).toBe(8000);
  });

  it('falls back to listing prices when there are no room types', () => {
    expect(getStartingPrice({ price: 9000, price_sharing: 6000 }, [])).toBe(6000);
    expect(getStartingPrice({ price: 9000 }, null)).toBe(9000);
    expect(getStartingPrice({})).toBe(0);
  });
});
