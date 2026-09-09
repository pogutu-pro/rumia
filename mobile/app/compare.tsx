import React, { useEffect, useMemo, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Share,
  Image as RNImage,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  GitCompareArrows,
  Users,
  Search,
  Trash2,
  Share2,
  Star,
  Navigation,
  BedDouble,
  Droplets,
  Check,
  Wifi,
  Zap,
  ShieldCheck,
  CreditCard,
  Wallet,
  MessageCircle,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCompareStore, type CompareSelection } from '../stores/compare';
import { distanceBadgeText } from '../lib/format';
import { palette, radii } from '../lib/theme';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';

const DISTANCE_ORDER = ['walking-500m', '5-10min', '1-2km', '3km', 'over-3km'];

function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `254${digits.slice(1)}` : digits;
}

function hostelHref(h: CompareSelection) {
  return { pathname: '/listing/[slug]', params: { slug: h.slug ?? h.id } } as const;
}

async function openWhatsApp(phone: string) {
  try {
    const url = `https://wa.me/${cleanPhone(phone)}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Open WhatsApp', `Agent phone: ${phone}`);
    }
  } catch {
    Alert.alert('Open WhatsApp', `Agent phone: ${phone}`);
  }
}

function BestValueBadge({ label }: { label: string }) {
  return (
    <View style={styles.bestValueBadge}>
      <Star size={10} color={palette.amber[700]} />
      <Text style={styles.bestValueBadgeText}>{label}</Text>
    </View>
  );
}

function AmenityChips({ amenities }: { amenities: string[] | null | undefined }) {
  if (!amenities || amenities.length === 0) {
    return <Text style={styles.dash}>—</Text>;
  }
  return (
    <View style={styles.chipWrap}>
      {amenities.map((a) => (
        <View key={a} style={styles.amenityChip}>
          <Text style={styles.amenityChipText}>{a}</Text>
        </View>
      ))}
    </View>
  );
}

function FurnishingCell({ items }: { items: string[] | null | undefined }) {
  const list = Array.isArray(items) ? items : [];
  const level =
    list.length === 0 ? 'Empty' : list.length <= 3 ? 'Semi-furnished' : 'Furnished';
  const color =
    list.length === 0 ? palette.slate[400] : list.length <= 3 ? palette.amber[600] : palette.emerald[600];
  return (
    <View style={styles.chipWrap}>
      <Text style={[styles.furnishingLevel, { color }]}>{level}</Text>
      {list.length > 0 ? (
        <View style={styles.chipRow}>
          {list.slice(0, 4).map((item) => (
            <View key={item} style={styles.smallChip}>
              <Text style={styles.smallChipText}>{item}</Text>
            </View>
          ))}
          {list.length > 4 ? <Text style={styles.moreCount}>+{list.length - 4}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function BooleanCell({ value, label }: { value: boolean | null | undefined; label: string }) {
  if (value === null || value === undefined) {
    return <Text style={styles.dash}>—</Text>;
  }
  if (value) {
    return (
      <View style={styles.booleanRow}>
        <View style={styles.booleanTrueIcon}>
          <Check size={11} color={palette.emerald[600]} />
        </View>
        <Text style={styles.booleanTrueText}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={styles.booleanRow}>
      <View style={styles.booleanFalseIcon}>
        <X size={11} color={palette.slate[400]} />
      </View>
      <Text style={styles.booleanFalseText}>Not included</Text>
    </View>
  );
}

interface RowContext {
  hostels: CompareSelection[];
  lowestPrice: number;
  closestId: string;
}

interface Row {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  topAligned?: boolean;
  render: (h: CompareSelection, ctx: RowContext) => ReactNode;
}

function buildRows(ctx: RowContext): Row[] {
  const { hostels, lowestPrice, closestId } = ctx;
  const minDeposit = Math.min(...hostels.map((x) => (typeof x.deposit === 'number' ? x.deposit : Infinity)));
  const minTotal = Math.min(
    ...hostels.map((x) => {
      const p = x.price_single ?? x.price_sharing ?? x.price;
      const d = typeof x.deposit === 'number' ? x.deposit : 0;
      return p + d;
    }),
  );

  return [
    {
      key: 'price',
      label: 'Price',
      icon: Wallet,
      render: (h) => {
        const price = h.price_single ?? h.price_sharing ?? h.price;
        const isLowest = price === lowestPrice && hostels.length > 1;
        return (
          <View style={styles.cellStack}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceMain, isLowest && styles.bestText]}>
                KES {price.toLocaleString()}
              </Text>
              <Text style={styles.priceSuffix}>/mo</Text>
            </View>
            {h.price_single && h.price_sharing ? (
              <Text style={styles.priceSub}>
                KES {h.price_single.toLocaleString()} single · KES {h.price_sharing.toLocaleString()} sharing
              </Text>
            ) : null}
            {isLowest ? <BestValueBadge label="Best Price" /> : null}
          </View>
        );
      },
    },
    {
      key: 'distance',
      label: 'Distance',
      icon: Navigation,
      render: (h) => {
        const badge = distanceBadgeText(h.distanceCategory);
        const text = badge || h.distanceToCampus || '—';
        const isClosest = h.id === closestId && hostels.length > 1;
        return (
          <View style={styles.cellStack}>
            <Text style={[styles.cellValue, isClosest && styles.closestText]}>{text}</Text>
            {isClosest ? <BestValueBadge label="Closest" /> : null}
          </View>
        );
      },
    },
    {
      key: 'room_type',
      label: 'Room Type',
      icon: BedDouble,
      render: (h) => (
        <Text style={styles.cellValue}>
          {h.roomType || h.roomTypeEnum?.replace('_', ' ') || h.roomTypeLabel || '—'}
        </Text>
      ),
    },
    {
      key: 'bathroom',
      label: 'Bathroom',
      icon: Droplets,
      render: (h) => (
        <Text style={[styles.cellValue, h.bathroomType ? styles.capitalize : null]}>
          {h.bathroomType || '—'}
        </Text>
      ),
    },
    {
      key: 'amenities',
      label: 'Amenities',
      icon: Check,
      topAligned: true,
      render: (h) => <AmenityChips amenities={h.amenities} />,
    },
    {
      key: 'wifi',
      label: 'WiFi',
      icon: Wifi,
      render: (h) => <BooleanCell value={h.wifiIncluded} label="Included" />,
    },
    {
      key: 'water',
      label: 'Water',
      icon: Droplets,
      render: (h) => <BooleanCell value={h.waterIncluded} label="Included" />,
    },
    {
      key: 'electricity',
      label: 'Electricity',
      icon: Zap,
      render: (h) => <BooleanCell value={h.electricityIncluded} label="Included" />,
    },
    {
      key: 'security',
      label: 'Security',
      icon: ShieldCheck,
      render: (h) =>
        h.securityType ? (
          <Text style={[styles.cellValue, styles.capitalize]}>{h.securityType}</Text>
        ) : (
          <Text style={styles.dash}>—</Text>
        ),
    },
    {
      key: 'deposit',
      label: 'Deposit',
      icon: CreditCard,
      render: (h) => {
        const num = typeof h.deposit === 'number' ? h.deposit : null;
        const isLowest = num !== null && num === minDeposit && hostels.length > 1;
        return (
          <View style={styles.cellStack}>
            <Text style={[styles.cellValue, isLowest && styles.closestText]}>
              {num !== null ? `KES ${num.toLocaleString()}` : '—'}
            </Text>
            {isLowest ? <BestValueBadge label="Lowest" /> : null}
          </View>
        );
      },
    },
    {
      key: 'total_move_in',
      label: 'Total to Move In',
      icon: Wallet,
      render: (h) => {
        const price = h.price_single ?? h.price_sharing ?? h.price;
        const deposit = typeof h.deposit === 'number' ? h.deposit : 0;
        const total = price + deposit;
        const isLowest = total === minTotal && hostels.length > 1;
        return (
          <View style={styles.cellStack}>
            <Text style={[styles.priceMain, isLowest && styles.bestText]}>
              KES {total.toLocaleString()}
            </Text>
            <Text style={styles.priceSub}>rent + deposit</Text>
            {isLowest ? <BestValueBadge label="Best Value" /> : null}
          </View>
        );
      },
    },
    {
      key: 'furnishing',
      label: 'Furnishing',
      icon: BedDouble,
      topAligned: true,
      render: (h) => <FurnishingCell items={h.furnishingItems} />,
    },
    {
      key: 'gender',
      label: 'Gender',
      icon: Users,
      render: (h) =>
        h.gender ? (
          <View style={styles.booleanRow}>
            <View
              style={[
                styles.genderDot,
                h.gender === 'female'
                  ? { backgroundColor: palette.rose[400] }
                  : h.gender === 'male'
                    ? { backgroundColor: '#60a5fa' }
                    : { backgroundColor: palette.slate[400] },
              ]}
            />
            <Text style={styles.cellValue}>
              {h.gender === 'female' ? 'Ladies Only' : h.gender === 'male' ? 'Gents Only' : 'Mixed'}
            </Text>
          </View>
        ) : (
          <Text style={styles.dash}>—</Text>
        ),
    },
    {
      key: 'agent',
      label: 'Agent',
      icon: MessageCircle,
      render: (h) => {
        const phone = h.agentWhatsapp || h.agentPhone || '';
        return (
          <View style={styles.cellStack}>
            <Text style={styles.agentName} numberOfLines={1}>
              {h.agentName || 'Rumia Agent'}
            </Text>
            {phone ? (
              <Pressable style={styles.whatsappButton} onPress={() => void openWhatsApp(phone)}>
                <MessageCircle size={11} color="#ffffff" fill="#ffffff" />
                <Text style={styles.whatsappButtonText}>WhatsApp</Text>
              </Pressable>
            ) : null}
          </View>
        );
      },
    },
  ];
}

function EmptyCompareState({ count }: { count: number }) {
  const router = useRouter();
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        {count === 0 ? (
          <GitCompareArrows size={38} color={palette.emerald[500]} />
        ) : (
          <Users size={38} color={palette.emerald[500]} />
        )}
      </View>
      <Text style={styles.emptyTitle}>
        {count === 0 ? 'No hostels selected' : 'Select at least 2 hostels'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {count === 0
          ? 'Browse hostels and tap Compare to add them here. The compare feature lets you weigh up to 2 hostels side by side.'
          : 'Add one more hostel from the search results to start comparing prices, amenities, and locations.'}
      </Text>
      <Pressable style={styles.emptyPrimary} onPress={() => router.push('/explore')}>
        <Search size={16} color="#ffffff" />
        <Text style={styles.emptyPrimaryText}>Browse Hostels</Text>
      </Pressable>
      {count === 1 ? (
        <Pressable style={styles.emptySecondary} onPress={() => router.push('/explore')}>
          <ArrowLeft size={15} color={palette.slate[600]} />
          <Text style={styles.emptySecondaryText}>Back to Results</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function WaitForHydration({ children }: { children: ReactNode }) {
  const hydrated = useCompareStore((s) => s.hydrated);
  const hydrate = useCompareStore((s) => s.hydrateFromStorage);
  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);
  if (!hydrated) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.loadingSkeleton} />
        <View style={styles.loadingSkeleton} />
        <View style={styles.loadingSkeleton} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function ComparePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const selectedIds = useCompareStore((s) => s.selectedIds);
  const selections = useCompareStore((s) => s.selections);
  const removeSelection = useCompareStore((s) => s.removeSelection);
  const clearSelection = useCompareStore((s) => s.clearSelection);

  const hostels = useMemo(
    () => selectedIds.map((id) => selections[id]).filter(Boolean) as CompareSelection[],
    [selectedIds, selections],
  );

  const lowestPrice = useMemo(
    () => Math.min(...hostels.map((h) => h.price_single ?? h.price_sharing ?? h.price)),
    [hostels],
  );

  const closestId = useMemo(() => {
    let best = { idx: Infinity, id: '' };
    hostels.forEach((h) => {
      const idx = DISTANCE_ORDER.indexOf(h.distanceCategory || '');
      if (idx !== -1 && idx < best.idx) best = { idx, id: h.id };
    });
    return best.id;
  }, [hostels]);

  const rows = useMemo(() => buildRows({ hostels, lowestPrice, closestId }), [hostels, lowestPrice, closestId]);

  const contentWidth = width - 32;
  const attrWidth = 96;
  const colWidth = Math.min(160, Math.floor((contentWidth - attrWidth) / Math.max(hostels.length, 1)));

  const handleClear = () => {
    clearSelection();
    router.back();
  };

  const handleShare = () => {
    const message = hostels
      .map((h, i) => `${i + 1}. ${h.title} — KES ${(h.price_single ?? h.price_sharing ?? h.price).toLocaleString()}/mo`)
      .join('\n');
    void Share.share({
      message: `Compare these hostels on Rumia:\n${message}`,
    }).catch(() => {});
  };

  if (hostels.length < 2) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={16} color={palette.slate[600]} />
            </Pressable>
            <View>
              <Text style={styles.title}>Compare Hostels</Text>
              <Text style={styles.subtitle}>{hostels.length} of 2 hostels selected</Text>
            </View>
          </View>
        </View>
        <WaitForHydration>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <EmptyCompareState count={hostels.length} />
          </ScrollView>
        </WaitForHydration>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <WaitForHydration>
        <View style={styles.page}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
                <ArrowLeft size={16} color={palette.slate[600]} />
              </Pressable>
              <View>
                <Text style={styles.title}>Compare Hostels</Text>
                <Text style={styles.subtitle}>{hostels.length} of 2 hostels selected</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                style={styles.headerAction}
                onPress={handleShare}
                hitSlop={8}
                accessibilityLabel="Share comparison"
              >
                <Share2 size={14} color={palette.slate[600]} />
              </Pressable>
              <Pressable
                style={styles.headerAction}
                onPress={handleClear}
                hitSlop={8}
                accessibilityLabel="Clear all"
              >
                <Trash2 size={14} color={palette.slate[600]} />
              </Pressable>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.tableContent} showsVerticalScrollIndicator={false}>
            {/* Hostel header row */}
            <View style={[styles.tableRow, styles.hostelRow]}>
              <View style={[styles.attrHeaderCell, { width: attrWidth }]}>
                <Text style={styles.cornerText}>Compare</Text>
              </View>
              {hostels.map((h) => (
                <View key={h.id} style={[styles.hostelCell, { width: colWidth }]}>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeSelection(h.id)}
                    hitSlop={6}
                    accessibilityLabel={`Remove ${h.title}`}
                  >
                    <Trash2 size={12} color={palette.slate[400]} />
                  </Pressable>
                  <Pressable style={styles.hostelLink} onPress={() => router.push(hostelHref(h))}>
                    <RNImage source={{ uri: h.imageUrl || FALLBACK_IMAGE }} style={styles.thumbnail} />
                    <Text style={[styles.hostelName, { maxWidth: colWidth - 20 }]} numberOfLines={2}>
                      {h.title}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Attribute rows */}
            {rows.map((row, rowIdx) => {
              const alt = rowIdx % 2 === 1;
              return (
                <View key={row.key} style={[styles.tableRow, alt && styles.rowAlt]}>
                  <View
                    style={[
                      styles.attrCell,
                      { width: attrWidth },
                      row.topAligned && styles.attrCellTop,
                    ]}
                  >
                    <row.icon size={14} color={palette.slate[400]} />
                    <Text style={styles.attrText}>{row.label}</Text>
                  </View>
                  {hostels.map((h, colIdx) => (
                    <View
                      key={h.id}
                      style={[
                        styles.valueCell,
                        { width: colWidth },
                        row.topAligned && styles.valueCellTop,
                        colIdx === hostels.length - 1 && styles.valueCellLast,
                      ]}
                    >
                      {row.render(h, { hostels, lowestPrice, closestId })}
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </WaitForHydration>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(248,250,252,0.5)' },
  page: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 40 },
  tableContent: { paddingHorizontal: 16, paddingBottom: 40 },
  loadingWrap: { gap: 12, padding: 16, marginTop: 8 },
  loadingSkeleton: { height: 120, borderRadius: radii['2xl'], backgroundColor: palette.slate[100] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: palette.slate[900], fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { color: palette.slate[400], fontSize: 13, fontWeight: '500', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tableRow: { flexDirection: 'row', alignItems: 'stretch' },
  hostelRow: { borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], overflow: 'hidden' },
  rowAlt: { backgroundColor: 'rgba(248,250,252,0.55)' },
  attrHeaderCell: {
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(226,232,240,0.6)',
  },
  cornerText: {
    color: palette.slate[400],
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  hostelCell: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(226,232,240,0.6)',
    alignItems: 'center',
    paddingTop: 4,
    position: 'relative',
  },
  hostelLink: { alignItems: 'center', width: '100%' },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: radii.xl,
    backgroundColor: palette.slate[100],
    marginTop: 10,
  },
  hostelName: {
    color: palette.slate[900],
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 14,
  },
  attrCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(226,232,240,0.6)',
    backgroundColor: '#ffffff',
  },
  attrCellTop: { alignItems: 'flex-start', justifyContent: 'flex-start' },
  attrText: {
    color: palette.slate[500],
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueCell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(241,245,249,0.8)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  valueCellTop: { alignItems: 'flex-start', justifyContent: 'flex-start' },
  valueCellLast: { borderRightWidth: 0 },

  cellStack: { alignItems: 'center', width: '100%' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceMain: { color: palette.slate[900], fontSize: 15, fontWeight: '900', letterSpacing: -0.3 },
  bestText: { color: palette.emerald[700] },
  priceSuffix: { color: palette.slate[400], fontSize: 11, fontWeight: '600' },
  priceSub: { color: palette.slate[400], fontSize: 10, fontWeight: '500', marginTop: 3, textAlign: 'center' },
  cellValue: { color: palette.slate[700], fontSize: 13, fontWeight: '600', textAlign: 'center' },
  closestText: { color: palette.emerald[700] },
  capitalize: { textTransform: 'capitalize' },
  dash: { color: palette.slate[400], fontSize: 13, fontWeight: '500' },

  bestValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.amber[50],
    borderWidth: 1,
    borderColor: palette.amber[200],
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  bestValueBadgeText: { color: palette.amber[700], fontSize: 10, fontWeight: '800' },

  chipWrap: { gap: 4, width: '100%' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  amenityChip: {
    backgroundColor: palette.slate[100],
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii.full,
    paddingHorizontal: 9,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  amenityChipText: { color: palette.slate[600], fontSize: 10, fontWeight: '600' },
  smallChip: {
    backgroundColor: 'rgba(226,232,240,0.4)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  smallChipText: { color: palette.slate[600], fontSize: 9, fontWeight: '500' },
  furnishingLevel: { fontSize: 12, fontWeight: '800' },
  moreCount: { color: palette.slate[400], fontSize: 9, fontWeight: '600', alignSelf: 'center' },

  booleanRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  booleanTrueIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  booleanFalseIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.slate[100],
    borderWidth: 1,
    borderColor: palette.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  booleanTrueText: { color: palette.slate[700], fontSize: 12, fontWeight: '600' },
  booleanFalseText: { color: palette.slate[400], fontSize: 12, fontWeight: '500' },

  genderDot: { width: 8, height: 8, borderRadius: 4 },

  agentName: { color: palette.slate[500], fontSize: 11, fontWeight: '600', maxWidth: 120 },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#25d366',
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  whatsappButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },

  emptyWrap: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 12 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: palette.slate[900],
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: palette.slate[500],
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 320,
  },
  emptyPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: radii.xl,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 24,
  },
  emptyPrimaryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  emptySecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
    borderRadius: radii.xl,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 10,
  },
  emptySecondaryText: { color: palette.slate[600], fontSize: 13, fontWeight: '600' },
});