import { useState, useLayoutEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);

    // Create an event listener for changes
    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Add the listener
    mediaQuery.addEventListener('change', listener);

    // Clean up
    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, [query]);

  return matches;
}

// Common media query helpers
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 768px)');

export const useIsTablet = (): boolean =>
  useMediaQuery('(min-width: 769px) and (max-width: 1024px)');

export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 1025px)');

export const usePrefersDarkMode = (): boolean =>
  useMediaQuery('(prefers-color-scheme: dark)');
