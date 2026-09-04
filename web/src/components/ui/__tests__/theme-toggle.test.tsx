/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../theme-toggle';
import { useTheme } from 'next-themes';

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: jest.fn(),
}));

// Mock Radix UI components to avoid Portal issues in JSDOM
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: any) => (
    <div data-testid="dropdown-item" onClick={onClick} className={className}>
      {children}
    </div>
  ),
}));


describe('ThemeToggle', () => {
  const mockSetTheme = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
      theme: 'system',
      setTheme: mockSetTheme,
    });
  });

  it('renders a skeleton/unmounted state initially', () => {
    // We can't easily test the transition from unmounted to mounted in a single render 
    // unless we control the useEffect. But we can check if it renders the Sun icon button.
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('displays the theme options when clicked', async () => {
    render(<ThemeToggle />);
    
    // The button might be disabled or opacity-50 if not mounted, 
    // but our component sets mounted in useEffect.
    // In JSDOM, useEffect runs immediately.
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('calls setTheme with "light" when Light option is clicked', () => {
    render(<ThemeToggle />);
    
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Light'));

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('calls setTheme with "dark" when Dark option is clicked', () => {
    render(<ThemeToggle />);
    
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Dark'));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme with "system" when System option is clicked', () => {
    render(<ThemeToggle />);
    
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('System'));

    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('updates the active state based on current theme', () => {
    (useTheme as jest.Mock).mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));

    const darkItem = screen.getByText('Dark').closest('div');
    expect(darkItem).toHaveClass('bg-accent');
  });
});
