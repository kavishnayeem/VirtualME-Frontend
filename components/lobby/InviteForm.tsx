import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

type Props = {
  onSubmit: (email: string) => Promise<any>;
};

export default function InviteForm({ onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handle = async () => {
    if (!email) return;
    setBusy(true);
    setMsg(null);
    try {
      await onSubmit(email.trim());
      setMsg('Invite sent.');
      setEmail('');
    } catch (e: any) {
      setMsg(e?.error || 'Failed to send invite.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Invite by email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="person@example.com"
        placeholderTextColor="#777"
        style={styles.input}
      />
      <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={handle} disabled={busy}>
        {busy ? <ActivityIndicator /> : <Text style={styles.btnText}>Send Invite</Text>}
      </Pressable>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, gap: 10 },
  label: { color: '#fff', fontSize: 16, fontWeight: '700' },
  input: { padding: 12, borderRadius: 12, backgroundColor: '#111', borderWidth: 1, borderColor: '#222', color: '#fff' },
  btn: { padding: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#3a3a3a' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700' },
  msg: { color: '#aaa' },
});
