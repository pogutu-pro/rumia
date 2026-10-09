/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { cardHref } from '../search-card';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const post = jest.fn();
const get = jest.fn();
const del = jest.fn();
jest.mock('@/lib/api/rumia', () => ({ rumia: { POST: (...a: unknown[]) => post(...a), GET: (...a: unknown[]) => get(...a), DELETE: (...a: unknown[]) => del(...a) } }));
jest.mock('@/lib/events', () => ({ track: jest.fn() }));

import { AlertButton } from '../alert-button';
import { AlertsList } from '../alerts-list';

beforeEach(() => jest.clearAllMocks());

describe('cardHref', () => {
  it('sends hostels and apartments to the listing page by slug', () => {
    expect(cardHref({ kind: 'hostel', slug: 'green-view', listing_id: 'l1' })).toBe('/hostels/nyeri/dekut/green-view');
  });
  it('sends short stays to the BnB page by listing id', () => {
    expect(cardHref({ kind: 'house', slug: 'cosy-house', listing_id: 'l9' })).toBe('/bnb/l9');
  });
});

describe('AlertButton', () => {
  const intent = { q: 'bedsitter', max_price: 8000 };

  async function open() {
    render(<AlertButton intent={intent} label="Bedsitter under 8,000" />);
    fireEvent.click(screen.getByRole('button', { name: /notify me/i }));
    return screen.findByLabelText(/your email/i);
  }

  it('rejects an invalid email without calling the API', async () => {
    const input = await open();
    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.click(screen.getAllByRole('button', { name: /notify me/i }).pop()!);
    expect(await screen.findByText(/valid email/i)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it('creates the alert with the search intent', async () => {
    post.mockResolvedValue({ data: { id: 'a1' } });
    const input = await open();
    fireEvent.change(input, { target: { value: 'me@example.com' } });
    fireEvent.click(screen.getAllByRole('button', { name: /notify me/i }).pop()!);
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/api/v1/discovery/alerts');
    expect(post.mock.calls[0][1].body).toMatchObject({ intent, channel: 'email', email: 'me@example.com', frequency: 'daily' });
  });
});

describe('AlertsList', () => {
  it('lists alerts and removes one', async () => {
    get.mockResolvedValue({ data: [{ id: 'a1', label: 'Bedsitter under 8k', channel: 'email', frequency: 'daily', active: true, intent: {}, created_at: '' }] });
    del.mockResolvedValue({});
    render(<AlertsList />);
    expect(await screen.findByText('Bedsitter under 8k')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /stop alert/i }));
    await waitFor(() => expect(screen.queryByText('Bedsitter under 8k')).toBeNull());
    expect(del).toHaveBeenCalled();
  });

  it('puts the alert back when removing fails', async () => {
    get.mockResolvedValue({ data: [{ id: 'a1', label: 'Keep me', channel: 'email', frequency: 'daily', active: true, intent: {}, created_at: '' }] });
    del.mockResolvedValue({ error: { detail: 'x' } });
    render(<AlertsList />);
    fireEvent.click(await screen.findByRole('button', { name: /stop alert/i }));
    expect(await screen.findByText('Keep me')).toBeTruthy();
  });
});
