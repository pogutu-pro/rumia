import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  MapPin,
  Clock,
  User,
  Phone,
  CalendarCheck,
  Check,
  AlertCircle,
} from 'lucide-react-native';
import { apiFetch } from '../../lib/api/client';
import type { Listing, TourBooking, TourBookingCreate } from '../../lib/api/schema';
import { fetchZones } from '../campus/queries';
import { formatDateInput, isValidDate } from '../../lib/tour-helpers';
import { palette, radii } from '../../lib/theme';

const TIME_SLOTS = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
] as const;

function formatTourPrice(amount: number): string {
  return `KES ${amount.toLocaleString()}`;
}

function formatDateDisplay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface BookTourModalProps {
  visible: boolean;
  listing: Listing | null;
  onClose: () => void;
  onBooked?: (booking: TourBooking) => void;
}

export function BookTourModal({ visible, listing, onClose, onBooked }: BookTourModalProps) {
  const [studentName, setStudentName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [timeSlot, setTimeSlot] = useState<(typeof TIME_SLOTS)[number]['key']>('morning');
  const [phoneError, setPhoneError] = useState('');
  const [booking, setBooking] = useState<TourBooking | null>(null);

  const { data: zones } = useQuery({
    queryKey: ['zones', listing?.campus_id],
    queryFn: () => fetchZones(listing?.campus_id ?? null, null),
    enabled: visible && !!listing,
  });

  const defaultZone = useMemo(() => {
    if (!listing || !zones?.length) return null;
    return zones.find((zone) => zone.id === listing.zone_id) ?? zones[0];
  }, [zones, listing]);

  const [zoneSlug, setZoneSlug] = useState<string | null>(null);
  const selectedZone = zones?.find((zone) => zone.slug === zoneSlug) ?? defaultZone ?? null;

  useEffect(() => {
    if (visible) {
      setStudentName('');
      setPhone('');
      setPreferredDate('');
      setPhoneError('');
      setTimeSlot('morning');
      setZoneSlug(null);
      setBooking(null);
    }
  }, [visible]);

  useEffect(() => {
    if (defaultZone) {
      setZoneSlug(defaultZone.slug);
    }
  }, [defaultZone]);

  const mutation = useMutation({
    mutationFn: (payload: TourBookingCreate) =>
      apiFetch<TourBooking>('/tours', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      setBooking(result);
      onBooked?.(result);
    },
    onError: (error: Error) => {
      Alert.alert('Booking failed', error.message || 'Please try again.');
    },
  });

  const amount = selectedZone?.full_search_price ?? 0;

  const handleClose = () => {
    setBooking(null);
    onClose();
  };

  const handleSubmit = () => {
    if (!listing) return;
    if (studentName.trim().length < 2) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }
    if (phone.trim().length < 8) {
      Alert.alert('Phone required', 'Please enter a valid phone number.');
      return;
    }
    if (!isValidDate(preferredDate)) {
      Alert.alert('Date required', 'Enter a valid date as YYYY-MM-DD.');
      return;
    }
    if (!selectedZone) {
      Alert.alert('Zone required', 'Please select a zone for the tour.');
      return;
    }

    mutation.mutate({
      student_name: studentName.trim(),
      phone: phone.trim(),
      listing_id: listing.id,
      zone: selectedZone.name,
      tour_type: 'specific_hostel',
      amount,
      preferred_date: preferredDate,
      preferred_time: timeSlot,
    });
  };

  const confirmation = booking ? (
    <ScrollView contentContainerStyle={styles.confirmation}>
      <View style={styles.successIcon}>
        <Check size={30} color={palette.emerald[600]} />
      </View>
      <Text style={styles.successTitle}>Tour Booked!</Text>
      <Text style={styles.successSubtitle}>Your hostel tour has been scheduled.</Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>TOUR TYPE</Text>
          <Text style={styles.summaryValue}>Hostel Tour</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>DATE</Text>
          <Text style={styles.summaryValue}>{formatDateDisplay(booking.preferred_date)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>TIME</Text>
          <Text style={styles.summaryValue}>
            {TIME_SLOTS.find((slot) => slot.key === booking.preferred_time)?.label}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>ZONE</Text>
          <Text style={styles.summaryValue}>{booking.zone}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>PAY ON ARRIVAL</Text>
          <Text style={styles.summaryPrice}>{formatTourPrice(booking.amount)}</Text>
        </View>
      </View>

      <View style={styles.payCard}>
        <Text style={styles.payTitle}>
          Pay {formatTourPrice(booking.amount)} directly to the agent when you arrive.
        </Text>
        <Text style={styles.paySubtitle}>Cash or direct Till payment accepted.</Text>
      </View>

      <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  ) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            {booking ? (
              confirmation
            ) : (
              <>
                <View style={styles.header}>
                  <TouchableOpacity onPress={handleClose} hitSlop={8} style={styles.backButton}>
                    <ArrowLeft size={20} color={palette.slate[600]} />
                  </TouchableOpacity>
                  <View style={styles.headerText}>
                    <Text style={styles.title}>Book a Tour</Text>
                    <Text style={styles.subtitle}>
                      {listing ? `Near ${listing.title}` : 'Reach your hostel without the guessing'}
                    </Text>
                  </View>
                </View>

                <View style={styles.amberBox}>
                  <Text style={styles.amberTitle}>Don't waste your first choice</Text>
                  <Text style={styles.amberText}>
                    Don't waste time getting lost, asking random people, or returning another day
                    because the caretaker isn't available. Rumia knows the hostels, guides you there,
                    and ensures you're expected.
                  </Text>
                </View>

                <View style={styles.emeraldBox}>
                  <Text style={styles.emeraldTitle}>How the tour fee works</Text>
                  <Text style={styles.emeraldText}>
                    The fee covers a verified agent who sets aside dedicated time to walk you through
                    the room, answer your questions, and show you the actual space. You pay the agent
                    directly when you arrive. No online payment required.
                  </Text>
                </View>

                <Text style={styles.label}>Zone tour</Text>
                <View style={styles.zoneCard}>
                  <View style={styles.zoneIcon}>
                    <MapPin size={16} color="#ffffff" />
                  </View>
                  <View style={styles.zoneInfo}>
                    <Text style={styles.zoneName}>{selectedZone?.name ?? 'Loading...'}</Text>
                    <Text style={styles.zoneCaption}>PER ZONE · ANY HOSTELS IN THE AREA</Text>
                  </View>
                </View>
                {listing && selectedZone && (
                  <Text style={styles.zoneHint}>
                    You'll be guided through {listing.title} and other hostels in {selectedZone.name}.
                    The fee covers the whole zone, not a single hostel.
                  </Text>
                )}

                <Text style={styles.label}>Preferred date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={preferredDate}
                  onChangeText={(value) => setPreferredDate(formatDateInput(value))}
                  placeholder="2026-09-05"
                  placeholderTextColor={palette.slate[400]}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />

                <Text style={styles.label}>Preferred time</Text>
                <View style={styles.timeRow}>
                  {TIME_SLOTS.map((slot) => {
                    const selected = timeSlot === slot.key;
                    return (
                      <TouchableOpacity
                        key={slot.key}
                        style={[styles.timeCard, selected && styles.timeCardActive]}
                        onPress={() => setTimeSlot(slot.key)}
                      >
                        <Clock
                          size={16}
                          color={selected ? palette.slate[900] : palette.slate[400]}
                        />
                        <Text
                          style={[styles.timeCardText, selected && styles.timeCardTextActive]}
                        >
                          {slot.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Your name</Text>
                <View style={styles.inputWrap}>
                  <User size={16} color={palette.slate[400]} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputWithIcon}
                    value={studentName}
                    onChangeText={setStudentName}
                    placeholder="e.g. John Kamau"
                    placeholderTextColor={palette.slate[400]}
                    autoCapitalize="words"
                  />
                </View>

                <Text style={styles.label}>Phone number</Text>
                <View style={[styles.inputWrap, phoneError && styles.inputWrapError]}>
                  <Phone size={16} color={palette.slate[400]} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputWithIcon}
                    value={phone}
                    onChangeText={(value) => {
                      setPhone(value);
                      if (value.trim().length >= 9) {
                        setPhoneError(/^(07|01)/.test(value.trim()) ? '' : 'Enter a valid Kenyan number (07xx or 01xx).');
                      } else {
                        setPhoneError('');
                      }
                    }}
                    placeholder="e.g. 0712 345 678"
                    placeholderTextColor={palette.slate[400]}
                    keyboardType="phone-pad"
                  />
                </View>
                {phoneError ? (
                  <View style={styles.phoneErrorRow}>
                    <AlertCircle size={13} color={palette.red[500]} />
                    <Text style={styles.phoneErrorText}>{phoneError}</Text>
                  </View>
                ) : (
                  <Text style={styles.fieldHint}>
                    Used to match this booking if you create an account later.
                  </Text>
                )}

                {amount > 0 ? (
                  <View style={styles.priceCard}>
                    <View style={styles.priceInfo}>
                      <Text style={styles.priceLabel}>TOUR FEE</Text>
                      <Text style={styles.priceZone}>Zone tour · {selectedZone?.name}</Text>
                    </View>
                    <Text style={styles.priceValue}>{formatTourPrice(amount)}</Text>
                  </View>
                ) : (
                  <View style={styles.priceUnavailable}>
                    <Text style={styles.priceUnavailableText}>
                      Pricing unavailable for this area. Please contact the agent directly.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.submitButton, mutation.isPending && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <CalendarCheck size={16} color="#ffffff" />
                      <Text style={styles.submitButtonText}>
                        Book Tour, {amount > 0 ? formatTourPrice(amount) : 'N/A'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.submitHint}>
                  Pay the agent directly when you arrive. No online payment required.
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '94%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 16,
  },
  sheetContent: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  handle: { width: 36, height: 3, borderRadius: 2, backgroundColor: palette.slate[300], alignSelf: 'center', marginTop: 12, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backButton: { padding: 6 },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: palette.slate[900] },
  subtitle: { color: palette.slate[500], fontSize: 12, marginTop: 1 },
  amberBox: {
    backgroundColor: palette.amber[50],
    borderWidth: 1,
    borderColor: palette.amber[100],
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 10,
  },
  amberTitle: { color: palette.amber[900], fontSize: 13, fontWeight: '700', marginBottom: 3 },
  amberText: { color: palette.amber[700], fontSize: 12, lineHeight: 18 },
  emeraldBox: {
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[100],
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 16,
  },
  emeraldTitle: { color: palette.emerald[900], fontSize: 13, fontWeight: '700', marginBottom: 3 },
  emeraldText: { color: palette.emerald[700], fontSize: 12, lineHeight: 18 },
  label: { color: palette.slate[700], fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  zoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.slate[50],
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii.xl,
    padding: 14,
  },
  zoneIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.slate[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneInfo: { flex: 1 },
  zoneName: { color: palette.slate[900], fontSize: 14, fontWeight: '800' },
  zoneCaption: { color: palette.slate[500], fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginTop: 2 },
  zoneHint: { color: palette.slate[500], fontSize: 12, lineHeight: 18, marginTop: 8 },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[300],
    borderRadius: 11,
    paddingHorizontal: 12,
    height: 44,
    color: palette.slate[800],
    fontSize: 15,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[300],
    borderRadius: 11,
  },
  inputWrapError: { borderColor: palette.red[400] },
  inputIcon: { marginLeft: 12 },
  inputWithIcon: { flex: 1, paddingHorizontal: 10, height: 44, color: palette.slate[800], fontSize: 15 },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
  },
  timeCardActive: { borderColor: palette.slate[900], backgroundColor: palette.slate[50] },
  timeCardText: { color: palette.slate[600], fontSize: 12, fontWeight: '700' },
  timeCardTextActive: { color: palette.slate[900] },
  phoneErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  phoneErrorText: { color: palette.red[500], fontSize: 12, fontWeight: '600' },
  fieldHint: { color: palette.slate[400], fontSize: 10, marginTop: 6 },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.slate[50],
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii.xl,
    padding: 14,
    marginTop: 16,
  },
  priceInfo: { flex: 1 },
  priceLabel: { color: palette.slate[400], fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  priceZone: { color: palette.slate[500], fontSize: 11, marginTop: 2 },
  priceValue: { color: palette.slate[900], fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  priceUnavailable: {
    backgroundColor: palette.amber[50],
    borderWidth: 1,
    borderColor: palette.amber[200],
    borderRadius: radii.xl,
    padding: 14,
    marginTop: 16,
  },
  priceUnavailableText: { color: palette.amber[800], fontSize: 13, fontWeight: '700' },
  submitButton: {
    backgroundColor: palette.slate[900],
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    shadowColor: palette.slate[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },
  submitHint: { color: palette.slate[400], fontSize: 10, textAlign: 'center', marginTop: 10 },
  confirmation: { paddingVertical: 8, alignItems: 'center' },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.emerald[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: { color: palette.slate[900], fontSize: 20, fontWeight: '800' },
  successSubtitle: { color: palette.slate[500], fontSize: 13, marginTop: 3, marginBottom: 18 },
  summaryCard: {
    width: '100%',
    backgroundColor: palette.slate[50],
    borderRadius: radii.xl,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  summaryLabel: { color: palette.slate[400], fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  summaryValue: { color: palette.slate[900], fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' },
  summaryPrice: { color: palette.slate[900], fontSize: 18, fontWeight: '900', flex: 1, textAlign: 'right' },
  summaryDivider: { height: 1, backgroundColor: palette.slate[200] },
  payCard: {
    width: '100%',
    backgroundColor: palette.amber[50],
    borderWidth: 1,
    borderColor: palette.amber[100],
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 18,
  },
  payTitle: { color: palette.amber[900], fontSize: 13, fontWeight: '700' },
  paySubtitle: { color: palette.amber[700], fontSize: 12, marginTop: 3 },
  doneButton: {
    width: '100%',
    backgroundColor: palette.slate[900],
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  doneButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
});