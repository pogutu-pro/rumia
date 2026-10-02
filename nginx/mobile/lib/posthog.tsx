import type { ReactNode } from 'react';
import { PostHogProvider } from 'posthog-react-native';

const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  if (!posthogApiKey) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      apiKey={posthogApiKey}
      options={{ host: posthogHost }}
      autocapture={{
        captureScreens: true,
        captureTouches: false,
      }}
    >
      {children}
    </PostHogProvider>
  );
}
