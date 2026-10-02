import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Loader2 } from 'lucide-react-native';
import { radii } from '../../lib/theme';

type ButtonVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const HEIGHTS: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 48 };
const FONT_SIZES: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 16 };

// Variant palettes mirror the web button usages:
//  - primary: emerald-600            (contact, whatsapp, primary CTAs)
//  - dark:    slate-900               (tour submit, campus browse, compare)
//  - outline: white + slate-200 border
//  - ghost:   transparent, slate text (review actions)
const VARIANT: Record<
  ButtonVariant,
  { bg: string; border?: string; text: string; pressedBg: string }
> = {
  primary: { bg: '#059669', text: '#ffffff', pressedBg: '#10b981' },
  dark: { bg: '#0f172a', text: '#ffffff', pressedBg: '#334155' },
  outline: { bg: '#ffffff', border: '#e2e8f0', text: '#334155', pressedBg: '#f8fafc' },
  ghost: { bg: 'transparent', text: '#64748b', pressedBg: '#f1f5f9' },
  destructive: { bg: '#ef4444', text: '#ffffff', pressedBg: '#dc2626' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  disabled = false,
  loading = false,
  onPress,
  leftIcon,
  rightIcon,
  label,
  style,
  testID,
}: ButtonProps) {
  const v = VARIANT[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHTS[size],
          backgroundColor: pressed && variant !== 'ghost' ? v.pressedBg : v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          borderRadius: radii.xl,
          opacity: disabled ? 0.55 : 1,
        },
        variant === 'ghost' && pressed && styles.pressedGhost,
        full && styles.full,
        style,
      ]}
    >
      {loading ? (
        <Loader2 size={16} color={v.text} testID="button-loader" />
      ) : (
        <>
          {leftIcon ? leftIcon : null}
          <Text style={[styles.label, { color: v.text, fontSize: FONT_SIZES[size] }]} allowFontScaling={false}>
            {label}
          </Text>
          {rightIcon ? rightIcon : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  full: { width: '100%' },
  pressedGhost: { backgroundColor: '#f1f5f9' },
  label: { fontWeight: '700' },
});