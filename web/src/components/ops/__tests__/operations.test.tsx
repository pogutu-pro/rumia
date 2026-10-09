/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const get = jest.fn();
const post = jest.fn();
jest.mock('@/lib/api/rumia', () => ({ rumia: { GET: (...a: unknown[]) => get(...a), POST: (...a: unknown[]) => post(...a) } }));

import { ago, hoursText, Operations, ReportsPanel, ReviewPanel } from '../operations';

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

const review = { id: 'p1', slug: 'green', name: 'Green View', kind: 'hostel', updated_at: '2026-10-09T00:00:00Z', org_name: 'Kamau Homes', standing: null, reason: 'New listing', open_reports: 0, duplicate_photos: 1 };

describe('time text', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  it('speaks in minutes, hours and days', () => {
    expect(ago('2026-10-10T11:30:00Z', now)).toBe('30 min ago');
    expect(ago('2026-10-10T06:00:00Z', now)).toBe('6 h ago');
    expect(ago('2026-10-07T12:00:00Z', now)).toBe('3 d ago');
    expect(ago(null, now)).toBe('-');
    expect(hoursText(0.2)).toBe('12 min');
    expect(hoursText(50)).toBe('2 d');
  });
});

describe('access', () => {
  it('explains when the account has no ops role', async () => {
    get.mockResolvedValue({ data: undefined, response: { status: 403 } });
    render(<Operations />);
    expect(await screen.findByText(/does not have access to operations/i)).toBeTruthy();
  });
});

describe('ReviewPanel', () => {
  it('shows why a place is waiting and approves it', async () => {
    get.mockResolvedValue({ data: [review], response: { status: 200 } });
    post.mockResolvedValue({ data: {}, response: { status: 204 } });
    render(<ReviewPanel />);
    expect(await screen.findByText('photos used elsewhere')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/api/v1/ops/properties/{property_id}/review');
    expect(post.mock.calls[0][1].body).toEqual({ decision: 'approve', note: undefined });
  });

  it('will not reject without a note', async () => {
    get.mockResolvedValue({ data: [review], response: { status: 200 } });
    render(<ReviewPanel />);
    const reject = (await screen.findByRole('button', { name: 'Reject' })) as HTMLButtonElement;
    expect(reject.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: 'Photos are stock images' } });
    expect(reject.disabled).toBe(false);
  });
});

describe('ReportsPanel', () => {
  const report = { id: 'r1', reason: 'scam', details: 'Asked me to pay first', priority: 1, created_at: '2026-10-10T10:00:00Z', slug: 'green', name: 'Green View', status: 'live', same_reason_count: 3 };

  it('shows the reason and how many people reported it, and dismisses', async () => {
    get.mockResolvedValue({ data: [report], response: { status: 200 } });
    post.mockResolvedValue({ data: {}, response: { status: 204 } });
    render(<ReportsPanel />);
    expect(await screen.findByText(/3 people reported this/)).toBeTruthy();
    expect(screen.getByText('Scam')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1].body).toEqual({ resolution: 'dismiss' });
  });

  it('asks before removing a listing', async () => {
    get.mockResolvedValue({ data: [report], response: { status: 200 } });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ReportsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove listing' }));
    expect(confirm).toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
