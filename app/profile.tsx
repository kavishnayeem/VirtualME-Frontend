// app/profile.tsx
import React from 'react';
import { View, StyleSheet, Image, Pressable, ActivityIndicator, Platform } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useAuth } from '../providers/AuthProvider';

const BACKEND_BASE ="https://virtual-me-auth.vercel.app";

export default function ProfileScreen() {
  // ✅ Hooks at top-level only
  const { user, isAuthed, loading, signInWithGoogle, signOut, token, ready } = useAuth();

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={{ marginBottom: 12 }}>Profile</ThemedText>

      {isAuthed && user ? (
        <>
          {user.picture ? <Image source={{ uri: user.picture }} style={styles.avatar} /> : null}
          <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginTop: 8 }}>
            {user.name || 'Signed in'}
          </ThemedText>
          <ThemedText style={{ opacity: 0.7, marginBottom: 24 }}>{user.email}</ThemedText>

          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={signOut}>
            <ThemedText style={{ color: 'black' }}>Sign out</ThemedText>
          </Pressable>

          <View style={{ height: 24 }} />

          <Pressable
            style={[styles.btn, styles.btnOutline]}
            onPress={async () => {
              try {
                if (!token) {
                  alert('No session token, sign in first.');
                  return;
                }
                const res = await fetch(`${BACKEND_BASE}/calendar/next`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                alert(`Next event: ${data?.summary || data?.message || 'None found'}`);
              } catch (e) {
                alert('Failed to fetch calendar');
                console.error(e);
              }
            }}>
            <ThemedText>Test Calendar: Next event</ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText style={{ opacity: 0.8, marginBottom: 16 }}>
            Sign in to sync your calendar and personalize VirtualMe.
          </ThemedText>
          <Pressable
            style={[styles.btn, !ready && { opacity: 0.5 }]}
            onPress={signInWithGoogle}
            disabled={!ready}
          >
            <ThemedText style={{ color: 'black' }}>Continue with Google</ThemedText>
          </Pressable>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  btn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, backgroundColor: 'white' },
  btnSecondary: { backgroundColor: '#eee' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
});
