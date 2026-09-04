import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Mail, KeyRound, Loader2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase/client';
import { AuthFlowCancelledError, signInWithGoogle } from '../../features/auth/oauth';
import { useSessionHydration } from '../../features/auth/use-auth';
import { palette, radii } from '../../lib/theme';

function useRedirectAfterAuth() {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };
}

export default function LoginScreen() {
  const router = useRouter();
  const redirectAfterAuth = useRedirectAfterAuth();
  const hydrateSession = useSessionHydration();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign In Failed', error.message);
      return;
    }

    if (data.session) {
      await hydrateSession(data.session);
      redirectAfterAuth();
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const session = await signInWithGoogle();
      await hydrateSession(session);
      redirectAfterAuth();
    } catch (error) {
      if (!(error instanceof AuthFlowCancelledError)) {
        Alert.alert('Google Sign In Failed', error instanceof Error ? error.message : 'Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={() => router.back()}>
        <ChevronLeft size={20} color={palette.slate[700]} />
      </Pressable>

      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Welcome back, or create an account to get started.</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color={palette.slate[600]} />
          ) : (
            <View style={styles.googleLogo}>
              <Text style={styles.googleLogoText}>G</Text>
            </View>
          )}
          <Text style={styles.googleButtonText}>
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrap}>
          <Mail size={16} color={palette.slate[400]} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={palette.slate[400]}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWrap}>
          <KeyRound size={16} color={palette.slate[400]} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor={palette.slate[400]}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, (pressed || loading) && styles.pressed]}
          onPress={handleEmailSignIn}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={18} color={palette.white} />
              <Text style={styles.buttonText}>Signing in...</Text>
            </>
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <Text style={styles.footnote}>
          New here? Sign up with Google. Already have an account? Sign in with email above.
        </Text>
        <Text style={styles.footnote}>Agents and administrators use email sign-in.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.slate[50] },
  content: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 12,
    left: 20,
    zIndex: 1,
  },
  pressed: { opacity: 0.6 },
  card: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate[100],
    borderRadius: radii['3xl'],
    padding: 28,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 8,
  },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '900', color: palette.slate[900], letterSpacing: -0.6 },
  subtitle: { color: palette.slate[500], fontSize: 13, marginTop: 8, textAlign: 'center' },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: palette.slate[200],
    borderRadius: radii.xl,
    paddingVertical: 14,
  },
  googleLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate[300],
  },
  googleLogoText: { color: '#4285F4', fontWeight: '800', fontSize: 12 },
  googleButtonText: { color: palette.slate[800], fontWeight: '600', fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: palette.slate[200] },
  dividerText: { color: palette.slate[400], fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  label: { color: palette.slate[700], fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.slate[50],
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii.xl,
    paddingHorizontal: 13,
    marginBottom: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 13, color: palette.slate[900], fontSize: 14 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.emerald[600],
    borderRadius: radii.xl,
    paddingVertical: 15,
    marginTop: 4,
  },
  buttonText: { color: palette.white, fontWeight: '700', fontSize: 15 },
  footnote: { color: palette.slate[400], fontSize: 11, textAlign: 'center', marginTop: 14 },
});