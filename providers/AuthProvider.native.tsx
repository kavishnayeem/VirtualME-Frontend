// providers/AuthProvider.native.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { getItem, setItem, deleteItem } from '../utils/safeStorage';
import { setLocationAuthToken } from '../services/location-bg';
import { setDeviceApiAuthToken } from '../services/deviceApi';

type User = { name?: string; email?: string; picture?: string; _id?: string };

type AuthContextType = {
  isAuthed: boolean;
  loading: boolean;
  user: User | null;
  token: string | null;
  ready: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  isAuthed: false,
  loading: true,
  user: null,
  token: null,
  ready: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

// --- YOUR backend ---
const BACKEND_BASE = 'https://virtual-me-auth.vercel.app';

// --- IMPORTANT ---
// Use the WEB CLIENT ID here (not Android client ID)
// This is the one your backend verifies against:
const WEB_CLIENT_ID = '626679169115-qqbvcsefhea4qfntqngeub6amtapan8o.apps.googleusercontent.com';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Configure native Google Sign-In once
  useEffect(() => {
    try {
      console.log('[Auth] Configuring GoogleSignin with webClientId');
      GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,  // <-- must be Web client ID
        offlineAccess: true,
        forceCodeForRefreshToken: false,
      });
    } catch (e) {
      console.warn('[Auth] GoogleSignin.configure failed', e);
    }
  }, []);

  // Load stored session
  useEffect(() => {
    (async () => {
      try {
        const saved = await getItem('vm_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSessionToken(parsed.token ?? null);
          setUser(parsed.user ?? null);
          console.log('[Auth] Restored existing session for', parsed?.user?.email);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setLocationAuthToken(sessionToken ?? null);
    setDeviceApiAuthToken(sessionToken ?? null);
  }, [sessionToken]);

  async function persist(token: string, u?: User | null) {
    await setItem('vm_session', JSON.stringify({ token, user: u || null }));
    setSessionToken(token);
    setUser(u || null);
  }

  const signInWithGoogle = async () => {
    try {
      console.log('[Auth] signInWithGoogle (native) starting…');

      if (Platform.OS === 'android') {
        console.log('[Auth] Checking Google Play services…');
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      console.log('[Auth] Invoking GoogleSignin.signIn()');
      const res = await GoogleSignin.signIn();

      // Different lib versions expose fields differently; check both shapes
      const idToken =
        // new shape
        (res as any)?.idToken ||
        // legacy shape
        (res as any)?.data?.idToken;

      const profile =
        (res as any)?.user ||
        (res as any)?.data?.user;

      console.log('[Auth] Google sign-in returned. Has idToken?', !!idToken, 'profile email:', profile?.email);

      if (!idToken) {
        throw new Error('No idToken returned by Google Sign-In. Check webClientId configuration.');
      }

      // Send idToken to backend for verification & session
      console.log('[Auth] POST /auth/google/native to backend…');
      const resp = await fetch(`${BACKEND_BASE}/auth/google/native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        console.error('[Auth] Backend /native failed:', resp.status, txt);
        throw new Error(`Native auth failed: ${resp.status}`);
      }

      const { token, user: u } = await resp.json();
      const mergedUser: User = u || {
        name: profile?.name,
        email: profile?.email,
        picture: profile?.photo,
      };

      console.log('[Auth] Backend session created for', mergedUser?.email);
      await persist(token, mergedUser);
    } catch (e: any) {
      // Nice branching for common cases
      if (e?.code) {
        switch (e.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            console.log('[Auth] User cancelled sign-in');
            return;
          case statusCodes.IN_PROGRESS:
            console.log('[Auth] Sign-in already in progress');
            return;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert('Google Play Services', 'Google Play Services not available or outdated.');
            return;
        }
      }
      // DEVELOPER_ERROR shows up here
      if (typeof e?.message === 'string' && e.message.includes('DEVELOPER_ERROR')) {
        console.error('[Auth] Google Sign-in DEVELOPER_ERROR', e);
        Alert.alert(
          'Configuration error (DEVELOPER_ERROR)',
          [
            'This means package name + SHA-1 + Android OAuth client do not match.',
            'Fix steps:',
            '1) Ensure android.package = com.kavishnayeem.virtualme',
            '2) Use SHA-1 from THIS dev build in GCP → Credentials → Android OAuth client',
            '3) Keep Web & Android clients in the same project as your OAuth consent screen',
            '4) In code, GoogleSignin.configure({ webClientId: <WEB client ID> })',
            'After changes: uninstall the app and install dev build again.',
          ].join('\n')
        );
        return;
      }
      console.error('[Auth] signInWithGoogle (native) error:', e);
      Alert.alert('Sign-in failed', e?.message || 'Try again');
    }
  };

  const signOut = async () => {
    try {
      await GoogleSignin.signOut().catch(() => {});
    } catch {}
    setUser(null);
    setSessionToken(null);
    setLocationAuthToken(null);
  setDeviceApiAuthToken(null);
    await deleteItem('vm_session');
    console.log('[Auth] Signed out');
  };

  const value = useMemo(
    () => ({
      isAuthed: !!sessionToken,
      loading,
      user,
      token: sessionToken,
      ready: true,
      signInWithGoogle,
      signOut,
    }),
    [sessionToken, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}