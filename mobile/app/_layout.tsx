import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import type { Session } from '@supabase/supabase-js';
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
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="listing/[slug]" options={{ headerShown: false }} />
              <Stack.Screen name="notifications" options={{ headerShown: false }} />
            </Stack>
          </QueryClientProvider>
        </AnalyticsProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default wrapWithSentry(RootLayout);
