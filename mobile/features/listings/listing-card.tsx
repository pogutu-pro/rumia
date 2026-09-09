import type { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Eye, Heart, Check, GitCompareArrows } from 'lucide-react-native';
import type { Listing } from '../../lib/api/schema';
import { distanceBadgeText } from '../../lib/format';
import { palette, radii } from '../../lib/theme';

type ListingCardVariant = 'search' | 'popular';

interface ListingCardProps {
  listing: Listing;
  variant?: ListingCardVariant;
  onPress: () => void;
  /** Extra element rendered in the popular-card footer (e.g. unsave button). */
  rightAction?: ReactNode;
  /** Rank badge shown on popular cards (web: index + 1 circle). */
  rank?: number;
  /** Whether the listing is a selected comparison (web: compare-store). */
  compareSelected?: boolean;
  /** Toggles the compare selection (web: compare store toggle on the card). */
  onCompare?: () => void;
  style?: StyleProp<ViewStyle>;
  imageWidth?: number;
}

function imageSource(listing: Listing) {
  const firstImage = listing.images[0]?.r2_url;
  return firstImage ? { uri: firstImage } : require('../../assets/images/logo-glow.png');
}

function priceDisplay(listing: Listing): string {
  const { price_single, price_sharing, price } = listing;
  if (price_single && price_sharing) {
    return `KES ${price_single.toLocaleString()} for 1 person · KES ${price_sharing.toLocaleString()} sharing`;
  }
  if (price_single) {
    return `KES ${price_single.toLocaleString()}/mo for 1 person`;
  }
  if (price_sharing) {
    return `KES ${price_sharing.toLocaleString()}/mo sharing`;
  }
  return `KES ${price.toLocaleString()}/mo`;
}

const FALLBACK_ASPECT = 4 / 3;

export function ListingCard({
  listing,
  variant = 'search',
  onPress,
  rightAction,
  rank,
  compareSelected,
  onCompare,
  style,
  imageWidth,
}: ListingCardProps) {
  if (variant === 'popular') {
    return (
      <PopularCardImage listing={listing} onPress={onPress} rank={rank} rightAction={rightAction} style={style} imageWidth={imageWidth} />
    );
  }
  return <SearchCard listing={listing} onPress={onPress} rightAction={rightAction} compareSelected={compareSelected} onCompare={onCompare} style={style} imageWidth={imageWidth} />;
}

/** Web search-result card (hostels-search.tsx). */
function SearchCard({
  listing,
  onPress,
  rightAction,
  compareSelected = false,
  onCompare,
  style,
  imageWidth,
}: Omit<ListingCardProps, 'variant' | 'rank'>) {
  const location = listing.specific_location
    ? `${listing.area || 'Hostel Area'} · ${listing.specific_location}`
    : listing.location;
  const showGender = listing.gender != null && listing.gender !== 'mixed';
  const showPricePill = !listing.area && !showGender;
  const distanceBadge = distanceBadgeText(listing.distance_category);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.searchCard, pressed && styles.pressed, style]}
    >
      <ListingImage
        listing={listing}
        imageWidth={imageWidth}
        overlay={
          <>
            {distanceBadge ? (
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceBadgeText}>{distanceBadge}</Text>
              </View>
            ) : null}
            {showGender && listing.gender ? (
              <View style={[styles.genderBadge, listing.gender === 'female' ? styles.femaleBadge : styles.maleBadge]}>
                <Text style={styles.genderBadgeText}>
                  {listing.gender === 'female' ? 'Ladies Only' : 'Gents Only'}
                </Text>
              </View>
            ) : null}
            {showPricePill ? (
              <View style={styles.pricePill}>
                <Text style={styles.pricePillText}>{`KES ${listing.price.toLocaleString()}`}</Text>
              </View>
            ) : null}
          </>
        }
      />

      <View style={styles.body}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {listing.title}
        </Text>

        <View style={styles.locationRow}>
          <MapPin size={12} color="#94a3b8" />
          <Text style={styles.locationText} numberOfLines={1}>
            {location}
          </Text>
        </View>

        <Text style={styles.cardDescription} numberOfLines={2}>
          {listing.description}
        </Text>

        <View style={styles.divider}>
          <Text style={styles.price}>{priceDisplay(listing)}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerMeta} numberOfLines={1}>
            Agent: {listing.agent?.name ?? 'Rumia Agent'}
          </Text>
          {rightAction ? <View style={styles.footerAction}>{rightAction}</View> : null}
          {onCompare ? (
            <View style={styles.footerActions}>
              <Pressable
                onPress={onCompare}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.compareButton,
                  compareSelected && styles.compareButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                {compareSelected ? (
                  <Check size={14} color="#ffffff" strokeWidth={3} />
                ) : (
                  <GitCompareArrows size={14} color={palette.slate[900]} />
                )}
                <Text
                  style={[
                    styles.compareButtonText,
                    compareSelected && styles.compareButtonTextSelected,
                  ]}
                >
                  {compareSelected ? 'Added' : 'Compare'}
                </Text>
              </Pressable>
              <View style={styles.viewDetails}>
                <Eye size={14} color={palette.emerald[600]} />
                <Text style={styles.viewDetailsText}>View Details</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Web popular card (popular-hostels.tsx) — rank, views, emerald price pill. */
function PopularCardImage({
  listing,
  onPress,
  rank,
  rightAction,
  style,
  imageWidth,
  compareSelected = false,
  onCompare,
}: ListingCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.popularCard, pressed && styles.pressed, style]}
    >
      <ListingImage
        listing={listing}
        imageWidth={imageWidth}
        overlay={
          <>
            {rank != null && (
              <View style={styles.rankCircle}>
                <Text style={styles.rankText}>{rank}</Text>
              </View>
            )}
            <View style={styles.viewsPill}>
              <Eye size={12} color="#64748b" />
              <Text style={styles.viewsText}>{(listing.views ?? 0).toLocaleString()}</Text>
            </View>
            <View style={styles.emeraldPricePill}>
              <Text style={styles.emeraldPriceText}>{`KES ${listing.price.toLocaleString()}/mo`}</Text>
            </View>
          </>
        }
      />

      <View style={styles.body}>
        <View style={styles.popularLocationRow}>
          <MapPin size={12} color="#94a3b8" />
          <Text style={styles.popularLocationText} numberOfLines={1}>
            {listing.location}
          </Text>
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {listing.title}
        </Text>

        <Text style={styles.popularDescription} numberOfLines={2}>
          {listing.description}
        </Text>

        <View style={styles.popularFooter}>
          <Text style={styles.footerMeta}>Agent: {listing.agent?.name ?? 'Rumia Agent'}</Text>
          {rightAction || onCompare ? (
            <View style={styles.footerAction}>
              {rightAction}
              {onCompare ? (
                <Pressable
                  onPress={onCompare}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.compareButton,
                    compareSelected && styles.compareButtonSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  {compareSelected ? (
                    <Check size={14} color="#ffffff" strokeWidth={3} />
                  ) : (
                    <GitCompareArrows size={14} color={palette.slate[900]} />
                  )}
                  <Text
                    style={[
                      styles.compareButtonText,
                      compareSelected && styles.compareButtonTextSelected,
                    ]}
                  >
                    {compareSelected ? 'Added' : 'Compare'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function ListingImage({
  listing,
  imageWidth,
  overlay,
}: {
  listing: Listing;
  imageWidth?: number;
  overlay: ReactNode;
}) {
  const width = imageWidth ?? '100%';
  return (
    <View style={[styles.imageWrap, { width }]}>
      <Image
        source={imageSource(listing)}
        style={styles.image}
        contentFit="cover"
        transition={180}
      />
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  popularCard: {
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    width: 268,
  },
  pressed: { opacity: 0.92 },
  imageWrap: { aspectRatio: FALLBACK_ASPECT, backgroundColor: '#f1f5f9', position: 'relative' },
  image: { width: '100%', height: '100%' },
  body: { padding: 16, flex: 1 },
  cardTitle: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 6 },
  locationText: { color: '#64748b', fontSize: 12, fontWeight: '600', flex: 1 },
  cardDescription: { color: '#64748b', fontSize: 12, lineHeight: 17, marginBottom: 12 },
  divider: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8, marginBottom: 8 },
  price: { color: '#059669', fontSize: 14, fontWeight: '700' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerMeta: { color: '#94a3b8', fontSize: 12, fontWeight: '500', flex: 1 },
  footerAction: { flexDirection: 'row', alignItems: 'center' },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#0f172a',
    backgroundColor: '#ffffff',
  },
  compareButtonSelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  compareButtonText: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
  compareButtonTextSelected: { color: '#ffffff' },
  viewDetails: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewDetailsText: { color: '#059669', fontSize: 12, fontWeight: '600' },
  // Image overlays
  distanceBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  distanceBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  genderBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  femaleBadge: { backgroundColor: 'rgba(219,39,119,0.9)' },
  maleBadge: { backgroundColor: 'rgba(37,99,235,0.9)' },
  genderBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  pricePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(241,245,249,0.6)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  pricePillText: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
  // Popular overlays
  rankCircle: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(2,6,23,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  rankText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  viewsPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewsText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  emeraldPricePill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(5,150,105,0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  emeraldPriceText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  popularLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    marginTop: 2,
  },
  popularLocationText: { color: '#94a3b8', fontSize: 11, fontWeight: '600', flex: 1 },
  popularDescription: { color: '#64748b', fontSize: 13, lineHeight: 18, marginTop: 6, marginBottom: 8, flex: 1 },
  popularFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

// Re-export so SaveButton usages can reference the same heart colour scheme.
export { Heart };
export type { ReactNode };