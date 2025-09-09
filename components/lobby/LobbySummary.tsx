// components/lobby/LobbySummary.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  grantedTo: number;     // people you granted access to
  grantedFrom: number;   // people who granted you access
  pending: number;       // pending invites you sent
};

export default function LobbySummary({ grantedTo, grantedFrom, pending }: Props) {
  return (
    <View style={styles.row}>
      <StatCard label="Granted To" value={grantedTo} />
      <StatCard label="Granted From" value={grantedFrom} />
      <StatCard label="Pending Invites" value={pending} />
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value ?? 0}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 12,
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(14,14,18,0.95)',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    minWidth: 110,
    maxWidth: 160,
  },
  value: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  label: {
    color: '#bbb',
    fontSize: 12,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
    textAlign: 'center',
  },
});
