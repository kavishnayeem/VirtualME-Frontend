import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { usePersonaTarget } from '../hooks/usePersonaTarget';
import { fetchMeAndGranted, UserSummary } from '../lib/lobby';
import { usePersonaResources } from '../hooks/usePersonaResources';

export default function PersonaCenter({
  visible,
  onClose,
}: { visible: boolean; onClose: () => void; }) {
  const { token } = useAuth?.() ?? ({ token: undefined } as any);
  const { target, setTarget } = usePersonaTarget();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<UserSummary | null>(null);
  const [rows, setRows] = useState<UserSummary[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        setLoading(true);
        const snap = await fetchMeAndGranted(token ?? undefined);
        setMe(snap.me);
        setRows([snap.me, ...snap.grantedFrom]);
      } catch (e) {
        setRows([]); setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, token]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((u) =>
      (u.name ?? '').toLowerCase().includes(needle) ||
      (u.email ?? '').toLowerCase().includes(needle)
    );
  }, [rows, q]);

  // live resources for currently selected target
  const { userId, location, events, loading: loadingRes } = usePersonaResources({ agendaLimit: 3 });

  const headline = target?.name || target?.email || (me?.name ? `Me (${me.name})` : 'Me');

  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === 'ios' ? 'slide' : 'fade'}
      transparent
      onRequestClose={onClose}
    >
      <View style={S.backdrop}>
        <View style={S.sheet}>
          <View style={S.header}>
            <Text style={S.title}>Personas</Text>
            <Pressable onPress={onClose}><Text style={S.close}>Close</Text></Pressable>
          </View>

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search name or email"
            placeholderTextColor="#777"
            style={S.search}
            autoCapitalize="none"
          />

          {loading ? (
            <View style={S.center}><ActivityIndicator /></View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item._id}
              style={{ maxHeight: 260 }}
              renderItem={({ item }) => {
                const active = target ? (target._id === item._id) : (me && item._id === me._id);
                return (
                  <Pressable
                    style={[S.row, active && S.rowActive]}
                    onPress={() => setTarget(item)}
                  >
                    {item.picture ? (
                      <Image source={{ uri: item.picture }} style={S.avatar} />
                    ) : <View style={[S.avatar, S.blank]} />}
                    <View style={{ flex: 1 }}>
                      <Text style={S.name}>{item.name ?? item.email}</Text>
                      {!!item.name && <Text style={S.sub}>{item.email}</Text>}
                    </View>
                    {active && <Text style={S.badge}>Selected</Text>}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<View style={S.center}><Text style={S.empty}>No accessible people.</Text></View>}
            />
          )}

          {/* Live persona details */}
          <View style={S.card}>
            <Text style={S.cardTitle}>Acting For</Text>
            <Text style={S.headline}>{headline}</Text>

            <View style={S.split}>
              <View style={{ flex: 1 }}>
                <Text style={S.section}>Location</Text>
                {loadingRes ? (
                  <Text style={S.dim}>Loading…</Text>
                ) : location ? (
                  <>
                    <Text style={S.value}>{location.label ?? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}</Text>
                    {!!location.when && <Text style={S.dim}>Updated: {new Date(location.when).toLocaleString()}</Text>}
                  </>
                ) : <Text style={S.dim}>No recent location</Text>}
              </View>
              <View style={{ width: 16 }} />
              <View style={{ flex: 1 }}>
                <Text style={S.section}>Next Events</Text>
                {loadingRes ? (
                  <Text style={S.dim}>Loading…</Text>
                ) : Array.isArray(events) && events.length ? (
                  events.slice(0, 3).map((e) => (
                    <View key={e.id} style={{ marginBottom: 6 }}>
                      <Text style={S.value}>{e.title}</Text>
                      <Text style={S.dim}>
                        {new Date(e.start).toLocaleString()}
                        {e.location ? ` · ${e.location}` : ''}
                      </Text>
                    </View>
                  ))
                ) : <Text style={S.dim}>No upcoming events</Text>}
              </View>
            </View>

            <View style={S.footer}>
              <Pressable
                style={[S.primaryBtn, !userId && { opacity: 0.5 }]}
                disabled={!userId}
                onPress={onClose}
              >
                <Text style={S.primaryText}>Use this persona in Orb</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0b0b0b', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: 10 },
  header: { padding: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  close: { color: '#9b87f5', fontWeight: '700' },
  search: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: '#111', borderWidth: 1, borderColor: '#222', color: '#fff' },

  row: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowActive: { backgroundColor: '#0f0f18' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222' },
  blank: { borderWidth: 1, borderColor: '#333' },
  name: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sub: { color: '#aaa', fontSize: 12 },
  badge: { color: '#9b87f5', fontSize: 12, fontWeight: '800' },
  empty: { color: '#aaa' },
  center: { padding: 24, alignItems: 'center', justifyContent: 'center' },

  card: { marginHorizontal: 16, marginTop: 8, padding: 14, borderRadius: 14, backgroundColor: '#0d0d12', borderWidth: 1, borderColor: '#1e1e27' },
  cardTitle: { color: '#9b87f5', fontWeight: '800', marginBottom: 6 },
  headline: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 10 },
  split: { flexDirection: 'row' },
  section: { color: '#ddd', fontWeight: '700', marginBottom: 6 },
  value: { color: '#fff' },
  dim: { color: '#9aa', fontSize: 12 },
  footer: { marginTop: 12, alignItems: 'flex-end' },
  primaryBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#201f3a', borderWidth: 1, borderColor: '#2a2a4a' },
  primaryText: { color: '#ddd', fontWeight: '700' },
});
