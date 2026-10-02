import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { T } from './text';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/** Matches web empty states: centered icon, title, hint, optional CTA. */
export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>{icon}</View>
      <T variant="h3" color="#0f172a" align="center" weight="bold">
        {title}
      </T>
      {subtitle ? (
        <T variant="body" muted align="center" style={styles.subtitle}>
          {subtitle}
        </T>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  subtitle: { maxWidth: 280 },
  action: { marginTop: 12 },
});