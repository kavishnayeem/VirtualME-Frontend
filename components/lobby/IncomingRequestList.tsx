import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

export type IncomingRequest = {
  inviteCode: string;
  createdAt?: string;
  owner: { _id: string; name?: string; email?: string; picture?: string };
};

export default function IncomingRequestList({
  items,
  onAccept,
  onReject,
  emptyText = 'No requests.',
}: {
  items: IncomingRequest[];
  onAccept: (code: string) => void;
  onReject: (code: string) => void;
  emptyText?: string;
}) {
  if (!items || items.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }
  return (
    <View style={styles.wrap}>
      {items.map((it) => (
        <View key={it.inviteCode} style={styles.row}>
          <View style={styles.left}>
            {it.owner?.picture ? (
              <Image source={{ uri: it.owner.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholder]} />
            )}
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.name}>{it.owner?.name || it.owner?.email || 'Unknown'}</Text>
              <Text style={styles.meta}>Invite: {it.inviteCode}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.accept]} onPress={() => onAccept(it.inviteCode)}>
              <Text style={styles.btnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.reject]} onPress={() => onReject(it.inviteCode)}>
              <Text style={styles.btnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(18,18,20,0.96)',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#222' },
  placeholder: { backgroundColor: '#333' },
  name: { color: '#fff', fontWeight: '800', fontSize: 16 },
  meta: { color: '#bbb', fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.2 },
  accept: { borderColor: '#7CFF7C', backgroundColor: 'rgba(20,80,20,0.25)' },
  reject: { borderColor: '#FF7C7C', backgroundColor: 'rgba(80,20,20,0.25)' },
  btnText: { color: '#fff', fontWeight: '800' },
  empty: { color: '#aaa', textAlign: 'center', padding: 12 },
});
