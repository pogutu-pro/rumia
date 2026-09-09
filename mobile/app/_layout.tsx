import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StyleSheet, View, useColorScheme } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase/client';
import { ApiError } from '../lib/api/client';
import { AnalyticsProvider } from '../lib/posthog';
import { initSentry, wrapWithSentry } from '../lib/sentry';
import { ErrorBoundary } from '../lib/error-boundary';
import { useSessionHydration } from '../features/auth/use-auth';
import { usePushNotificationRegistration } from '../features/notifications/use-push-notifications';
import { getThemeColors } from '../lib/theme';

initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 5,
    },
  },
});

/**
 * On web, render the app inside a centred phone-width frame so expo web
 * previews like a mobile app instead of a full-bleed desktop web page.
 * Native builds render children directly.
 */
function AppFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }
  return (
    <View style={styles.webStage}>
      <View style={styles.webPhone}>{children}</View>
    </View>
  );
}

function RootLayout() {
  const hydrateSession = useSessionHydration();
  usePushNotificationRegistration();
  const scheme = useColorScheme();
  const colors = getThemeColors(scheme);

  useEffect(() => {
    let active = true;

    const syncSession = async (session: Session | null) => {
      if (active) {
        await hydrateSession(session);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [hydrateSession]);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AnalyticsProvider>
          <QueryClientProvider client={queryClient}>
            <AppFrame>
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="listing/[slug]" options={{ headerShown: false }} />
                <Stack.Screen name="notifications" options={{ headerShown: false }} />
              </Stack>
            </AppFrame>
          </QueryClientProvider>
        </AnalyticsProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webStage: {
    flex: 1,
    backgroundColor: getThemeColors('light').surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webPhone: {
    width: '100%',
    maxWidth: 430,
    height: '100%',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: getThemeColors('light').border,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 40,
  },
});

export default wrapWithSentry(RootLayout);
