import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Keyboard,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShieldCheck,
  CircleOff,
  AlertTriangle,
  Check,
  Phone,
  Building2,
  CreditCard,
  ArrowRight,
} from 'lucide-react-native';
import officialRecordsData from '../../lib/data/dekut-official-records.json';
import {
  extractVerificationSignals,
  parseOfficialRecord,
  buildOfficialPhoneIndex,
  type OfficialDeKutRecord,
  type ListingMatchCandidate,
} from '../../lib/utils/dekut-verification';
import { buildWhatsAppUrl } from '../../lib/utils/whatsapp';
import { palette, radii } from '../../lib/theme';

const OFFICIAL_RECORDS: OfficialDeKutRecord[] = (officialRecordsData as {
  hostel_name: string;
  zone?: string;
  contacts?: string | null;
  payments?: string | null;
}[]).map((record) => parseOfficialRecord(record));

const OFFICIAL_PHONE_INDEX = buildOfficialPhoneIndex(OFFICIAL_RECORDS);

interface HakisaCheckerProps {
  rumiaListings?: ListingMatchCandidate[];
  supportWhatsapp?: string | null;
}

type ResultState = 'verified' | 'mismatch' | 'not-found' | 'multiple';
type SearchMode = 'phone' | 'hostel' | 'paybill' | 'till';

interface VerifiedData {
  hostelName: string;
  officialContact: string;
  officialPayment: string;
  verifiedDate: string;
  onRumia: boolean;
  listingUrl?: string;
}

interface MultipleData {
  hostels: string[];
}

interface MismatchData {
  officialContact: string;
  providedContact: string;
}

const MODE_CONFIG: Record<
  SearchMode,
  { label: string; placeholder: string; keyboardType: 'phone-pad' | 'number-pad' | 'default' }
> = {
  phone: {
    label: 'Phone Number',
    placeholder: 'e.g. 0728XXXXXX',
    keyboardType: 'phone-pad',
  },
  hostel: {
    label: 'Hostel Name',
    placeholder: 'e.g. Urban Suites',
    keyboardType: 'default',
  },
  paybill: {
    label: 'Paybill Number',
    placeholder: 'e.g. 247247 or 522533',
    keyboardType: 'number-pad',
  },
  till: {
    label: 'Till Number',
    placeholder: 'e.g. 9383225',
    keyboardType: 'number-pad',
  },
};

const MODES: { key: SearchMode; label: string; icon: React.ReactNode }[] = [
  { key: 'phone', label: 'Phone', icon: <Phone size={14} color="currentColor" /> },
  { key: 'hostel', label: 'Hostel', icon: <Building2 size={14} color="currentColor" /> },
  { key: 'paybill', label: 'Paybill', icon: <CreditCard size={14} color="currentColor" /> },
  { key: 'till', label: 'Till Number', icon: <CreditCard size={14} color="currentColor" /> },
];

function formatPhone(val: string) {
  if (val.length <= 3) return val;
  return `${val.slice(0, 3)} ${val.slice(3)}`;
}

function useCheckOutcome(
  value: string,
  submitted: boolean,
  searchMode: SearchMode,
  rumiaListings: ListingMatchCandidate[],
) {
  return useMemo<{
    state: ResultState;
    verified?: VerifiedData;
    multiple?: MultipleData;
    mismatch?: MismatchData;
  } | null>(() => {
    if (!submitted || !value.trim()) return null;

    const signals = extractVerificationSignals(value.trim());
    const query = value.trim().toLowerCase();
    const cleanDigits = query.replace(/\D/g, '');
    const phoneSignal = signals.find((s) => s.kind === 'phone');
    const paymentSignal = signals.find((s) => s.kind === 'payment');

    if (phoneSignal) {
      const normalized = phoneSignal.value;
      const hostelsForPhone = OFFICIAL_PHONE_INDEX.get(normalized);

      if (hostelsForPhone && hostelsForPhone.length > 1) {
        return { state: 'multiple', multiple: { hostels: hostelsForPhone } };
      }

      if (hostelsForPhone && hostelsForPhone.length === 1) {
        const record = OFFICIAL_RECORDS.find((r) => r.contacts.some((c) => c === normalized));
        if (record) {
          return { state: 'verified', verified: buildVerifiedData(record, normalized, rumiaListings) };
        }
      }

      const matchingRumiaListing = rumiaListings.find((l) => {
        const phones = [l.landlord_phone, l.agent_phone, l.agent_whatsapp]
          .filter(Boolean)
          .map((p) => (p ? p.replace(/\D/g, '') : ''));
        const searchDigit = normalized.replace(/\D/g, '');
        return phones.some((p) => p && (p === searchDigit || p.endsWith(searchDigit.slice(-9))));
      });

      if (matchingRumiaListing) {
        return { state: 'verified', verified: buildListingVerifiedData(matchingRumiaListing) };
      }
    }

    if (
      searchMode === 'paybill' ||
      searchMode === 'till' ||
      paymentSignal ||
      (cleanDigits.length >= 4 && cleanDigits.length <= 8)
    ) {
      const payVal = paymentSignal?.value || cleanDigits || query;

      const officialPaymentMatches = OFFICIAL_RECORDS.filter((r) =>
        r.payments.some((p) => {
          const lowerP = p.toLowerCase();
          const pDigits = p.replace(/\D/g, '');
          return (
            lowerP.includes(query) ||
            (payVal && p.includes(payVal)) ||
            (cleanDigits && cleanDigits.length >= 4 && pDigits.includes(cleanDigits))
          );
        }),
      );

      const rumiaPaymentMatches = rumiaListings.filter((l) => {
        if (!l.mpesa_details) return false;
        const lowerM = l.mpesa_details.toLowerCase();
        const mDigits = l.mpesa_details.replace(/\D/g, '');
        return (
          lowerM.includes(query) ||
          (payVal && lowerM.includes(payVal)) ||
          (cleanDigits && cleanDigits.length >= 4 && mDigits.includes(cleanDigits))
        );
      });

      const totalMatchesCount = officialPaymentMatches.length + rumiaPaymentMatches.length;

      if (totalMatchesCount === 1) {
        if (officialPaymentMatches.length === 1) {
          const record = officialPaymentMatches[0];
          return {
            state: 'verified',
            verified: buildVerifiedData(record, phoneSignal?.value || record.contacts[0] || '', rumiaListings),
          };
        }
        if (rumiaPaymentMatches.length === 1) {
          return { state: 'verified', verified: buildListingVerifiedData(rumiaPaymentMatches[0]) };
        }
      }

      if (totalMatchesCount > 1) {
        const names = [
          ...officialPaymentMatches.map((r) => r.hostel_name),
          ...rumiaPaymentMatches.map((l) => l.title),
        ];
        return { state: 'multiple', multiple: { hostels: Array.from(new Set(names)) } };
      }
    }

    const officialNameMatches = OFFICIAL_RECORDS.filter((r) =>
      r.hostel_name.toLowerCase().includes(query),
    );

    const rumiaNameMatches = rumiaListings.filter(
      (l) =>
        l.title.toLowerCase().includes(query) ||
        (l.specific_location && l.specific_location.toLowerCase().includes(query)),
    );

    const totalNameCount = officialNameMatches.length + rumiaNameMatches.length;

    if (officialNameMatches.length === 1 && rumiaNameMatches.length === 0) {
      const record = officialNameMatches[0];
      if (phoneSignal && !record.contacts.some((c) => c === phoneSignal.value)) {
        return {
          state: 'mismatch',
          mismatch: { officialContact: record.contacts[0], providedContact: phoneSignal.value },
        };
      }
      return {
        state: 'verified',
        verified: buildVerifiedData(record, phoneSignal?.value || record.contacts[0], rumiaListings),
      };
    }

    if (rumiaNameMatches.length === 1 && officialNameMatches.length === 0) {
      return { state: 'verified', verified: buildListingVerifiedData(rumiaNameMatches[0]) };
    }

    if (totalNameCount > 1) {
      const names = [
        ...officialNameMatches.map((r) => r.hostel_name),
        ...rumiaNameMatches.map((l) => l.title),
      ];
      return { state: 'multiple', multiple: { hostels: Array.from(new Set(names)) } };
    }

    return { state: 'not-found' };
  }, [value, submitted, searchMode, rumiaListings]);
}

function VerifiedResult({ data }: { data: VerifiedData }) {
  const router = useRouter();
  return (
    <View style={[styles.resultCard, styles.verifiedCard]}>
      <View style={styles.verifiedHeader}>
        <ShieldCheck size={16} color="#ecfdf5" />
        <Text style={styles.resultHeaderText}>Verified</Text>
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.verifiedTitle}>{data.hostelName}</Text>
        <Text style={styles.verifiedSub}>Verified by Rumia</Text>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            <Text style={styles.infoValueMono}>
              {formatPhone(data.officialContact.slice(0, 3) + 'XXXXXXXX')}
            </Text>
          </View>
          <View style={[styles.divider, styles.dividerGreen]} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Details</Text>
            <Text style={styles.infoValue}>{data.officialPayment || '-'}</Text>
          </View>
          <View style={[styles.divider, styles.dividerGreen]} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last updated</Text>
            <Text style={styles.infoValueSoft}>{data.verifiedDate}</Text>
          </View>
        </View>

        <View style={styles.safeRow}>
          <Check size={16} color={palette.emerald[700]} />
          <Text style={styles.safeText}>Safe to proceed.</Text>
        </View>

        {data.onRumia && data.listingUrl ? (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => router.push(data.listingUrl as never)}
          >
            <Text style={styles.primaryBtnText}>View Listing</Text>
            <ArrowRight size={14} color="#ffffff" />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.outlineBtnGreen, pressed && styles.pressed]}
            onPress={() => router.push('/verify-report')}
          >
            <Text style={styles.outlineBtnGreenText}>Report Information</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function MultipleResult({ data }: { data: MultipleData }) {
  const router = useRouter();
  return (
    <View style={[styles.resultCard, styles.multipleCard]}>
      <View style={styles.multipleHeader}>
        <AlertTriangle size={16} color="#ffffff" />
        <Text style={styles.resultHeaderText}>Multiple Matches</Text>
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.multipleLead}>
          This information matches multiple official records:
        </Text>
        <View style={styles.multipleList}>
          {data.hostels.map((name, i) => (
            <View key={name} style={styles.multipleRow}>
              {i > 0 && <Text style={styles.multipleOr}>or</Text>}
              <Text style={styles.multipleName}>{name}</Text>
            </View>
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [styles.amberBtn, pressed && styles.pressed]}
          onPress={() => router.push('/verify-records')}
        >
          <Text style={styles.amberBtnText}>View Records</Text>
          <ArrowRight size={14} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

function MismatchResult({ data }: { data: MismatchData }) {
  const router = useRouter();
  return (
    <View style={[styles.resultCard, styles.mismatchCard]}>
      <View style={styles.mismatchHeader}>
        <CircleOff size={16} color="#fef2f2" />
        <Text style={styles.resultHeaderText}>Details Don&apos;t Match</Text>
      </View>
      <View style={styles.resultBody}>
        <View style={[styles.infoBox, styles.infoBoxRed]}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Official Contact</Text>
            <Text style={styles.infoValueMono}>
              {formatPhone(data.officialContact.slice(0, 3) + 'XXXXXXXX')}
            </Text>
          </View>
          <View style={[styles.divider, styles.dividerRed]} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>You Entered</Text>
            <Text style={styles.mismatchValue}>
              {formatPhone(data.providedContact.slice(0, 3) + 'XXXXXXXX')}
            </Text>
          </View>
        </View>
        <Text style={styles.mismatchLead}>
          Please confirm directly with the hostel before making payment.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.redBtn, pressed && styles.pressed]}
          onPress={() => router.push('/verify-records')}
        >
          <Text style={styles.redBtnText}>View Official Record</Text>
          <ArrowRight size={14} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

function NotFoundResult({ supportWhatsapp }: { supportWhatsapp?: string | null }) {
  const router = useRouter();
  return (
    <View style={[styles.resultCard, styles.mismatchCard]}>
      <View style={styles.mismatchHeader}>
        <AlertTriangle size={16} color="#fef2f2" />
        <Text style={styles.resultHeaderText}>Unverified</Text>
      </View>
      <View style={styles.resultBody}>
        <View style={styles.notFoundLead}>
          <CircleOff size={24} color={palette.red[400]} />
          <Text style={styles.notFoundText}>
            This payment information has <Text style={styles.notFoundBold}>not</Text> been verified by Rumia. Proceed with caution.
          </Text>
        </View>
        <View style={[styles.infoBox, styles.infoBoxRed]}>
          <Text style={styles.cautionTitle}>Before making payment:</Text>
          <View style={styles.cautionRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.cautionItem}>Ask for a hostel tour.</Text>
          </View>
          <View style={styles.cautionRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.cautionItem}>Confirm ownership with the landlord.</Text>
          </View>
          <View style={styles.cautionRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.cautionItem}>Contact support if unsure.</Text>
          </View>
        </View>
        <View style={styles.rowGap}>
          <Pressable
            style={({ pressed }) => [styles.redBtn, styles.flexBtn, pressed && styles.pressed]}
            onPress={() => router.push('/verify-report')}
          >
            <Text style={styles.redBtnText}>Report Listing</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.outlineBtnRed, styles.flexBtn, pressed && styles.pressed]}
            onPress={() => {
              if (supportWhatsapp) {
                Linking.openURL(buildWhatsAppUrl(supportWhatsapp, 'Hello, I found a hostel on Rumia that I am unsure about and need help before paying.'));
              } else {
                router.push('/verify-report');
              }
            }}
          >
            <Text style={styles.outlineBtnRedText}>Contact Support</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function HakisaChecker({ rumiaListings = [], supportWhatsapp }: HakisaCheckerProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>('phone');
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mode = MODE_CONFIG[searchMode];
  const outcome = useCheckOutcome(value, submitted, searchMode, rumiaListings);

  const handleCheck = () => {
    if (!value.trim()) return;
    Keyboard.dismiss();
    setSubmitted(true);
  };

  const switchMode = (key: SearchMode) => {
    setSearchMode(key);
    setValue('');
    setSubmitted(false);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <ShieldCheck size={20} color={palette.emerald[700]} />
          </View>
          <Text style={styles.heroEyebrow}>Hakikisha</Text>
        </View>
        <Text style={styles.heroTitle}>Avoid hostel payment scams.</Text>
        <Text style={styles.heroSub}>
          Before sending money, confirm whether a hostel, phone number or payment details have been verified by Rumia.
        </Text>

        <Text style={styles.modeLabel}>Search by</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeTabs}>
          {MODES.map((m) => {
            const active = searchMode === m.key;
            return (
              <Pressable
                key={m.key}
                style={[styles.modeTab, active && styles.modeTabActive]}
                onPress={() => switchMode(m.key)}
              >
                <Text style={[styles.modeIcon, active && styles.modeTabTextActive]}>{m.icon}</Text>
                {active ? (
                  <Text style={styles.modeTabTextActive}>{m.label}</Text>
                ) : (
                  <Text style={styles.modeTabText}>{m.label}</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.inputBlock}>
          <Text style={styles.inputLabel}>
            {searchMode === 'phone'
              ? 'Enter phone number'
              : searchMode === 'hostel'
                ? 'Enter hostel name'
                : searchMode === 'paybill'
                  ? 'Enter Paybill number'
                  : 'Enter Till number'}
          </Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={(text) => {
              setValue(text);
              setSubmitted(false);
            }}
            placeholder={mode.placeholder}
            placeholderTextColor={palette.slate[300]}
            keyboardType={mode.keyboardType}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleCheck}
          />
          <Pressable
            style={({ pressed }) => [styles.verifyBtn, pressed && styles.pressed]}
            onPress={handleCheck}
          >
            <Text style={styles.verifyBtnText}>Verify Details</Text>
            <ArrowRight size={16} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* Results */}
      {outcome && (
        <View style={styles.results}>
          {outcome.state === 'verified' && outcome.verified && (
            <VerifiedResult data={outcome.verified} />
          )}
          {outcome.state === 'multiple' && outcome.multiple && (
            <MultipleResult data={outcome.multiple} />
          )}
          {outcome.state === 'mismatch' && outcome.mismatch && (
            <MismatchResult data={outcome.mismatch} />
          )}
          {outcome.state === 'not-found' && <NotFoundResult supportWhatsapp={supportWhatsapp} />}
        </View>
      )}

      {/* Trust indicators */}
      <View style={styles.trustCard}>
        {[
          { label: 'Verified by Rumia' },
          { label: 'Takes less than 10 seconds' },
          { label: 'Free to use' },
        ].map((item) => (
          <View key={item.label} style={styles.trustRow}>
            <View style={styles.trustIcon}>
              <Check size={14} color={palette.emerald[600]} />
            </View>
            <Text style={styles.trustText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function buildVerifiedData(
  record: OfficialDeKutRecord,
  contact: string,
  rumiaListings: ListingMatchCandidate[],
): VerifiedData {
  const onRumia = rumiaListings.some((listing) => {
    const phones = [listing.landlord_phone, listing.agent_phone, listing.agent_whatsapp].filter(
      Boolean,
    ) as string[];
    return record.contacts.some((rc) => phones.includes(rc));
  });

  const matchedListing = onRumia
    ? rumiaListings.find((listing) => {
        const phones = [listing.landlord_phone, listing.agent_phone, listing.agent_whatsapp].filter(
          Boolean,
        ) as string[];
        return record.contacts.some((rc) => phones.includes(rc));
      })
    : undefined;

  return {
    hostelName: record.hostel_name,
    officialContact: contact,
    officialPayment: record.payments[0],
    verifiedDate: '14 July 2026',
    onRumia,
    listingUrl: matchedListing ? `/listing/${matchedListing.slug || matchedListing.id}` : undefined,
  };
}

function buildListingVerifiedData(listing: ListingMatchCandidate): VerifiedData {
  const contact =
    listing.landlord_phone || listing.agent_phone || listing.agent_whatsapp || 'Verified Agent';
  return {
    hostelName: listing.title,
    officialContact: contact,
    officialPayment: listing.mpesa_details || 'Verified on Rumia',
    verifiedDate: '14 July 2026',
    onRumia: true,
    listingUrl: `/listing/${listing.slug || listing.id}`,
  };
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii['2xl'],
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 2,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.emerald[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 3, color: palette.slate[400] },
  heroTitle: { fontSize: 22, fontWeight: '800', color: palette.slate[900], lineHeight: 28 },
  heroSub: {
    fontSize: 13,
    color: palette.slate[500],
    lineHeight: 20,
    marginTop: 8,
  },
  modeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: palette.slate[400],
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  modeTabs: { gap: 6 },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: palette.slate[100],
  },
  modeTabActive: { backgroundColor: palette.slate[900] },
  modeTabText: { fontSize: 12, fontWeight: '700', color: palette.slate[500] },
  modeTabTextActive: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  modeIcon: { color: palette.slate[500] },
  inputBlock: { marginTop: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: palette.slate[500], marginBottom: 8 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.slate[900],
  },
  verifyBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: palette.slate[900],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  verifyBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  results: { marginTop: 20 },
  resultCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  verifiedCard: { borderColor: palette.emerald[200], backgroundColor: palette.emerald[50] },
  multipleCard: { borderColor: palette.amber[200], backgroundColor: palette.amber[50] },
  mismatchCard: { borderColor: palette.red[200], backgroundColor: palette.red[50] },
  verifiedHeader: {
    backgroundColor: palette.emerald[600],
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  multipleHeader: {
    backgroundColor: palette.amber[500],
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mismatchHeader: {
    backgroundColor: palette.red[600],
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultHeaderText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  resultBody: { padding: 20 },
  verifiedTitle: { fontSize: 20, fontWeight: '700', color: palette.emerald[900] },
  verifiedSub: { fontSize: 12, color: palette.emerald[600], fontWeight: '600', marginTop: 4 },
  infoBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.emerald[100],
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  infoBoxRed: { borderColor: palette.red[100] },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: { fontSize: 12, fontWeight: '600', color: palette.slate[500] },
  infoValue: { fontSize: 13, fontWeight: '700', color: palette.slate[900], flexShrink: 1, textAlign: 'right' },
  infoValueSoft: { fontSize: 13, fontWeight: '600', color: palette.slate[700] },
  infoValueMono: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.slate[900],
    fontVariant: ['tabular-nums'],
  },
  divider: { height: 1, marginVertical: 10 },
  dividerGreen: { backgroundColor: palette.emerald[50] },
  dividerRed: { backgroundColor: palette.red[50] },
  safeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  safeText: { fontSize: 13, fontWeight: '600', color: palette.emerald[700] },
  primaryBtn: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: palette.emerald[600],
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  outlineBtnGreen: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.emerald[200],
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnGreenText: { color: palette.emerald[700], fontSize: 13, fontWeight: '700' },
  multipleLead: { fontSize: 13, color: palette.amber[800], fontWeight: '600', lineHeight: 20 },
  multipleList: { marginTop: 12, gap: 6 },
  multipleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  multipleOr: { fontSize: 12, fontWeight: '500', color: palette.amber[500] },
  multipleName: { fontSize: 16, fontWeight: '700', color: palette.amber[900] },
  amberBtn: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: palette.amber[500],
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  amberBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  mismatchValue: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.red[600],
    fontVariant: ['tabular-nums'],
  },
  mismatchLead: {
    fontSize: 13,
    color: palette.red[700],
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 16,
  },
  redBtn: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: palette.red[600],
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  redBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  notFoundLead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  notFoundText: { fontSize: 13, color: '#991b1b', fontWeight: '500', lineHeight: 20, flex: 1 },
  notFoundBold: { fontWeight: '700' },
  cautionTitle: { fontSize: 13, fontWeight: '700', color: palette.red[700], marginBottom: 8 },
  cautionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  bullet: { color: palette.red[300], fontSize: 14 },
  cautionItem: { fontSize: 12, color: palette.red[600], flex: 1, lineHeight: 18 },
  rowGap: { flexDirection: 'row', gap: 8, marginTop: 4 },
  flexBtn: { flex: 1, marginTop: 16 },
  outlineBtnRed: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.red[200],
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnRedText: { color: palette.red[700], fontSize: 13, fontWeight: '700' },
  trustCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii['2xl'],
    padding: 20,
    marginTop: 20,
    gap: 12,
  },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trustIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.emerald[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: { fontSize: 13, fontWeight: '600', color: palette.slate[700] },
  pressed: { opacity: 0.8 },
});