'use client';

import { ThemeProvider } from 'next-themes';
import { ReactNode } from 'react';

interface UnifiedThemeProviderProps {
  children: ReactNode;
  forcedTheme?: 'light' | 'dark' | 'system';
}


/**
 * UnifiedThemeProvider consolidates theme management for Rumia.
 * 
 * - Dashboards: Use without forcedTheme to allow Light/Dark/System switching.
 * - Public Pages: Use with forcedTheme="light" to enforce light mode.
 * 
 * Centralizing this ensures consistent hydration and SSR safety.
 */
/**
 * UnifiedThemeProvider
 * 
 * THEME CONTRACT:
 * 1. This is the SINGLE source of truth for theming in Rumia.
 * 2. Dashboards MUST NOT define their own theme state or providers.
 * 3. Public pages MUST use `forcedTheme="light"`.
 * 4. All styling MUST consume semantic tokens from themes.css.
 * 
 * @example
 * // Dashboard Layout (Theme-aware)
 * <UnifiedThemeProvider>{children}</UnifiedThemeProvider>
 * 
 * @example
 * // Public Layout (Forced Light)
 * <UnifiedThemeProvider forcedTheme="light">{children}</UnifiedThemeProvider>
 */
export function UnifiedThemeProvider({ 
  children, 
  forcedTheme 
}: UnifiedThemeProviderProps) {
  const props = {
    attribute: 'class' as const,
    defaultTheme: forcedTheme || 'system',
    enableSystem: !forcedTheme,
    forcedTheme,
    disableTransitionOnChange: true,
  };
  return (
    <ThemeProvider {...(props as any)}>
      {children}
    </ThemeProvider>
  );
}
