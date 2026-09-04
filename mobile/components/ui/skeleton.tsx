import { View, StyleSheet } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: object;
}

/** Matches the web `skeleton` utility (slate-200 rounded shimmer block). */
export function Skeleton({ width = '100%', height = 14, radius = 6, style }: SkeletonProps) {
  return (
    <View
      style={[
        styles.base,
        { width, height, borderRadius: radius },
        style,
      ]}
    />
  );
}

/* List of skeleton blocks in the layout order of web skeleton states. */
export function SkeletonLine({ width = '100%', height = 14, style }: SkeletonProps) {
  return <Skeleton width={width} height={height} style={style} />;
}

const styles = StyleSheet.create({
  base: { backgroundColor: '#e2e8f0' },
});