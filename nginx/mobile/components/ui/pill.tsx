import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii } from '../../lib/theme';

type PillVariant =
  | 'white' // web: bg-white/95 border-slate-100/60 shadow-sm text-slate-900  (card price pill)
  | 'emerald' // web: bg-emerald-600 text-white  (popular card price pill)
  | 'emeraldWash' // web: bg-emerald-50 text-emerald-700  (verified badge)
  | 'amber' // web: bg-amber-50 border-amber-200 text-amber-700  (trending / note)
  | 'dark' // web: bg-slate-900/80 text-white  (photo count)
  | 'soft' // web: bg-slate-100 text-slate-600  (zone chips)
  | 'outline' // web: border-slate-200 text-slate-600  (status)
  | 'live' // web: bg-emerald-600 text-white with pulse dot
  | 'danger'; // web: bg-red-100/red text  (FULL)

interface PillProps {
  variant?: PillVariant;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
  dot?: boolean;
}

export function Pill({ variant = 'soft', children, style, icon, dot = false }: PillProps) {
  const v = VARIANTS[variant];
  return (
    <View style={[styles.base, v, style]}>
      {dot && <View style={styles.dot} />}
      {icon}
      <Text style={[styles.label, { color: v.color }]} allowFontScaling={false}>
        {children}
      </Text>
    </View>
  );
}

const VARIANTS: Record<PillVariant, ViewStyle & { color: string }> = {
  white: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(241,245,249,0.6)',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
    color: '#0f172a',
  },
  emerald: { backgroundColor: 'rgba(5,150,105,0.92)', color: '#ffffff' },
  emeraldWash: { backgroundColor: '#ecfdf5', color: '#047857' },
  amber: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.6)',
    color: '#b45309',
  },
  dark: { backgroundColor: 'rgba(2,6,23,0.8)', color: '#ffffff' },
  soft: { backgroundColor: '#f1f5f9', color: '#475569' },
  outline: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    color: '#475569',
  },
  live: { backgroundColor: '#059669', color: '#ffffff' },
  danger: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', color: '#dc2626' },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.md,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff' },
  label: { fontSize: 12, fontWeight: '700' },
});