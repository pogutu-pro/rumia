import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  Share,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Share2,
  MapPin,
  BedDouble,
  Bath,
  Wifi,
  Zap,
  Flame,
  Fuel,
  ShieldCheck,
  CheckCircle2,
  LayoutGrid,
  CalendarCheck,
  MessageCircle,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react-native';
import { apiFetch } from '../../lib/api/client';
import type { Listing } from '../../lib/api/schema';
import { useSessionStore } from '../../stores/session';
import { palette, radii } from '../../lib/theme';
import { BookTourModal } from '../../features/tours/book-tour-modal';
import { ContactModal } from '../../features/listings/contact-modal';
import { ReviewsSection } from '../../features/reviews/reviews-section';

const DISTANCE_BADGE: Record<string, string> = {
  'walking-500m': 'Walking distance',
  '5-10min': '5–10 min walk',
  '1-2km': '1–2 km',
  '3km': '3 km away',
  'over-3km': 'Over 3 km',
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=1200';

function formatViews(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function deriveFurnishingLevel(items: string[] | null | undefined): string {
  if (!items || items.length === 0) return '';
  if (items.length <= 3) return 'Semi-furnished';
  return 'Furnished';
}

export default function ListingDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const [tourModalVisible, setTourModalVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const { data: listing, isLoading } = useQuery<Listing>({
    queryKey: ['listing', slug],
    queryFn: () => apiFetch(`/listings/${slug}`),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!listing) return;
      if (listing.is_saved) {
        return apiFetch(`/profiles/me/wishlist/${listing.id}`, { method: 'DELETE' });
      }
      return apiFetch(`/profiles/me/wishlist/${listing.id}`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing', slug] });
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });

  const handleSave = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
    } else {
      saveMutation.mutate();
    }
  };

  const handleShare = async () => {
    if (!listing) return;
    try {
      await Share.share({
        message: `${listing.title} — ${listing.room_type || 'Student hostel'} from KES ${listing.price.toLocaleString()}/month${listing.distance_to_campus ? ` · ${listing.distance_to_campus} from campus` : ''}`,
      });
    } catch {
      // dismissed
    }
  };

  const images = useMemo(() => {
    if (!listing) return [];
    const list = [...listing.images].sort((a, b) => a.display_order - b.display_order);
    return list.map((img) => img.r2_url).filter(Boolean);
  }, [listing]);

  const galleryList = useRef<FlatList<string>>(null);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.emerald[600]} />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Listing not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const roomTypes = listing.room_types ?? [];
  const availableRooms = roomTypes.filter((rt) => rt.is_available !== false);

  const bestVariant = (() => {
    if (availableRooms.length === 0) return null;
    const shared = availableRooms.filter(
      (rt) =>
        Number(rt.occupancy) > 1 ||
        rt.category === 'shared' ||
        rt.room_type?.toLowerCase().includes('sharing') ||
        rt.room_type?.toLowerCase().includes('shared'),
    );
    const pool = shared.length > 0 ? shared : availableRooms;
    return pool.reduce((best, rt) => (best == null || rt.price < best.price ? rt : best), null as typeof pool[number] | null);
  })();

  const startingPrice =
    bestVariant?.price ?? listing.price_sharing ?? listing.price_single ?? listing.price ?? 0;
  const isFull = Boolean(
    listing.is_full || (roomTypes.length > 0 && availableRooms.length === 0),
  );

  const distanceBadge = DISTANCE_BADGE[listing.distance_category ?? ''] ?? null;

  const facts: { icon: typeof BedDouble; label: string; value: string }[] = [];
  if (listing.room_type) facts.push({ icon: BedDouble, label: 'Room Type', value: listing.room_type });
  if (listing.bathroom_type) facts.push({ icon: Bath, label: 'Bathroom', value: listing.bathroom_type });
  facts.push({ icon: Wifi, label: 'Internet', value: listing.wifi_included ? 'Available' : 'Not Included' });
  facts.push({ icon: Zap, label: 'Electricity', value: listing.electricity_included ? 'Included' : 'Tokens' });
  if (listing.hot_water_included) facts.push({ icon: Flame, label: 'Hot Water', value: 'Available' });
  if (listing.cooking_gas_included) facts.push({ icon: Fuel, label: 'Cooking Gas', value: 'Included' });
  if (listing.distance_to_campus) facts.push({ icon: MapPin, label: 'Distance', value: listing.distance_to_campus });
  if (listing.security_type) facts.push({ icon: ShieldCheck, label: 'Security', value: listing.security_type });

  const includedUtilities: string[] = [];
  if (listing.water_included) includedUtilities.push('Water included');
  if (listing.electricity_included) includedUtilities.push('Electricity included');
  if (listing.wifi_included) includedUtilities.push('WiFi included');
  if (listing.hot_water_included) includedUtilities.push('Hot water included');
  if (listing.cooking_gas_included) includedUtilities.push('Cooking gas included');
  if (listing.security_type) includedUtilities.push(`Security: ${listing.security_type}`);

  const amenities = (listing.amenities ?? []).slice(0, 8);
  const hasMoreAmenities = (listing.amenities ?? []).length > 8;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Gallery Hero */}
        <View style={styles.hero}>
          <Image
            source={{ uri: images[0] || FALLBACK_IMAGE }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
          />
          {images.length > 1 && (
            <>
              <View style={styles.photoCount}>
                <Text style={styles.photoCountText}>1 / {images.length}</Text>
              </View>
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() => {
                  setGalleryIndex(0);
                  setGalleryOpen(true);
                }}
              >
                <LayoutGrid size={14} color={palette.slate[700]} />
                <Text style={styles.seeAllText}>See all photos</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Overlay Header */}
        <View
          style={[
            styles.overlayHeader,
            { top: insets.top + 8 },
          ]}
        >
          <TouchableOpacity
            style={styles.roundIcon}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <ArrowLeft size={20} color={palette.slate[700]} />
          </TouchableOpacity>
          <View style={styles.overlayRight}>
            <View style={styles.viewsPill}>
              <Eye size={14} color={palette.slate[500]} />
              <Text style={styles.viewsText}>{formatViews(listing.views)} views</Text>
            </View>
            <TouchableOpacity
              style={[styles.roundIcon, listing.is_saved && styles.roundIconActive]}
              onPress={handleSave}
              hitSlop={8}
            >
              <Heart
                size={18}
                color={listing.is_saved ? '#ffffff' : palette.slate[700]}
                fill={listing.is_saved ? '#e11d48' : 'transparent'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundIcon} onPress={handleShare} hitSlop={8}>
              <Share2 size={18} color={palette.slate[700]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>{listing.title}</Text>

          <View style={styles.submetaRow}>
            {listing.area && <Text style={styles.submeta}>Area: {listing.area}</Text>}
            {listing.specific_location && (
              <>
                <Text style={styles.submetaDot}>·</Text>
                <Text style={styles.submeta}>{listing.specific_location}</Text>
              </>
            )}
            {distanceBadge && (
              <>
                <Text style={styles.submetaDot}>·</Text>
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceBadgeText}>{distanceBadge}</Text>
                </View>
              </>
            )}
          </View>

          {listing.gender && listing.gender !== 'mixed' && (
            <View
              style={[
                styles.genderBadge,
                { backgroundColor: listing.gender === 'female' ? '#db2777' : '#2563eb' },
              ]}
            >
              <Text style={styles.genderBadgeText}>
                {listing.gender === 'female' ? 'Ladies Only' : 'Gents Only'}
              </Text>
            </View>
          )}

          <View style={styles.locationRow}>
            <MapPin size={16} color={palette.slate[400]} />
            <Text style={styles.locationText}>{listing.location}</Text>
          </View>

          <Text style={styles.summaryLine}>
            Room type:{' '}
            <Text style={styles.summaryStrong}>
              {bestVariant?.room_type || listing.room_type || 'Self Contained'}
            </Text>
            {' · '}Price from:{' '}
            <Text style={styles.summaryStrong}>KES {startingPrice.toLocaleString()}/month</Text>
            {listing.distance_to_campus && (
              <>
                {' · '}
                <Text>{listing.distance_to_campus} from campus</Text>
              </>
            )}
          </Text>

          <View style={styles.divider} />

          {facts.length > 0 && (
            <View style={styles.quickFacts}>
              {facts.map((fact) => {
                const Icon = fact.icon;
                return (
                  <View key={fact.label} style={styles.fact}>
                    <Icon size={22} color={palette.slate[800]} strokeWidth={1.5} />
                    <Text style={styles.factValue}>{fact.value}</Text>
                    <Text style={styles.factLabel}>{fact.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this hostel</Text>
            <Text style={styles.description}>{listing.description}</Text>
          </View>

          <View style={styles.divider} />

          {amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenityGrid}>
                {amenities.map((item) => (
                  <View key={item} style={styles.amenityRow}>
                    <CheckCircle2 size={16} color={palette.slate[700]} />
                    <Text style={styles.amenityText}>{item}</Text>
                  </View>
                ))}
              </View>
              {hasMoreAmenities && (
                <Text style={styles.moreAmenities}>
                  +{(listing.amenities ?? []).length - 8} more amenities available
                </Text>
              )}
            </View>
          )}

          {includedUtilities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What&apos;s included</Text>
              <View style={styles.utilityList}>
                {includedUtilities.map((item) => (
                  <View key={item} style={styles.utilityRow}>
                    <CheckCircle2 size={18} color={palette.emerald[600]} />
                    <Text style={styles.utilityText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {roomTypes.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Room Types & Pricing</Text>
                <View style={styles.roomGrid}>
                  {roomTypes.map((room) => {
                    const hasDeposit = room.deposit != null && room.deposit > 0;
                    const totalToMoveIn = hasDeposit ? room.price + room.deposit! : null;
                    const hasFurnishing = (room.furnishing_items ?? []).length > 0;
                    const isStartingFrom =
                      startingPrice !== null && room.price === startingPrice && room.is_available;
                    return (
                      <View
                        key={room.id}
                        style={[styles.roomCard, isStartingFrom && styles.roomCardHighlight]}
                      >
                        <View style={styles.roomHeader}>
                          <View style={styles.roomTitleRow}>
                            <BedDouble size={18} color={palette.emerald[600]} />
                            <Text style={styles.roomTitle} numberOfLines={1}>
                              {room.room_type}
                            </Text>
                          </View>
                          {isStartingFrom && (
                            <View style={styles.startingPill}>
                              <Text style={styles.startingPillText}>Starting from</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.roomBody}>
                          <View style={styles.roomPriceRow}>
                            <Text style={styles.roomPrice}>KES {room.price.toLocaleString()}</Text>
                            <Text style={styles.roomPriceSuffix}>/mo</Text>
                          </View>

                          {hasDeposit && (
                            <View style={styles.depositBlock}>
                              <View style={styles.depositRow}>
                                <View style={styles.depositLabelRow}>
                                  <Wallet size={14} color={palette.slate[400]} />
                                  <Text style={styles.depositLabel}>Deposit</Text>
                                </View>
                                <Text style={styles.depositValue}>
                                  KES {room.deposit!.toLocaleString()}
                                </Text>
                              </View>
                              <View style={styles.moveInBox}>
                                <Text style={styles.moveInLabel}>Total to move in</Text>
                                <Text style={styles.moveInValue}>KES {totalToMoveIn!.toLocaleString()}</Text>
                              </View>
                            </View>
                          )}

                          {hasFurnishing && (
                            <View style={styles.furnishingBlock}>
                              <View style={styles.furnishingLabelRow}>
                                <Sparkles size={14} color={palette.amber[500]} />
                                <Text style={styles.furnishingLabel}>
                                  {deriveFurnishingLevel(room.furnishing_items ?? [])}
                                </Text>
                              </View>
                              <View style={styles.furnishingChips}>
                                {(room.furnishing_items ?? []).map((item) => (
                                  <View key={item} style={styles.furnishingChip}>
                                    <Text style={styles.furnishingChipText}>{item}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {listing.agent && (
            <View style={styles.agentCard}>
              <Text style={styles.agentLabel}>Your Agent</Text>
              <View style={styles.agentRow}>
                <View style={styles.agentAvatar}>
                  <Text style={styles.agentAvatarText}>
                    {listing.agent.name.substring(0, 2)}
                  </Text>
                </View>
                <View style={styles.agentInfo}>
                  <Text style={styles.agentName} numberOfLines={1}>
                    {listing.agent.name}
                  </Text>
                  <View style={styles.agentVerifiedRow}>
                    <ShieldCheck size={12} color={palette.emerald[600]} />
                    <Text style={styles.agentVerified}>Verified Agent</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <RecentReviews listing={listing} />

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      {/* Sticky Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.tourButton}
          onPress={() => setTourModalVisible(true)}
          disabled={isFull}
        >
          <CalendarCheck size={18} color="#ffffff" />
          <Text style={styles.tourButtonText}>{isFull ? 'Currently Full' : 'Book a Tour'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => setContactModalVisible(true)}
        >
          <MessageCircle size={18} color="#ffffff" />
          <Text style={styles.contactButtonText}>Contact</Text>
        </TouchableOpacity>
      </View>

      <BookTourModal
        visible={tourModalVisible}
        listing={listing}
        onClose={() => setTourModalVisible(false)}
      />

      <ContactModal
        visible={contactModalVisible}
        listing={listing}
        onClose={() => setContactModalVisible(false)}
      />

      {/* Gallery Fullscreen */}
      <Modal visible={galleryOpen} animationType="fade" onRequestClose={() => setGalleryOpen(false)}>
        <View style={styles.galleryWrap}>
          <View style={styles.galleryHeader}>
            <View>
              <Text style={styles.galleryTitle}>Photo Gallery</Text>
              <Text style={styles.galleryCount}>
                {galleryIndex + 1} of {images.length || 1}
              </Text>
            </View>
            <TouchableOpacity style={styles.galleryClose} onPress={() => setGalleryOpen(false)}>
              <X size={20} color={palette.slate[700]} />
            </TouchableOpacity>
          </View>

          {images.length > 0 ? (
            <FlatList
              ref={galleryList}
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => `${item}-${index}`}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / width);
                setGalleryIndex(index);
              }}
              renderItem={({ item }) => (
                <View style={{ width }}>
                  <Image
                    source={{ uri: item }}
                    style={styles.galleryImage}
                    contentFit="contain"
                  />
                </View>
              )}
            />
          ) : (
            <Image source={{ uri: FALLBACK_IMAGE }} style={styles.galleryImage} contentFit="contain" />
          )}

          {images.length > 1 && (
            <View style={styles.galleryNav}>
              <TouchableOpacity
                style={styles.galleryNavButton}
                disabled={galleryIndex === 0}
                onPress={() => {
                  const next = Math.max(0, galleryIndex - 1);
                  setGalleryIndex(next);
                  galleryList.current?.scrollToOffset({ offset: next * width, animated: true });
                }}
              >
                <ChevronLeft size={22} color={galleryIndex === 0 ? palette.slate[300] : palette.slate[700]} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.galleryNavButton}
                disabled={galleryIndex >= images.length - 1}
                onPress={() => {
                  const next = Math.min(images.length - 1, galleryIndex + 1);
                  setGalleryIndex(next);
                  galleryList.current?.scrollToOffset({ offset: next * width, animated: true });
                }}
              >
                <ChevronRight
                  size={22}
                  color={galleryIndex >= images.length - 1 ? palette.slate[300] : palette.slate[700]}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function RecentReviews({ listing }: { listing: Listing }) {
  return <ReviewsSection listingId={listing.id} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  errorText: { color: palette.slate[700], fontSize: 16, marginBottom: 16 },
  buttonText: { color: palette.emerald[600], fontWeight: '700' },
  backButton: { backgroundColor: palette.slate[100], paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  scrollContent: { paddingBottom: 0 },
  hero: { backgroundColor: palette.slate[100], aspectRatio: 4 / 3, width: '100%' },
  heroImage: { width: '100%', height: '100%' },
  photoCount: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  photoCountText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  seeAllButton: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 4,
  },
  seeAllText: { color: palette.slate[900], fontSize: 12, fontWeight: '800' },
  overlayHeader: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overlayRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  roundIconActive: { backgroundColor: palette.red[500], borderColor: palette.red[500] },
  viewsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 10,
    height: 42,
    borderRadius: 21,
  },
  viewsText: { color: palette.slate[500], fontSize: 12, fontWeight: '800' },
  content: { padding: 18 },
  title: { color: palette.slate[950], fontSize: 24, fontWeight: '800', letterSpacing: -0.4, lineHeight: 30 },
  submetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 6 },
  submeta: { color: palette.slate[600], fontSize: 13, fontWeight: '600' },
  submetaDot: { color: palette.slate[300], fontSize: 13, fontWeight: '700' },
  distanceBadge: {
    backgroundColor: palette.slate[200],
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  distanceBadgeText: { color: palette.slate[700], fontSize: 11, fontWeight: '800' },
  genderBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    marginTop: 10,
  },
  genderBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  locationText: { color: palette.slate[500], fontSize: 14, fontWeight: '700' },
  summaryLine: { color: palette.slate[600], fontSize: 13, fontWeight: '600', marginTop: 10, lineHeight: 19 },
  summaryStrong: { color: palette.slate[900], fontWeight: '800' },
  divider: { height: 1, backgroundColor: palette.slate[100], marginVertical: 20 },
  quickFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, rowGap: 20 },
  fact: { width: '27%', gap: 3 },
  factValue: { color: palette.slate[900], fontSize: 13, fontWeight: '700', marginTop: 4 },
  factLabel: { color: palette.slate[500], fontSize: 11, fontWeight: '500' },
  section: { gap: 12 },
  sectionTitle: { color: palette.slate[950], fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  description: { color: palette.slate[600], fontSize: 14, lineHeight: 22 },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  amenityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '47%' },
  amenityText: { color: palette.slate[800], fontSize: 13, fontWeight: '600' },
  moreAmenities: { color: palette.slate[600], fontSize: 13, fontWeight: '800', textDecorationLine: 'underline', marginTop: 2 },
  utilityList: { gap: 12 },
  utilityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  utilityText: { color: palette.slate[700], fontSize: 14, fontWeight: '700' },
  roomGrid: { gap: 12 },
  roomCard: {
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  roomCardHighlight: {
    borderColor: palette.emerald[400],
    shadowColor: '#059669',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  roomHeader: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  roomTitle: { color: palette.slate[900], fontSize: 15, fontWeight: '800', flexShrink: 1 },
  startingPill: {
    backgroundColor: palette.emerald[600],
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  startingPillText: { color: '#ffffff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  roomBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  roomPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  roomPrice: { color: palette.slate[900], fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  roomPriceSuffix: { color: palette.slate[400], fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  depositBlock: { gap: 8 },
  depositRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  depositLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  depositLabel: { color: palette.slate[500], fontSize: 13, fontWeight: '600' },
  depositValue: { color: palette.slate[700], fontSize: 13, fontWeight: '800' },
  moveInBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  moveInLabel: { color: palette.emerald[700], fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  moveInValue: { color: palette.emerald[900], fontSize: 16, fontWeight: '900' },
  furnishingBlock: { borderTopWidth: 1, borderTopColor: palette.slate[100], paddingTop: 10, gap: 8 },
  furnishingLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  furnishingLabel: { color: palette.slate[700], fontSize: 12, fontWeight: '800' },
  furnishingChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  furnishingChip: {
    backgroundColor: palette.slate[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  furnishingChipText: { color: palette.slate[600], fontSize: 11, fontWeight: '600' },
  agentCard: {
    borderWidth: 1,
    borderColor: palette.slate[100],
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    padding: 18,
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  agentLabel: { color: palette.slate[400], fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  agentAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentAvatarText: { color: palette.emerald[700], fontSize: 16, fontWeight: '800' },
  agentInfo: { flex: 1 },
  agentName: { color: palette.slate[900], fontSize: 14, fontWeight: '800' },
  agentVerifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  agentVerified: { color: palette.emerald[600], fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  bottomSpacer: { height: 110 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: palette.slate[100],
    paddingHorizontal: 14,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 10,
  },
  tourButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: palette.slate[900],
    borderRadius: 12,
    height: 48,
  },
  tourButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: palette.emerald[600],
    borderRadius: 12,
    height: 48,
  },
  contactButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  galleryWrap: { flex: 1, backgroundColor: '#ffffff' },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.slate[100],
  },
  galleryTitle: { color: palette.slate[900], fontSize: 17, fontWeight: '800' },
  galleryCount: { color: palette.slate[500], fontSize: 12, marginTop: 1 },
  galleryClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryImage: { width: '100%', height: '100%' },
  galleryNav: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 28,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  galleryNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
});