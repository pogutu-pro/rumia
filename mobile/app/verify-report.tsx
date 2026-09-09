import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Flag, AlertTriangle, Phone, MessageSquare, CheckCircle2, ArrowRight, Mail } from 'lucide-react-native';
import { apiFetch } from '../lib/api/client';
import type { Campus } from '../lib/api/schema';
import { buildWhatsAppUrl } from '../lib/utils/whatsapp';
import { palette, radii } from '../lib/theme';

type IssueType = 'wrong_number' | 'wrong_payment' | 'impersonating' | 'scam' | 'other';

const ISSUE_OPTIONS: { key: IssueType; label: string; description: string }[] = [
  { key: 'wrong_number', label: 'Wrong phone number', description: 'The number shared with me differs from the official record' },
  { key: 'wrong_payment', label: 'Suspicious payment details', description: 'I was given a Paybill/Till that does not match the official record' },
  { key: 'impersonating', label: 'Impersonating a hostel', description: 'Someone is pretending to be from a hostel I verified' },
  { key: 'scam', label: 'Possible scam / fraud', description: 'I was asked to pay before seeing the room or signing any agreement' },
  { key: 'other', label: 'Other concern', description: 'I have a different issue to report' },
];

export default function VerifyReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [issueType, setIssueType] = useState<IssueType | null>(null);
  const [contactReported, setContactReported] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: campuses } = useQuery<Campus[]>({
    queryKey: ['campuses'],
    queryFn: () => apiFetch('/campuses'),
    staleTime: 1000 * 60 * 5,
  });

  const dekutCampus = useMemo(
    () => (campuses ?? []).find((c) => c.slug === 'dekut'),
    [campuses],
  );

  const whatsappNumber = dekutCampus?.whatsapp_number;
  const selectedOption = ISSUE_OPTIONS.find((o) => o.key === issueType);
  const whatsappMessage = `[Rumia Hostel Report]\nIssue: ${selectedOption?.label || 'General report'}\nContact reported: ${contactReported || 'N/A'}\nDetails: ${details || 'N/A'}`;

  const handleSubmit = () => {
    if (!issueType || !whatsappNumber) return;
    Linking.openURL(buildWhatsAppUrl(whatsappNumber, whatsappMessage)).catch(() => {
      Alert.alert('Open WhatsApp', `Send your report to ${whatsappNumber}\n\n${whatsappMessage}`);
    });
    setSubmitted(true);
  };

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
        <Text style={styles.title}>Report a Concern</Text>
        <Text style={styles.subtitle}>
          Seen something suspicious while verifying? Help us protect other students. Every report is reviewed by our team within 24 hours.
        </Text>
      </View>

      {submitted ? (
        <View style={styles.card}>
          <View style={[styles.cardHeader, styles.cardHeaderGreen]}>
            <CheckCircle2 size={14} color={palette.emerald[600]} />
            <Text style={styles.cardHeaderText}>Report sent</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardLead}>
              Thank you for helping keep the community safe. We&apos;ve received your report and will investigate within 24 hours. If WhatsApp didn&apos;t open, tap the button below to send it manually.
            </Text>
            {whatsappNumber && (
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={() => Linking.openURL(buildWhatsAppUrl(whatsappNumber, whatsappMessage))}
              >
                <Text style={styles.primaryBtnText}>Open WhatsApp to Send</Text>
                <ArrowRight size={14} color="#ffffff" />
              </Pressable>
            )}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Your report summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Issue</Text>
                <Text style={styles.summaryValue}>{selectedOption?.label}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Contact reported</Text>
                <Text style={[styles.summaryValue, styles.mono]}>{contactReported || 'N/A'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Details</Text>
                <Text style={[styles.summaryValue, styles.summaryTruncate]} numberOfLines={2}>{details || 'N/A'}</Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
              onPress={() => {
                setSubmitted(false);
                setIssueType(null);
                setContactReported('');
                setDetails('');
              }}
            >
              <Text style={styles.resetBtnText}>Submit another report</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Flag size={14} color={palette.slate[400]} />
            <Text style={styles.cardHeaderText}>Report a Concern</Text>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.sectionLabel}>What would you like to report?</Text>
            <View style={styles.issueList}>
              {ISSUE_OPTIONS.map((option) => {
                const active = issueType === option.key;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.issueOption, active && styles.issueOptionActive]}
                    onPress={() => setIssueType(option.key)}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.issueText}>
                      <Text style={[styles.issueLabel, active && styles.issueLabelActive]}>{option.label}</Text>
                      <Text style={[styles.issueDesc, active && styles.issueDescActive]}>{option.description}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Phone or payment number you were given</Text>
            <View style={styles.inputWrap}>
              <Phone size={16} color={palette.slate[400]} />
              <TextInput
                style={styles.input}
                value={contactReported}
                onChangeText={setContactReported}
                placeholder="e.g. 0712 345 678 or Paybill 247247"
                placeholderTextColor={palette.slate[400]}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.sectionLabel}>Additional details (optional)</Text>
            <View style={[styles.inputWrap, styles.textareaWrap]}>
              <MessageSquare size={16} color={palette.slate[400]} style={styles.textareaIcon} />
              <TextInput
                style={[styles.input, styles.textarea]}
                value={details}
                onChangeText={setDetails}
                placeholder="Describe what happened…"
                placeholderTextColor={palette.slate[400]}
                multiline
              />
            </View>

            <View style={styles.warningBox}>
              <AlertTriangle size={16} color={palette.amber[500]} />
              <Text style={styles.warningText}>
                Your report opens WhatsApp with a pre-filled message to Rumia support. We review all reports and will never share your identity.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                (!issueType || !whatsappNumber) && styles.primaryBtnDisabled,
                pressed && styles.pressed,
              ]}
              onPress={handleSubmit}
              disabled={!issueType || !whatsappNumber}
            >
              <Flag size={15} color="#ffffff" />
              <Text style={styles.primaryBtnText}>Send Report via WhatsApp</Text>
              <ArrowRight size={14} color="#ffffff" />
            </Pressable>

            <View style={styles.emailRow}>
              <Text style={styles.emailHint}>Or send us an email</Text>
              <Pressable onPress={() => Linking.openURL('mailto:contact@rumia.co.ke?subject=Hostel%20Report')}>
                <View style={styles.emailLink}>
                  <Mail size={12} color={palette.slate[600]} />
                  <Text style={styles.emailLinkText}>contact@rumia.co.ke</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#1B1B181A',
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    marginTop: 18,
  },
  cardHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1B1B180D',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHeaderGreen: { borderBottomWidth: 0 },
  cardHeaderText: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: palette.slate[400], textTransform: 'uppercase' },
  cardBody: { padding: 20 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: palette.slate[400],
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  issueList: { gap: 8, marginBottom: 20 },
  issueOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.slate[200],
    padding: 12,
  },
  issueOptionActive: { backgroundColor: palette.slate[900], borderColor: palette.slate[900] },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.slate[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioActive: { borderColor: '#ffffff', backgroundColor: '#ffffff' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.slate[900] },
  issueText: { flex: 1 },
  issueLabel: { fontSize: 14, fontWeight: '600', color: palette.slate[800] },
  issueLabelActive: { color: '#ffffff' },
  issueDesc: { fontSize: 12, color: palette.slate[400], marginTop: 2, lineHeight: 17 },
  issueDescActive: { color: '#ffffffB3' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: palette.slate[50],
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: palette.slate[800] },
  textareaWrap: { alignItems: 'flex-start', paddingTop: 14 },
  textareaIcon: { marginTop: 2 },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: palette.amber[50],
    borderWidth: 1,
    borderColor: palette.amber[200],
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  warningText: { flex: 1, fontSize: 12, color: palette.amber[700], lineHeight: 17 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.slate[900],
    borderRadius: 12,
    paddingVertical: 14,
  },
  primaryBtnDisabled: { backgroundColor: palette.slate[100] },
  primaryBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  emailRow: { alignItems: 'center', marginTop: 16 },
  emailHint: { fontSize: 11, color: palette.slate[400], marginBottom: 6 },
  emailLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emailLinkText: { fontSize: 12, fontWeight: '600', color: palette.slate[600] },
  cardLead: { fontSize: 13, color: palette.slate[700], lineHeight: 20 },
  summaryBox: {
    backgroundColor: '#F7F5F0',
    borderWidth: 1,
    borderColor: '#1B1B180D',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  summaryTitle: { fontSize: 13, fontWeight: '600', color: palette.slate[900], marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  summaryLabel: { fontSize: 11, color: palette.slate[500] },
  summaryValue: { fontSize: 11, fontWeight: '600', color: palette.slate[900], flexShrink: 1, textAlign: 'right' },
  summaryTruncate: { maxWidth: '90%' },
  mono: { fontVariant: ['tabular-nums'] },
  resetBtn: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1B1B181A',
    paddingVertical: 11,
    alignItems: 'center',
  },
  resetBtnText: { fontSize: 12, fontWeight: '600', color: palette.slate[700] },
  pressed: { opacity: 0.8 },
});