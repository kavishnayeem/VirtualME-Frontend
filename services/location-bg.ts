// src/services/location-bg.ts
import { Platform } from 'react-native';
import { ensureDeviceId } from '../utils/deviceId';
import { registerThisDevice, setDeviceSharing } from './deviceApi';

const TASK_NAME = 'vm-location-updates';
const HEARTBEAT_TASK = 'vm-hourly-ping';
const isWeb = Platform.OS === 'web';

let TaskManager: typeof import('expo-task-manager') | null = null;
let Location: typeof import('expo-location') | null = null;
let BackgroundFetch: typeof import('expo-background-fetch') | null = null;

let AUTH_TOKEN: string | null = null;

/** Call this after login (and on app start if token is persisted) */
export function setLocationAuthToken(token: string | null) {
  AUTH_TOKEN = token && token.trim() ? token : null;
}

async function loadNative() {
  if (isWeb) return false;
  if (!TaskManager)      try { TaskManager = await import('expo-task-manager'); } catch { return false; }
  if (!Location)         try { Location    = await import('expo-location'); }    catch { return false; }
  if (!BackgroundFetch)  try { BackgroundFetch = await import('expo-background-fetch'); } catch {}
  // @ts-ignore
  return !!(TaskManager?.defineTask && Location?.Accuracy);
}

function apiBase() {
  return 'https://virtual-me-voice-agent.vercel.app';
}

// ----- POST with auto-heal (register + enable sharing → retry once) -----
async function postUpdate(payload: any, reason = 'bg') {
  const deviceId = await ensureDeviceId();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  // Avoid CORS preflight on web
  if (!isWeb) headers['X-VM-Reason'] = reason;

  const body = JSON.stringify({ deviceId, payload });
  const url = `${apiBase()}/location/update`;

  const doPost = () => fetch(url, { method: 'POST', headers, body });

  // First attempt
  let r: Response;
  try { r = await doPost(); } catch (e) {
    console.warn('[vm] fetch /location/update failed:', (e as any)?.message || e);
    throw e;
  }

  // Auto-heal on 403
  if (r.status === 403) {
    const txt = (await r.clone().text()).toLowerCase();
    const canAuth = !!AUTH_TOKEN;

    if (canAuth && txt.includes('device not registered')) {
      try {
        const label =
          Platform.OS === 'ios' ? 'My iPhone' :
          Platform.OS === 'android' ? 'My Android' : 'My Browser';
        await registerThisDevice({ id: deviceId, label, platform: Platform.OS, model: undefined });
        await setDeviceSharing(deviceId, true);
        console.log('[vm] Auto-registered device + enabled sharing. Retrying push…');
        r = await doPost();
      } catch (e) {
        console.warn('[vm] Auto-register failed:', (e as any)?.message || e);
      }
    } else if (canAuth && txt.includes('sharing disabled')) {
      try {
        await setDeviceSharing(deviceId, true);
        console.log('[vm] Auto-enabled sharing. Retrying push…');
        r = await doPost();
      } catch (e) {
        console.warn('[vm] Auto-enable failed:', (e as any)?.message || e);
      }
    }
  }

  const txt = await r.text();
  console.log('[vm] POST /location/update', r.status, r.headers.get('x-store'), r.headers.get('x-user'), 'resp=', txt);

  if (r.status === 401) console.warn('[vm] No/invalid auth for /location/update. Did you call setLocationAuthToken(token)?');
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

export async function ensureHeartbeatRegistered() {
  const ok = await loadNative();
  if (!ok || !TaskManager) return;

  // @ts-ignore
  const _tm: any = TaskManager;
  if (_tm.__vmHeartbeatDefined) return;
  _tm.__vmHeartbeatDefined = true;

  TaskManager.defineTask(HEARTBEAT_TASK, async () => {
    try {
      await forcePushNow('heartbeat');
      return BackgroundFetch?.BackgroundFetchResult?.NewData ?? 1;
    } catch {
      return BackgroundFetch?.BackgroundFetchResult?.Failed ?? 3;
    }
  });
}

/** Keep data fresh even if GPS is quiet */
export async function enableHeartbeat(minIntervalSec = 3600) {
  await ensureHeartbeatRegistered();
  if (!BackgroundFetch) return;

  await BackgroundFetch.registerTaskAsync(HEARTBEAT_TASK, {
    minimumInterval: minIntervalSec, // Android honors >= 15m; 3600 = 1h
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function disableHeartbeat() {
  if (!BackgroundFetch) return;
  try { await BackgroundFetch.unregisterTaskAsync(HEARTBEAT_TASK); } catch {}
}

export async function enableBackgroundLocation(opts?: { minutes?: number }) {
  if (isWeb) {
    await forcePushNow('web-enable-toggle'); // one-shot on web
    return;
  }
  const ok = await loadNative();
  if (!ok || !TaskManager || !Location) throw new Error('Background location not available in this build.');

  await ensureTaskRegistered();
  await ensureHeartbeatRegistered();

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('Foreground permission not granted');

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    throw new Error(Platform.OS === 'android'
      ? 'Background permission not granted. In Settings → Apps → VirtualMe → Permissions → Location → Allow all the time.'
      : 'Background permission not granted. In iOS Settings → Privacy & Security → Location Services → VirtualMe → Always + Precise.');
  }

  const minutes = Math.max(1, Math.floor((opts?.minutes ?? 60))); // default hourly
  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);

  if (!started) {
    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,
      timeInterval: minutes * 60 * 1000,
      deferredUpdatesInterval: 5 * 60 * 1000,
      deferredUpdatesDistance: 0,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: true,
      foregroundService: Platform.select({
        android: {
          notificationTitle: 'VirtualMe is updating your location',
          notificationBody: 'Background location sharing is ON.',
        },
        default: undefined,
      }),
    });
    console.log('[vm] startLocationUpdatesAsync() called');
  } else {
    console.log('[vm] updates already started');
  }

  await enableHeartbeat(minutes * 60);
  await forcePushNow('enable-toggle');
}

export async function disableBackgroundLocation() {
  if (isWeb) { console.log('[vm] web: no native background task to stop'); return; }
  const ok = await loadNative();
  if (!ok || !Location) return;
  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (started) await Location.stopLocationUpdatesAsync(TASK_NAME);
  await disableHeartbeat();
  console.log('[vm] stopped updates');
}

async function getOrLastPosition(timeoutMs = 3500) {
  if (!Location) return null;

  const withTimeout = <T>(p: Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      p.then(v => { clearTimeout(t); resolve(v); })
       .catch(e => { clearTimeout(t); reject(e); });
    });

  try {
    return await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  } catch {}

  try {
    const last = await Location.getLastKnownPositionAsync();
    if (last) return last;
  } catch {}

  return null;
}

/** One-shot push (web uses navigator.geolocation) */
export async function forcePushNow(reason = 'manual') {
  if (isWeb) {
    const hasNav = typeof navigator !== 'undefined' && !!navigator.geolocation;
    if (!hasNav) { console.warn('[vm] web: navigator.geolocation not available'); return; }

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const payload = {
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy:  pos.coords.accuracy ?? null,
            speed:     pos.coords.speed ?? null,
            heading:   pos.coords.heading ?? null,
            altitude:  pos.coords.altitude ?? null,
            timestamp: pos.timestamp || Date.now(),
          };
          console.log('[vm] WEB push', payload);
          try { await postUpdate(payload, reason); } finally { resolve(); }
        },
        (err) => { console.warn('[vm] web geolocation error:', err?.message || err); resolve(); },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 3500 }
      );
    });
    return;
  }

  const ok = await loadNative();
  if (!ok || !Location) return;

  const loc = await getOrLastPosition().catch(() => null as any);
  if (!loc) { console.warn('[vm] No local fix; relying on server last-known.'); return; }

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

// Safe no-ops on web
void ensureTaskRegistered();
void ensureHeartbeatRegistered();
