/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueuesPanel, ReportsPanel, ReviewPanel } from '../ops-console';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api/rumia', () => ({
  rumia: { GET: (...args: unknown[]) => mockGet(...(args as [])), POST: (...args: unknown[]) => mockPost(...(args as [])) },
}));

const queues = {
  review: { count: 3, oldest_hours: 5 },
  reports: { count: 2, oldest_hours: 30 },
  stale: { count: 7, oldest_hours: 100 },
  unverified_busy: { count: 1, oldest_hours: null },
};

const report = {
  id: 'r1',
  reason: 'scam',
  details: 'Asked for a deposit before viewing',
  priority: 10,
  created_at: new Date().toISOString(),
  property_id: 'p1',
  slug: 'urban-suites',
  name: 'Urban Suites',
  status: 'live',
  same_reason_count: 2,
};

const review = {
  id: 'p1',
  slug: 'urban-suites',
  name: 'Urban Suites',
  kind: 'hostel',
  updated_at: new Date().toISOString(),
  org_name: 'Mary Homes',
  standing: 'good',
  reason: 'New listing',
  open_reports: 1,
  duplicate_photos: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue({ error: undefined, response: { status: 200 } });
});

describe('QueuesPanel', () => {
  it('shows the queue counts', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === '/api/v1/ops/queues') return Promise.resolve({ data: queues, response: { status: 200 } });
      return Promise.resolve({ data: [], response: { status: 200 } });
    });
    render(<QueuesPanel />);
    expect(await screen.findByText('Work queues')).toBeInTheDocument();
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});

describe('ReportsPanel', () => {
  it('resolves a report', async () => {
    mockGet.mockResolvedValue({ data: [report], response: { status: 200 } });
    render(<ReportsPanel />);
    expect(await screen.findByText(/scam/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove listing' }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/v1/ops/reports/{report_id}/resolve', {
        params: { path: { report_id: 'r1' } },
        body: { resolution: 'remove_listing', note: undefined },
      }),
    );
  });
});

describe('ReviewPanel', () => {
  it('approves a place', async () => {
    mockGet.mockResolvedValue({ data: [review], response: { status: 200 } });
    render(<ReviewPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/v1/ops/properties/{property_id}/review', {
        params: { path: { property_id: 'p1' } },
        body: { decision: 'approve', note: undefined },
      }),
    );
  });
});
