/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';

const get = jest.fn();
jest.mock('@/lib/api/rumia', () => ({ rumia: { GET: (...a: unknown[]) => get(...a), POST: jest.fn(), DELETE: jest.fn() } }));
jest.mock('@/lib/events', () => ({ track: jest.fn() }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams('q=bedsitter under 8k'),
}));
jest.mock('next/image', () => ({ __esModule: true, default: (p: { alt: string }) => <span>{p.alt}</span> }));
jest.mock('@/components/ui/save-button', () => ({ SaveButton: () => null }));

import { SmartSearch, alertIntent } from './smart-search';

const card = (id: string, name: string) => ({ id, listing_id: id, name, slug: name.toLowerCase(), kind: 'hostel', status: 'live', flags: { registry: false, visited: false, has_video: false }, from_price: 7000, price_period: 'month' });

describe('alertIntent', () => {
  it('keeps the filters and the words, and drops paging and ordering', () => {
    expect(alertIntent('bedsitter', { max_price: 8000, sort: 'newest', new_since: 'x', places: ['gate-a'] })).toEqual({ max_price: 8000, places: ['gate-a'], q: 'bedsitter' });
  });
});

describe('SmartSearch', () => {
  beforeEach(() => get.mockReset());

  it('shows what was understood and the results', async () => {
    get.mockResolvedValue({ data: { total: 2, items: [card('1', 'Alpha'), card('2', 'Beta')], chips: [{ key: 'max_price', label: 'Under KSh 8,000' }], applied: { max_price: 8000 }, relaxations: [], next_cursor: null } });
    render(<SmartSearch />);
    expect(await screen.findByText('2 places')).toBeTruthy();
    expect(screen.getByText('Under KSh 8,000')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /notify me/i }).length).toBe(1);
  });

  it('offers ways to loosen the search when nothing matches', async () => {
    get.mockResolvedValue({ data: { total: 0, items: [], chips: [], applied: {}, relaxations: [{ label: 'Up to KSh 10,000', count: 4, change: {} }], next_cursor: null } });
    render(<SmartSearch />);
    expect(await screen.findByText(/loosen one thing/i)).toBeTruthy();
    expect(screen.getByText(/Up to KSh 10,000/)).toBeTruthy();
  });

  it('says so when the search fails', async () => {
    get.mockRejectedValue(new Error('offline'));
    render(<SmartSearch />);
    await waitFor(() => expect(screen.getByText(/could not search/i)).toBeTruthy());
  });
});
