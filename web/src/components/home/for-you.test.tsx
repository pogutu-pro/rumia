/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';

const get = jest.fn();
jest.mock('@/lib/api/rumia', () => ({ rumia: { GET: (...a: unknown[]) => get(...a) } }));
jest.mock('next/image', () => ({ __esModule: true, default: (p: { alt: string }) => <span>{p.alt}</span> }));
jest.mock('@/components/ui/save-button', () => ({ SaveButton: () => null }));

import { ForYou } from './for-you';
import { rememberInterest, rememberSearch } from '@/lib/personalisation';

const card = (id: string, name: string, kind: string) => ({ id, listing_id: id, name, slug: name, kind, status: 'live', flags: { registry: false, visited: false, has_video: false }, from_price: 7000, price_period: 'month', place_name: null });

beforeEach(() => {
  localStorage.clear();
  get.mockReset();
});

describe('ForYou', () => {
  it('shows nothing for someone new', async () => {
    const { container } = render(<ForYou />);
    await waitFor(() => expect(get).not.toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('offers recent searches', async () => {
    rememberSearch('single room with wifi');
    render(<ForYou />);
    expect(await screen.findByRole('link', { name: /single room with wifi/i })).toBeTruthy();
  });

  it('puts places like the ones they open first', async () => {
    rememberInterest({ kind: 'apartment', price: 15000 });
    rememberInterest({ kind: 'apartment', price: 16000 });
    get.mockResolvedValue({ data: { items: [card('1', 'Hostelone', 'hostel'), card('2', 'Flatone', 'apartment')] } });
    render(<ForYou />);
    await screen.findByText('Picked for you');
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names[0]).toBe('Flatone');
    expect(get.mock.calls[0][1].params.query).toMatchObject({ kind: 'apartment' });
  });
});
