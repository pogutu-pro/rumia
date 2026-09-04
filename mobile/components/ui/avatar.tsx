import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

interface AvatarProps {
  name?: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md';
}

const SIZES = { sm: 28, md: 40 } as const;

export function Avatar({ name, imageUrl, size = 'md' }: AvatarProps) {
  const d = SIZES[size];
  const initial = (name ?? 'S').trim().charAt(0).toUpperCase() || 'S';

  return (
    <View style={[styles.wrap, { width: d, height: d, borderRadius: d / 2 }]}>
      {imageUrl ? (
        <AvatarImage src={imageUrl} size={d} />
      ) : (
        <Text style={[styles.initial, { fontSize: d * 0.42 }]}>{initial}</Text>
      )}
    </View>
  );
}

function AvatarImage({ src, size }: { src: string; size: number }) {
  return (
    <Image
      source={{ uri: src }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { color: '#475569', fontWeight: '800' },
});