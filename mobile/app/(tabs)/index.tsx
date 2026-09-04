import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
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
  Megaphone,
  CheckCircle2,
  KeyRound,
} from 'lucide-react-native';
import { apiFetch } from '../../lib/api/client';
import type { Campus, Announcement, AppNotification, ListingsPage } from '../../lib/api/schema';
import { fetchCampuses, listingCampusParams } from '../../lib/api/campuses';
import { ListingCard } from '../../features/listings/listing-card';
import { useCampusStore } from '../../stores/campus';
import { useSessionStore } from '../../stores/session';
import { Skeleton } from '../../lib/components/ui';
import { palette, radii } from '../../lib/theme';

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

function shortName(campus?: Campus): string {
  if (!campus?.slug && !campus?.name) return 'DeKUT';
  if (campus.slug) return SHORT_NAMES[campus.slug] ?? campus.name.split(' ')[0] ?? campus.name;
  return campus.name.split(' ')[0] ?? campus.name;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selectedCampusId = useCampusStore((s) => s.selectedCampusId);
  const selectedCampusName = useCampusStore((s) => s.selectedCampusName);
  const selectedCampusSlug = useCampusStore((s) => s.selectedCampusSlug);
  const setSelectedCampus = useCampusStore((s) => s.setSelectedCampus);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const [notifiedCampuses, setNotifiedCampuses] = useState<Record<string, boolean>>({});

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
        params: { ...listingCampusParams(selectedCampusId, selectedCampusSlug), sort: 'views', limit: 6 },
      }),
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ['announcements', selectedCampusId],
    queryFn: () => apiFetch('/announcements', { params: { campus_id: selectedCampusId } }),
    enabled: Boolean(selectedCampusId),
  });

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;
  const selectedCampus = campuses?.find((c) => c.slug === selectedCampusSlug);

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

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroGlowTop} />
        <View style={styles.heroGlowBottom} />
        <View style={styles.heroContent}>
          <View style={styles.heroEyebrow}>
            <Text style={styles.heroEyebrowText}>KENYAN STUDENT HOUSING</Text>
          </View>
          <Text style={styles.heroTitle}>Find Verified Hostels Near Your Campus</Text>
          <Text style={styles.heroSubtitle}>
            {selectedCampus?.hero_subtext ??
              `Browse verified student rooms near the ${selectedCampusName || 'Dedan Kimathi University of Technology'} campus. Contact agents directly on WhatsApp with zero booking fees.`}
          </Text>

          <Pressable
            style={styles.heroSearch}
            onPress={() => router.push('/explore')}
          >
            <Search size={18} color={palette.slate[400]} />
            <TextInput
              style={styles.heroSearchInput}
              placeholder={`Try 'Boma' or 'Gate A' near ${shortName(selectedCampus)}`}
              placeholderTextColor={palette.slate[400]}
              editable={false}
            />
          </Pressable>
        </View>
      </View>

      {/* Find Me a Hostel */}
      <View style={styles.findSection}>
        <Pressable style={({ pressed }) => [styles.findCard, pressed && styles.pressed]} onPress={() => router.push('/find-me-a-hostel')}>
          <View style={styles.findIcon}>
            <KeyRound size={22} color={palette.emerald[700]} />
          </View>
          <View style={styles.findBody}>
            <Text style={styles.findTitle}>Find Me a Hostel</Text>
            <Text style={styles.findText}>
              Tell us your budget and area. Rumia finds the hostel for you and a manager contacts you on WhatsApp.
            </Text>
          </View>
          <View style={styles.findArrow}>
            <ArrowRight size={16} color={palette.white} />
          </View>
        </Pressable>
      </View>

      {/* Announcements */}
      {announcements && announcements.length > 0 ? (
        <View style={styles.announcementSection}>
          {announcements.slice(0, 2).map((item) => (
            <View key={item.id} style={styles.announcementCard}>
              <View style={styles.announcementIcon}>
                <Megaphone size={16} color={palette.emerald[600]} />
              </View>
              <View style={styles.announcementBody}>
                <View style={styles.announcementTag}>
                  <Text style={styles.announcementTagText}>ANNOUNCEMENT</Text>
                </View>
                <Text style={styles.announcementTitle}>{item.title}</Text>
                <Text style={styles.announcementMessage} numberOfLines={2}>
                  {item.message}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Campus picker */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.eyebrowPill}>
            <Text style={styles.eyebrowPillText}>University Locations</Text>
          </View>
          <Text style={styles.sectionHeading}>Find Hostels Near Your University</Text>
          <Text style={styles.sectionSub}>
            Select your campus to browse verified student rooms, pricing, and direct agent WhatsApp contacts.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={330}
          decelerationRate="fast"
          style={styles.horizontalRail}
        >
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
              <Pressable key={campus.id} style={styles.campusCard} onPress={() => handleCampusPress(campus)}>
                <View style={styles.campusCardImage}>
                  <Image source={{ uri: preview.image }} contentFit="cover" transition={180} style={styles.campusImage} />
                  <View style={styles.campusImageOverlay} />
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

                  <Pressable
                    style={[styles.campusAction, isNotified && styles.campusActionDone]}
                    onPress={() => handleCampusPress(campus)}
                  >
                    {isActive ? (
                      <Text style={styles.campusActionText}>Browse {name} hostels</Text>
                    ) : isNotified ? (
                      <>
                        <CheckCircle2 size={15} color="#ffffff" />
                        <Text style={styles.campusActionText}>Registered</Text>
                      </>
                    ) : (
                      <Text style={styles.campusActionText}>Notify me when live</Text>
                    )}
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Popular hostels */}
      <View style={styles.section}>
        <View style={styles.popularHead}>
          <Pressable style={styles.trendingPill} onPress={() => router.push('/explore')}>
            <TrendingUp size={12} color={palette.amber[700]} />
            <Text style={styles.trendingText}>Trending</Text>
          </Pressable>
          <Text style={styles.sectionHeading}>Rumia&apos;s Top 6</Text>
          <Text style={styles.sectionSub}>
            The most visited hostels by {shortName(selectedCampus)} students of all time.
          </Text>

          <Pressable style={styles.viewAll} onPress={() => router.push('/explore')}>
            <Text style={styles.viewAllText}>View all</Text>
            <ArrowRight size={14} color={palette.emerald[600]} />
          </Pressable>
        </View>

        {loadingHostels ? (
          <View style={styles.skeletonRail}>
            {[0, 1].map((i) => (
              <Skeleton key={i} style={styles.skeletonCard} />
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={280}
            decelerationRate="fast"
            style={styles.horizontalRail}
          >
            {(popularListings?.items ?? []).map((item, index) => (
              <ListingCard
                key={item.id}
                listing={item}
                variant="popular"
                rank={index + 1}
                onPress={() => router.push(`/listing/${item.slug || item.id}`)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
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
    backgroundColor: palette.slate[950],
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 34,
    paddingBottom: 44,
  },
  heroGlowTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(16,185,129,0.28)',
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: -140,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(16,185,129,0.16)',
  },
  heroContent: { alignItems: 'center' },
  heroEyebrow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
  },
  heroEyebrowText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 12,
    maxWidth: 340,
  },
  heroSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: radii.full,
    paddingLeft: 16,
    paddingRight: 8,
    height: 50,
    marginTop: 22,
    alignSelf: 'stretch',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 8,
  },
  heroSearchInput: { flex: 1, color: palette.slate[700], fontSize: 14, fontWeight: '600' },
  // Announcements
  // Find Me a Hostel
  findSection: { paddingHorizontal: 16, paddingTop: 20 },
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
  findTitle: { color: palette.slate[900], fontSize: 15, fontWeight: '700' },
  findText: { color: palette.slate[500], fontSize: 12, lineHeight: 18, marginTop: 2 },
  findArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.slate[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  // Announcements
  announcementSection: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  announcementCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: palette.slate[50],
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii['2xl'],
    padding: 14,
  },
  announcementIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: palette.emerald[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementBody: { flex: 1 },
  announcementTag: { alignSelf: 'flex-start', marginBottom: 4 },
  announcementTagText: {
    color: palette.emerald[700],
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    backgroundColor: palette.emerald[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  announcementTitle: { color: palette.slate[900], fontSize: 15, fontWeight: '700' },
  announcementMessage: { color: palette.slate[500], fontSize: 13, lineHeight: 19, marginTop: 2 },
  // Sections
  section: { paddingHorizontal: 16, paddingTop: 32 },
  sectionHead: { marginBottom: 16 },
  eyebrowPill: {
    alignSelf: 'flex-start',
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[100],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginBottom: 10,
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
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sectionSub: {
    color: palette.slate[500],
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    marginTop: 8,
  },
  // Campus cards
  horizontalRail: { marginHorizontal: -16, paddingHorizontal: 16 },
  campusCard: {
    width: 314,
    marginRight: 12,
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.slate[200],
  },
  campusCardImage: { height: 176, position: 'relative' },
  campusImage: { width: '100%', height: '100%' },
  campusImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  campusCardBody: { padding: 16 },
  campusFullName: {
    color: palette.emerald[600],
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  zoneChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  zoneChip: {
    backgroundColor: palette.slate[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  zoneChipText: { color: palette.slate[600], fontSize: 11, fontWeight: '600' },
  campusDescription: { color: palette.slate[500], fontSize: 12, lineHeight: 18 },
  campusAction: {
    marginTop: 14,
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: palette.slate[900],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  campusActionDone: { backgroundColor: 'rgba(2,6,23,0.35)' },
  campusActionText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  // Popular
  popularHead: { marginBottom: 16 },
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
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  viewAllText: { color: palette.emerald[600], fontSize: 14, fontWeight: '600' },
  skeletonRail: { flexDirection: 'row', gap: 12 },
  skeletonCard: { width: 268, height: 340, borderRadius: 16 },
});