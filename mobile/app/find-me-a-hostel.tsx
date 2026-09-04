import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { FindMeAHostelScreen } from '../features/hostel-requests/find-me-a-hostel';
import { palette, radii } from '../lib/theme';

export default function FindMeAHostelRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={() => router.back()}>
          <ChevronLeft size={22} color={palette.slate[900]} />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.title}>Find Me a Hostel</Text>
          <Text style={styles.subtitle}>Let Rumia find your next home</Text>
        </View>
      </View>
      <FindMeAHostelScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.slate[100],
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: palette.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: palette.slate[900] },
  subtitle: { color: palette.slate[500], fontSize: 12, marginTop: 1 },
  pressed: { opacity: 0.6 },
});