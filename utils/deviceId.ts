// utils/deviceId.ts
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const KEY = 'vm_device_id';

function randomId() {
  // Prefer cryptographic UUID if available
  // @ts-ignore
  if (global?.crypto?.randomUUID) return global.crypto.randomUUID();
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function ensureDeviceId(): Promise<string> {
  // 1) If we already saved one, return it
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing && existing.trim()) return existing;
  } catch {
    // SecureStore can be unavailable on web; ignore and continue
  }

  // 2) Try a platform identifier (best-effort)
  let base: string | null = null;
  try {
    if (Platform.OS === 'android') {
      // androidId is a string | null (Android only)
      base = (Application as any).androidId ?? null;
    } else if (Platform.OS === 'ios' && typeof Application.getIosIdForVendorAsync === 'function') {
      base = await Application.getIosIdForVendorAsync();
    }
  } catch {
    // ignore and fallback
  }

  // 3) Fallback to a random ID if nothing else
  const id = (typeof base === 'string' && base.trim().length >= 8) ? base.trim() : randomId();

  // 4) Persist for future runs (best-effort)
  try {
    await SecureStore.setItemAsync(KEY, id);
  } catch {
    // On web / restricted envs, SecureStore may no-op; that's fine
  }

  return id;
}
