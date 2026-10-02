import { useEffect, useRef, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  type StyleProp,
  type ViewStyle,
  Easing,
} from 'react-native';
import { X } from 'lucide-react-native';
import { palette, radii, useThemeColors } from '../theme';

/** Circular icon button (Lucide icon children). */
export function IconButton({
  onPress,
  children,
  accessibilityLabel,
  dark = false,
  style,
}: {
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        dark && styles.iconButtonDark,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** Selectable filter pill (web: rounded-full bg-slate-100 / emerald active). */
export function Chip({
  label,
  selected,
  onPress,
  leading,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leading?: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: selected ?? false }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipActive : styles.chipInactive,
        pressed && styles.pressed,
      ]}
    >
      {leading}
      <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Readonly star rating row (web uses amber filled / slate empty stars). */
export function StarRating({
  value,
  size = 14,
  showValue = false,
}: {
  value: number;
  size?: number;
  showValue?: boolean;
}) {
  const rounded = Math.round(value);
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= rounded;
        return (
          <Text
            key={star}
            style={{
              fontSize: size,
              lineHeight: size + 2,
              color: filled ? palette.amber[500] : palette.slate[300],
            }}
          >
            ★
          </Text>
        );
      })}
      {showValue && <Text style={styles.starValue}>{value.toFixed(1)}</Text>}
    </View>
  );
}

/** Pulsing placeholder block. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.skeleton, { opacity }, style]} />;
}

/** Empty / error state block (web empty-state anatomy). */
export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.emptyRoot}>
      <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceAlt }]}>{icon}</View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [styles.emptyAction, { backgroundColor: colors.primary }, pressed && styles.pressed]}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 15 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Section heading with optional trailing action (web section headers). */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Modal bottom-sheet shell (web sheet anatomy): handle, header, close. */
export function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <View style={StylesSheetVars.handle} />
      <View style={styles.sheetHeader}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
        <IconButton onPress={onClose} accessibilityLabel="Close" style={{ width: 32, height: 32 }}>
          <X size={16} color={colors.textMuted} />
        </IconButton>
      </View>
      {children}
    </View>
  );
}

const StylesSheetVars = {
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.slate[300],
    alignSelf: 'center' as const,
    marginBottom: 16,
  },
};

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radii.full,
  },
  chipActive: { backgroundColor: palette.emerald[600] },
  chipInactive: { backgroundColor: palette.slate[100] },
  chipText: { fontSize: 13, fontWeight: '600' },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  starValue: { marginLeft: 4, color: palette.slate[400], fontSize: 12, fontWeight: '600' },
  skeleton: { backgroundColor: palette.slate[100], borderRadius: radii.xl },
  emptyRoot: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', maxWidth: 280, marginBottom: 20 },
  emptyAction: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: radii.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
});