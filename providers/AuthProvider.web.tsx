// providers/AuthProvider.web.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
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

const BACKEND_BASE = 'https://virtual-me-auth.vercel.app';

const AuthContext = createContext<AuthContextType>({
  isAuthed: false,
  loading: true,
  user: null,
  token: null,
  ready: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session
  useEffect(() => {
    (async () => {
      try {
        const saved = await getItem('vm_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSessionToken(parsed.token ?? null);
          setUser(parsed.user ?? null);
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
  const signInWithGoogle = async () => {
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

  const signOut = async () => {
    setUser(null);
    setSessionToken(null);
    setLocationAuthToken(null);
    setDeviceApiAuthToken(null);
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
