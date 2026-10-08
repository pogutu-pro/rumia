/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SiteHeader } from '../site-header';

const mockPush = jest.fn();
let mockPathname = '/';
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

jest.mock('@/lib/supabase/client', () => ({
  hasStoredSession: () => false,
}));

jest.mock('@/stores/wishlist-store', () => ({
  useWishlistStore: (sel: (s: unknown) => unknown) =>
    sel({
      saved: { a: true, b: true, c: false },
      fetchBatch: jest.fn(),
    }),
}));

// Radix portals need pointer support jsdom lacks; render a plain trigger button and the menu inline.
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children, 'aria-label': label }: { children: React.ReactNode; 'aria-label'?: string }) => (
    <button type="button" aria-label={label}>{children}</button>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('SiteHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/';
  });

  it('links the wordmark to Explore', () => {
    render(<SiteHeader />);
    const wordmark = screen.getByRole('link', { name: /Rumia/ });
    expect(wordmark).toHaveAttribute('href', '/');
  });

  it('hides the search pill on the Explore page', () => {
    mockPathname = '/';
    render(<SiteHeader />);
    expect(screen.queryByRole('link', { name: 'Search places' })).not.toBeInTheDocument();
  });

  it('shows a search pill on other public pages, linking to Explore', () => {
    mockPathname = '/p/abc';
    render(<SiteHeader />);
    const pill = screen.getByRole('link', { name: 'Search places' });
    expect(pill).toHaveAttribute('href', '/');
  });

  it('shows a Saved link with the count of saved places', () => {
    render(<SiteHeader />);
    const saved = screen.getByRole('link', { name: 'Saved places (2)' });
    expect(saved).toHaveAttribute('href', '/saved');
  });

  it('offers the site menu', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saved' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'List your property' })).toHaveAttribute('href', '/workspace');
    expect(screen.getByRole('link', { name: 'Help & safety' })).toHaveAttribute('href', '/help');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth/login');
  });
});