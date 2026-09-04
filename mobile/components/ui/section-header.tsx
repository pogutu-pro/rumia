import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { T } from './text';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  trending?: boolean;
}

/** Matches web section headers (e.g. PopularHostels) — title + optional "View all" link. */
export function SectionHeader({ title, subtitle, actionLabel, onAction, trending }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        {trending && (
          <View style={styles.trending}>
            <T variant="caption" color="#b45309" weight="bold">
              Trending
            </T>
          </View>
        )}
        <T variant="h1" style={styles.title}>
          {title}
        </T>
        {subtitle ? (
          <T variant="caption" muted>
            {subtitle}
          </T>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
          <View style={styles.action}>
            <T variant="caption" color="#059669" weight="semibold">
              {actionLabel}
            </T>
            <ArrowRight size={16} color="#059669" />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 },
  left: { flex: 1, gap: 4 },
  title: { color: '#0f172a' },
  trending: {
    alignSelf: 'flex-start',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.6)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 2 },
  pressed: { opacity: 0.6 },
});