// src/utils/deviceId.ts
import { Platform } from 'react-native';

let cached: string | null = null;
const KEY = 'vm_device_id';

function uuid(): string {
  // Prefer crypto UUID if available
  // @ts-ignore
  if (typeof crypto !== 'undefined' && crypto?.randomUUID) return crypto.randomUUID();
  const rnd = () =>
    Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  // not a true v4, but fine as a fallback
  return `${rnd()}${rnd()}-${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
}

export async function ensureDeviceId(): Promise<string> {
  if (cached) return cached;

  // ---------- WEB: persist to localStorage ----------
  if (Platform.OS === 'web') {
    const KEY_WEB = KEY; // "vm_device_id"
    try {
      const existing = window.localStorage.getItem(KEY_WEB);
      if (existing && existing.trim()) {
        cached = existing.trim();
        return cached;
      }
      const id = uuid();
      window.localStorage.setItem(KEY_WEB, id);
      cached = id;
      return cached;
    } catch {
      // localStorage blocked? At least keep it stable for this tab session.
      cached = uuid();
      return cached;
    }
  }

  // ---------- NATIVE: SecureStore → AsyncStorage ----------
  try {
    const SecureStore = await import('expo-secure-store');
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing && existing.trim()) {
      cached = existing.trim();
      return cached;
    }
    const id = uuid();
    try {
      await SecureStore.setItemAsync(KEY, id);
    } catch { /* fall back below */ }
    cached = id;
    return cached;
  } catch {
    // expo-secure-store not available (unlikely on native)
  }

  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const existing = await AsyncStorage.getItem(KEY);
    if (existing && existing.trim()) {
      cached = existing.trim();
      return cached;
    }
    const id = uuid();
    await AsyncStorage.setItem(KEY, id);
    cached = id;
    return cached;
  } catch {
    // Last resort: volatile in-memory ID (won't survive app restart)
    cached = uuid();
    return cached;
  }
}
