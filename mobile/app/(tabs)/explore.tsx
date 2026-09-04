import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, Tag, X, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../../lib/api/client';
import type { ListingsPage } from '../../lib/api/schema';
import { fetchZones } from '../../features/campus/queries';
import { ListingCard } from '../../features/listings/listing-card';
import { useCampusStore } from '../../stores/campus';
import { EmptyState, IconButton, Skeleton } from '../../lib/components/ui';
import { palette, radii, useThemeColors } from '../../lib/theme';

const PRICE_FILTERS: { key: string; label: string; min?: number; max?: number }[] = [
  { key: 'any', label: 'Any price' },
  { key: 'under-5k', label: 'Under 5K', max: 5000 },
  { key: '5k-10k', label: '5K-10K', min: 5000, max: 10000 },
  { key: '10k-plus', label: '10K+', min: 10000 },
];

function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface FiltersDraft {
  zoneSlug: string | null;
  priceKey: string;
}

export default function ExploreScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { zone } = useLocalSearchParams<{ zone?: string }>();
  const selectedCampusId = useCampusStore((s) => s.selectedCampusId);
  const selectedCampusSlug = useCampusStore((s) => s.selectedCampusSlug);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);

  const [filters, setFilters] = useState<FiltersDraft>({
    zoneSlug: typeof zone === 'string' ? zone : null,
    priceKey: 'any',
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<FiltersDraft>(filters);

  const selectedPrice = PRICE_FILTERS.find((item) => item.key === filters.priceKey) ?? PRICE_FILTERS[0];
  const activeFilterCount =
    (filters.zoneSlug ? 1 : 0) + (filters.priceKey !== 'any' ? 1 : 0) + (debouncedSearch.trim() ? 1 : 0);

  const { data: zones } = useQuery({
    queryKey: ['zones', selectedCampusId, selectedCampusSlug],
    queryFn: () => fetchZones(selectedCampusId, selectedCampusSlug),
  });

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['explore-listings', selectedCampusSlug, filters.zoneSlug, filters.priceKey, debouncedSearch],
    queryFn: ({ pageParam }) =>
      apiFetch<ListingsPage>('/search', {
        params: {
          q: debouncedSearch.trim() || undefined,
          campus_slug: selectedCampusSlug,
          zone_slug: filters.zoneSlug || undefined,
          min_price: selectedPrice.min,
          max_price: selectedPrice.max,
          page: typeof pageParam === 'number' ? pageParam : 1,
          limit: 12,
        },
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined),
  });

  const listings = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const total = data?.pages[0]?.total ?? listings.length;

  const openFilters = () => {
    setDraft(filters);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setFilters(draft);
    setFiltersOpen(false);
  };

  return (
    <View style={styles.container}>
      {/* Search + controls */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Explore Hostels</Text>

        <View style={styles.searchWrap}>
          <Search size={18} color={palette.slate[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, area, or price"
            placeholderTextColor={palette.slate[500]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={16} color={palette.slate[400]} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.controlsRail}>
          <Pressable style={styles.controlsPill} onPress={openFilters}>
            <SlidersHorizontal size={14} color="#ffffff" />
            <Text style={styles.controlsPillText}>Filters</Text>
            {activeFilterCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>

          <Pressable style={styles.pricePill} onPress={openFilters}>
            <Tag size={14} color="#ffffff" />
            <Text style={styles.controlsPillText}>Price</Text>
            {filters.priceKey !== 'any' && (
              <View style={styles.countBadgeLight}>
                <Text style={styles.countBadgeLightText}>1</Text>
              </View>
            )}
          </Pressable>
        </ScrollView>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <View style={styles.activeChips}>
            {filters.zoneSlug ? (
              <Pressable
                style={styles.activeChip}
                onPress={() => setFilters((f) => ({ ...f, zoneSlug: null }))}
              >
                <Text style={styles.activeChipText}>{zones?.find((z) => z.slug === filters.zoneSlug)?.name ?? filters.zoneSlug}</Text>
                <X size={12} color={palette.slate[600]} />
              </Pressable>
            ) : null}
            {filters.priceKey !== 'any' ? (
              <Pressable
                style={styles.activeChip}
                onPress={() => setFilters((f) => ({ ...f, priceKey: 'any' }))}
              >
                <Text style={styles.activeChipText}>{PRICE_FILTERS.find((p) => p.key === filters.priceKey)?.label}</Text>
                <X size={12} color={palette.slate[600]} />
              </Pressable>
            ) : null}
            {debouncedSearch.trim() ? (
              <Pressable style={styles.activeChip} onPress={() => setSearchQuery('')}>
                <Text style={styles.activeChipText} numberOfLines={1}>
                  “{debouncedSearch.trim()}”
                </Text>
                <X size={12} color={palette.slate[600]} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                setFilters({ zoneSlug: null, priceKey: 'any' });
                setSearchQuery('');
              }}
            >
              <Text style={styles.clearAll}>Clear all</Text>
            </Pressable>
          </View>
        )}

        {/* Results count */}
        {!isLoading && (
          <Text style={styles.resultCount}>
            {total} {total === 1 ? 'hostel' : 'hostels'} found
          </Text>
        )}
      </View>

      {/* Results */}
      {isLoading ? (
        <FlatList
          data={[0, 1, 2]}
          keyExtractor={(i) => String(i)}
          contentContainerStyle={styles.listContent}
          renderItem={() => <Skeleton style={styles.skeletonCard} />}
        />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon={<Search size={26} color={palette.slate[400]} />}
              title="No hostels found"
              subtitle="Try another search term, zone, or price range."
              actionLabel="Clear filters"
              onAction={() => {
                setFilters({ zoneSlug: null, priceKey: 'any' });
                setSearchQuery('');
              }}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={colors.primary} style={styles.footerLoader} />
            ) : (
              <View style={styles.footerGap} />
            )
          }
          renderItem={({ item }) => (
            <ListingCard listing={item} onPress={() => router.push(`/listing/${item.slug || item.id}`)} />
          )}
        />
      )}

      {/* Filters bottom sheet */}
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFiltersOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <IconButton onPress={() => setFiltersOpen(false)} style={{ width: 32, height: 32 }}>
                <X size={16} color={palette.slate[500]} />
              </IconButton>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetLabel}>Area / Zone</Text>
              <View style={styles.chipGrid}>
                <Pressable
                  style={[styles.choiceChip, draft.zoneSlug === null && styles.choiceChipActive]}
                  onPress={() => setDraft((d) => ({ ...d, zoneSlug: null }))}
                >
                  <Text style={[styles.choiceChipText, draft.zoneSlug === null && styles.choiceChipTextActive]}>
                    All zones
                  </Text>
                </Pressable>
                {(zones ?? []).map((item) => {
                  const selected = draft.zoneSlug === item.slug;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.choiceChip, selected && styles.choiceChipActive]}
                      onPress={() => setDraft((d) => ({ ...d, zoneSlug: item.slug }))}
                    >
                      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sheetLabel}>Monthly price</Text>
              <View style={styles.chipGrid}>
                {PRICE_FILTERS.map((item) => {
                  const selected = draft.priceKey === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.choiceChip, selected && styles.choiceChipActive]}
                      onPress={() => setDraft((d) => ({ ...d, priceKey: item.key }))}
                    >
                      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable
                style={styles.clearButton}
                onPress={() => setDraft({ zoneSlug: null, priceKey: 'any' })}
              >
                <Text style={styles.clearButtonText}>Clear all</Text>
              </Pressable>
              <Pressable style={styles.applyButton} onPress={applyFilters}>
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: palette.slate[100],
  },
  title: { fontSize: 24, fontWeight: '800', color: palette.slate[900], marginBottom: 12, letterSpacing: -0.4 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.slate[100],
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: { flex: 1, color: palette.slate[900], fontSize: 15, fontWeight: '500' },
  controlsRail: { marginHorizontal: -16, paddingHorizontal: 16, marginTop: 12, flexGrow: 0 },
  controlsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.emerald[500],
    paddingHorizontal: 16,
    height: 36,
    borderRadius: radii.full,
    marginRight: 8,
  },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.rose[600],
    paddingHorizontal: 16,
    height: 36,
    borderRadius: radii.full,
    marginRight: 8,
  },
  controlsPillText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  countBadgeLight: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countBadgeLightText: { color: palette.rose[600], fontSize: 11, fontWeight: '800' },
  activeChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.slate[100],
    borderRadius: radii.full,
    paddingHorizontal: 12,
    height: 30,
  },
  activeChipText: { color: palette.slate[700], fontSize: 12, fontWeight: '600', maxWidth: 160 },
  clearAll: { color: palette.slate[500], fontSize: 12, fontWeight: '700' },
  resultCount: {
    color: palette.slate[400],
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
  listContent: { padding: 16, gap: 16 },
  skeletonCard: { height: 320, borderRadius: 16 },
  footerLoader: { marginVertical: 20 },
  footerGap: { height: 40 },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: palette.slate[300], alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: palette.slate[900] },
  sheetLabel: {
    color: palette.slate[500],
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 6,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  choiceChip: {
    backgroundColor: palette.slate[100],
    paddingHorizontal: 16,
    height: 38,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceChipActive: { backgroundColor: palette.slate[900] },
  choiceChipText: { color: palette.slate[600], fontSize: 13, fontWeight: '600' },
  choiceChipTextActive: { color: '#ffffff' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  clearButton: {
    flex: 1,
    height: 48,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.slate[300],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  clearButtonText: { color: palette.slate[700], fontSize: 14, fontWeight: '700' },
  applyButton: {
    flex: 2,
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: palette.slate[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});