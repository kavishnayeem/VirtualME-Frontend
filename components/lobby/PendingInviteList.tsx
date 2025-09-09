import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { InvitePending } from '../../types/user';

type Props = {
  items: InvitePending[];
  onRevoke: (token: string) => void | Promise<void>;
  emptyText?: string;
};

export default function PendingInviteList({ items, onRevoke, emptyText = "No pending invites." }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Pending Invites</Text>
      {items?.length ? (
        items.map(p => (
          <View key={p.token} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.email}>{p.email}</Text>
              <Text style={styles.sub}>Created {new Date(p.createdAt).toLocaleString()}</Text>
            </View>
            <Pressable style={styles.btn} onPress={() => onRevoke(p.token)}>
              <Text style={styles.btnText}>Revoke</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, gap: 6 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  email: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sub: { color: '#aaa', fontSize: 12 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#3a3a3a' },
  btnText: { color: '#ddd', fontWeight: '600' },
  emptyText: { color: '#aaa', fontSize: 14, fontStyle: 'italic', marginTop: 8 },
});
