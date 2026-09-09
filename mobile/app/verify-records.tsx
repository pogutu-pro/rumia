import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search } from 'lucide-react-native';
import officialRecordsData from '../lib/data/dekut-official-records.json';
import { parseOfficialRecord, buildOfficialPhoneIndex, type OfficialDeKutRecord } from '../lib/utils/dekut-verification';
import { palette, radii } from '../lib/theme';

const RECORDS: OfficialDeKutRecord[] = (officialRecordsData as {
  hostel_name: string;
  zone?: string;
  contacts?: string | null;
  payments?: string | null;
}[]).map((record) => parseOfficialRecord(record));

function maskContact(contact: string): string {
  return contact.length > 3 ? `${contact.slice(0, 3)}XXXXXXXX` : contact;
}

export default function OfficialRecordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const phoneIndex = useMemo(() => buildOfficialPhoneIndex(RECORDS), []);
  const zones = useMemo(
    () => Array.from(new Set((officialRecordsData as { zone?: string }[]).map((r) => (r.zone || '').toUpperCase()).filter(Boolean))).sort(),
    [],
  );
  const sharedContacts = useMemo(
    () => Array.from(phoneIndex.entries()).filter(([, hostels]) => hostels.length > 1).length,
    [phoneIndex],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return RECORDS;
    return RECORDS.filter(
      (r) =>
        r.hostel_name.toLowerCase().includes(q) ||
        (r.zone || '').toLowerCase().includes(q) ||
        r.payments.some((p) => p.toLowerCase().includes(q)) ||
        r.contacts.some((c) => c.includes(q)),
    );
  }, [query]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 40 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <ArrowLeft size={18} color={palette.slate[500]} />
        <Text style={styles.backText}>Back to Verifier</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Official DeKUT Hostel Records</Text>
        <Text style={styles.subtitle}>
          Every hostel below is sourced from the DeKUT official student housing list. Cross-check the number you were given before sending any deposit.
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{RECORDS.length}</Text>
          <Text style={styles.statLabel}>Hostels listed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{zones.length}</Text>
          <Text style={styles.statLabel}>Zones</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{sharedContacts}</Text>
          <Text style={styles.statLabel}>Shared contacts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>14 Jul</Text>
          <Text style={styles.statLabel}>Last updated</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Search size={16} color={palette.slate[400]} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search hostel, zone or payment details"
          placeholderTextColor={palette.slate[400]}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.recordsList}>
        {filtered.map((record) => (
          <View key={record.hostel_name} style={styles.recordCard}>
            <View style={styles.recordTop}>
              <Text style={styles.recordName}>{record.hostel_name}</Text>
              {record.zone ? (
                <View style={styles.zoneBadge}>
                  <Text style={styles.zoneText}>{record.zone}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.recordContact}>
              {record.contacts.slice(0, 3).map(maskContact).join(' · ') || 'No contact'}
            </Text>
            {record.payments.length > 0 && (
              <Text style={styles.recordPayment} numberOfLines={2}>
                {record.payments.join('; ')}
              </Text>
            )}
          </View>
        ))}
        {filtered.length === 0 && (
          <Text style={styles.emptyText}>No records match &quot;{query}&quot;.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F5F0' },
  content: { paddingHorizontal: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  backText: { fontSize: 13, fontWeight: '600', color: palette.slate[500] },
  header: { marginTop: 16 },
  title: { fontSize: 22, fontWeight: '800', color: palette.slate[900], letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: palette.slate[500], lineHeight: 20, marginTop: 6 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  statCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#1B1B181A',
    borderRadius: radii['2xl'],
    padding: 14,
    flexGrow: 1,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: palette.slate[900] },
  statLabel: { fontSize: 11, fontWeight: '500', color: palette.slate[500], marginTop: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: palette.slate[900] },
  recordsList: { marginTop: 16, gap: 10 },
  recordCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#1B1B181A',
    borderRadius: radii['2xl'],
    padding: 14,
  },
  recordTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordName: { flex: 1, fontSize: 14, fontWeight: '700', color: palette.slate[900] },
  zoneBadge: {
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[200],
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  zoneText: { fontSize: 9, fontWeight: '700', color: palette.emerald[700], letterSpacing: 0.5 },
  recordContact: {
    fontSize: 12,
    color: palette.slate[700],
    fontWeight: '600',
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  recordPayment: { fontSize: 11, color: palette.slate[500], marginTop: 4, lineHeight: 16 },
  emptyText: { color: palette.slate[500], fontSize: 13, textAlign: 'center', marginTop: 24 },
});