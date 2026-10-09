/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const get = jest.fn();
const post = jest.fn();
jest.mock('@/lib/api/rumia', () => ({ rumia: { GET: (...a: unknown[]) => get(...a), POST: (...a: unknown[]) => post(...a) } }));
jest.mock('next/image', () => ({ __esModule: true, default: (p: { alt: string }) => <span>{p.alt}</span> }));
jest.mock('@/components/ui/save-button', () => ({ SaveButton: () => null }));

import { PropertyFacts, ReportListing, SimilarPlaces } from '../property-extras';

beforeEach(() => jest.clearAllMocks());

describe('PropertyFacts', () => {
  it('shows only the facts the API returns', async () => {
    get.mockResolvedValue({ data: { facts: [{ kind: 'availability', text: 'Available, confirmed by the owner 3 days ago' }] } });
    render(<PropertyFacts slug="green-view" />);
    expect(await screen.findByText(/confirmed by the owner 3 days ago/)).toBeTruthy();
  });
  it('renders nothing when there are none or the call fails', async () => {
    get.mockRejectedValue(new Error('x'));
    const { container } = render(<PropertyFacts slug="green-view" />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });
});

describe('SimilarPlaces', () => {
  it('lists up to four similar places', async () => {
    const card = (i: number) => ({ id: String(i), listing_id: String(i), name: `Place ${i}`, slug: `p${i}`, kind: 'hostel', status: 'live', flags: { registry: false, visited: false, has_video: false }, from_price: 7000, price_period: 'month' });
    get.mockResolvedValue({ data: { items: [1, 2, 3, 4, 5].map(card) } });
    render(<SimilarPlaces slug="green-view" />);
    expect(await screen.findByText('Place 4')).toBeTruthy();
    expect(screen.queryByText('Place 5')).toBeNull();
  });
});

describe('ReportListing', () => {
  it('sends the chosen reason and details', async () => {
    post.mockResolvedValue({ data: {} });
    render(<ReportListing slug="green-view" />);
    fireEvent.click(screen.getByRole('button', { name: /report a problem/i }));
    fireEvent.click(await screen.findByLabelText(/price is wrong/i));
    fireEvent.change(screen.getByLabelText(/more detail/i), { target: { value: 'Asked for more' } });
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/api/v1/properties/{slug}/reports');
    expect(post.mock.calls[0][1].body).toEqual({ reason: 'wrong_price', details: 'Asked for more' });
    expect(post.mock.calls[0][1].params.path.slug).toBe('green-view');
  });
});
