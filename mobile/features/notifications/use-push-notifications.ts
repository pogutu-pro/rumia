import { useEffect } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiFetch } from '../../lib/api/client';
import { useSessionStore } from '../../stores/session';

const isExpoGo = Constants?.executionEnvironment === 'storeClient';

/**
 * expo-notifications throws at module evaluation time in Expo Go (SDK 53+).
 * Use a lazy conditional require so the import is skipped entirely in Expo Go.
 */
function loadNotifications() {
  if (isExpoGo) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }
}

const Notifications = loadNotifications();

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

let currentExpoPushToken: string | null = null;

function getProjectId(): string | undefined {
  const config = Constants.expoConfig as
    | { extra?: { eas?: { projectId?: string } }; easConfig?: { projectId?: string } }
    | undefined;
  return config?.extra?.eas?.projectId ?? config?.easConfig?.projectId;
}

async function getExpoPushToken(): Promise<string | null> {
  if (!Notifications) return null;
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Rumia notifications',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const settings = await Notifications.getPermissionsAsync();
  let granted =
    settings.granted ||
    (Platform.OS === 'ios' &&
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);

  if (!granted) {
    const request = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    granted =
      request.granted ||
      (Platform.OS === 'ios' &&
        request.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
  }

  if (!granted) return null;

  const projectId = getProjectId();
  if (!projectId) return null;

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return token || null;
  } catch {
    return null;
  }
}

async function registerTokenWithBackend(token: string): Promise<void> {
  try {
    await apiFetch('/notifications/devices', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }),
    });
  } catch {
    // Best-effort registration — a failed sync should not block the app.
  }
}

export async function registerPushToken(): Promise<string | null> {
  const token = await getExpoPushToken();
  if (!token) return null;

  currentExpoPushToken = token;
  await registerTokenWithBackend(token);
  return token;
}

export async function unregisterPushToken(): Promise<void> {
  const token = currentExpoPushToken;
  currentExpoPushToken = null;
  if (!token) return;

  try {
    await apiFetch(`/notifications/devices/${token}`, { method: 'DELETE' });
  } catch {
    // Best-effort unregistration.
  }
}

/** Register the device push token on sign-in, unregister on sign-out. */
export function usePushNotificationRegistration() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!Notifications) return;

    if (isAuthenticated) {
      void registerPushToken();
    } else {
      void unregisterPushToken();
    }

    // Expo occasionally rolls the device token while the app runs — keep the
    // backend token fresh without re-registering on every auth change.
    const subscription = Notifications.addPushTokenListener((event) => {
      const newToken = event.data;
      if (newToken && newToken !== currentExpoPushToken) {
        currentExpoPushToken = newToken;
        void registerTokenWithBackend(newToken);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);
}