import React, { useEffect, useMemo, useState, type ComponentType } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  Heart,
  ArrowRight,
  Compass,
  KeyRound,
  Lightbulb,
  Sparkles,
  Info,
  AlertTriangle
} from 'lucide-react-native';

import { apiFetch } from '../../lib/api/client';
import type {
  Campus,
  Announcement,
  AppNotification,
  ListingsPage,
  Listing
} from '../../lib/api/schema';
import { fetchCampuses, listingCampusParams } from '../../lib/api/campuses';
import { fetchZones } from '../../features/campus/queries';
import { ListingCard } from '../../features/listings/listing-card';
import { useCampusStore } from '../../stores/campus';
import { useSessionStore } from '../../stores/session';
import { useCompareStore } from '../../stores/compare';
import { Skeleton } from '../../lib/components/ui';
import { palette, radii, shadows, spacing } from '../../lib/theme';

const DEFAULT_CAMPUS_IMAGE = 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';

const CAMPUS_PREVIEWS: Record<string, { image: string; zones: string[]; description: string }> = {
  dekut: {
    image: DEFAULT_CAMPUS_IMAGE,
    zones: ['Gate A', 'Embassy', 'Boma', 'Nyeri View'],
    description: 'Verified student hostels near Dedan Kimathi University of Technology, Nyeri.'
  },
  mmu: {
    image: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=800',
    zones: ['Magadi Road', 'Ongata Rongai', 'Rimpa'],
    description: 'Hostels along Magadi Road and Ongata Rongai, Nairobi.'
  },
  ku: {
    image: 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800',
    zones: ['Kahawa Sukari', 'Kahawa Wendani', 'KM'],
    description: 'Hostels around Main Campus and Kahawa Sukari, Nairobi.'
  },
  uon: {
    image: 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?q=80&w=800',
    zones: ['Main Campus', 'Chiromo', 'Parklands'],
    description: 'Housing near Main, Chiromo and Parklands campuses, Nairobi.'
  },
  mmust: {
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=800',
    zones: ['Kakamega Town', 'Lurambi', 'Kefinco'],
    description: 'Student accommodation across Kakamega, Kenya.'
  },
  kisii: {
    image: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?q=80&w=800',
    zones: ['Main Campus', 'Nyanchwa', 'Town Centre'],
    description: 'Verified student rooms near Main Campus, Kisii.'
  }
};

const SHORT_NAMES: Record<string, string> = {
  dekut: 'DeKUT',
  mmu: 'MMU',
  ku: 'KU',
  uon: 'UoN',
  mmust: 'MMUST',
  kisii: 'Kisii'
};

interface AnnouncementStyle {
  icon: ComponentType<{ size?: number; color?: string }>;
  accent: string;
  chipBg: string;
  chipFg: string;
}

const ANNOUNCEMENT_STYLES: Record<string, AnnouncementStyle> = {
  warning: {
    icon: AlertTriangle,
    accent: palette.amber[400],
    chipBg: palette.amber[100],
    chipFg: palette.amber[700]
  },
  encouragement: {
    icon: Sparkles,
    accent: palette.emerald[400],
    chipBg: palette.emerald[100],
    chipFg: palette.emerald[700]
  },
  info: {
    icon: Info,
    accent: palette.sky[400],
    chipBg: palette.sky[100],
    chipFg: palette.sky[700]
  }
};

function shortName(campus?: Campus): string {
  if (!campus?.slug && !campus?.name) return 'DeKUT';
  if (campus.slug) return SHORT_NAMES[campus.slug] ?? campus.name.split(' ')[0] ?? campus.name;
  return campus.name.split(' ')[0] ?? campus.name;
}

function campusName(campus: Campus | undefined, width: number): string {
  if (!campus) return 'DeKUT';
  return width < 600 ? shortName(campus) : campus.name;
}

function HomePopularCard({
  listing,
  index,
  onPress
}: {
  listing: Listing;
  index: number;
  onPress: () => void;
}) {
  const addSelection = useCompareStore((s) => s.addSelection);
  const removeSelection = useCompareStore((s) => s.removeSelection);
  const isSelected = useCompareStore((s) => s.isSelected(listing.id));

  const handleCompare = () => {
    if (isSelected) {
      removeSelection(listing.id);
      return;
    }

    addSelection({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      price_single: listing.price_single,
      price_sharing: listing.price_sharing,
      imageUrl: listing.images[0]?.r2_url,
      slug: listing.slug,
      county: listing.county,
      area: listing.area,
      agentName: listing.agent?.name
    });
  };

  return (
    <ListingCard
      listing={listing}
      variant="popular"
      rank={index + 1}
      onPress={onPress}
      compareSelected={isSelected}
      onCompare={handleCompare}
      style={styles.popularCardWide}
    />
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const selectedCampusId = useCampusStore((s) => s.selectedCampusId);
  const selectedCampusSlug = useCampusStore((s) => s.selectedCampusSlug);
  const setSelectedCampus = useCampusStore((s) => s.setSelectedCampus);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const hydrateCompare = useCompareStore((s) => s.hydrateFromStorage);
  const [notifiedCampuses, setNotifiedCampuses] = useState<Record<string, boolean>>({});
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  useEffect(() => {
    void hydrateCompare();
  }, [hydrateCompare]);

  const { data: notifications } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch('/notifications'),
    enabled: isAuthenticated
  });

  const { data: campuses } = useQuery<Campus[]>({
    queryKey: ['campuses'],
    queryFn: fetchCampuses
  });

  const { data: zones } = useQuery({
    queryKey: ['zones', selectedCampusId, selectedCampusSlug],
    queryFn: () => fetchZones(selectedCampusId, selectedCampusSlug)
  });

  useEffect(() => {
    if (selectedCampusId || !campuses?.length) {
      return;
    }

    const campus = campuses.find((item) => item.slug === selectedCampusSlug) ?? campuses[0];
    setSelectedCampus({ id: campus.id, name: campus.name, slug: campus.slug });
  }, [campuses, selectedCampusId, selectedCampusSlug, setSelectedCampus]);

  const { data: popularListings, isLoading: loadingHostels } = useQuery<ListingsPage>({
    queryKey: ['popular-hostels', selectedCampusId, selectedCampusSlug],
    queryFn: () =>
      apiFetch('/listings', {
        params: {
          ...listingCampusParams(selectedCampusId, selectedCampusSlug),
          sort: 'views',
          limit: 10
        }
      })
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ['announcements', selectedCampusId],
    queryFn: () => apiFetch('/announcements', { params: { campus_id: selectedCampusId } }),
    enabled: Boolean(selectedCampusId)
  });

  const selectedCampus = campuses?.find((c) => c.slug === selectedCampusSlug);
  const displayCampusName = campusName(selectedCampus, width);

  const filteredListings = useMemo(() => {
    const base = popularListings?.items ?? [];
    if (!selectedArea) return base;

    const area = selectedArea.toLowerCase();
    return base.filter((item) => {
      const listingArea = (item.area ?? '').toLowerCase();
      const listingLocation = (item.location ?? '').toLowerCase();
      return listingArea === area || listingLocation.includes(area) || listingArea.includes(area);
    });
  }, [popularListings?.items, selectedArea]);

  const handleCampusPress = (campus: Campus) => {
    if (campus.status === 'active') {
      setSelectedCampus({ id: campus.id, name: campus.name, slug: campus.slug });
      router.push('/explore');
      return;
    }

    setNotifiedCampuses((prev) => ({ ...prev, [campus.slug]: true }));
  };

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.brand} onPress={() => router.push('/')}>
          <View style={styles.brandLogo}>
            <Image source={require('../../assets/images/icon.png')} style={styles.brandImage} />
          </View>
          <Text style={styles.brandText}>RUMIA</Text>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/explore')}>
            <Search size={18} color={palette.slate[700]} />
          </Pressable>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/saved')}>
            <Heart size={18} color={palette.slate[700]} />
          </Pressable>
          {unreadCount > 0 ? (
            <View style={styles.notifBadge} pointerEvents="none">
              <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.discoverySection}>
        <Text style={styles.discoveryEyebrow}>Explore near {displayCampusName}</Text>
        <Text style={styles.discoveryTitle}>Hostels near {displayCampusName}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.areaChipsRow}
        >
          <Pressable
            onPress={() => setSelectedArea(null)}
            style={({ pressed }) => [
              styles.areaChip,
              !selectedArea && styles.areaChipActive,
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.areaChipText, !selectedArea && styles.areaChipTextActive]}>
              All areas
            </Text>
          </Pressable>

          {(zones ?? []).map((zone) => {
            const isActive = selectedArea === zone.name;
            return (
              <Pressable
                key={zone.id}
                onPress={() => setSelectedArea(isActive ? null : zone.name)}
                style={({ pressed }) => [
                  styles.areaChip,
                  isActive && styles.areaChipActive,
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.areaChipText, isActive && styles.areaChipTextActive]}>
                  {zone.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {announcements && announcements.length > 0 ? (
        <View style={styles.announcementSection}>
          {announcements.map((item) => {
            const style = ANNOUNCEMENT_STYLES[item.type] ?? ANNOUNCEMENT_STYLES.info;
            const Icon = style.icon;

            return (
              <View
                key={item.id}
                style={[styles.announcementCard, { borderLeftColor: style.accent }]}
              >
                <View style={[styles.announcementIcon, { backgroundColor: style.chipBg }]}>
                  <Icon size={16} color={style.chipFg} />
                </View>
                <View style={styles.announcementBody}>
                  <Text style={styles.announcementTitle}>{item.title}</Text>
                  <Text style={styles.announcementMessage}>{item.message}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionLabel}>Popular</Text>
            <Text style={styles.sectionTitle}>Popular near {displayCampusName}</Text>
          </View>
          <Pressable onPress={() => router.push('/explore')} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>See all</Text>
            <ArrowRight size={14} color={palette.emerald[700]} />
          </Pressable>
        </View>

        {loadingHostels ? (
          <View style={styles.cardStack}>
            <Skeleton style={styles.skeletonCard} />
            <Skeleton style={styles.skeletonCard} />
          </View>
        ) : (
          <View style={styles.cardStack}>
            {filteredListings.map((item, index) => (
              <HomePopularCard
                key={item.id}
                listing={item}
                index={index}
                onPress={() => router.push(`/listing/${item.slug || item.id}`)}
              />
            ))}

            {filteredListings.length === 0 && !loadingHostels ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>
                  No rooms in {selectedArea || 'this area'}
                </Text>
                <Text style={styles.emptyStateText}>
                  Try another area or browse wider across {displayCampusName}.
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.findBand}>
        <View style={styles.findEyebrow}>
          <Compass size={13} color={palette.emerald[700]} />
          <Text style={styles.findEyebrowText}>Rumia match</Text>
        </View>
        <Text style={styles.findBandTitle}>Let us find a room that fits.</Text>

        <Pressable
          style={({ pressed }) => [styles.findCard, pressed && styles.pressed]}
          onPress={() => router.push('/find-me-a-hostel')}
        >
          <View style={styles.findIcon}>
            <KeyRound size={18} color={palette.emerald[700]} />
          </View>
          <View style={styles.findBody}>
            <Text style={styles.findText}>
              Tell us your budget and area and we will match you with the best options.
            </Text>
          </View>
          <View style={styles.findArrow}>
            <ArrowRight size={14} color={palette.white} />
          </View>
        </Pressable>
      </View>

      {typeof popularListings?.total === 'number' && popularListings.total < 20 && (
        <View style={styles.earlyAccessSection}>
          <View style={styles.earlyAccessCard}>
            <View style={styles.earlyAccessIcon}>
              <Lightbulb size={18} color={palette.emerald[600]} />
            </View>
            <View style={styles.earlyAccessBody}>
              <Text style={styles.earlyAccessTitle}>More homes are being added.</Text>
              <Text style={styles.earlyAccessSub}>
                Tell us the area or type of room you want most.
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.earlyAccessCta, pressed && styles.pressed]}
              onPress={() => router.push(isAuthenticated ? '/profile' : '/(auth)/login')}
            >
              <Text style={styles.earlyAccessCtaText}>Share</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.slate[50] },
  content: { paddingBottom: spacing[8] },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
    backgroundColor: '#ffffff'
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: 'hidden'
  },
  brandImage: { width: '100%', height: '100%' },
  brandText: { fontSize: 18, fontWeight: '900', color: palette.slate[900], letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.slate[100],
    alignItems: 'center',
    justifyContent: 'center'
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: palette.red[600],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[1]
  },
  notifBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  discoverySection: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
    paddingBottom: spacing[4]
  },
  discoveryEyebrow: {
    color: palette.emerald[700],
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  discoveryTitle: {
    color: palette.slate[900],
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginTop: spacing[2]
  },
  areaChipsRow: { paddingTop: spacing[4], gap: spacing[2] },
  areaChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate[200]
  },
  areaChipActive: {
    backgroundColor: palette.emerald[50],
    borderColor: palette.emerald[200]
  },
  areaChipText: {
    color: palette.slate[600],
    fontSize: 12,
    fontWeight: '600'
  },
  areaChipTextActive: {
    color: palette.emerald[700]
  },
  announcementSection: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
    gap: spacing[3]
  },
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: '#ffffff',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderLeftWidth: 4,
    padding: spacing[4],
    ...shadows.card
  },
  announcementIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[0]
  },
  announcementBody: { flex: 1, minWidth: 0 },
  announcementTitle: { color: palette.slate[900], fontSize: 14, fontWeight: '700' },
  announcementMessage: {
    color: palette.slate[600],
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing[1]
  },
  section: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[8],
    paddingBottom: spacing[2]
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginBottom: spacing[4]
  },
  sectionHeaderCopy: { flex: 1, minWidth: 0 },
  sectionLabel: {
    color: palette.emerald[700],
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  sectionTitle: {
    color: palette.slate[900],
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 28,
    marginTop: spacing[1]
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[1]
  },
  linkButtonText: {
    color: palette.emerald[700],
    fontSize: 13,
    fontWeight: '700'
  },
  cardStack: { gap: spacing[4] },
  skeletonCard: { width: '100%', height: 340, borderRadius: 16 },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: palette.slate[200],
    padding: spacing[5]
  },
  emptyStateTitle: {
    color: palette.slate[900],
    fontSize: 16,
    fontWeight: '700'
  },
  emptyStateText: {
    color: palette.slate[500],
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing[1.5]
  },
  findBand: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(226,232,240,0.6)',
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
    marginTop: spacing[8]
  },
  findEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1.5],
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.6)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
    marginBottom: spacing[4]
  },
  findEyebrowText: { color: palette.emerald[700], fontSize: 12, fontWeight: '700' },
  findBandTitle: {
    color: palette.slate[900],
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 34,
    maxWidth: 340,
    marginBottom: spacing[4]
  },
  findCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.emerald[200],
    borderRadius: radii['2xl'],
    padding: spacing[3]
  },
  findIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.emerald[50],
    alignItems: 'center',
    justifyContent: 'center'
  },
  findBody: { flex: 1 },
  findText: { color: palette.slate[500], fontSize: 13, lineHeight: 19 },
  findArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.slate[900],
    alignItems: 'center',
    justifyContent: 'center'
  },
  earlyAccessSection: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
    paddingBottom: spacing[2]
  },
  earlyAccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[200],
    borderRadius: radii['2xl'],
    padding: spacing[3]
  },
  earlyAccessIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: palette.emerald[100],
    alignItems: 'center',
    justifyContent: 'center'
  },
  earlyAccessBody: { flex: 1 },
  earlyAccessTitle: { color: palette.slate[800], fontSize: 13, fontWeight: '700' },
  earlyAccessSub: {
    color: palette.slate[500],
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing[0.5]
  },
  earlyAccessCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: palette.emerald[600],
    borderRadius: radii.xl,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2]
  },
  earlyAccessCtaText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  popularCardWide: { width: '100%' }
});
