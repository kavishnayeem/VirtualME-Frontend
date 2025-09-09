import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { UserSummary } from '../../types/user';

type Props = {
  title: string;
  users: UserSummary[];
  emptyText: string;
  actionLabel?: string;
  onAction?: (user: UserSummary) => void;
};

export default function LobbyList({ title, users, emptyText, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {users.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        users.map(u => (
          <View key={u._id} style={styles.row}>
            {u.picture ? <Image source={{ uri: u.picture }} style={styles.avatar} /> : <View style={[styles.avatar, styles.blank]} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{u.name ?? u.email}</Text>
              {u.name ? <Text style={styles.sub}>{u.email}</Text> : null}
            </View>
            {!!actionLabel && !!onAction && (
              <Pressable style={styles.btn} onPress={() => onAction(u)}>
                <Text style={styles.btnText}>{actionLabel}</Text>
              </Pressable>
            )}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#fff' },
  empty: { color: '#aaa', paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222' },
  blank: { borderWidth: 1, borderColor: '#333' },
  name: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sub: { color: '#aaa', fontSize: 12 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#3a3a3a' },
  btnText: { color: '#ddd', fontWeight: '600' },
});
