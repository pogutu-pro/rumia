import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  GraduationCap,
  CalendarCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchCampuses } from '../lib/api/campuses';
import { fetchZones } from '../features/campus/queries';
import { ZoneTourModal, type ZoneTourSelection } from '../features/tours/zone-tour-modal';
import { palette, radii } from '../lib/theme';

export default function BookTourPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { data: campuses, isLoading: campusesLoading } = useQuery({
    queryKey: ['campuses'],
    queryFn: fetchCampuses,
  });

  const activeCampuses = useMemo(() => (campuses ?? []).filter((c) => c.status === 'active'), [campuses]);

  const { data: zoneSections, isLoading: zonesLoading } = useQuery({
    queryKey: ['tour-zones', activeCampuses.map((c) => c.id).join(',')],
    queryFn: async () => {
      const sections = await Promise.all(
        activeCampuses.map(async (campus) => {
          const zones = await fetchZones(campus.id, campus.slug);
          return {
            campusId: campus.id,
            campusName: campus.name,
            zones: zones.filter((z) => z.full_search_price > 0),
          };
        }),
      );
      return sections.filter((s) => s.zones.length > 0);
    },
    enabled: activeCampuses.length > 0,
  });

  const [selected, setSelected] = useState<ZoneTourSelection | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const loading = campusesLoading || zonesLoading;
  const zoneCount = zoneSections?.reduce((sum, s) => sum + s.zones.length, 0) ?? 0;
  const twoColGap = 12;
  const zoneCardWidth = (width - 32 - 48 - twoColGap) / 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.head}>
          <Pressable
            style={styles.backLink}
            onPress={() => router.push('/explore')}
            hitSlop={8}
          >
            <ArrowLeft size={16} color={palette.slate[500]} />
            <Text style={styles.backLinkText}>Back to hostels</Text>
          </Pressable>
          <Text style={styles.title}>Book a Hostel Tour</Text>
          <Text style={styles.subtitle}>
            Pick your university, then the area you want to tour and a verified agent will walk you
            through the options.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select your campus and area</Text>

          {loading ? (
            <View style={styles.loadingGrid}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.zoneSkeleton, { width: zoneCardWidth }]} />
              ))}
            </View>
          ) : zoneCount === 0 ? (
            <View style={styles.noZones}>
              <Text style={styles.noZonesTitle}>No tour zones set up yet</Text>
              <Text style={styles.noZonesText}>
                Tour pricing is configured by campus managers. Check back soon.
              </Text>
            </View>
          ) : (
            <View style={styles.sections}>
              {(zoneSections ?? []).map((section) => (
                <View key={section.campusId}>
                  <View style={styles.sectionHead}>
                    <GraduationCap size={16} color={palette.slate[400]} />
                    <Text style={styles.sectionTitle}>{section.campusName}</Text>
                  </View>
                  <View style={styles.zoneGrid}>
                    {section.zones.map((zone) => {
                      const isSelected =
                        selected?.campusId === section.campusId &&
                        selected?.zoneName === zone.name;
                      return (
                        <Pressable
                          key={zone.id}
                          style={[
                            styles.zoneCard,
                            { width: zoneCardWidth },
                            isSelected && styles.zoneCardSelected,
                          ]}
                          onPress={() =>
                            setSelected({
                              campusId: section.campusId,
                              campusName: section.campusName,
                              zoneName: zone.name,
                              zonePrice: zone.full_search_price,
                            })
                          }
                        >
                          <Text
                            style={[styles.zoneName, isSelected && styles.zoneNameSelected]}
                            numberOfLines={1}
                          >
                            {zone.name}
                          </Text>
                          <View style={styles.zonePriceRow}>
                            <Banknote size={12} color={isSelected ? palette.emerald[700] : palette.slate[500]} />
                            <Text style={[styles.zonePrice, isSelected && styles.zonePriceSelected]}>
                              KSh {zone.full_search_price.toLocaleString()}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

          <Pressable
            style={[styles.continueButton, !selected && styles.continueDisabled]}
            onPress={() => selected && setFormOpen(true)}
            disabled={!selected}
          >
            <CalendarCheck size={16} color="#ffffff" />
            <Text style={styles.continueText}>Continue</Text>
          </Pressable>

          <Text style={styles.footerNote}>
            Pay the agent directly when you arrive. No online payment required.
          </Text>
        </View>
      </ScrollView>

      <ZoneTourModal visible={formOpen} selection={selected} onClose={() => setFormOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(248,250,252,0.5)' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  head: { marginBottom: 24, paddingHorizontal: 4 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 16, paddingVertical: 4 },
  backLinkText: { color: palette.slate[500], fontSize: 14, fontWeight: '600' },
  title: { color: palette.slate[900], fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: palette.slate[500], fontSize: 14, fontWeight: '500', lineHeight: 21, marginTop: 6 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: palette.slate[100],
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 14,
    elevation: 2,
    padding: 24,
  },
  cardTitle: { color: palette.slate[700], fontSize: 14, fontWeight: '700', marginBottom: 12 },
  loadingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  zoneSkeleton: {
    height: 80,
    borderRadius: radii.xl,
    backgroundColor: palette.slate[100],
  },
  noZones: {
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: palette.slate[200],
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  noZonesTitle: { color: palette.slate[700], fontSize: 14, fontWeight: '600' },
  noZonesText: { color: palette.slate[500], fontSize: 12, marginTop: 6, textAlign: 'center' },
  sections: { gap: 24, marginBottom: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: {
    color: palette.slate[500],
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  zoneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  zoneCard: {
    padding: 14,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
  },
  zoneCardSelected: { borderColor: palette.emerald[600], backgroundColor: palette.emerald[50] },
  zoneName: { color: palette.slate[900], fontSize: 14, fontWeight: '700' },
  zoneNameSelected: { color: palette.emerald[800] },
  zonePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  zonePrice: { color: palette.slate[500], fontSize: 12, fontWeight: '700' },
  zonePriceSelected: { color: palette.emerald[700] },
  continueButton: {
    marginTop: 20,
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: palette.slate[900],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  continueDisabled: { opacity: 0.4 },
  continueText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  footerNote: { color: palette.slate[600], fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 12 },
});