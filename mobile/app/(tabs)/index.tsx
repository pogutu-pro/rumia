import React, { useEffect, useState, type ComponentType } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  Search,
  MapPin,
  TrendingUp,
  ArrowRight,
  Compass,
  KeyRound,
  Lightbulb,
  Sparkles,
  Info,
  AlertTriangle,
} from 'lucide-react-native';
import { apiFetch } from '../../lib/api/client';
import type {
  Campus,
  Announcement,
  AppNotification,
  ListingsPage,
  Listing,
} from '../../lib/api/schema';
import { fetchCampuses, listingCampusParams } from '../../lib/api/campuses';
import { ListingCard } from '../../features/listings/listing-card';
import { useCampusStore } from '../../stores/campus';
import { useSessionStore } from '../../stores/session';
import { useCompareStore } from '../../stores/compare';
import { Skeleton } from '../../lib/components/ui';
import { palette, radii, shadows } from '../../lib/theme';

const DEFAULT_CAMPUS_IMAGE =
  'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';

/**
 * Mirrors web CAMPUS_PREVIEWS in campus-picker-cards.tsx so mobile shows the
 * same zones, descriptions and preview imagery.
 */
const CAMPUS_PREVIEWS: Record<
  string,
  { image: string; zones: string[]; description: string }
> = {
  dekut: {
    image: DEFAULT_CAMPUS_IMAGE,
    zones: ['Gate A', 'Embassy', 'Boma', 'Nyeri View'],
    description:
      'Verified student hostels near Dedan Kimathi University of Technology, Nyeri.',
  },
  mmu: {
    image: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=800',
    zones: ['Magadi Road', 'Ongata Rongai', 'Rimpa'],
    description: 'Hostels along Magadi Road and Ongata Rongai, Nairobi.',
  },
  ku: {
    image: 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800',
    zones: ['Kahawa Sukari', 'Kahawa Wendani', 'KM'],
    description: 'Hostels around Main Campus and Kahawa Sukari, Nairobi.',
  },
  uon: {
    image: 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?q=80&w=800',
    zones: ['Main Campus', 'Chiromo', 'Parklands'],
    description: 'Housing near Main, Chiromo and Parklands campuses, Nairobi.',
  },
  mmust: {
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=800',
    zones: ['Kakamega Town', 'Lurambi', 'Kefinco'],
    description: 'Student accommodation across Kakamega, Kenya.',
  },
  kisii: {
    image: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?q=80&w=800',
    zones: ['Main Campus', 'Nyanchwa', 'Town Centre'],
    description: 'Verified student rooms near Main Campus, Kisii.',
  },
};

const SHORT_NAMES: Record<string, string> = {
  dekut: 'DeKUT',
  mmu: 'MMU',
  ku: 'KU',
  uon: 'UoN',
  mmust: 'MMUST',
  kisii: 'Kisii',
};

interface AnnouncementStyle {
  icon: ComponentType<{ size?: number; color?: string }>;
  accent: string;
  chipBg: string;
  chipFg: string;
}

/** Mirrors the STYLES map in web PublicAnnouncements (warning/encouragement/info). */
const ANNOUNCEMENT_STYLES: Record<string, AnnouncementStyle> = {
  warning: {
    icon: AlertTriangle,
    accent: palette.amber[400],
    chipBg: palette.amber[100],
    chipFg: palette.amber[700],
  },
  encouragement: {
    icon: Sparkles,
    accent: palette.emerald[400],
    chipBg: palette.emerald[100],
    chipFg: palette.emerald[700],
  },
  info: {
    icon: Info,
    accent: palette.sky[400],
    chipBg: palette.sky[100],
    chipFg: palette.sky[700],
  },
};

function shortName(campus?: Campus): string {
  if (!campus?.slug && !campus?.name) return 'DeKUT';
  if (campus.slug) return SHORT_NAMES[campus.slug] ?? campus.name.split(' ')[0] ?? campus.name;
  return campus.name.split(' ')[0] ?? campus.name;
}

/** Web PopularHostels card — compare toggle wired to the compare store. */
function HomePopularCard({
  listing,
  index,
  onPress,
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
      agentName: listing.agent?.name,
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
  const selectedCampusId = useCampusStore((s) => s.selectedCampusId);
  const selectedCampusName = useCampusStore((s) => s.selectedCampusName);
  const selectedCampusSlug = useCampusStore((s) => s.selectedCampusSlug);
  const setSelectedCampus = useCampusStore((s) => s.setSelectedCampus);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const hydrateCompare = useCompareStore((s) => s.hydrateFromStorage);
  const [notifiedCampuses, setNotifiedCampuses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void hydrateCompare();
  }, [hydrateCompare]);

  const { data: notifications } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch('/notifications'),
    enabled: isAuthenticated,
  });

  const { data: campuses } = useQuery<Campus[]>({
    queryKey: ['campuses'],
    queryFn: fetchCampuses,
  });

  React.useEffect(() => {
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
          limit: 10,
        },
      }),
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ['announcements', selectedCampusId],
    queryFn: () => apiFetch('/announcements', { params: { campus_id: selectedCampusId } }),
    enabled: Boolean(selectedCampusId),
  });

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;
  const selectedCampus = campuses?.find((c) => c.slug === selectedCampusSlug);

  const heroImage = CAMPUS_PREVIEWS[selectedCampusSlug ?? 'dekut']?.image ?? DEFAULT_CAMPUS_IMAGE;

  const handleCampusPress = (campus: Campus) => {
    if (campus.status === 'active') {
      setSelectedCampus({ id: campus.id, name: campus.name, slug: campus.slug });
      router.push('/explore');
    } else {
      setNotifiedCampuses((prev) => ({ ...prev, [campus.slug]: true }));
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.brand} onPress={() => router.push('/')}>
          <View style={styles.brandLogo}>
            <Image source={require('../../assets/images/icon.png')} style={styles.brandImage} />
          </View>
          <Text style={styles.brandText}>RUMIA</Text>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/profile')}>
            <MapPin size={20} color={palette.slate[700]} />
          </Pressable>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/notifications')}>
            <Bell size={20} color={palette.slate[700]} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{Math.min(unreadCount, 9)}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/explore')}>
            <Search size={20} color={palette.slate[700]} />
          </Pressable>
        </View>
      </View>

      {/* Hero — web page.tsx hero: image bg + slate-950/70 overlay + top-right emerald glow */}
      <View style={styles.hero}>
        <Image source={{ uri: heroImage }} style={styles.heroImage} contentFit="cover" transition={200} />
        <View style={styles.heroOverlay} />
        <View style={styles.heroGlowTop} />
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Find Verified Hostels Near Your Campus</Text>
          <Text style={styles.heroSubtitle}>
            {selectedCampus?.hero_subtext ??
              `Browse verified student rooms near the ${selectedCampusName || 'Dedan Kimathi University of Technology'} campus. Contact agents directly on WhatsApp with zero booking fees.`}
          </Text>
        </View>
      </View>

      {/* Announcements — web PublicAnnouncements (white card, left accent, icon chip) */}
      {announcements && announcements.length > 0 ? (
        <View style={styles.announcementSection}>
          {announcements.map((item) => {
            const style = ANNOUNCEMENT_STYLES[item.type] ?? ANNOUNCEMENT_STYLES.info;
            const Icon = style.icon;
            return (
              <View key={item.id} style={[styles.announcementCard, { borderLeftColor: style.accent }]}>
                <View style={[styles.announcementIcon, { backgroundColor: style.chipBg }]}>
                  <Icon size={16} color={style.chipFg} />
                </View>
                <View style={styles.announcementBody}>
                  <Text style={styles.announcementTitle}>{item.title}</Text>
                  <Text style={styles.announcementMessage} numberOfLines={4}>
                    {item.message}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* University Campus Picker Cards — web CampusPickerCards (centered header, stacked cards) */}
      <View style={styles.campusSection}>
        <View style={styles.sectionHead}>
          <View style={styles.eyebrowPill}>
            <Text style={styles.eyebrowPillText}>University Locations</Text>
          </View>
          <Text style={styles.sectionHeading}>Find Hostels Near Your University</Text>
          <Text style={styles.sectionSub}>
            Select your campus to browse verified student rooms, pricing, and direct agent WhatsApp contacts.
          </Text>
        </View>

        <View style={styles.cardStack}>
          {(campuses ?? []).map((campus) => {
            const isActive = campus.status === 'active';
            const preview = CAMPUS_PREVIEWS[campus.slug] ?? {
              image: DEFAULT_CAMPUS_IMAGE,
              zones: [campus.city],
              description: campus.hero_subtext || `Student hostels near ${campus.name}.`,
            };
            const isNotified = notifiedCampuses[campus.slug];
            const name = shortName(campus);

            return (
              <Pressable
                key={campus.id}
                accessibilityRole="link"
                style={({ pressed }) => [styles.campusCard, pressed && styles.pressed]}
                onPress={() => handleCampusPress(campus)}
              >
                <View style={styles.campusCardImage}>
                  <Image source={{ uri: preview.image }} contentFit="cover" transition={180} style={styles.campusImage} />
                  <View style={styles.campusImageOverlay} />
                  <View style={styles.campusImageBottomOverlay} />
                  <View style={styles.campusStatus}>
                    {isActive ? (
                      <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>Live</Text>
                      </View>
                    ) : (
                      <View style={styles.soonBadge}>
                        <Text style={styles.soonText}>Coming Soon</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cityBadge}>
                    <MapPin size={12} color={palette.slate[400]} />
                    <Text style={styles.cityText}>{campus.city}</Text>
                  </View>
                  <Text style={styles.campusNameOverlay}>{name}</Text>
                </View>

                <View style={styles.campusCardBody}>
                  <Text style={styles.campusFullName}>{campus.name}</Text>
                  <View style={styles.zoneChips}>
                    {preview.zones.slice(0, 3).map((zone) => (
                      <View key={zone} style={styles.zoneChip}>
                        <Text style={styles.zoneChipText}>{zone}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.campusDescription} numberOfLines={2}>
                    {preview.description}
                  </Text>
                </View>

                <View style={styles.campusCardFooter}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!isActive && isNotified}
                    style={({ pressed }) => [
                      styles.campusAction,
                      !isActive && isNotified && styles.campusActionDone,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleCampusPress(campus)}
                  >
                    {isActive ? (
                      <Text style={styles.campusActionText}>Browse {name} hostels</Text>
                    ) : (
                      <Text style={styles.campusActionText}>
                        {isNotified ? 'Registered' : 'Notify me when live'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Popular Hostels — web PopularHostels (Top 10, stacked cards, mobile View All button) */}
      <View style={styles.section}>
        <View style={styles.popularHead}>
          <View style={styles.trendingPill}>
            <TrendingUp size={12} color={palette.amber[700]} />
            <Text style={styles.trendingText}>Trending</Text>
          </View>
          <Text style={[styles.sectionHeading, styles.popularHeading]}>Rumia&apos;s Top 10</Text>
          <Text style={[styles.sectionSub, styles.popularSub]}>
            The most visited hostels by {shortName(selectedCampus)} students of all time.
          </Text>
        </View>

        {loadingHostels ? (
          <View style={styles.cardStack}>
            <Skeleton style={styles.skeletonCard} />
            <Skeleton style={styles.skeletonCard} />
          </View>
        ) : (
          <View style={styles.cardStack}>
            {(popularListings?.items ?? []).map((item, index) => (
              <HomePopularCard
                key={item.id}
                listing={item}
                index={index}
                onPress={() => router.push(`/listing/${item.slug || item.id}`)}
              />
            ))}
          </View>
        )}

        <Pressable
          accessibilityRole="link"
          style={({ pressed }) => [styles.viewAllButton, pressed && styles.pressed]}
          onPress={() => router.push('/explore')}
        >
          <Text style={styles.viewAllButtonText}>View All Listings</Text>
          <ArrowRight size={16} color={palette.white} />
        </Pressable>
      </View>

      {/* Find Me a Hostel — web find-me-a-hostel home variant (white band) */}
      <View style={styles.findBand}>
        <View style={styles.findEyebrow}>
          <Compass size={13} color={palette.emerald[700]} />
          <Text style={styles.findEyebrowText}>Hostel Finding Service</Text>
        </View>
        <Text style={styles.findBandTitle}>Let Rumia Find For You a Home</Text>

        <Pressable
          style={({ pressed }) => [styles.findCard, pressed && styles.pressed]}
          onPress={() => router.push('/find-me-a-hostel')}
        >
          <View style={styles.findIcon}>
            <KeyRound size={22} color={palette.emerald[700]} />
          </View>
          <View style={styles.findBody}>
            <Text style={styles.findText}>
              Tell us your budget and area. Rumia finds the hostel for you and a manager contacts you on WhatsApp.
            </Text>
          </View>
          <View style={styles.findArrow}>
            <ArrowRight size={16} color={palette.white} />
          </View>
        </Pressable>
      </View>

      {/* Early access banner — shown while the catalogue is small (web EarlyAccessBanner) */}
      {typeof popularListings?.total === 'number' && popularListings.total < 20 && (
        <View style={styles.earlyAccessSection}>
          <View style={styles.earlyAccessCard}>
            <View style={styles.earlyAccessIcon}>
              <Lightbulb size={18} color={palette.emerald[600]} />
            </View>
            <View style={styles.earlyAccessBody}>
              <Text style={styles.earlyAccessTitle}>More hostels will be added. Got a suggestion?</Text>
              <Text style={styles.earlyAccessSub}>
                We&apos;re growing, tell us what you&apos;d like to see next.
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.earlyAccessCta, pressed && styles.pressed]}
              onPress={() => router.push(isAuthenticated ? '/profile' : '/login')}
            >
              <Text style={styles.earlyAccessCtaText}>Give Feedback</Text>
              <ArrowRight size={14} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.slate[50] },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
  },
  brandImage: { width: '100%', height: '100%' },
  brandText: { fontSize: 18, fontWeight: '900', color: palette.slate[900], letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 4,
  },
  notifBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  // Hero
  hero: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 64,
    backgroundColor: palette.slate[950],
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,23,0.7)' },
  heroGlowTop: {
    position: 'absolute',
    top: -140,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(16,185,129,0.3)',
  },
  heroContent: { alignItems: 'center', zIndex: 1 },
  heroTitle: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.6,
    maxWidth: 340,
  },
  heroSubtitle: {
    color: palette.slate[300],
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 14,
    maxWidth: 340,
  },
  // Announcements
  announcementSection: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderLeftWidth: 4,
    padding: 16,
    ...shadows.card,
  },
  announcementIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  announcementBody: { flex: 1, minWidth: 0 },
  announcementTitle: { color: palette.slate[900], fontSize: 14, fontWeight: '700' },
  announcementMessage: { color: palette.slate[600], fontSize: 14, lineHeight: 21, marginTop: 4 },
  // Sections
  campusSection: { backgroundColor: palette.slate[50], paddingHorizontal: 16, paddingVertical: 40 },
  sectionHead: { alignItems: 'center', marginBottom: 24 },
  eyebrowPill: {
    alignSelf: 'center',
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[100],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginBottom: 12,
  },
  eyebrowPillText: {
    color: palette.emerald[700],
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionHeading: {
    color: palette.slate[900],
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  sectionSub: {
    color: palette.slate[500],
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
    maxWidth: 300,
  },
  popularHeading: { textAlign: 'left' },
  popularSub: { textAlign: 'left', maxWidth: '100%' },
  popularHead: { marginBottom: 20 },
  trendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.amber[50],
    borderWidth: 1,
    borderColor: palette.amber[200],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  trendingText: { color: palette.amber[700], fontSize: 11, fontWeight: '800' },
  // Campus cards
  cardStack: { gap: 24 },
  campusCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    ...shadows.card,
  },
  campusCardImage: { height: 176, position: 'relative' },
  campusImage: { width: '100%', height: '100%' },
campusImageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2,6,23,0.3)',
  },
  campusImageBottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    backgroundColor: 'rgba(2,6,23,0.42)',
  },
  campusStatus: { position: 'absolute', top: 12, left: 12 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.emerald[600],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff' },
  liveText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  soonBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  soonText: { color: palette.slate[600], fontSize: 11, fontWeight: '600' },
  cityBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  cityText: { color: palette.slate[700], fontSize: 11, fontWeight: '500' },
  campusNameOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  campusCardBody: { padding: 20 },
  campusFullName: {
    color: palette.emerald[600],
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  zoneChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  zoneChip: {
    backgroundColor: palette.slate[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  zoneChipText: { color: palette.slate[600], fontSize: 12, fontWeight: '600' },
  campusDescription: { color: palette.slate[600], fontSize: 12, lineHeight: 18 },
  campusCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    padding: 12,
    marginHorizontal: -20,
    marginBottom: -20,
    marginTop: 16,
  },
  campusAction: {
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: palette.slate[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  campusActionDone: { backgroundColor: 'rgba(15,23,42,0.4)' },
  campusActionText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  // Popular
  section: { paddingHorizontal: 16, paddingTop: 40, paddingBottom: 8 },
  popularCardWide: { width: '100%' },
  skeletonCard: { width: '100%', height: 340, borderRadius: 16 },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 24,
    backgroundColor: palette.emerald[600],
    borderRadius: radii.xl,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  viewAllButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  // Find Me a Hostel
  findBand: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(226,232,240,0.6)',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  findEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginBottom: 14,
  },
  findEyebrowText: { color: palette.emerald[700], fontSize: 12, fontWeight: '700' },
  findBandTitle: {
    color: palette.slate[900],
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 34,
    maxWidth: 340,
    marginBottom: 20,
  },
  findCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.emerald[200],
    borderRadius: radii['2xl'],
    padding: 14,
  },
  findIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.emerald[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  findBody: { flex: 1 },
  findText: { color: palette.slate[500], fontSize: 13, lineHeight: 19 },
  findArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.slate[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Early access
  earlyAccessSection: { paddingHorizontal: 16, paddingTop: 40, paddingBottom: 8 },
  earlyAccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[200],
    borderRadius: radii['2xl'],
    padding: 14,
  },
  earlyAccessIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: palette.emerald[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  earlyAccessBody: { flex: 1 },
  earlyAccessTitle: { color: palette.slate[800], fontSize: 13, fontWeight: '700' },
  earlyAccessSub: { color: palette.slate[500], fontSize: 11, lineHeight: 16, marginTop: 2 },
  earlyAccessCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.emerald[600],
    borderRadius: radii.xl,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  earlyAccessCtaText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});