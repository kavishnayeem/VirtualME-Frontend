// app/settings.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Switch, Alert, StyleSheet, Platform, TextInput, Pressable, ActivityIndicator } from 'react-native';
import * as Device from 'expo-device';

import { enableBackgroundLocation, disableBackgroundLocation, forcePushNow } from '../services/location-bg';
import { ensureDeviceId } from '../utils/deviceId';
import { registerThisDevice, fetchMyDevice, setDeviceSharing } from '../services/deviceApi';
import { setDeviceApiAuthToken } from '../services/deviceApi';
import { setLocationAuthToken } from '../services/location-bg';
import { useAuth } from '../providers/AuthProvider';

type DeviceRecord = {
  id: string;
  label?: string;
  platform?: string;
  model?: string;
  sharing?: boolean;
  lastSeenAt?: string | null;
};

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [deviceId, setDeviceId] = useState<string>('');
  const [record, setRecord] = useState<DeviceRecord | null>(null);
  const [label, setLabel] = useState<string>('');
  const [minutes, setMinutes] = useState<number>(60); // background cadence
  const { token } = useAuth?.() ?? ({ token: undefined } as any);
  const sharing = !!record?.sharing;

  const needsNative = useMemo(() => Platform.OS !== 'web', []);
  const platformModel = useMemo(
    () => (Device.manufacturer || '') + (Device.modelName ? ` ${Device.modelName}` : ''),
    []
  );
  if (!token) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff', fontSize: 16, marginBottom: 10 }}>Sign in required</Text>
        
      </View>
    );
  }
  useEffect(() => {
    if (token) {
      setDeviceApiAuthToken(token);
      setLocationAuthToken(token);
    } else {
      setDeviceApiAuthToken(null);
      setLocationAuthToken(null);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return; // wait until token is ready
    (async () => {
      setLoading(true);
      try {
        const id = await ensureDeviceId();
        setDeviceId(id);
        const rec = await fetchMyDevice(id);
        if (rec) { setRecord(rec); setLabel(rec.label || ''); }
        else {
          setLabel(Platform.OS === 'ios' ? 'My iPhone' :
                   Platform.OS === 'android' ? 'My Android' : 'My Browser');
        }
      } catch (e: any) {
        console.warn('Settings init error:', e?.message || e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const onRegister = useCallback(async () => {
    if (!needsNative && !label.trim()) {
      Alert.alert('Device', 'Please enter a name for this device.');
      return;
    }
    setBusy(true);
    try {
      const id = deviceId || (await ensureDeviceId());
      const rec = await registerThisDevice({
        id,
        label: label.trim() || undefined,
        platform: Platform.OS,
        model: platformModel || undefined,
      });
      setRecord(rec);
      if (typeof rec.label === 'string') setLabel(rec.label);
      Alert.alert('Device', 'Device registered.');
    } catch (e: any) {
      Alert.alert('Device', e?.message ?? 'Failed to register device');
    } finally {
      setBusy(false);
    }
  }, [deviceId, label, platformModel, needsNative]);

  const onToggleShare = useCallback(async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      // Ensure server record exists before flipping sharing
      let rec = record;
      if (!rec) {
        const id = deviceId || (await ensureDeviceId());
        rec = await registerThisDevice({
          id,
          label: label.trim() || undefined,
          platform: Platform.OS,
          model: platformModel || undefined,
        });
        setRecord(rec);
      }

      if (next) {
        await enableBackgroundLocation({ minutes });
        try { await forcePushNow('settings-toggle'); } catch {}
      } else {
        await disableBackgroundLocation();
      }

      const updated = await setDeviceSharing(rec!.id, next);
      setRecord(updated);

      if (Platform.OS === 'android' && next) {
        Alert.alert('Tip (Android)', 'For best results, set Battery → Unrestricted for VirtualMe.');
      }
    } catch (e: any) {
      Alert.alert('Location', e?.message ?? 'Failed to update location sharing');
    } finally {
      setBusy(false);
    }
  }, [busy, record, deviceId, label, platformModel, minutes]);

  const onPushNow = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await forcePushNow('manual-button');
      Alert.alert('Location', 'Pushed current/last known location.');
    } catch (e: any) {
      Alert.alert('Location', e?.message ?? 'Push failed');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: '#aaa' }}>Loading settings…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {/* Device block */}
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>This device</Text>
          <Text style={styles.cardSub}>
            {platformModel ? `${platformModel}` : 'Unknown device'}{deviceId ? ` · ${deviceId.slice(0, 8)}…` : ''}
          </Text>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.inputLabel}>Device name</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="e.g., Kavish’s Android"
              placeholderTextColor="#777"
              style={styles.input}
            />
          </View>
        </View>

        <Pressable onPress={onRegister} disabled={busy} style={[styles.button, busy && styles.buttonDisabled]}>
          <Text style={styles.buttonText}>{record ? 'Update' : 'Register'}</Text>
        </Pressable>
      </View>

      {/* Location sharing */}
      <View style={styles.card}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={styles.cardTitle}>Share my location</Text>
          <Text style={styles.cardSub}>
            Updates run in the background so the Orb can answer “Where are you?” for the selected persona.
          </Text>
          {record?.lastSeenAt ? (
            <Text style={[styles.cardSub, { marginTop: 4 }]}>
              Last sync: {new Date(record.lastSeenAt).toLocaleString()}
            </Text>
          ) : null}
          <Text style={[styles.inputLabel, { marginTop: 8 }]}>Background cadence (minutes)</Text>
          <TextInput
            value={String(minutes)}
            onChangeText={(t) => setMinutes(Math.max(1, Number.parseInt(t || '60', 10) || 60))}
            keyboardType="number-pad"
            style={[styles.input, { width: 120 }]}
          />
        </View>
        <Switch value={sharing} onValueChange={onToggleShare} disabled={busy} />
      </View>


      {Platform.OS !== 'web' ? (
        <Text style={styles.note}>
          iOS shows a status bar indicator; Android shows a persistent notification while sharing.
        </Text>
      ) : (
        <Text style={styles.note}>
          Background location is limited on web; toggle affects server intent but won’t start a native task.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16, backgroundColor: '#000' },
  title: { fontSize: 22, fontWeight: '600', color: '#fff' },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6, color: '#fff' },
  cardSub: { color: '#aaa', maxWidth: 560 },
  inputLabel: { color: '#ddd', marginBottom: 6, fontSize: 12 },
  input: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    color: '#fff',
    minWidth: 220,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ddd', fontWeight: '700' },
  note: { color: '#888' },
});
