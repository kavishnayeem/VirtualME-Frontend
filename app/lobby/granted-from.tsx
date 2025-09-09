import { ScrollView, StyleSheet, Text, RefreshControl } from 'react-native';
import LobbyList from '../../components/lobby/LobbyList';
import { useLobby } from '../../hooks/useLobby';

export default function GrantedFromScreen() {
  const authToken = undefined;
  const { grantedFrom = [], loading, refresh } = useLobby(authToken);

  return (
    <ScrollView style={styles.page} refreshControl={<RefreshControl refreshing={!!loading} onRefresh={refresh} />}>
      <Text style={styles.h1}>You can access</Text>
      <LobbyList
        title="People who granted you access"
        users={grantedFrom}
        emptyText="No one yet."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  h1: { fontSize: 24, fontWeight: '800', color: '#fff', padding: 12 },
});
