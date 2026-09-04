import * as Crypto from 'expo-crypto';
import { secureStorage } from './storage/secure-store';

const ANONYMOUS_DEVICE_KEY = 'rumia_anonymous_device_id';

/**
 * Stable per-install anonymous identifier used as the `ip_hash` for lead
 * tracking. The backend uses it to dedupe repeated clicks; unlike on web there
 * is no server-side client IP for the mobile client to hash, so we persist a
 * random id once per install and SHA-256 it.
 */
export async function getAnonymousDeviceHash(): Promise<string> {
  let id = await secureStorage.getItem(ANONYMOUS_DEVICE_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await secureStorage.setItem(ANONYMOUS_DEVICE_KEY, id);
  }
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, id);
}