/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkspaceScreen } from '../workspace-screen';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api/rumia', () => ({
  rumia: { GET: (...args: unknown[]) => mockGet(...(args as [])), POST: (...args: unknown[]) => mockPost(...(args as [])) },
}));

const workspace = {
  orgs: [{ id: 'o1', name: 'Mary Homes', slug: 'mary', status: 'active', role: 'owner' }],
  properties: [
    {
      id: 'p1',
      org_id: 'o1',
      slug: 'urban-suites',
      name: 'Urban Suites',
      status: 'stale',
      last_confirmed_at: null,
      contacts_7d: 2,
      awaiting_reply: 1,
    },
  ],
  attention: [
    { property_id: 'p1', slug: 'urban-suites', name: 'Urban Suites', kind: 'confirm_availability', text: 'Still available? Not confirmed recently.' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/v1/me/workspace') return Promise.resolve({ data: workspace, response: { status: 200 } });
    if (path === '/api/v1/orgs/{org_id}/inquiries') return Promise.resolve({ data: [], response: { status: 200 } });
    return Promise.resolve({ data: undefined, response: { status: 404 } });
  });
  mockPost.mockResolvedValue({ error: undefined, response: { status: 200 } });
});

describe('WorkspaceScreen', () => {
  it('shows the Today attention list and the places', async () => {
    render(<WorkspaceScreen />);
    expect(await screen.findByText('Still available? Not confirmed recently.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Urban Suites' })[0]).toHaveAttribute('href', '/p/urban-suites');
    expect(await screen.findByText('No contacts yet.')).toBeInTheDocument();
  });

  it('confirms a place from the attention list and reloads', async () => {
    render(<WorkspaceScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Still available' }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/v1/properties/{property_id}/confirm', { params: { path: { property_id: 'p1' } } }),
    );
    expect(await screen.findByText('Confirmed as still available.')).toBeInTheDocument();
    // workspace reloaded after the action (initial load + reload)
    expect(mockGet.mock.calls.filter(([p]) => p === '/api/v1/me/workspace').length).toBeGreaterThanOrEqual(2);
  });

  it('lets and pauses a place', async () => {
    render(<WorkspaceScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Let' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/properties/{property_id}/let', { params: { path: { property_id: 'p1' } }, body: {} }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/properties/{property_id}/pause', { params: { path: { property_id: 'p1' } }, body: {} }));
  });
});
