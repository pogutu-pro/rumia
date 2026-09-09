import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

/**
 * RUMIA DESIGN SYSTEM - MOBILE TOKENS
 *
 * Single source of truth mirroring the web PWA:
 *  - web/src/styles/themes.css (light + dark HSL tokens)
 *  - Tailwind palette usage across the web UI (slate / emerald / amber)
 *  - web spacing, radii, shadows and typography conventions
 *
 * Brand:
 *  - Primary emerald : hsl(154 85% 30%) = #0b8e55
 *  - Accent amber    : hsl(39 95% 52%)  = #f9a710
 *  - Surfaces        : white pages, #fafafa surfaces, slate-50 section
 *    backgrounds (web homepage root is bg-slate-50/50 over white)
 *
 * NOTE: Tailwind "slate-*" colours used heavily by the web components are
 * exposed under `palette.slate`. Page BACKGROUNDS must stay white/soft —
 * slate-900 is only ever ink/button colour, never a page background.
 */

export interface RumiaColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  star: string;
  starSoft: string;
  starStrong: string;
  primarySoft: string;
  destructive: string;
  warning: string;
  info: string;
  success: string;
}

/** Tailwind palette values used literally across the web components. */
export const palette = {
  white: '#ffffff',
  black: '#000000',
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  rose: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
  },
  sky: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  slice: {
    bg: 'rgba(248,250,252,0.5)',
  },
} as const;

export const lightColors: RumiaColors = {
  background: '#ffffff',
  surface: '#fafafa',
  surfaceAlt: '#f4f4f5',
  border: '#e4e4e7',
  text: '#09090b',
  textSecondary: '#18181b',
  textMuted: '#6e6e77',
  primary: '#0b8e55',
  onPrimary: '#ffffff',
  accent: '#f9a710',
  onAccent: '#09090b',
  star: '#f59e0b',
  starSoft: '#fef3c7',
  starStrong: '#92400e',
  primarySoft: '#e8f6ef',
  destructive: '#ef4343',
  warning: '#f59f0a',
  info: '#0664e0',
  success: '#0b8e55',
};

export const darkColors: RumiaColors = {
  background: '#030711',
  surface: '#040a1a',
  surfaceAlt: '#0f1629',
  border: '#1d283a',
  text: '#e1e7ef',
  textSecondary: '#f8fafc',
  textMuted: '#7f8ea3',
  primary: '#11d480',
  onPrimary: '#030711',
  accent: '#1d283a',
  onAccent: '#f8fafc',
  star: '#f59e0b',
  starSoft: '#422006',
  starStrong: '#fde68a',
  primarySoft: '#0a2218',
  destructive: '#811d1d',
  warning: '#f59f0a',
  info: '#388cfa',
  success: '#11d480',
};

export type ColorScheme = 'light' | 'dark';

export function getThemeColors(
  scheme: 'light' | 'dark' | null | undefined | 'unspecified',
): RumiaColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

export function useThemeColors(): RumiaColors {
  const scheme = useColorScheme();
  return useMemo(() => getThemeColors(scheme), [scheme]);
}

export function createStyles<T>(factory: (colors: RumiaColors) => T) {
  return function useStyles(): T {
    const colors = useThemeColors();
    return useMemo(() => factory(colors), [colors]);
  };
}

/** 4px spacing scale (mirrors Tailwind spacing used across the web). */
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
} as const;

/** Radii — web uses rounded-lg 8, rounded-xl 12, rounded-2xl 16, round-full. */
export const radii = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 16,
  '3xl': 20,
  '4xl': 24,
  full: 9999,
} as const;

/** Web icon sizes: h-3 12, h-3.5 14, h-4 16, h-5 20, h-6 24. */
export const iconSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

/** Shadow presets matching web elevation usage. */
export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  hover: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
  },
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 30,
    elevation: 12,
  },
  modal: {
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 40,
    elevation: 18,
  },
} as const;