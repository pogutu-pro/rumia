import type { ReactNode } from 'react';
import { Text as RNText, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useThemeColors } from '../../lib/theme';

/**
 * Typography primitives matching the web conventions:
 *  - headings are heavy/black with tight tracking (Plus Jakarta Sans on web)
 *  - body is regular slate text
 *  - meta labels are small, uppercase, wide tracking
 */
type Variant =
  | 'hero'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'title'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'overline'
  | 'price'
  | 'priceStrong';

const FONT_WEIGHTS: Record<string, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
};

interface TextProps {
  variant?: Variant;
  weight?: keyof typeof FONT_WEIGHTS;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  muted?: boolean;
  testID?: string;
}

export function T({
  variant = 'body',
  weight,
  color,
  align,
  style,
  children,
  numberOfLines,
  muted = false,
  testID,
}: TextProps) {
  const c = useThemeColors();
  const base = TEXT_VARIANTS[variant];
  const baseColor = muted ? c.textMuted : c.text;

  return (
    <RNText
      testID={testID}
      numberOfLines={numberOfLines}
      allowFontScaling={false}
      style={[
        styles.base,
        base,
        weight != null && { fontWeight: FONT_WEIGHTS[weight] },
        { color: color ?? baseColor },
        align != null && { textAlign: align },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
});

const TEXT_VARIANTS: Record<Variant, TextStyle> = {
  // Hero headline ~ web text-4xl sm:text-6xl font-black tracking-tight
  hero: { fontSize: 30, fontWeight: '900', letterSpacing: -0.6, lineHeight: 36 },
  // Section headline ~ web text-2xl sm:text-4xl font-extrabold tracking-tight
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, lineHeight: 30 },
  // Sub-section ~ web text-xl font-bold
  h2: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, lineHeight: 26 },
  // Column title ~ web text-lg font-extrabold
  h3: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2, lineHeight: 22 },
  // Card title ~ web font-bold
  title: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 21 },
  bodyStrong: { fontSize: 14, fontWeight: '600', lineHeight: 21 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  // Meta label ~ web text-xs font-semibold uppercase tracking-wider
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  // Large currency ~ web text-2xl font-black tracking-tight
  price: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  priceStrong: { fontSize: 32, fontWeight: '900', letterSpacing: -0.6, lineHeight: 38 },
};