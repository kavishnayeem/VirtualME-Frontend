// app/settings.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, Switch, Alert, StyleSheet } from 'react-native';
import { enableBackgroundLocation, disableBackgroundLocation } from '../services/location-bg';

export default function SettingsScreen() {
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);

  const onToggle = useCallback(async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        await enableBackgroundLocation();
        setSharing(true);
      } else {
        await disableBackgroundLocation();
        setSharing(false);
      }
    } catch (e: any) {
      Alert.alert('Location', e?.message ?? 'Failed to update location sharing');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Share my location</Text>
          <Text style={styles.cardSub}>
            Allow VirtualMe to update your location in the background so the Orb can answer
            “Where are you?” from the web or app. You can turn this off anytime.
          </Text>
        </View>
        <Switch value={sharing} onValueChange={onToggle} disabled={busy} />
      </View>

      <Text style={styles.note}>
        iOS shows a status bar indicator; Android requires a persistent notification while sharing.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16 },
  title: { fontSize: 22, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center'
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  cardSub: { color: '#aaa' },
  note: { color: '#888' }
});
