import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getItem, setItem, deleteItem } from '../utils/safeStorage';

export type UserSummary = {
  _id: string;
  email: string;
  name?: string;
  picture?: string;
};

type PersonaTargetCtx = {
  target?: UserSummary | null;              // who the app should “speak for”
  setTarget: (u: UserSummary | null) => void;
  clear: () => void;
};

const Ctx = createContext<PersonaTargetCtx | undefined>(undefined);

const STORE_KEY = 'personaTargetUser';

export function PersonaTargetProvider({ children }: { children: React.ReactNode }) {
  const [target, setTargetState] = useState<UserSummary | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await getItem(STORE_KEY);
      if (raw) {
        try { setTargetState(JSON.parse(raw)); } catch {}
      }
    })();
  }, []);

  const setTarget = async (u: UserSummary | null) => {
    setTargetState(u);
    if (u) await setItem(STORE_KEY, JSON.stringify(u));
    else await deleteItem(STORE_KEY);
  };

  const clear = async () => setTarget(null);

  const value = useMemo(() => ({ target, setTarget, clear }), [target]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePersonaTarget() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePersonaTarget must be used inside <PersonaTargetProvider>');
  return v;
}
