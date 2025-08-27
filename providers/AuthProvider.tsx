// providers/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getItem, setItem, deleteItem } from '../utils/safeStorage';

type User = { name?: string; email?: string; picture?: string };

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

const BACKEND_BASE ='https://virtual-me-auth.vercel.app';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load saved session
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

  // Listen for popup → postMessage({ type:'vm-auth', payload:{ token, user } })
  useEffect(() => {
    const onMsg = async (ev: MessageEvent) => {
      if (!ev.data || ev.data.type !== 'vm-auth') return;
      const { token, user } = ev.data.payload || {};
      if (!token) return;
      setSessionToken(token);
      setUser(user || null);
      await setItem('vm_session', JSON.stringify({ token, user }));
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const signInWithGoogle = async () => {
    // Opens /auth/google/start which redirects to Google → callback → postMessage → close
    window.open(`${BACKEND_BASE}/auth/google/start`, 'vm-auth', 'width=520,height=640');
  };

  const signOut = async () => {
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
      ready: true, // web popup is always "ready"
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
