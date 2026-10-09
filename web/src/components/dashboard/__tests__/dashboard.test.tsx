/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const get = jest.fn();
const post = jest.fn();
jest.mock('@/lib/api/rumia', () => ({ rumia: { GET: (...a: unknown[]) => get(...a), POST: (...a: unknown[]) => post(...a) } }));

import { TodayPanel } from '../today-panel';
import { EnquiriesSection } from '../enquiries-section';
import { TeamSection } from '../team-section';
import { confirmedText } from '../workspace';

const org = { id: 'o1', name: 'Kamau Homes', slug: 'kamau', status: 'active', role: 'owner' };
const workspace = (attention: unknown[] = [], orgs = [org]) => ({ data: { orgs, properties: [], attention } });

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('confirmedText', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  it.each([
    [null, 'Not confirmed yet'],
    ['2026-10-10T11:59:30Z', 'Confirmed just now'],
    ['2026-10-10T09:00:00Z', 'Confirmed 3 h ago'],
    ['2026-10-07T12:00:00Z', 'Confirmed 3 days ago'],
    ['garbage', 'Not confirmed yet'],
  ])('%s', (iso, expected) => {
    expect(confirmedText(iso as string | null, now)).toBe(expected);
  });
});

describe('TodayPanel', () => {
  it('renders nothing when nothing needs attention', async () => {
    get.mockResolvedValue(workspace());
    const { container } = render(<TodayPanel />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('confirms availability in one tap and reloads', async () => {
    get.mockResolvedValue(workspace([{ property_id: 'p1', slug: 'green', name: 'Green View', kind: 'confirm_availability', text: 'Still available?' }]));
    post.mockResolvedValue({ data: {} });
    render(<TodayPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /still available/i }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/api/v1/properties/{property_id}/confirm');
    expect(post.mock.calls[0][1].params.path.property_id).toBe('p1');
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});

describe('EnquiriesSection', () => {
  const inquiry = { ref_code: 'RUM-7', channel: 'whatsapp', created_at: '2026-10-09T08:00:00Z', replied: null, outcome: null, name: 'Green View', slug: 'green' };

  it('records what happened with an enquiry', async () => {
    get.mockImplementation(async (path: string) => (path === '/api/v1/me/workspace' ? workspace() : { data: [inquiry] }));
    post.mockResolvedValue({ data: {} });
    render(<EnquiriesSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'Moved in' }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1].params.path).toEqual({ org_id: 'o1', ref_code: 'RUM-7' });
    expect(post.mock.calls[0][1].body).toEqual({ outcome: 'moved_in' });
  });

  it('shows the recorded outcome instead of buttons', async () => {
    get.mockImplementation(async (path: string) => (path === '/api/v1/me/workspace' ? workspace() : { data: [{ ...inquiry, outcome: 'moved_in' }] }));
    render(<EnquiriesSection />);
    expect(await screen.findByText('Moved in')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'No reply' })).toBeNull();
  });
});

describe('TeamSection', () => {
  it('is hidden for people who do not own an organisation', async () => {
    get.mockResolvedValue(workspace([], [{ ...org, role: 'agent' }]));
    const { container } = render(<TeamSection />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('adds a member by email', async () => {
    get.mockResolvedValue(workspace());
    post.mockResolvedValue({ data: {} });
    render(<TeamSection />);
    fireEvent.change(await screen.findByLabelText(/their email/i), { target: { value: 'care@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1].body).toEqual({ email: 'care@example.com', role: 'manager' });
    expect(post.mock.calls[0][1].params.path.org_id).toBe('o1');
  });
});
