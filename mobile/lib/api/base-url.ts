import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Resolve the backend base URL for the current runtime.
 *
 *  - EXPO_PUBLIC_API_BASE_URL always wins when explicitly configured.
 *  - Android (emulator) reaches the host machine via 10.0.2.2.
 *  - Physical iOS devices / LAN preview: reuse the host Metro is served from
 *    (Constants.expoConfig.hostUri), since uvicorn runs on that machine.
 *  - iOS simulator and web dev default to localhost.
 *
 * For a physical Android device, point EXPO_PUBLIC_API_BASE_URL at your
 * machine's LAN URL (e.g. http://192.168.1.5:8000/api/v1).
 */
function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) {
    return configured;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }

  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:8000/api/v1`;
  }

  return 'http://localhost:8000/api/v1';
}



export const API_BASE_URL = resolveApiBaseUrl();
