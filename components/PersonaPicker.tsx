import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePersonaTarget } from '../providers/PersonaTargetProvider';
import { useAuth } from '../providers/AuthProvider';

type UserSummary = {
  _id: string;
  email: string;
  name?: string;
  picture?: string;
};

type Snapshot = {
  me: UserSummary;
  grantedFrom: UserSummary[]; // people who granted me access (I can act for them)
};

const API_BASE = process.env.EXPO_PUBLIC_DATABASE_API_BASE ?? 'https://virtual-me-auth.vercel.app';

async function fetchSnapshot(authToken?: string): Promise<Snapshot> {
  const r = await fetch(`${API_BASE}/lobby/summary`, {
    headers: {
      Accept: 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);

  const s = await r.json() as {
    me: UserSummary;
    granted?: Array<{ status: 'active' | 'pending' | string; guest: UserSummary }>;
    received?: Array<{ status: 'active' | 'pending' | string; owner: UserSummary }>;
  };

  const me = s.me;
  const grantedFrom = Array.isArray(s.received)
    ? s.received
        .filter(g => g && g.owner && g.status === 'active')
        .map(g => g.owner)
    : [];

  return { me, grantedFrom };
}

export default function PersonaPicker({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { target, setTarget, clear } = usePersonaTarget();
  const { token } = useAuth?.() ?? ({ token: undefined } as any);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<UserSummary[]>([]);
  const [me, setMe] = useState<UserSummary | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        setLoading(true);
        const snap = await fetchSnapshot(token ?? undefined);
        setMe(snap.me);
        const people = [snap.me, ...(snap.grantedFrom || [])];
        setList(people);
      } catch (e) {
        // silent; show empty
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, token]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(p =>
      (p.name || '').toLowerCase().includes(needle) ||
      (p.email || '').toLowerCase().includes(needle)
    );
  }, [list, q]);

  const currentId = target?._id ?? me?._id;

  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === 'ios' ? 'slide' : 'fade'}
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose who to assist</Text>
            <Pressable onPress={onClose}><Text style={styles.close}>Close</Text></Pressable>
          </View>

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search name or email"
            placeholderTextColor="#777"
            style={styles.search}
            autoCapitalize="none"
          />

          {loading ? (
            <View style={styles.center}><ActivityIndicator /></View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.row, currentId === item._id && styles.rowActive]}
                  onPress={() => { setTarget(item); onClose(); }}
                >
                  {item.picture ? (
                    <Image source={{ uri: item.picture }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.blank]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name ?? item.email}</Text>
                    {!!item.name && <Text style={styles.sub}>{item.email}</Text>}
                  </View>
                  {currentId === item._id ? <Text style={styles.badge}>Selected</Text> : null}
                </Pressable>
              )}
              ListHeaderComponent={
                me ? (
                  <Pressable
                    style={[styles.row, (!target || target._id === me._id) && styles.rowActive]}
                    onPress={() => { setTarget(me); onClose(); }}
                  >
                    {me.picture ? (
                      <Image source={{ uri: me.picture }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.blank]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>Me</Text>
                      <Text style={styles.sub}>{me.name ? `${me.name} · ${me.email}` : me.email}</Text>
                    </View>
                    {(!target || target._id === me._id) ? <Text style={styles.badge}>Selected</Text> : null}
                  </Pressable>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.center}><Text style={styles.empty}>No accessible people yet.</Text></View>
              }
            />
          )}

          <View style={styles.footer}>
            <Pressable
              style={[styles.resetBtn, !target && styles.resetDisabled]}
              onPress={() => { if (me) setTarget(me); else clear(); onClose(); }}
              disabled={!target}
            >
              <Text style={styles.resetText}>Reset to Me</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0b0b0b', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 8 },
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
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1d1d1d', alignItems: 'flex-end' },
  resetBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#171717', borderWidth: 1, borderColor: '#2a2a2a' },
  resetDisabled: { opacity: 0.6 },
  resetText: { color: '#ddd', fontWeight: '700' },
});
