import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Platform,
} from 'react-native';
import {
  MessageCircle,
  Building2,
  UserCheck,
  X,
  ArrowLeft,
  Phone,
} from 'lucide-react-native';
import { apiFetch } from '../../lib/api/client';
import { getAnonymousDeviceHash } from '../../lib/device';
import type { Listing } from '../../lib/api/schema';
import { palette, radii } from '../../lib/theme';

type Step = 'choose' | 'full' | 'fee' | 'redirecting';

interface ContactModalProps {
  visible: boolean;
  listing: Listing | null;
  onClose: () => void;
}

function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/[^0-9]/g, '').replace(/^0/, '254');
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function ContactModal({ visible, listing, onClose }: ContactModalProps) {
  const [step, setStep] = useState<Step>('choose');
  const [isLoading, setIsLoading] = useState(false);

  if (!listing) return null;

  const agentPhone = listing.agent?.whatsapp || listing.agent?.phone || '';
  const landlordPhone = listing.landlord_phone || '';
  const consultationFee = 1000;
  const feeDisplay = `KES ${consultationFee.toLocaleString()}`;
  const isFull = listing.is_full;

  const reset = () => {
    setStep('choose');
    setIsLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const openWhatsApp = async (type: 'hostel_owner' | 'rumia_agent') => {
    setIsLoading(true);

    let target = type === 'hostel_owner' && landlordPhone ? landlordPhone : agentPhone;
    let message =
      type === 'hostel_owner'
        ? `Hi! I found ${listing.title} on Rumia and I'd like to view it.`
        : `Hi! I'm interested in ${listing.title} on Rumia. Can you help me arrange a viewing?`;

    try {
      const ip_hash = await getAnonymousDeviceHash();
      await apiFetch('/leads/track', {
        method: 'POST',
        body: JSON.stringify({ listing_id: listing.id, source: 'mobile_contact', ip_hash }),
      });
    } catch {
      // Lead tracking is best-effort — still open WhatsApp.
    }

    if (!target) {
      setIsLoading(false);
      Alert.alert('No contact number', 'Contact details are unavailable for this listing right now.');
      return;
    }

    try {
      const url = buildWhatsAppUrl(target, message);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Open WhatsApp', `Agent phone: ${target}`);
      }
    } catch {
      Alert.alert('Open WhatsApp', `Agent phone: ${target}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHostelOwner = () => {
    if (isFull) {
      setStep('full');
      return;
    }
    openWhatsApp('hostel_owner');
  };

  const handleSelectRumiaAgent = () => {
    if (step === 'full') {
      if (!listing.pays_commission) {
        setStep('fee');
        return;
      }
      openWhatsApp('rumia_agent');
      return;
    }
    if (!listing.pays_commission) {
      setStep('fee');
      return;
    }
    openWhatsApp('rumia_agent');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {step === 'redirecting' && (
              <View style={styles.centerStep}>
                <View style={styles.spinnerCircle}>
                  <ActivityIndicator color={palette.emerald[600]} size="large" />
                </View>
                <Text style={styles.redirectText}>Opening WhatsApp…</Text>
              </View>
            )}

            {step === 'full' && (
              <>
                <View style={styles.headerRow}>
                  <View style={styles.headerTextWrap}>
                    <Text style={styles.title}>This hostel is fully occupied</Text>
                    <Text style={styles.subtitle}>Rooms are all taken right now</Text>
                  </View>
                  <TouchableOpacity onPress={handleClose} hitSlop={8} style={styles.iconButton}>
                    <X size={18} color={palette.slate[500]} />
                  </TouchableOpacity>
                </View>

                <View style={styles.amberCard}>
                  <Text style={styles.amberText}>
                    This hostel is currently <Text style={styles.strong}>full</Text>. A Rumia agent can
                    help you find available alternatives for a consultation fee of{' '}
                    <Text style={styles.strong}>{feeDisplay}</Text>.
                  </Text>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.outlineButton} onPress={handleClose}>
                    <Text style={styles.outlineButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => (listing.pays_commission ? openWhatsApp('rumia_agent') : setStep('fee'))}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Continue with Agent</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 'fee' && (
              <>
                <View style={styles.headerRow}>
                  <TouchableOpacity
                    onPress={() => setStep(listing.is_full ? 'full' : 'choose')}
                    hitSlop={8}
                    style={styles.iconButton}
                  >
                    <ArrowLeft size={20} color={palette.slate[600]} />
                  </TouchableOpacity>
                  <View style={styles.headerTextWrap}>
                    <Text style={styles.title}>Get the real details</Text>
                    <Text style={styles.subtitle}>Insider information from the agent</Text>
                  </View>
                </View>

                <View style={styles.amberCard}>
                  <Text style={styles.amberText}>
                    Get professional guidance from a verified Rumia agent to evaluate this property
                    against your budget, location preferences, and requirements.{' '}
                    <Text style={styles.strong}>
                      A consultation fee of {feeDisplay} applies, paid directly to the agent.
                    </Text>
                  </Text>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.outlineButton} onPress={handleClose}>
                    <Text style={styles.outlineButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => openWhatsApp('rumia_agent')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Accept and Continue</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 'choose' && (
              <>
                <View style={styles.headerRow}>
                  <View style={styles.headerTextWrap}>
                    <Text style={styles.title}>Contact</Text>
                    <Text style={styles.subtitle}>Who would you like to speak to?</Text>
                  </View>
                  <TouchableOpacity onPress={handleClose} hitSlop={8} style={styles.iconButton}>
                    <X size={18} color={palette.slate[500]} />
                  </TouchableOpacity>
                </View>

                <View style={styles.grid}>
                  <TouchableOpacity
                    style={[styles.optionCard, isLoading && styles.optionDisabled]}
                    onPress={handleSelectHostelOwner}
                    disabled={isLoading}
                  >
                    <View style={styles.optionIcon}>
                      <Building2 size={20} color={palette.slate[700]} />
                    </View>
                    <Text style={styles.optionTitle}>Hostel Owner</Text>
                    <Text style={styles.optionSubtitle}>Speak directly with the landlord</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.optionCard, styles.optionCardAgent, isLoading && styles.optionDisabled]}
                    onPress={handleSelectRumiaAgent}
                    disabled={isLoading}
                  >
                    <View style={styles.optionIconAgent}>
                      <UserCheck size={20} color={palette.emerald[600]} />
                    </View>
                    <Text style={styles.optionTitle}>Rumia Agent</Text>
                    <Text style={styles.optionSubtitle}>Get guided help from an expert</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.connectHint}>
                  <MessageCircle size={12} color={palette.slate[400]} /> Connects via WhatsApp
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropTouch: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.5)' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 16,
  },
  handle: { width: 36, height: 3, borderRadius: 2, backgroundColor: palette.slate[300], alignSelf: 'center', marginTop: 12, marginBottom: 10 },
  content: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 28, paddingTop: 8 },
  centerStep: { alignItems: 'center', paddingVertical: 44, gap: 14 },
  spinnerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.emerald[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  redirectText: { color: palette.slate[600], fontSize: 13, fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerTextWrap: { flex: 1 },
  title: { color: palette.slate[900], fontSize: 17, fontWeight: '800' },
  subtitle: { color: palette.slate[500], fontSize: 12, marginTop: 1 },
  iconButton: { padding: 6 },
  amberCard: {
    backgroundColor: palette.amber[50],
    borderWidth: 1,
    borderColor: palette.amber[100],
    borderRadius: radii['2xl'],
    padding: 18,
    marginBottom: 18,
  },
  amberText: { color: palette.amber[900], fontSize: 14, lineHeight: 21 },
  strong: { fontWeight: '800' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  outlineButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: { color: palette.slate[700], fontSize: 14, fontWeight: '700' },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: palette.emerald[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  grid: { flexDirection: 'row', gap: 12 },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    padding: 18,
    borderRadius: radii['2xl'],
    borderWidth: 2,
    borderColor: palette.slate[200],
  },
  optionCardAgent: { borderColor: palette.emerald[200] },
  optionDisabled: { opacity: 0.6 },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconAgent: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.emerald[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { color: palette.slate[900], fontSize: 14, fontWeight: '800' },
  optionSubtitle: { color: palette.slate[500], fontSize: 11, textAlign: 'center', lineHeight: 15 },
  connectHint: { color: palette.slate[400], fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 16 },
});