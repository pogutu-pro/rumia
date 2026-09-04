import type { ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { shadows, radii } from '../../lib/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** rounded-2xl with border (web default card look). */
  variant?: 'bordered' | 'plain' | 'subtle';
  padding?: number;
}

export function Card({ children, style, variant = 'bordered', padding = 16 }: CardProps) {
  const v =
    variant === 'bordered'
      ? styles.bordered
      : variant === 'subtle'
        ? styles.subtle
        : styles.plain;
  return (
    <View style={[styles.base, v, { padding }, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii['2xl'] },
  bordered: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...shadows.card,
  },
  plain: { backgroundColor: '#ffffff' },
  subtle: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
});