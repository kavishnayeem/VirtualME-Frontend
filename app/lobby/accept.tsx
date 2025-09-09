import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLobby } from '../../hooks/useLobby';

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const authToken = undefined;
  const { accept } = useLobby(authToken);
  const [state, setState] = useState<'idle'|'ok'|'err'|'busy'>(token ? 'busy' : 'idle');
  const [msg, setMsg] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (!token) { setMsg('Missing token.'); setState('err'); return; }
      try {
        await accept(String(token));
        setMsg('Invite accepted. You now have access.');
        setState('ok');
        setTimeout(() => router.replace('/lobby'), 1200);
      } catch (e: any) {
        setMsg(e?.error || 'Failed to accept invite.');
        setState('err');
      }
    })();
  }, [token]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.center}>
      {state === 'busy' ? <ActivityIndicator /> : null}
      <Text style={styles.text}>{msg || 'Processing invite...'}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: '#fff', fontSize: 16, textAlign: 'center' },
});
