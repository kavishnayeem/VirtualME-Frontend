// app/lobby/index.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, TouchableOpacity, ScrollView, RefreshControl, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import LobbySummary from '../../components/lobby/LobbySummary';
import LobbyList from '../../components/lobby/LobbyList';
import PendingInviteList from '../../components/lobby/PendingInviteList';
import IncomingRequestList from '../../components/lobby/IncomingRequestList';
import { useLobby } from '../../hooks/useLobby';
import { useAuth } from '../../providers/AuthProvider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTAINER_WIDTH = Math.min(SCREEN_WIDTH * 0.98, 500);

export default function LobbyHome() {
  const insets = useSafeAreaInsets();
  const { token, isAuthed } = useAuth();

  const {
    loading,
    error,
    counts,
    grantedTo = [],
    grantedFrom = [],
    pending = [],
    requests = [],
    revokeAccess,
    revokeInvite,
    accept,
    reject,
    refresh,
  } = useLobby(token || undefined);

  const [busyCode, setBusyCode] = useState<string | null>(null);

  const onAccept = async (code: string) => {
    if (!code || busyCode) return;
    try {
      setBusyCode(code);
      const r: any = await accept(code); // hook calls refresh internally
      if (r?.error) throw r;
      // Safety: force refresh in case your hook’s refresh is async
      await refresh();
    } catch (e: any) {
      Alert.alert('Accept failed', e?.details?.error || e?.message || 'Unknown error');
    } finally {
      setBusyCode(null);
    }
  };

  const onReject = async (code: string) => {
    if (!code || busyCode) return;
    try {
      setBusyCode(code);
      const r: any = await reject(code); // hook calls refresh internally
      if (r?.error) throw r;
      await refresh();
    } catch (e: any) {
      Alert.alert('Reject failed', e?.details?.error || e?.message || 'Unknown error');
    } finally {
      setBusyCode(null);
    }
  };

  if (!isAuthed) {
    return (
      <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.error}>Please sign in to use Lobby.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 48 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        bounces
        alwaysBounceVertical
        decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.98}
        refreshControl={<RefreshControl refreshing={!!loading} onRefresh={refresh} tintColor="#fff" />}
      >
        <Text style={styles.h1}>Lobby Summary</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.summaryCard}>
          <LobbySummary grantedTo={counts.grantedTo} grantedFrom={counts.grantedFrom} pending={counts.pending} />
        </View>

        <View style={styles.inviteRow}>
          <Link href="/lobby/invite" asChild>
            <TouchableOpacity style={styles.linkButton} activeOpacity={0.85}>
              <Text style={styles.linkText}>Invite someone →</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.sectionCard}>
          <LobbyList
            title="People you granted access to"
            users={grantedTo}
            emptyText="No one yet. Send an invite."
            actionLabel="Revoke"
            onAction={(u) => revokeAccess(u._id)}
          />
        </View>

        <View style={styles.sectionCard}>
          <LobbyList
            title="People who granted you access"
            users={grantedFrom}
            emptyText="No one yet."
          />
        </View>

        <View style={styles.sectionCard}>
          <PendingInviteList
            items={pending && Array.isArray(pending) ? pending : []}
            onRevoke={revokeInvite}
            emptyText="No pending invites."
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.h2}>Invite Requests For You</Text>
          <IncomingRequestList
            items={requests}
            onAccept={onAccept}
            onReject={onReject}
            emptyText="No requests."
          />
          {busyCode ? <Text style={{ color: '#aaa', marginTop: 8 }}>Working on: {busyCode}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    minHeight: SCREEN_HEIGHT,
  },
  scroll: { width: '100%', flex: 1 },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 32,
    minHeight: SCREEN_HEIGHT,
  },
  h1: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 18,
    marginTop: 0,
    width: CONTAINER_WIDTH,
  },
  h2: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 8 },
  summaryCard: {
    backgroundColor: 'rgba(20,20,22,0.92)',
    borderRadius: 20,
    padding: 22,
    marginBottom: 22,
    width: CONTAINER_WIDTH,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    borderWidth: 1.5,
    borderColor: '#f5f5f5',
    alignSelf: 'center',
  },
  inviteRow: {
    width: CONTAINER_WIDTH,
    alignSelf: 'center',
    marginBottom: 22,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  linkButton: {
    backgroundColor: '#15151c',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 0,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  linkText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: 'rgba(18,18,20,0.96)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 22,
    width: CONTAINER_WIDTH,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    borderWidth: 1.2,
    borderColor: '#e0e0e0',
    alignSelf: 'center',
  },
  error: {
    color: '#ff4c4c',
    backgroundColor: 'rgba(40,0,0,0.18)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    width: CONTAINER_WIDTH,
    alignSelf: 'center',
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
    fontSize: 16,
  },
});
