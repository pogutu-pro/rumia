import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck, ArrowRight } from 'lucide-react-native';
import { apiFetch } from '../../lib/api/client';
import type { ListingsPage, Listing } from '../../lib/api/schema';
import type { ListingMatchCandidate } from '../../lib/utils/dekut-verification';
import { HakisaChecker } from '../../features/verify/hakisa-checker';
import { SupportTeamSection, type AgentSupport } from '../../features/verify/support-team-section';
import { palette, radii } from '../../lib/theme';

function toCandidate(l: Listing): ListingMatchCandidate {
  return {
    id: l.id,
    title: l.title,
    county: l.county,
    area: l.area,
    slug: l.slug,
    landlord_phone: l.landlord_phone,
    agent_phone: l.agent?.phone ?? null,
    agent_whatsapp: l.agent?.whatsapp ?? null,
    agent_verified: null,
    verified: null,
    mpesa_details: null,
    specific_location: l.specific_location,
  };
}

export default function VerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: listings } = useQuery<ListingsPage>({
    queryKey: ['verify-listings'],
    queryFn: () => apiFetch('/listings', { params: { limit: 300 } }),
    staleTime: 1000 * 60 * 5,
  });

  const { data: agents } = useQuery<AgentSupport[]>({
    queryKey: ['verify-agents'],
    queryFn: () => apiFetch('/agents'),
    staleTime: 1000 * 60 * 5,
  });

  const candidates = useMemo<ListingMatchCandidate[]>(
    () => (listings?.items ?? []).map(toCandidate),
    [listings],
  );

  const owner = useMemo<AgentSupport | null>(
    () => (agents ?? []).find((a) => a.is_founder) ?? null,
    [agents],
  );

  const team = useMemo<AgentSupport[]>(
    () => (agents ?? []).filter((a) => a.is_support && !a.is_founder),
    [agents],
  );

  const supportWhatsapp = owner?.whatsapp || team[0]?.whatsapp || null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <ShieldCheck size={20} color={palette.emerald[700]} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Hakikisha</Text>
          <Text style={styles.headerSub}>Verify Before You Pay</Text>
        </View>
      </View>

      <SupportTeamSection
        agents={owner ? [owner] : []}
        variant="owner"
      />

      <View style={styles.checkerWrap}>
        <HakisaChecker rumiaListings={candidates} supportWhatsapp={supportWhatsapp} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.browseBtn, pressed && styles.pressed]}
        onPress={() => router.push('/explore')}
      >
        <Text style={styles.browseBtnText}>Browse verified hostels</Text>
        <ArrowRight size={16} color={palette.slate[700]} />
      </Pressable>

      <SupportTeamSection
        agents={team}
        variant="team"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F5F0' },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14 },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.emerald[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: palette.slate[900], letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: palette.slate[500], marginTop: 2 },
  checkerWrap: { marginTop: 4 },
  browseBtn: {
    marginTop: 16,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  browseBtnText: { color: palette.slate[700], fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});