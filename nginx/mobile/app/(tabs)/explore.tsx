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
  type LayoutChangeEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, Tag, X, Search, CalendarCheck, GitCompareArrows, CloudOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../../lib/api/client';
import type { Listing, ListingsPage } from '../../lib/api/schema';
import { fetchZones } from '../../features/campus/queries';
import { ListingCard } from '../../features/listings/listing-card';
import { useCampusStore } from '../../stores/campus';
import { useCompareStore } from '../../stores/compare';
import { Skeleton, IconButton } from '../../lib/components/ui';
import { palette, radii } from '../../lib/theme';

// Web price presets (price-range-filter.tsx) mapped to backend min/max.
const PRICE_PRESETS: { key: string; label: string; min?: number; max?: number }[] = [
  { key: 'under-3k', label: 'Under KES 3,000', max: 3000 },
  { key: 'under-4k', label: 'Under KES 4,000', max: 4000 },
  { key: 'under-5k', label: 'Under KES 5,000', max: 5000 },
  { key: 'under-6k', label: 'Under KES 6,000', max: 6000 },
  { key: 'under-8k', label: 'Under KES 8,000', max: 8000 },
  { key: 'under-10k', label: 'Under KES 10,000', max: 10000 },
  { key: 'above-10k', label: 'Above KES 10,000', min: 10000 },
];

function useDebouncedValue<T>(value: T, delayMs = 200): T {
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

/** Web search-result skeleton (hostels-search.tsx ListingSkeleton). */
function ListingSkeleton({ cardWidth }: { cardWidth: number }) {
  const lines = [48, 70, 100];
  return (
    <View style={styles.skeletonCard}>
      <Skeleton style={[styles.skeletonImage, { width: cardWidth }]} />
      <View style={styles.skeletonBody}>
        {lines.map((w, i) => (
          <Skeleton
            key={i}
            style={[styles.skeletonLine, { width: w, height: i === 0 ? 16 : 12, marginTop: i === 0 ? 0 : 8 }]}
          />
        ))}
      </View>
    </View>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { zone } = useLocalSearchParams<{ zone?: string }>();
  const selectedCampusId = useCampusStore((s) => s.selectedCampusId);
  const selectedCampusSlug = useCampusStore((s) => s.selectedCampusSlug);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const debouncedSearch = useDebouncedValue(searchQuery);

  const [filters, setFilters] = useState<FiltersDraft>({
    zoneSlug: typeof zone === 'string' ? zone : null,
    priceKey: 'any',
  });
  const [sheetMode, setSheetMode] = useState<'filters' | 'price'>('filters');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<FiltersDraft>(filters);

  const selectedPrice = PRICE_PRESETS.find((item) => item.key === filters.priceKey) ?? null;
  const activeFilterCount =
    (filters.zoneSlug ? 1 : 0) + (selectedPrice ? 1 : 0) + (debouncedSearch.trim() ? 1 : 0);

  // ── Compare bar (web: floating compare CTA once anything is selected) ─────
  const hydrateCompare = useCompareStore((s) => s.hydrateFromStorage);
  const compareSelectedIds = useCompareStore((s) => s.selectedIds);
  const addCompareSelection = useCompareStore((s) => s.addSelection);
  const removeCompareSelection = useCompareStore((s) => s.removeSelection);

  useEffect(() => {
    void hydrateCompare();
  }, [hydrateCompare]);

  const { data: zones } = useQuery({
    queryKey: ['zones', selectedCampusId, selectedCampusSlug],
    queryFn: () => fetchZones(selectedCampusId, selectedCampusSlug),
  });

  const {
    data,
    isLoading,
    isError,
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
          min_price: selectedPrice?.min,
          max_price: selectedPrice?.max,
          page: typeof pageParam === 'number' ? pageParam : 1,
          limit: 12,
        },
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined),
  });

  const listings = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const total = data?.pages[0]?.total ?? listings.length;

  const [cardWidth, setCardWidth] = useState(0);
  const onListLayout = (event: LayoutChangeEvent) => {
    setCardWidth(event.nativeEvent.layout.width);
  };

  const openFilters = (mode: 'filters' | 'price') => {
    setDraft(filters);
    setSheetMode(mode);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setFilters(draft);
    setFiltersOpen(false);
  };

  const clearAll = () => {
    setFilters({ zoneSlug: null, priceKey: 'any' });
    setSearchQuery('');
  };

  const resetDraft = () => {
    setDraft({ zoneSlug: null, priceKey: 'any' });
  };

  const handleCompare = (item: Listing) => {
    if (compareSelectedIds.includes(item.id)) {
      removeCompareSelection(item.id);
      return;
    }
    const firstRoom = item.room_types?.[0];
    addCompareSelection({
      id: item.id,
      title: item.title,
      price: item.price,
      price_single: item.price_single,
      price_sharing: item.price_sharing,
      imageUrl: item.images?.[0]?.r2_url,
      slug: item.slug,
      county: item.county,
      area: item.area,
      agentName: item.agent?.name ?? null,
      agentPhone: item.agent?.phone ?? null,
      agentWhatsapp: item.agent?.whatsapp ?? null,
      amenities: item.amenities,
      roomType: firstRoom?.room_type ?? item.room_type,
      roomTypeEnum: item.room_type,
      bathroomType: item.bathroom_type,
      distanceCategory: item.distance_category,
      distanceToCampus: item.distance_to_campus,
      gender: item.gender,
      wifiIncluded: item.wifi_included,
      waterIncluded: item.water_included,
      electricityIncluded: item.electricity_included,
      securityType: item.security_type,
      specificLocation: item.specific_location,
      latitude: item.latitude,
      longitude: item.longitude,
      deposit: firstRoom?.deposit ?? null,
      furnishingItems: firstRoom?.furnishing_items ?? null,
      roomTypeLabel: firstRoom?.room_type ?? null,
    });
  };

  const header = (
    <View style={[styles.headerWrap, { paddingTop: insets.top + 12 }]}>
      {/* Elevated search container (web: bg-white rounded-2xl shadow border) */}
      <View style={styles.searchCard}>
        {/* Search input */}
        <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
          <Search size={18} color={palette.slate[400]} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, area, or price"
            placeholderTextColor={palette.slate[500]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={16} color={palette.slate[400]} />
            </Pressable>
          )}
        </View>

        {/* Controls row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.controlsRail}
        >
          <Pressable style={styles.controlsPill} onPress={() => openFilters('filters')}>
            <SlidersHorizontal size={14} color="#ffffff" />
            <Text style={styles.controlsPillText}>Filters</Text>
            {(activeFilterCount - (debouncedSearch.trim() ? 1 : 0)) > 0 && (
              <View style={[styles.pillBadge, styles.pillBadgeOnDark]}>
                <Text style={styles.pillBadgeText}>
                  {activeFilterCount - (debouncedSearch.trim() ? 1 : 0)}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable style={styles.pricePill} onPress={() => openFilters('price')}>
            <Tag size={14} color="#ffffff" />
            <Text style={styles.controlsPillText}>Price</Text>
            {selectedPrice && (
              <View style={[styles.pillBadge, styles.pillBadgeOnDark]}>
                <Text style={styles.pillBadgeText}>1</Text>
              </View>
            )}
          </Pressable>

          <Pressable style={styles.tourPill} onPress={() => router.push('/book-tour')}>
            <CalendarCheck size={14} color="#ffffff" />
            <Text style={styles.controlsPillText}>Book a Tour</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Active filter chips */}
      {activeFilterCount > 0 ? (
        <View style={styles.activeChips}>
          {filters.zoneSlug ? (
            <Pressable
              style={styles.activeChip}
              onPress={() => setFilters((f) => ({ ...f, zoneSlug: null }))}
            >
              <Text style={styles.activeChipText}>
                {zones?.find((z) => z.slug === filters.zoneSlug)?.name ?? filters.zoneSlug}
              </Text>
              <X size={12} color={palette.emerald[700]} />
            </Pressable>
          ) : null}
          {selectedPrice ? (
            <Pressable
              style={styles.activeChip}
              onPress={() => setFilters((f) => ({ ...f, priceKey: 'any' }))}
            >
              <Text style={styles.activeChipText}>{selectedPrice.label}</Text>
              <X size={12} color={palette.emerald[700]} />
            </Pressable>
          ) : null}
          {debouncedSearch.trim() ? (
            <Pressable style={styles.activeChip} onPress={() => setSearchQuery('')}>
              <Text style={styles.activeChipText} numberOfLines={1}>
                “{debouncedSearch.trim()}”
              </Text>
              <X size={12} color={palette.emerald[700]} />
            </Pressable>
          ) : null}
          <Pressable onPress={clearAll} hitSlop={6}>
            <Text style={styles.clearAll}>Clear all</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Results count */}
      {!isLoading && !isError ? (
        <View style={styles.resultCountRow}>
          <Text style={styles.resultCount}>
            {total} {total === 1 ? 'hostel' : 'hostels'} found
            {activeFilterCount > 0 ? <Text style={styles.resultAccent}> · </Text> : null}
          </Text>
          {activeFilterCount > 0 ? (
            <Pressable onPress={clearAll} hitSlop={6}>
              <Text style={styles.resultClearAll}>Clear all</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <FlatList
          data={[0, 1, 2]}
          keyExtractor={(i) => `skeleton-${i}`}
          onLayout={onListLayout}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          renderItem={() => <ListingSkeleton cardWidth={cardWidth} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
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
          ListHeaderComponent={header}
          ListEmptyComponent={
            isError ? (
              <View style={styles.emptyCard}>
                <View style={styles.errorIcon}>
                  <CloudOff size={24} color={palette.slate[400]} />
                </View>
                <Text style={styles.emptyText}>
                  Couldn{'\u2019'}t load hostels right now. Check that the backend is running and you{'\u2019'}re
                  connected, then try again.
                </Text>
                <Pressable style={styles.emptyButton} onPress={() => void refetch()}>
                  <Text style={styles.emptyButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No hostels match your search. Try different terms or clear your filters.
                </Text>
                <Pressable style={styles.emptyButton} onPress={clearAll}>
                  <Text style={styles.emptyButtonText}>Clear all filters</Text>
                </Pressable>
              </View>
            )
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={palette.emerald[500]} style={styles.footerLoader} />
            ) : (
              <View style={styles.footerGap} />
            )
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => router.push(`/listing/${item.slug || item.id}`)}
              compareSelected={compareSelectedIds.includes(item.id)}
              onCompare={() => handleCompare(item)}
            />
          )}
        />
      )}

      {/* Floating compare bar (web: fixed bottom CTA on /hostels) */}
      {compareSelectedIds.length > 0 ? (
        <View style={[styles.compareBar, { bottom: insets.bottom + 72 }]}>
          <View style={styles.compareBarInfo}>
            <GitCompareArrows size={16} color={palette.emerald[600]} />
            <Text style={styles.compareBarText}>
              {compareSelectedIds.length} {compareSelectedIds.length === 1 ? 'hostel' : 'hostels'} selected
            </Text>
            <Pressable onPress={() => removeCompareSelection(compareSelectedIds[compareSelectedIds.length - 1])} hitSlop={8}>
              <Text style={styles.compareBarClose}>✕</Text>
            </Pressable>
          </View>
          <Pressable style={styles.compareBarButton} onPress={() => router.push('/compare')}>
            <Text style={styles.compareBarButtonText}>Compare Now</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Filters bottom sheet (web: FilterBottomSheet rounded-t-3xl + footer actions) */}
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFiltersOpen(false)} />
          <View style={[styles.sheet, sheetMode === 'price' ? styles.sheetAuto : null, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{sheetMode === 'price' ? 'Price Filter' : 'Filters'}</Text>
              <IconButton onPress={() => setFiltersOpen(false)} accessibilityLabel="Close" dark style={styles.sheetClose}>
                <X size={18} color={palette.slate[400]} />
              </IconButton>
            </View>
            <View style={styles.sheetDivider} />

            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {sheetMode !== 'price' ? (
                <>
                  <Text style={styles.sheetLabel}>Location (DeKUT Zones)</Text>
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
                  <View style={styles.sheetSectionDivider} />
                </>
              ) : null}

              <Text style={styles.sheetLabel}>Price Range</Text>
              <View style={styles.chipGrid}>
                <Pressable
                  style={[styles.choiceChip, draft.priceKey === 'any' && styles.choiceChipActive]}
                  onPress={() => setDraft((d) => ({ ...d, priceKey: 'any' }))}
                >
                  <Text style={[styles.choiceChipText, draft.priceKey === 'any' && styles.choiceChipTextActive]}>
                    Any price
                  </Text>
                </Pressable>
                {PRICE_PRESETS.map((item) => {
                  const selected = draft.priceKey === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.choiceChip, selected && styles.choiceChipActive]}
                      onPress={() => setDraft((d) => ({ ...d, priceKey: item.key }))}
                    >
                      <Text
                        style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable style={styles.clearButton} onPress={resetDraft}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </Pressable>
              <Pressable style={styles.applyButton} onPress={applyFilters}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(248,250,252,0.5)' },
  headerWrap: { paddingHorizontal: 16, paddingBottom: 4 },
  // Elevated search container
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: palette.slate[100],
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 14,
    elevation: 2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(241,245,249,0.6)',
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii.xl,
    height: 48,
    paddingRight: 12,
    paddingLeft: 6,
  },
  searchWrapFocused: { backgroundColor: '#ffffff', borderColor: palette.emerald[400] },
  searchIcon: { marginLeft: 8, marginRight: 2 },
  searchInput: { flex: 1, color: palette.slate[900], fontSize: 15, fontWeight: '500' },
  controlsRail: { flexDirection: 'row', gap: 8, paddingTop: 10, paddingBottom: 2 },
  controlsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.emerald[500],
    borderRadius: radii.full,
    paddingHorizontal: 16,
    height: 36,
    shadowColor: palette.emerald[500],
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.rose[500],
    borderRadius: radii.full,
    paddingHorizontal: 16,
    height: 36,
    shadowColor: palette.rose[500],
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  tourPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.slate[900],
    borderRadius: radii.full,
    paddingHorizontal: 16,
    height: 36,
  },
  controlsPillText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  pillBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 2,
  },
  pillBadgeOnDark: { backgroundColor: 'rgba(255,255,255,0.2)' },
  pillBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  // Active filter chips (web ActiveFilterChips)
  activeChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[200],
    borderRadius: radii.full,
    paddingHorizontal: 12,
    height: 28,
    maxWidth: '80%',
  },
  activeChipText: { color: palette.emerald[700], fontSize: 12, fontWeight: '600', maxWidth: 220 },
  clearAll: { color: palette.rose[500], fontSize: 12, fontWeight: '600' },
  // Results count
  resultCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 2,
    gap: 4,
  },
  resultCount: { color: palette.slate[400], fontSize: 14, fontWeight: '600' },
  resultAccent: { color: palette.slate[300] },
  resultClearAll: { color: palette.rose[400], fontSize: 14, fontWeight: '600' },
  // Listing grid
  listContent: { paddingHorizontal: 16, gap: 16 },
  skeletonCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[100],
    borderRadius: radii['2xl'],
    overflow: 'hidden',
  },
  skeletonImage: { aspectRatio: 4 / 3, backgroundColor: palette.slate[200] },
  skeletonBody: { padding: 16 },
  skeletonLine: { borderRadius: 4, backgroundColor: palette.slate[200] },
  footerLoader: { marginVertical: 20 },
  footerGap: { height: 80 },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[100],
    borderRadius: radii['2xl'],
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: palette.slate[500],
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 20,
    backgroundColor: palette.slate[900],
    borderRadius: radii.xl,
    paddingHorizontal: 20,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  // Floating compare bar
  compareBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: palette.emerald[200],
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 8,
  },
  compareBarInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  compareBarText: { color: palette.slate[900], fontSize: 13, fontWeight: '700', flex: 1 },
  compareBarClose: { color: palette.slate[400], fontSize: 14, padding: 4 },
  compareBarButton: {
    backgroundColor: palette.emerald[600],
    borderRadius: radii.xl,
    paddingHorizontal: 16,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareBarButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  // Filters bottom sheet (web FilterBottomSheet)
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: palette.slate[200],
    paddingHorizontal: 20,
    paddingTop: 10,
    height: '85%',
  },
  sheetAuto: { height: 'auto', maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: palette.slate[300], alignSelf: 'center', marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: palette.slate[900] },
  sheetClose: { width: 40, height: 40, borderRadius: 20 },
  sheetDivider: { height: 1, backgroundColor: palette.slate[100] },
  sheetScroll: { flex: 1, paddingVertical: 18 },
  sheetLabel: {
    color: palette.slate[900],
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetSectionDivider: { height: 1, backgroundColor: palette.slate[100], marginVertical: 20 },
  choiceChip: {
    backgroundColor: palette.slate[100],
    paddingHorizontal: 16,
    height: 40,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceChipActive: { backgroundColor: palette.emerald[500] },
  choiceChipText: { color: palette.slate[600], fontSize: 14, fontWeight: '500', maxWidth: 220 },
  choiceChipTextActive: { color: '#ffffff' },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: palette.slate[100],
    paddingTop: 16,
  },
  clearButton: {
    flex: 1,
    height: 48,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: palette.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  clearButtonText: { color: palette.slate[600], fontSize: 14, fontWeight: '600' },
  applyButton: {
    flex: 1,
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: palette.emerald[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});