import { ScrollView, StyleSheet, Text, RefreshControl } from 'react-native';
import LobbyList from '../../components/lobby/LobbyList';
import { useLobby } from '../../hooks/useLobby';

export default function GrantedToScreen() {
  const authToken = undefined;
  const { grantedTo = [], revokeAccess, loading, refresh } = useLobby(authToken);

  return (
    <ScrollView style={styles.page} refreshControl={<RefreshControl refreshing={!!loading} onRefresh={refresh} />}>
      <Text style={styles.h1}>Granted to others</Text>
      <LobbyList
        title="You granted access to"
        users={grantedTo}
        emptyText="No one yet."
        actionLabel="Revoke"
        onAction={(u) => revokeAccess(u._id)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  h1: { fontSize: 24, fontWeight: '800', color: '#fff', padding: 12 },
});
