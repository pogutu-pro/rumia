import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone, MapPin, Send, Loader2, CheckCircle2, Clock, X, Pencil, Check, CreditCard, Lock } from 'lucide-react-native';
import { useSessionStore } from '../../stores/session';
import {
  BUDGET_OPTIONS,
  FURNISHING_OPTIONS,
  GENDER_OPTIONS,
  ROOM_TYPE_OPTIONS,
  STAY_PREFERENCE_OPTIONS,
  budgetLabel,
  furnishingLabel,
  genderLabel,
  roomTypeLabel,
  stayPreferenceLabel,
} from './constants';
import type { HostelRequest, HostelRequestInput } from './types';
import {
  cancelHostelRequest,
  createHostelRequest,
  deleteHostelRequest,
  fetchHostelRequestFormConfig,
  fetchMyHostelRequests,
  hostelConfigKey,
  hostelRequestsKey,
  updateHostelRequest,
} from './queries';
import { hostelRequestStatusLabel } from './types';
import { formatDateInput, isValidDate } from '../../lib/tour-helpers';
import { formatLongDate } from '../../lib/format';
import { timeAgo } from '../../lib/time';
import { EmptyState, Skeleton } from '../../lib/components/ui';
import { palette, radii } from '../../lib/theme';

const NONE = '__none__';

interface ChipButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  wide?: boolean;
}

function ChipButton({ label, selected, onPress, wide }: ChipButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        wide && styles.chipWide,
        selected ? styles.chipSelected : styles.chipUnselected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {children}
      {required ? <Text style={styles.requiredMark}> *</Text> : null}
    </Text>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export function FindMeAHostelScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);

  const [phone, setPhone] = useState('');
  const [zoneId, setZoneId] = useState(NONE);
  const [budget, setBudget] = useState('');
  const [gender, setGender] = useState('no_preference');
  const [roomType, setRoomType] = useState('no_preference');
  const [stayPreference, setStayPreference] = useState('no_preference');
  const [furnishing, setFurnishing] = useState('no_preference');
  const [moveInDate, setMoveInDate] = useState('');
  const [requirements, setRequirements] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Fee acceptance modal
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeAccepted, setFeeAccepted] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<HostelRequest | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editZoneId, setEditZoneId] = useState(NONE);
  const [editBudget, setEditBudget] = useState('');
  const [editGender, setEditGender] = useState('no_preference');
  const [editRoomType, setEditRoomType] = useState('no_preference');
  const [editStayPreference, setEditStayPreference] = useState('no_preference');
  const [editFurnishing, setEditFurnishing] = useState('no_preference');
  const [editMoveInDate, setEditMoveInDate] = useState('');
  const [editRequirements, setEditRequirements] = useState('');

  const { data: requests, isLoading } = useQuery({
    queryKey: hostelRequestsKey,
    queryFn: fetchMyHostelRequests,
    enabled: isAuthenticated,
  });

  const { data: config } = useQuery({
    queryKey: hostelConfigKey,
    queryFn: fetchHostelRequestFormConfig,
    enabled: isAuthenticated,
  });

  const fee = config?.fee ?? 100;
  const hasCampus = config?.has_campus ?? false;
  const zones = config?.zones ?? [];

  useEffect(() => {
    if (editing) {
      setEditPhone(editing.phone);
      setEditZoneId(editing.preferred_zone ?? NONE);
      setEditBudget(editing.budget_range);
      setEditGender(editing.gender);
      setEditRoomType(editing.room_type);
      setEditStayPreference(editing.stay_preference);
      setEditFurnishing(editing.furnishing);
      setEditMoveInDate(editing.move_in_date ?? '');
      setEditRequirements(editing.additional_requirements ?? '');
    }
  }, [editing]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: hostelRequestsKey });
  };

  const createMutation = useMutation({
    mutationFn: (input: HostelRequestInput) => createHostelRequest(input),
    onSuccess: () => {
      invalidate();
      setJustSubmitted(true);
      setBudget('');
      setGender('no_preference');
      setRoomType('no_preference');
      setStayPreference('no_preference');
      setFurnishing('no_preference');
      setMoveInDate('');
      setRequirements('');
      setShowFeeModal(false);
    },
    onError: (error: Error) => {
      Alert.alert('Submission failed', error.message || 'Please try again.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: HostelRequestInput }) => updateHostelRequest(id, input),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: (error: Error) => {
      Alert.alert('Update failed', error.message || 'Please try again.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelHostelRequest(id),
    onSuccess: () => invalidate(),
    onError: (error: Error) => {
      Alert.alert('Cancel failed', error.message || 'Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteHostelRequest(id),
    onSuccess: () => invalidate(),
    onError: (error: Error) => {
      Alert.alert('Delete failed', error.message || 'Please try again.');
    },
  });

  const canSubmit = phone.replace(/\D/g, '').length >= 9 && !!budget && hasCampus;
  const isValidMoveInDate = !moveInDate || isValidDate(moveInDate);

  const buildInput = (): HostelRequestInput => ({
    phone: phone.trim(),
    preferred_zone: zoneId === NONE ? null : zoneId,
    budget_range: budget,
    gender,
    room_type: roomType,
    furnishing,
    stay_preference: stayPreference,
    move_in_date: moveInDate || null,
    additional_requirements: requirements.trim() || null,
  });

  const handleSubmit = () => {
    if (!canSubmit || createMutation.isPending) return;
    if (!isValidMoveInDate) {
      Alert.alert('Invalid date', 'Please enter a valid move-in date.');
      return;
    }
    setFeeAccepted(false);
    setShowFeeModal(true);
  };

  const handleAcceptSubmit = () => {
    createMutation.mutate(buildInput());
  };

  const handleCancelRequest = (request: HostelRequest) => {
    Alert.alert('Cancel request?', 'This request can no longer be edited once cancelled.', [
      { text: 'Keep request', style: 'cancel' },
      { text: 'Cancel Request', style: 'destructive', onPress: () => cancelMutation.mutate(request.id) },
    ]);
  };

  const handleDeleteRequest = (request: HostelRequest) => {
    Alert.alert('Remove request?', 'Remove this cancelled request from your dashboard?', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(request.id) },
    ]);
  };

  const editCanSave =
    editing != null &&
    editPhone.replace(/\D/g, '').length >= 9 &&
    !!editBudget &&
    updateMutation.isPending === false;

  const handleSaveEdit = () => {
    if (!editing || !editCanSave) return;
    updateMutation.mutate({
      id: editing.id,
      input: {
        phone: editPhone.trim(),
        preferred_zone: editZoneId === NONE ? null : editZoneId,
        budget_range: editBudget,
        gender: editGender,
        room_type: editRoomType,
        furnishing: editFurnishing,
        stay_preference: editStayPreference,
        move_in_date: editMoveInDate || null,
        additional_requirements: editRequirements.trim() || null,
      },
    });
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.center, { paddingTop: 12 }]}>
        <EmptyState
          icon={<Lock size={26} color={palette.slate[400]} />}
          title="Sign in to use Find Me a Hostel"
          subtitle="Tell us what you're looking for and Rumia will find it for you."
          actionLabel="Sign In"
          onAction={() => router.push('/(auth)/login')}
        />
      </View>
    );
  }

  const feeModal = (
    <Modal
      visible={showFeeModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFeeModal(false)}
    >
      <View style={styles.modalRoot}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <View style={styles.amberIcon}>
                <CreditCard size={22} color={palette.amber[700]} />
              </View>
              <View>
                <Text style={styles.sheetTitle}>Accept Service Fee</Text>
                <Text style={styles.sheetSubtitle}>You need to accept the fee before submitting</Text>
              </View>
            </View>
            <Pressable onPress={() => setShowFeeModal(false)} hitSlop={8} style={styles.closeIcon}>
              <X size={18} color={palette.slate[400]} />
            </Pressable>
          </View>

          <View style={styles.feeBox}>
            <View style={styles.feeRow}>
              <Text style={styles.feeRowLabel}>Service fee</Text>
              <Text style={styles.feeRowValue}>KSh {fee.toLocaleString()}</Text>
            </View>
            <View style={styles.feeDivider} />
            <View style={styles.feeRow}>
              <Text style={styles.feeAmountLabel}>Amount to pay now (50%)</Text>
              <Text style={styles.feeAmountValue}>KSh {Math.ceil(fee / 2).toLocaleString()}</Text>
            </View>
          </View>

          <Text style={styles.feeNote}>
            A Rumia manager will contact you on WhatsApp with payment details after you submit.
          </Text>

          <Pressable style={styles.agreeRow} onPress={() => setFeeAccepted((v) => !v)}>
            <View style={[styles.checkbox, feeAccepted && styles.checkboxChecked]}>
              {feeAccepted && <Check size={14} color={palette.white} />}
            </View>
            <Text style={styles.agreeText}>
              I agree to pay half of the service fee (KSh {Math.ceil(fee / 2).toLocaleString()}) to confirm this request.
            </Text>
          </Pressable>

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setShowFeeModal(false)} disabled={createMutation.isPending}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, (!feeAccepted || createMutation.isPending) && styles.buttonDisabled, pressed && styles.pressed]}
              onPress={handleAcceptSubmit}
              disabled={!feeAccepted || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 size={16} color={palette.white} />
              ) : (
                <Send size={16} color={palette.white} />
              )}
              <Text style={styles.primaryButtonText}>
                {createMutation.isPending ? 'Submitting…' : 'Accept & Submit'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  const editModal = (
    <Modal
      visible={editing != null}
      transparent
      animationType="slide"
      onRequestClose={() => setEditing(null)}
    >
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <Text style={styles.sheetTitle}>Edit Request</Text>
              <Text style={styles.sheetSubtitle}>A manager will see the change instantly.</Text>
            </View>
            <Pressable onPress={() => setEditing(null)} hitSlop={8} style={styles.closeIcon}>
              <X size={18} color={palette.slate[400]} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.editFields} keyboardShouldPersistTaps="handled">
            <FieldLabel required>Phone number</FieldLabel>
            <View style={styles.inputWrap}>
              <Phone size={16} color={palette.slate[400]} style={styles.inputIcon} />
              <TextInput
                style={styles.inputInsideWrap}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="e.g. 0712 345 678"
                placeholderTextColor={palette.slate[400]}
                keyboardType="phone-pad"
              />
            </View>

            <FieldLabel>Preferred area / zone</FieldLabel>
            <View style={styles.chipRow}>
              <ChipButton label="Any area" selected={editZoneId === NONE} onPress={() => setEditZoneId(NONE)} />
              {zones.map((zone) => (
                <ChipButton key={zone.id} label={zone.name} selected={editZoneId === zone.name} onPress={() => setEditZoneId(zone.name)} />
              ))}
            </View>

            <FieldLabel required>Monthly budget</FieldLabel>
            <View style={styles.chipGrid}>
              {BUDGET_OPTIONS.map((option) => (
                <ChipButton key={option.value} wide label={option.label} selected={editBudget === option.value} onPress={() => setEditBudget(option.value)} />
              ))}
            </View>

            <FieldLabel>Gender</FieldLabel>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((option) => (
                <ChipButton key={option.value} label={option.label} selected={editGender === option.value} onPress={() => setEditGender(option.value)} />
              ))}
            </View>

            <FieldLabel>Room type</FieldLabel>
            <View style={styles.chipRow}>
              {ROOM_TYPE_OPTIONS.map((option) => (
                <ChipButton key={option.value} label={option.label} selected={editRoomType === option.value} onPress={() => setEditRoomType(option.value)} />
              ))}
            </View>

            <FieldLabel>Stay alone or sharing</FieldLabel>
            <View style={styles.chipRow}>
              {STAY_PREFERENCE_OPTIONS.map((option) => (
                <ChipButton key={option.value} label={option.label} selected={editStayPreference === option.value} onPress={() => setEditStayPreference(option.value)} />
              ))}
            </View>

            <FieldLabel>Furnishing</FieldLabel>
            <View style={styles.chipRow}>
              {FURNISHING_OPTIONS.map((option) => (
                <ChipButton key={option.value} label={option.label} selected={editFurnishing === option.value} onPress={() => setEditFurnishing(option.value)} />
              ))}
            </View>

            <FieldLabel>Move-in date</FieldLabel>
            <TextInput
              style={styles.input}
              value={editMoveInDate}
              onChangeText={(v) => setEditMoveInDate(formatDateInput(v))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.slate[400]}
              keyboardType="numbers-and-punctuation"
            />

            <FieldLabel>Important requirements</FieldLabel>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={editRequirements}
              onChangeText={setEditRequirements}
              placeholder="Hot water, parking, wifi…"
              placeholderTextColor={palette.slate[400]}
              multiline
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setEditing(null)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, !editCanSave && styles.buttonDisabled, pressed && styles.pressed]}
              onPress={handleSaveEdit}
              disabled={!editCanSave}
            >
              {updateMutation.isPending ? <Loader2 size={16} color={palette.white} /> : <Check size={16} color={palette.white} />}
              <Text style={styles.primaryButtonText}>{updateMutation.isPending ? 'Saving…' : 'Save Changes'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 12 }]}>
        <Text style={styles.subtitle}>
          Tell us what you&apos;re looking for and Rumia will find it for you. A manager reviews your request and contacts you on WhatsApp.
        </Text>

        {justSubmitted && (
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <CheckCircle2 size={20} color={palette.emerald[600]} />
              <Text style={styles.successTitle}>Request Submitted · Waiting</Text>
            </View>
            <Text style={styles.successText}>
              Your hostel request has been received. A Rumia manager will review your requirements and contact you to help find a suitable hostel.
            </Text>
          </View>
        )}

        {!hasCampus && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              Set your campus in Account Profile to pick preferred areas and submit a request.
            </Text>
          </View>
        )}

        {!justSubmitted && (
          <View style={styles.formCard}>
            <FieldLabel required>Phone number</FieldLabel>
            <View style={styles.inputWrap}>
              <Phone size={16} color={palette.slate[400]} style={styles.inputIcon} />
              <TextInput
                style={styles.inputInsideWrap}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 0712 345 678"
                placeholderTextColor={palette.slate[400]}
                keyboardType="phone-pad"
              />
            </View>
            <Text style={styles.fieldHint}>
              We use this to share your request with a campus manager.
            </Text>

            <FieldLabel>Preferred area / zone</FieldLabel>
            <View style={styles.chipRow}>
              <ChipButton label="Any area" selected={zoneId === NONE} onPress={() => setZoneId(NONE)} />
              {zones.map((zone) => (
                <ChipButton key={zone.id} label={zone.name} selected={zoneId === zone.name} onPress={() => setZoneId(zone.name)} />
              ))}
            </View>

            <FieldLabel required>Monthly budget</FieldLabel>
            <View style={styles.chipGrid}>
              {BUDGET_OPTIONS.map((option) => (
                <ChipButton key={option.value} wide label={option.label} selected={budget === option.value} onPress={() => setBudget(option.value)} />
              ))}
            </View>

            <FieldLabel>Gender</FieldLabel>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((option) => (
                <ChipButton key={option.value} label={option.label} selected={gender === option.value} onPress={() => setGender(option.value)} />
              ))}
            </View>

            <FieldLabel>Room type</FieldLabel>
            <View style={styles.chipRow}>
              {ROOM_TYPE_OPTIONS.map((option) => (
                <ChipButton key={option.value} label={option.label} selected={roomType === option.value} onPress={() => setRoomType(option.value)} />
              ))}
            </View>
            <Text style={styles.fieldHint}>
              Single room is a room without self-contained facilities; bedsitter is self-contained; one bedroom is a separate bedroom.
            </Text>

            <FieldLabel>Stay alone or sharing</FieldLabel>
            <View style={styles.chipRow}>
              {STAY_PREFERENCE_OPTIONS.map((option) => (
                <ChipButton key={option.value} label={option.label} selected={stayPreference === option.value} onPress={() => setStayPreference(option.value)} />
              ))}
            </View>
            <Text style={styles.fieldHint}>
              Let the manager know if you want the room to yourself or you&apos;re happy sharing.
            </Text>

            <FieldLabel>Furnishing</FieldLabel>
            <View style={styles.chipRow}>
              {FURNISHING_OPTIONS.map((option) => (
                <ChipButton key={option.value} label={option.label} selected={furnishing === option.value} onPress={() => setFurnishing(option.value)} />
              ))}
            </View>

            <FieldLabel>Move-in date</FieldLabel>
            <TextInput
              style={styles.input}
              value={moveInDate}
              onChangeText={(v) => setMoveInDate(formatDateInput(v))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.slate[400]}
              keyboardType="numbers-and-punctuation"
            />

            <FieldLabel>Important requirements</FieldLabel>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={requirements}
              onChangeText={setRequirements}
              placeholder="Anything else you need? e.g. Hot water, parking, wifi…"
              placeholderTextColor={palette.slate[400]}
              multiline
            />

            <Pressable
              style={({ pressed }) => [styles.submitButton, (!canSubmit || createMutation.isPending) && styles.buttonDisabled, pressed && styles.pressed]}
              onPress={handleSubmit}
              disabled={!canSubmit || createMutation.isPending}
            >
              <Send size={16} color={palette.white} />
              <Text style={styles.submitButtonText}>Find My Hostel</Text>
            </Pressable>
            {!canSubmit && (
              <Text style={styles.hintText}>Add your phone number and pick a budget to submit.</Text>
            )}
          </View>
        )}

        {/* Your Requests */}
        <Text style={styles.sectionTitle}>Your Requests</Text>
        {isLoading ? (
          <View style={styles.requestsList}>
            <Skeleton style={styles.requestSkeleton} />
            <Skeleton style={styles.requestSkeleton} />
          </View>
        ) : !requests?.length ? (
          <View style={styles.emptyRequests}>
            <MapPin size={20} color={palette.slate[400]} />
            <Text style={styles.emptyRequestsText}>
              No requests yet. Submit the form above and we&apos;ll take it from here.
            </Text>
          </View>
        ) : (
          <View style={styles.requestsList}>
            {requests.map((request) => {
              const cancelled = request.status === 'cancelled';
              const active = request.status === 'waiting' || request.status === 'contacted';
              return (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.requestHeaderLeft}>
                      <View style={[styles.statusIcon, cancelled && styles.statusIconCancelled]}>
                        {cancelled ? (
                          <X size={16} color={palette.rose[600]} />
                        ) : (
                          <CheckCircle2 size={16} color={palette.emerald[600]} />
                        )}
                      </View>
                      <View>
                        <Text style={styles.requestStatus}>{hostelRequestStatusLabel(request.status)}</Text>
                        <Text style={styles.requestDate}>{timeAgo(request.created_at)}</Text>
                      </View>
                    </View>
                    <View style={[styles.badge, cancelled && styles.badgeCancelled]}>
                      <Clock size={12} color={cancelled ? palette.rose[600] : palette.slate[600]} />
                      <Text style={[styles.badgeText, cancelled && styles.badgeTextCancelled]}>
                        {hostelRequestStatusLabel(request.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.summaryBox}>
                    <SummaryRow label="Area" value={`${request.preferred_zone || 'Any area'} • ${config?.campus_name || 'campus'}`} />
                    <SummaryRow label="Budget" value={`${budgetLabel(request.budget_range)}/month`} />
                    <SummaryRow label="Gender" value={genderLabel(request.gender)} />
                    <SummaryRow label="Room type" value={roomTypeLabel(request.room_type)} />
                    <SummaryRow label="Stay alone / sharing" value={stayPreferenceLabel(request.stay_preference)} />
                    <SummaryRow label="Furnishing" value={furnishingLabel(request.furnishing)} />
                    <SummaryRow
                      label="Move-in"
                      value={request.move_in_date ? formatLongDate(request.move_in_date) : 'Flexible'}
                    />
                    {request.additional_requirements?.trim() ? (
                      <SummaryRow label="Requirements" value={request.additional_requirements} />
                    ) : null}
                    <SummaryRow label="Service fee" value={`KSh ${Number(request.fee).toLocaleString()}`} />
                  </View>

                  {active ? (
                    <View style={styles.requestActions}>
                      <Pressable style={styles.editButton} onPress={() => setEditing(request)}>
                        <Pencil size={14} color={palette.slate[700]} />
                        <Text style={styles.editButtonText}>Edit request</Text>
                      </Pressable>
                      <Pressable onPress={() => handleCancelRequest(request)} hitSlop={8}>
                        <Text style={styles.cancelButtonText}>Cancel request</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {cancelled ? (
                    <View style={styles.requestActions}>
                      <Text style={styles.cancelledHint}>You can remove this request to keep your dashboard tidy.</Text>
                      {deleteMutation.isPending ? (
                        <ActivityIndicator size="small" color={palette.slate[400]} />
                      ) : (
                        <Pressable onPress={() => handleDeleteRequest(request)} hitSlop={8}>
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        </Pressable>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {feeModal}
      {editModal}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.white },
  center: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  subtitle: { fontSize: 13, color: palette.slate[500], marginTop: 4, marginBottom: 16, lineHeight: 19 },
  successCard: {
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[200],
    borderRadius: radii['2xl'],
    padding: 16,
    marginBottom: 16,
  },
  successHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  successTitle: { color: palette.emerald[900], fontSize: 14, fontWeight: '700' },
  successText: { color: palette.emerald[800], fontSize: 12, lineHeight: 18 },
  warningCard: {
    backgroundColor: palette.amber[50],
    borderWidth: 1,
    borderColor: palette.amber[200],
    borderRadius: radii.xl,
    padding: 12,
    marginBottom: 16,
  },
  warningText: { color: palette.amber[800], fontSize: 12, lineHeight: 18 },
  formCard: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii['2xl'],
    padding: 16,
    marginBottom: 24,
  },
  fieldLabel: {
    color: palette.slate[500],
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 8,
  },
  requiredMark: { color: palette.rose[400] },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.slate[300],
    borderRadius: radii.xl,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: palette.slate[900],
    fontSize: 14,
    borderWidth: 1,
    borderColor: palette.slate[300],
    borderRadius: radii.xl,
    paddingHorizontal: 12,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  inputInsideWrap: {
    flex: 1,
    paddingVertical: 12,
    color: palette.slate[900],
    fontSize: 14,
  },
  fieldHint: { color: palette.slate[400], fontSize: 11, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  chipWide: { minWidth: 150, alignItems: 'center' },
  chipSelected: { backgroundColor: palette.slate[900], borderColor: palette.slate[900] },
  chipUnselected: { backgroundColor: palette.white, borderColor: palette.slate[200] },
  chipText: { fontSize: 12, fontWeight: '700' },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.slate[900],
    borderRadius: radii.xl,
    paddingVertical: 15,
    marginTop: 20,
  },
  submitButtonText: { color: palette.white, fontSize: 15, fontWeight: '700' },
  hintText: { color: palette.slate[400], fontSize: 11, textAlign: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.slate[900], marginBottom: 12, marginTop: 4 },
  requestsList: { gap: 12 },
  requestSkeleton: { height: 200, borderRadius: radii['2xl'] },
  emptyRequests: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.slate[200],
    backgroundColor: palette.slate[50],
    borderRadius: radii['2xl'],
    padding: 24,
    alignItems: 'center',
  },
  emptyRequestsText: { color: palette.slate[500], fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 18 },
  requestCard: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii['2xl'],
    padding: 14,
  },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  requestHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: palette.emerald[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconCancelled: { backgroundColor: palette.rose[50] },
  requestStatus: { color: palette.slate[900], fontSize: 14, fontWeight: '700' },
  requestDate: { color: palette.slate[500], fontSize: 11, marginTop: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: palette.slate[50],
  },
  badgeCancelled: { borderColor: palette.rose[400], backgroundColor: palette.rose[50] },
  badgeText: { color: palette.slate[700], fontSize: 10, fontWeight: '700' },
  badgeTextCancelled: { color: palette.rose[600] },
  summaryBox: {
    backgroundColor: palette.slate[50],
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.slate[100],
  },
  summaryLabel: { color: palette.slate[500], fontSize: 12 },
  summaryValue: { color: palette.slate[900], fontSize: 12, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
  },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.slate[100], paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.lg },
  editButtonText: { color: palette.slate[700], fontSize: 12, fontWeight: '700' },
  cancelButtonText: { color: palette.rose[600], fontSize: 12, fontWeight: '700' },
  cancelledHint: { color: palette.slate[400], fontSize: 11, flex: 1 },
  deleteButtonText: { color: palette.slate[500], fontSize: 12, fontWeight: '700' },

  // Modals
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '92%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amberIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.amber[50], alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: palette.slate[900] },
  sheetSubtitle: { color: palette.slate[500], fontSize: 12, marginTop: 2 },
  closeIcon: { padding: 4 },
  feeBox: { backgroundColor: palette.slate[50], borderRadius: radii.xl, padding: 16 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeRowLabel: { color: palette.slate[600], fontSize: 14 },
  feeRowValue: { color: palette.slate[900], fontSize: 14, fontWeight: '700' },
  feeDivider: { height: 1, backgroundColor: palette.slate[200], marginVertical: 12 },
  feeAmountLabel: { color: palette.slate[900], fontSize: 14, fontWeight: '600' },
  feeAmountValue: { color: palette.slate[900], fontSize: 20, fontWeight: '800' },
  feeNote: { color: palette.slate[500], fontSize: 12, lineHeight: 18, marginTop: 12 },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: palette.slate[300],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
  },
  checkboxChecked: { backgroundColor: palette.slate[900], borderColor: palette.slate[900] },
  agreeText: { color: palette.slate[700], fontSize: 13, lineHeight: 18, flex: 1 },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate[300],
    borderRadius: radii.xl,
    paddingVertical: 13,
  },
  secondaryButtonText: { color: palette.slate[700], fontSize: 14, fontWeight: '700' },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.slate[900],
    borderRadius: radii.xl,
    paddingVertical: 13,
  },
  primaryButtonText: { color: palette.white, fontSize: 14, fontWeight: '700' },
  editFields: { paddingBottom: 8 },
});