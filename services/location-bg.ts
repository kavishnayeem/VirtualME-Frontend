// src/services/location-bg.ts
import { Platform } from 'react-native';
import { ensureDeviceId } from '../utils/deviceId';

const TASK_NAME = 'vm-location-updates';
let TaskManager: typeof import('expo-task-manager') | null = null;
let Location: typeof import('expo-location') | null = null;
let AUTH_TOKEN: string | null = null;
export function setLocationAuthToken(token: string | null) {
  AUTH_TOKEN = token && token.trim() ? token : null;
}
async function loadNative() {
  if (Platform.OS === 'web') return false;
  if (!TaskManager) try { TaskManager = await import('expo-task-manager'); } catch { return false; }
  if (!Location)    try { Location    = await import('expo-location'); }    catch { return false; }
  // @ts-ignore
  return !!(TaskManager?.defineTask && Location?.Accuracy);
}

function apiBase() {
  const base = 'https://virtual-me-voice-agent.vercel.app';
  if (!base) console.warn('[vm] EXPO_PUBLIC_API_BASE is empty');
  return base!;
}

async function postUpdate(payload: any, reason = 'bg') {
  const base = apiBase();
  if (!base) return;

  // ensure we have a deviceId
  const deviceId = await ensureDeviceId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-VM-Reason': reason,
  };
  if (AUTH_TOKEN) headers.Authorization = `Bearer ${AUTH_TOKEN}`;

  const body = JSON.stringify({ deviceId, payload });

  const r = await fetch(`${base}/location/update`, {
    method: 'POST',
    headers,
    body,
  });

  const txt = await r.text();
  console.log('[vm] POST /location/update', r.status, r.headers.get('x-store'), r.headers.get('x-saved-at'), 'resp=', txt);

  // Helpful dev hinting: if device not registered, surface it once
  if (r.status === 403 && /device not registered/i.test(txt)) {
    console.warn('[vm] Device not registered on auth backend. Open Settings → Register device, then re-enable sharing.');
  } else if (r.status === 403 && /sharing disabled/i.test(txt)) {
    console.warn('[vm] Device exists but sharing is OFF on server. Toggle the setting to ON.');
  } else if (r.status === 401) {
    console.warn('[vm] No auth for /location/update. Make sure setLocationAuthToken(token) is called after login.');
  }
}

export async function ensureTaskRegistered() {
  const ok = await loadNative();
  if (!ok || !TaskManager || !Location) return;

  // @ts-ignore
  const _tm: any = TaskManager;
  if (_tm.__vmTaskDefined) return;
  _tm.__vmTaskDefined = true;

  TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
    if (error) { console.warn('[vm] task error', error); return; }
    // @ts-ignore
    const { locations } = data || {};
    if (!locations?.length) return;

    const loc = locations[0];
    const payload = {
      latitude:  loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy:  loc.coords.accuracy,
      speed:     loc.coords.speed,
      heading:   loc.coords.heading,
      altitude:  loc.coords.altitude,
      timestamp: loc.timestamp
    };
    console.log('[vm] BG location', payload);
    await postUpdate(payload, 'bg');
  });
}

export async function enableBackgroundLocation() {
  const ok = await loadNative();
  if (!ok || !TaskManager || !Location) throw new Error('Background location not available in this build.');

  await ensureTaskRegistered();

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('Foreground permission not granted');

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    throw new Error(Platform.OS === 'android'
      ? 'Background permission not granted. In Settings → Apps → VirtualMe → Permissions → Location → Allow all the time.'
      : 'Background permission not granted. In iOS Settings → Privacy & Security → Location Services → VirtualMe → Always + Precise.');
  }

  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (!started) {
    await Location.startLocationUpdatesAsync(TASK_NAME, {
      // DEBUG: make it chatty; relax later
      accuracy: Location.Accuracy.High,
      distanceInterval: 0,            // meters
      timeInterval: 15 * 1000,        // Android: every 15s
      deferredUpdatesInterval: 10*1000, // iOS batch
      deferredUpdatesDistance: 0,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: true,
      foregroundService: Platform.select({
        android: {
          notificationTitle: 'VirtualMe location',
          notificationBody: 'Sharing your location (debug).',
        },
        default: undefined,
      }),
    });
    console.log('[vm] startLocationUpdatesAsync() called');
  } else {
    console.log('[vm] updates already started');
  }

  // Force an immediate push so backend shows "just now"
  await forcePushNow('enable-toggle');
}

export async function disableBackgroundLocation() {
  const ok = await loadNative();
  if (!ok || !Location) return;
  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (started) await Location.stopLocationUpdatesAsync(TASK_NAME);
  console.log('[vm] stopped updates');
}

// One-shot: read current position and POST immediately
export async function forcePushNow(reason = 'manual') {
  const ok = await loadNative();
  if (!ok || !Location) return;

  const providers = await Location.getProviderStatusAsync?.().catch(() => null as any);
  console.log('[vm] provider status', providers);

  const permFg = await Location.getForegroundPermissionsAsync();
  const permBg = await Location.getBackgroundPermissionsAsync();
  // "Full" does not exist on Location.Accuracy; use "High" as the highest available accuracy
  console.log('[vm] perms', { 
    fg: permFg.status, 
    bg: permBg.status, 
    precise: (permFg as any)?.granted && (permFg as any)?.accuracy === Location.Accuracy.High 
  });

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
    mayShowUserSettingsDialog: true
  });
  const payload = {
    latitude:  loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy:  loc.coords.accuracy,
    speed:     loc.coords.speed,
    heading:   loc.coords.heading,
    altitude:  loc.coords.altitude,
    timestamp: loc.timestamp
  };
  console.log('[vm] FORCE push', payload);
  await postUpdate(payload, reason);
}

// Auto-register at app start
void ensureTaskRegistered();
