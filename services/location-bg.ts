import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

const TASK_NAME = 'vm-location-updates';

// Replace with your auth retrieval. For now, simple getter.
function getAuthToken(): string | undefined {
  // e.g., return your Zustand/store token
  // or set globalThis.__vmAuthToken__ at login time
  // @ts-ignore
  return globalThis.__vmAuthToken__ as string | undefined;
}

type LocationPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  timestamp: number; // ms
};

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) return;
  // @ts-ignore
  const { locations } = data || {};
  if (!locations?.length) return;
  const loc = locations[0];
  const payload: LocationPayload = {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy,
    speed: loc.coords.speed,
    heading: loc.coords.heading,
    altitude: loc.coords.altitude,
    timestamp: loc.timestamp
  };

  const token = getAuthToken();
  const base = 'https://virtual-me-voice-agent.vercel.app';
  if (!base) return;

  try {
    await fetch(`${base}/location/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ payload })
    });
  } catch {
    // best-effort; ignore
  }
});

export async function enableBackgroundLocation() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('Location permission not granted');

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') throw new Error('Background permission not granted');

  const already = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (!already) {
    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50, // meters
      timeInterval: 5 * 60 * 1000, // Android: 5 minutes
      deferredUpdatesInterval: 2 * 60 * 1000, // iOS defer batching
      deferredUpdatesDistance: 100, // iOS defer distance
      activityType: Location.ActivityType.Other,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: true, // iOS indicator
      // Required persistent notification on Android:
      foregroundService: Platform.select({
        android: {
          notificationTitle: 'VirtualMe location',
          notificationBody: 'Sharing your location securely.',
        },
        default: undefined,
      }),
    });
  }
}

export async function disableBackgroundLocation() {
  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (started) await Location.stopLocationUpdatesAsync(TASK_NAME);
}
