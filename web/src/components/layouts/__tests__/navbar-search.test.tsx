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

function mockViewport(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes('max-width'),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    onchange: null,
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('NavbarSearch', () => {
  const renderOpenSearch = () => {
    render(<NavbarSearch />);
    fireEvent.click(screen.getByRole('button', { name: /search hostels/i }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockViewport(false);
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

  it('sends plain words to the sentence search when on another page', () => {
    renderOpenSearch();
    const input = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(input, { target: { value: 'boma bedsitter' } });
    fireEvent.submit(input.closest('form')!);

    expect(mockPush).toHaveBeenCalledWith('/search?q=boma%20bedsitter');
  });

  it('keeps very short text on the filtered hostels list', () => {
    renderOpenSearch();
    const input = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.submit(input.closest('form')!);

    expect(mockPush).toHaveBeenCalledWith('/hostels?q=ab');
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

  describe('on a phone', () => {
    beforeEach(() => mockViewport(true));

    it('opens a full-screen layer with a Show results button and no Book a Tour', () => {
      renderOpenSearch();
      expect(screen.getByRole('dialog')).toHaveClass('fixed', 'inset-0');
      expect(screen.getByRole('button', { name: /browse all/i })).toBeInTheDocument();
      expect(screen.queryByText(/book a tour/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^filters/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bedsitter/i })).toBeInTheDocument();
    });

    it('replaces the search history entry when it navigates', () => {
      renderOpenSearch();
      const input = screen.getByPlaceholderText(/search by name/i);
      fireEvent.change(input, { target: { value: 'boma bedsitter' } });
      fireEvent.submit(input.closest('form')!);
      expect(mockReplace).toHaveBeenCalledWith('/search?q=boma%20bedsitter');
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('remembers recent searches', () => {
      renderOpenSearch();
      const input = screen.getByPlaceholderText(/search by name/i);
      fireEvent.change(input, { target: { value: 'kahawa' } });
      fireEvent.submit(input.closest('form')!);
      expect(JSON.parse(localStorage.getItem('rumia:recent-searches') ?? '[]')).toEqual(['kahawa']);
    });
  });
});
