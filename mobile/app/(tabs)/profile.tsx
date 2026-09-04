import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Phone, Mail, GraduationCap, Check, LogOut, Loader2, Lock, CheckCircle2, MapPin } from 'lucide-react-native';
import { apiFetch } from '../../lib/api/client';
import type { Campus, Profile, ProfileUpdate } from '../../lib/api/schema';
import { fetchCampuses } from '../../lib/api/campuses';
import { useSessionStore } from '../../stores/session';
import { useCampusStore } from '../../stores/campus';
import { useAuthActions } from '../../features/auth/use-auth';
import { palette, radii } from '../../lib/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, setUser } = useSessionStore();
  const { selectedCampusId, selectedCampusName, selectedCampusSlug, setSelectedCampus } = useCampusStore();
  const { signOut } = useAuthActions();
  const [profileDraft, setProfileDraft] = React.useState<{ fullName?: string; phone?: string }>({});

  const { data: profile } = useQuery<Profile>({
    queryKey: ['my-profile'],
    queryFn: () => apiFetch('/profiles/me'),
    enabled: isAuthenticated,
  });

  const fullName = profileDraft.fullName ?? profile?.full_name ?? user?.full_name ?? '';
  const phone = profileDraft.phone ?? profile?.phone ?? user?.phone ?? '';

  const { data: campuses, isLoading: loadingCampuses } = useQuery({
    queryKey: ['campuses'],
    queryFn: fetchCampuses,
  });

  const applyProfileToSession = (updated: Profile) => {
    if (!user) {
      return;
    }

    setUser({
      ...user,
      role: updated.role,
      email: updated.email ?? user.email,
      full_name: updated.full_name ?? undefined,
      phone: updated.phone ?? undefined,
      avatar_url: updated.avatar_url ?? undefined,
      home_campus_id: updated.home_campus_id ?? undefined,
      home_campus_name: updated.home_campus_name ?? undefined,
      home_campus_confirmed: updated.home_campus_confirmed,
    });
  };

  const profileMutation = useMutation({
    mutationFn: () => {
      const payload: ProfileUpdate = {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      };

      return apiFetch<Profile>('/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['my-profile'], updated);
      applyProfileToSession(updated);
      setProfileDraft({});
      Alert.alert('Profile updated', 'Your profile details have been saved.');
    },
  });

  const campusMutation = useMutation({
    mutationFn: (campus: Campus) =>
      apiFetch('/profiles/me/campus', {
        method: 'POST',
        body: JSON.stringify({ campus_id: campus.id, campus_name: campus.name }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['my-profile'], updated);
      applyProfileToSession(updated as Profile);
    },
    onError: () => {
      Alert.alert('Campus saved locally', 'Could not sync this campus to your account right now.');
    },
  });

  const handleSelectCampus = (campus: Campus) => {
    setSelectedCampus({ id: campus.id, name: campus.name, slug: campus.slug });

    if (isAuthenticated) {
      campusMutation.mutate(campus);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Leave Rumia?', 'You will need to sign in again to access your saved hostels and tour bookings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          Alert.alert('Signed out', 'You have been signed out successfully.');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Account Profile</Text>
      <Text style={styles.subtitle}>Manage your details and home university.</Text>

      {/* User Info Card */}
      <View style={styles.cardRow}>
        <View style={styles.avatar}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <User size={26} color={palette.slate[500]} />
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{profile?.full_name || user?.email?.split('@')[0] || 'Guest Student'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'Not signed in'}</Text>
          {profile?.role ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{profile.role.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Profile Details */}
      {isAuthenticated ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <Text style={styles.cardSubtitle}>Update your contact details for hostel tour bookings.</Text>

          <Text style={styles.inputLabel}>Full Name</Text>
          <View style={styles.inputWrap}>
            <User size={16} color={palette.slate[400]} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={(value) => setProfileDraft((current) => ({ ...current, fullName: value }))}
              placeholder="John Doe"
              placeholderTextColor={palette.slate[400]}
            />
          </View>

          <Text style={styles.inputLabel}>Phone Number</Text>
          <View style={styles.inputWrap}>
            <Phone size={16} color={palette.slate[400]} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(value) => setProfileDraft((current) => ({ ...current, phone: value }))}
              placeholder="0712 345 678"
              placeholderTextColor={palette.slate[400]}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={[styles.inputWrap, styles.inputWrapDisabled]}>
            <Mail size={16} color={palette.slate[400]} style={styles.inputIcon} />
            <Text style={[styles.input, styles.inputDisabled]}>{user?.email}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.saveButton, (pressed || profileMutation.isPending) && styles.buttonDisabled]}
            onPress={() => profileMutation.mutate()}
            disabled={profileMutation.isPending}
          >
            {profileMutation.isPending ? (
              <Loader2 size={16} color={palette.white} />
            ) : (
              <Check size={16} color={palette.emerald[400]} />
            )}
            <Text style={styles.saveButtonText}>
              {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <Text style={styles.cardSubtitle}>Sign in to update your profile, save hostels and book tours.</Text>
          <Pressable
            style={({ pressed }) => [styles.signInButton, pressed && styles.buttonDisabled]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Lock size={16} color={palette.white} />
            <Text style={styles.signInText}>Sign In / Register</Text>
          </Pressable>
        </View>
      )}

      {/* Home Campus */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Home Campus</Text>
        <Text style={styles.cardSubtitle}>Your home university, used to tailor listings and tours.</Text>

        {loadingCampuses ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.emerald[600]} />
          </View>
        ) : campuses?.length ? (
          campuses.map((campus) => {
            const selected = campus.id === selectedCampusId || campus.slug === selectedCampusSlug;

            return (
              <Pressable key={campus.id} style={styles.settingRow} onPress={() => handleSelectCampus(campus)}>
                <View style={styles.rowLeft}>
                  {selected ? (
                    <CheckCircle2 size={20} color={palette.emerald[600]} />
                  ) : (
                    <GraduationCap size={20} color={palette.slate[400]} />
                  )}
                  <View>
                    <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{campus.name}</Text>
                    <View style={styles.rowMetaRow}>
                      <MapPin size={12} color={palette.slate[400]} />
                      <Text style={styles.rowMeta}>{campus.city}</Text>
                    </View>
                  </View>
                </View>
                {selected ? <Check size={16} color={palette.emerald[600]} /> : null}
              </Pressable>
            );
          })
        ) : (
          <View style={styles.settingRow}>
            <GraduationCap size={20} color={palette.slate[400]} />
            <Text style={styles.rowLabel}>{selectedCampusName}</Text>
          </View>
        )}
      </View>

      {/* Account Session */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Session</Text>
        <Text style={styles.cardSubtitle}>
          {isAuthenticated ? 'Sign out of your account on this device.' : 'Sign in to access your account.'}
        </Text>
        {isAuthenticated ? (
          <Pressable
            style={({ pressed }) => [styles.signOutButton, pressed && styles.buttonDisabled]}
            onPress={handleSignOut}
          >
            <LogOut size={16} color={palette.red[600]} />
            <Text style={styles.signOutText}>Log Out of Rumia</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.signInButton, pressed && styles.buttonDisabled]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Lock size={16} color={palette.white} />
            <Text style={styles.signInText}>Sign In / Register</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.white },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  title: { fontSize: 22, fontWeight: '800', color: palette.slate[900] },
  subtitle: { fontSize: 13, color: palette.slate[500], marginTop: 2 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii['2xl'],
    padding: 16,
    marginTop: 6,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.slate[100],
    borderWidth: 1,
    borderColor: palette.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  userInfo: { flex: 1 },
  userName: { color: palette.slate[900], fontSize: 17, fontWeight: '700' },
  userEmail: { color: palette.slate[500], fontSize: 13, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[200],
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginTop: 6,
  },
  roleText: { color: palette.emerald[700], fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  card: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii['2xl'],
    padding: 18,
  },
  cardTitle: { color: palette.slate[900], fontSize: 14, fontWeight: '700' },
  cardSubtitle: { color: palette.slate[500], fontSize: 12, marginTop: 3, marginBottom: 14 },
  inputLabel: {
    color: palette.slate[700],
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii.xl,
    backgroundColor: palette.white,
    paddingHorizontal: 12,
  },
  inputWrapDisabled: {
    backgroundColor: palette.slate[50],
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 11, color: palette.slate[900], fontSize: 14 },
  inputDisabled: { color: palette.slate[500] },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.slate[900],
    borderRadius: radii.xl,
    paddingVertical: 13,
    marginTop: 20,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
  },
  saveButtonText: { color: palette.white, fontWeight: '600', fontSize: 13 },
  buttonDisabled: { opacity: 0.6 },
  loadingRow: { alignItems: 'center', paddingVertical: 8 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 8,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { color: palette.slate[700], fontSize: 14, fontWeight: '600' },
  rowLabelSelected: { color: palette.slate[900] },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rowMeta: { color: palette.slate[500], fontSize: 12 },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.red[50],
    borderWidth: 1,
    borderColor: palette.red[200],
    borderRadius: radii.xl,
    paddingVertical: 13,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  signOutText: { color: palette.red[600], fontWeight: '600', fontSize: 13 },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.slate[900],
    borderRadius: radii.xl,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  signInText: { color: palette.white, fontWeight: '600', fontSize: 13 },
});