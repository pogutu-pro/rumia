/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ConfirmActionPage from './page';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api/rumia', () => ({
  rumia: { GET: (...args: unknown[]) => mockGet(...(args as [])), POST: (...args: unknown[]) => mockPost(...(args as [])) },
}));
jest.mock('next/navigation', () => ({ useParams: () => ({ token: 'tok-test-1' }) }));

describe('ConfirmActionPage (/c/[token])', () => {
  beforeEach(() => jest.clearAllMocks());

  const preview = {
    action: 'confirm',
    property_name: 'Urban Suites',
    property_slug: 'urban-suites',
    current_status: 'live',
  };

  it('previews on the signed link with GET only — never performs on load', async () => {
    mockGet.mockResolvedValue({ data: preview });
    render(<ConfirmActionPage />);
    expect(await screen.findByRole('heading', { name: 'Is Urban Suites still available?' })).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('performs the action only when the button is tapped', async () => {
    mockGet.mockResolvedValue({ data: preview });
    mockPost.mockResolvedValue({ data: { action: 'confirm', status: 'live' }, error: undefined });
    render(<ConfirmActionPage />);
    fireEvent.click(await screen.findByRole('button', { name: "It's still available" }));
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/api/v1/actions/{token}', { params: { path: { token: 'tok-test-1' } } });
    expect(await screen.findByRole('heading', { name: 'Thanks — done.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View place' })).toHaveAttribute('href', '/p/urban-suites');
  });

  it('treats an expired link as invalid and offers no action', async () => {
    mockGet.mockResolvedValue({ data: undefined });
    render(<ConfirmActionPage />);
    expect(await screen.findByRole('heading', { name: 'This link has expired or is not valid.' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
    await act(async () => {}); // settle any pending state updates
  });
});