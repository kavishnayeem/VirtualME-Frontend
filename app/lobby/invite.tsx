// app/lobby/invite.tsx
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import InviteForm from '../../components/lobby/InviteForm';
import PendingInviteList from '../../components/lobby/PendingInviteList';
import IncomingRequestList, { IncomingRequest } from '../../components/lobby/IncomingRequestList';
import { useLobby } from '../../hooks/useLobby';
import { useAuth } from '../../providers/AuthProvider';

export default function InviteScreen() {
  const { token } = useAuth();
  const {
    loading,
    refresh,
    snapshot,          // ⬅️ we’ll use me._id
    invite,
    pending = [],
    revokeInvite,
    requests = [],
    accept,
    reject,
  } = useLobby(token || undefined) as ReturnType<typeof useLobby> & { snapshot?: any };

  const meId: string | undefined = snapshot?.me?._id;

  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState(false);

  const onSendInvite = async (email: string) => {
    if (!email) return;
    try {
      setSendBusy(true);
      await invite(email);
      Alert.alert('Invite sent', email);
    } catch (e: any) {
      Alert.alert('Invite failed', e?.details?.error || e?.message || 'Unknown error');
    } finally {
      setSendBusy(false);
    }
  };

  // Helper: find the request by inviteCode and synthesize a fallback code if missing
  const resolveCode = (codeFromRow: string | undefined | null): string | null => {
    // 1) If row already has a code, great.
    if (codeFromRow) return codeFromRow;

    // 2) Otherwise, locate the request row (rare, but can happen for Grants-only rows).
    // Since IncomingRequestList currently passes only the code, we try to find a row with empty code —
    // not reliable. Instead, we fallback to the first code-less row, using meId + ownerId to synthesize.
    // If you have multiple code-less rows, you can enhance IncomingRequestList to pass the whole item.
    const rowWithoutCode: IncomingRequest | undefined = requests.find(r => !r.inviteCode);
    if (rowWithoutCode && rowWithoutCode.owner?._id && meId) {
      return `GRANT-${rowWithoutCode.owner._id}-${meId}`;
    }

    // 3) Last attempt: derive from *this* code by searching the array; if still no luck, return null.
    return null;
  };

  const onAccept = async (codeFromRow: string) => {
    if (busyCode) return;
    const code = resolveCode(codeFromRow);
    if (!code) {
      Alert.alert('Accept failed', 'Missing invite code.');
      return;
    }
    try {
      setBusyCode(code);
      const res: any = await accept(code);
      Alert.alert('Invite accepted', res?.ok ? 'Access granted.' : 'Done.');
    } catch (e: any) {
      Alert.alert('Accept failed', e?.details?.error || e?.message || 'Unknown error');
    } finally {
      setBusyCode(null);
    }
  };

  const onReject = async (codeFromRow: string) => {
    if (busyCode) return;
    const code = resolveCode(codeFromRow);
    if (!code) {
      Alert.alert('Reject failed', 'Missing invite code.');
      return;
    }
    try {
      setBusyCode(code);
      const res: any = await reject(code);
      Alert.alert('Invite rejected', res?.ok ? 'Request removed.' : 'Done.');
    } catch (e: any) {
      Alert.alert('Reject failed', e?.details?.error || e?.message || 'Unknown error');
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={!!loading} onRefresh={refresh} tintColor="#fff" />
      }
    >
      <Text style={styles.h1}>Invite</Text>

      {loading && (
        <View style={styles.inlineLoader}>
          <ActivityIndicator />
          <Text style={styles.inlineLoaderText}>Loading…</Text>
        </View>
      )}

      <InviteForm onSubmit={onSendInvite} />
      {sendBusy ? <Text style={styles.note}>Sending invite…</Text> : null}

      <View style={styles.block}>
        <Text style={styles.h2}>Your Pending Invites</Text>
        <PendingInviteList
          items={pending}
          onRevoke={(code) => revokeInvite(code)}
          emptyText="No pending invites."
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.h2}>Invite Requests For You</Text>
        <IncomingRequestList
          items={requests}
          onAccept={onAccept}
          onReject={onReject}
          emptyText="No requests yet."
        />
        {busyCode ? <Text style={styles.note}>Working on: {busyCode}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  h1: { fontSize: 24, fontWeight: '800', color: '#fff', padding: 12 },
  h2: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 8 },
  block: { paddingHorizontal: 12, paddingBottom: 16 },
  inlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  inlineLoaderText: { color: '#aaa' },
  note: { color: '#aaa', paddingHorizontal: 12, marginTop: 6 },
});
