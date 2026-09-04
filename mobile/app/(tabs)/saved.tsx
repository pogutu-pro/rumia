import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Heart, Trash2, CalendarPlus, Loader2, Lock } from 'lucide-react-native';
import { apiFetch } from '../../lib/api/client';
import type { ListingsPage, Listing } from '../../lib/api/schema';
import { useSessionStore } from '../../stores/session';
import { EmptyState, Skeleton } from '../../lib/components/ui';
import { BookTourModal } from '../../features/tours/book-tour-modal';
import { palette, radii } from '../../lib/theme';

export default function SavedScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [tourListing, setTourListing] = useState<Listing | null>(null);

  const { data, isLoading } = useQuery<ListingsPage>({
    queryKey: ['saved-hostels'],
    queryFn: () => apiFetch('/profiles/me/saved'),
    enabled: isAuthenticated,
  });

  const saved = data?.items ?? [];

  const unsaveMutation = useMutation({
    mutationFn: async (listingId: string) => {
      setRemovingId(listingId);
      await apiFetch(`/profiles/me/saved/${listingId}`, { method: 'DELETE' });
    },
    onSettled: () => {
      setRemovingId(null);
      queryClient.invalidateQueries({ queryKey: ['saved-hostels'] });
    },
  });

  if (!isAuthenticated) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <EmptyState
          icon={<Lock size={26} color={palette.slate[400]} />}
          title="Sign in to view saved hostels"
          subtitle="Save your favorite hostels to easily compare and book later."
          actionLabel="Sign In"
          onAction={() => router.push('/(auth)/login')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Saved Hostels</Text>
        <Text style={styles.countText}>
          {isLoading ? '' : `${saved.length} ${saved.length === 1 ? 'hostel' : 'hostels'}`}
        </Text>
      </View>

      {isLoading ? (
        <FlatList
          data={[0, 1, 2]}
          keyExtractor={(i) => String(i)}
          contentContainerStyle={styles.listContent}
          renderItem={() => <Skeleton style={styles.skeletonRow} />}
        />
      ) : saved.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={<Heart size={26} color={palette.slate[400]} />}
            title="No saved hostels yet"
            subtitle="Explore hostels and tap the heart icon to save them here."
            actionLabel="Explore Hostels"
            onAction={() => router.push('/explore')}
          />
        </View>
      ) : (
        <View style={styles.listCard}>
          <FlatList
            data={saved}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
            renderItem={({ item, index }) => {
              const image = item.images[0]?.r2_url;
              return (
                <View style={styles.row}>
                  <Pressable
                    style={styles.thumb}
                    onPress={() => router.push(`/listing/${item.slug || item.id}`)}
                  >
                    {image ? (
                      <Image source={{ uri: image }} style={styles.thumbImage} contentFit="cover" transition={150} />
                    ) : (
                      <View style={styles.thumbFallback}>
                        <Heart size={18} color={palette.slate[300]} />
                      </View>
                    )}
                  </Pressable>

                  <View style={styles.rowBody}>
                    <Pressable onPress={() => router.push(`/listing/${item.slug || item.id}`)}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </Pressable>
                    <View style={styles.locationRow}>
                      <MapPin size={12} color={palette.slate[400]} />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {item.location}
                      </Text>
                    </View>
                    <Text style={styles.rowPrice}>KES {item.price.toLocaleString()}/mo</Text>
                  </View>

                  <View style={styles.rowActions}>
                    <Pressable
                      style={styles.bookTourButton}
                      onPress={() => setTourListing(item)}
                    >
                      <CalendarPlus size={14} color="#ffffff" />
                      <Text style={styles.bookTourText}>Book Tour</Text>
                    </Pressable>
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => unsaveMutation.mutate(item.id)}
                      disabled={removingId === item.id}
                    >
                      {removingId === item.id ? (
                        <Loader2 size={14} color={palette.slate[500]} />
                      ) : (
                        <Trash2 size={14} color={palette.slate[500]} />
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      <BookTourModal
        visible={Boolean(tourListing)}
        listing={tourListing}
        onClose={() => setTourListing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: palette.slate[900], letterSpacing: -0.4 },
  countText: { color: palette.slate[400], fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  listCard: {
    flex: 1,
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii['2xl'],
    overflow: 'hidden',
  },
  listContent: { padding: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    minHeight: 96,
  },
  rowDivider: { height: 1, backgroundColor: palette.slate[100], marginLeft: 84 },
  thumb: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.slate[100] },
  thumbImage: { width: '100%', height: '100%' },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { color: palette.slate[900], fontSize: 14, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: palette.slate[500], fontSize: 12, fontWeight: '500', flex: 1 },
  rowPrice: { color: palette.slate[900], fontSize: 13, fontWeight: '800', marginTop: 2 },
  rowActions: { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  bookTourButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.slate[900],
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
  },
  bookTourText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonRow: { height: 96, borderRadius: 16, marginHorizontal: 16 },
});