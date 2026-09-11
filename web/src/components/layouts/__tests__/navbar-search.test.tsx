/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NavbarSearch } from '../navbar-search';
import { searchApi } from '@/lib/api/search';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockPathname = '/';
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/lib/api/search', () => ({
  searchApi: {
    search: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

describe('NavbarSearch', () => {
  const renderOpenSearch = () => {
    render(<NavbarSearch />);
    fireEvent.click(screen.getByRole('button', { name: /search hostels/i }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/';
    mockSearchParams = new URLSearchParams();
  });

  it('renders search input with placeholder', () => {
    renderOpenSearch();
    const input = screen.getByPlaceholderText(/search by name/i);
    expect(input).toBeInTheDocument();
  });

  it('initializes value from URL search param q', () => {
    mockSearchParams = new URLSearchParams('q=dan');
    renderOpenSearch();
    const input = screen.getByPlaceholderText(
      /search by name/i,
    ) as HTMLInputElement;
    expect(input.value).toBe('dan');
  });

  it('navigates to /hostels?q=... on submit when on another page', () => {
    renderOpenSearch();
    const input = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(input, { target: { value: 'boma bedsitter' } });
    fireEvent.submit(input.closest('form')!);

    expect(mockPush).toHaveBeenCalledWith('/hostels?q=boma%20bedsitter');
  });

  it('navigates to /hostels on submit when query is empty', () => {
    renderOpenSearch();
    const input = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.submit(input.closest('form')!);

    expect(mockPush).toHaveBeenCalledWith('/hostels');
  });

  it('clears the query when clear button is clicked', async () => {
    mockPathname = '/hostels';
    mockSearchParams = new URLSearchParams('q=nyeri');
    renderOpenSearch();

    const clearButton = await screen.findByRole('button', {
      name: /clear search/i,
    });
    fireEvent.click(clearButton);

    const input = screen.getByPlaceholderText(
      /search by name/i,
    ) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(mockReplace).toHaveBeenCalled();
  });
});
