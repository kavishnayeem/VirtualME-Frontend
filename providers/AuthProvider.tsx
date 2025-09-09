// providers/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
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

const BACKEND_BASE = 'https://virtual-me-auth.vercel.app';
const isWeb = Platform.OS === 'web';

// So iOS SafariViewController (only used on web popup fallback) can complete
WebBrowser.maybeCompleteAuthSession();

// Grab your Web Client ID from app.json -> extra.googleWebClientId
const GOOGLE_WEB_CLIENT_ID =
  // SDK 49+ universal
  (Constants?.expoConfig as any)?.extra?.googleWebClientId ||
  // fallback
  (Constants?.manifest as any)?.extra?.googleWebClientId;
console.log(GOOGLE_WEB_CLIENT_ID);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Configure native Google once
  useEffect(() => {
    if (!isWeb && GOOGLE_WEB_CLIENT_ID) {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID, // IMPORTANT: use the *Web* client ID
        offlineAccess: true,
      });
    }
  }, []);

  // Restore session
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

  // ===== WEB popup flow (unchanged) =====
  const signInWithGoogleWeb = async () => {
    const onMsg = async (ev: MessageEvent) => {
      if (!ev?.data || ev.data.type !== 'vm-auth') return;
      const { token, user } = ev.data.payload || {};
      if (!token) return;
      await setItem('vm_session', JSON.stringify({ token, user }));
      setSessionToken(token);
      setUser(user || null);
      window.removeEventListener('message', onMsg);
    };
    window.addEventListener('message', onMsg);

    const popup = window.open(
      `${BACKEND_BASE}/auth/google/start`,
      'vm-auth',
      'width=520,height=640'
    );
    if (!popup) {
      window.location.href = `${BACKEND_BASE}/auth/google/start`;
    }
  };

  // ===== NATIVE Google Sign-In calling /auth/google/native =====
  const signInWithGoogleNative = async () => {
    try {
      // Ensure Play Services on Android
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }).catch(() => {});

      const resp: any = await GoogleSignin.signIn();
      // library versions differ in shape, cover both:
      const idToken =
        resp?.idToken ||
        resp?.data?.idToken ||
        (await GoogleSignin.getTokens().catch(() => null))?.idToken;

      if (!idToken) throw new Error('No idToken from Google');

      // Exchange the Google idToken for your app session
      const r = await fetch(`${BACKEND_BASE}/auth/google/native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!r.ok) throw new Error(`Native auth failed: ${r.status}`);
      const { token, user: u } = await r.json();

      await setItem('vm_session', JSON.stringify({ token, user: u }));
      setSessionToken(token);
      // If backend doesn’t return name/picture, fill from Google profile
      setUser(u || { name: resp?.user?.name, email: resp?.user?.email, picture: resp?.user?.photo });
    } catch (e: any) {
      console.error('[signInWithGoogleNative]', e);
      Alert.alert('Sign-in failed', e?.message || 'Try again');
    }
  };

  const signInWithGoogle = async () => {
    if (isWeb) return signInWithGoogleWeb();
    return signInWithGoogleNative();
  };

  const signOut = async () => {
    if (!isWeb) {
      try { await GoogleSignin.signOut(); } catch {}
    }
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
