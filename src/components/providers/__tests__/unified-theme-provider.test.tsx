import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { UnifiedThemeProvider } from '../unified-theme-provider';
import { ThemeProvider } from 'next-themes';

// Mock next-themes
jest.mock('next-themes', () => ({
  ThemeProvider: jest.fn(({ children }) => <div data-testid="next-theme-provider">{children}</div>),
}));


describe('UnifiedThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children correctly', () => {
    render(
      <UnifiedThemeProvider>
        <div>Test Child</div>
      </UnifiedThemeProvider>
    );

    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });


  it('passes default props to next-themes Provider when no forcedTheme is provided', () => {
    render(
      <UnifiedThemeProvider>
        <div>Test Child</div>
      </UnifiedThemeProvider>
    );

    expect(ThemeProvider).toHaveBeenCalled();
    const props = (ThemeProvider as jest.Mock).mock.calls[0][0];
    expect(props).toMatchObject({
      attribute: 'class',
      defaultTheme: 'system',
      enableSystem: true,
    });
  });

  it('enforces light theme when forcedTheme="light" is passed', () => {
    render(
      <UnifiedThemeProvider forcedTheme="light">
        <div>Test Child</div>
      </UnifiedThemeProvider>
    );

    expect(ThemeProvider).toHaveBeenCalled();
    const props = (ThemeProvider as jest.Mock).mock.calls[0][0];
    expect(props).toMatchObject({
      forcedTheme: 'light',
      defaultTheme: 'light',
      enableSystem: false,
    });
  });

  it('disables transition on change for performance/prevention of flash', () => {
    render(
      <UnifiedThemeProvider>
        <div>Test Child</div>
      </UnifiedThemeProvider>
    );

    expect(ThemeProvider).toHaveBeenCalled();
    const props = (ThemeProvider as jest.Mock).mock.calls[0][0];
    expect(props).toMatchObject({
      disableTransitionOnChange: true,
    });
  });
});


