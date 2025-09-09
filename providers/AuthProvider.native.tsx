// providers/AuthProvider.native.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getItem, setItem, deleteItem } from '../utils/safeStorage';

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

// Your deployed backend
const BACKEND_BASE = 'https://virtual-me-auth.vercel.app';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- Configure native Google SDK once ----
  useEffect(() => {
    try {
      const extra: any = Constants.expoConfig?.extra ?? {};
      GoogleSignin.configure({
        // REQUIRED: your Web client ID (OAuth type = Web application) – used for idToken minting
        webClientId: extra.googleWebClientId,
        // RECOMMENDED on iOS: the iOS client ID (OAuth type = iOS)
        iosClientId: extra.googleIosClientId,
        offlineAccess: false,
        forceCodeForRefreshToken: false,
      });
    } catch (e) {
      console.warn('[Auth] GoogleSignin.configure failed', e);
    }
  }, []);

  // ---- Load stored session on mount ----
  useEffect(() => {
    (async () => {
      try {
        const stored = await getItem('vm_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSessionToken(parsed.token ?? null);
          setUser(parsed.user ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (token: string, u?: User | null) => {
    await setItem('vm_session', JSON.stringify({ token, user: u || null }));
    setSessionToken(token);
    setUser(u || null);
  };

  // ---- Native Google Sign-In → send idToken to backend ----
  const signInWithGoogle = async () => {
    try {
      // Make sure Play Services are available on Android
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const result = await GoogleSignin.signIn();
      // SDK versions differ, pick whichever exists:
      const idToken =
        // @ts-ignore new API
        result?.idToken ||
        // @ts-ignore old API
        result?.data?.idToken;

      const profile =
        // @ts-ignore new API
        result?.user ||
        // @ts-ignore old API
        result?.data?.user;

      if (!idToken) throw new Error('No idToken from Google');

      const resp = await fetch(`${BACKEND_BASE}/auth/google/native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Native auth failed: ${resp.status} ${txt}`);
      }

      const { token, user: u } = await resp.json();

      // Fallback if backend doesn’t send user fields
      const mergedUser: User = u || {
        name: profile?.name,
        email: profile?.email,
        picture: profile?.photo,
      };

      await persist(token, mergedUser);
    } catch (e: any) {
      console.error('[Auth] signInWithGoogle (native) error:', e);
      Alert.alert(
        'Google Sign-in failed',
        e?.message || 'Please try again. If on Android, ensure the correct SHA-1 is registered.'
      );
    }
  };

  const signOut = async () => {
    try {
      await GoogleSignin.signOut().catch(() => {});
    } catch {}
    setUser(null);
    setSessionToken(null);
    await deleteItem('vm_session');
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
