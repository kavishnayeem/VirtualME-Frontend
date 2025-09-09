// hooks/useLobby.ts — patched to be backward‑compatible with your existing types & LobbyAPI
// - Keeps existing return shape & methods
// - Adds optional `requests` (incoming invites for YOU) and `reject()`
// - Safely uses LobbyAPI.requests / LobbyAPI.reject only if they exist; otherwise no-ops

import { useEffect, useMemo, useState, useCallback } from 'react';
import { LobbyAPI } from '../services/api/lobby';
import type { LobbySnapshot } from '../types/lobby';
import type { UserSummary, InvitePending } from '../types/user';

// Local lightweight type for incoming requests (owner -> you)
export type IncomingRequest = {
  inviteCode: string;
  createdAt?: string;
  owner: { _id: string; name?: string; email?: string; picture?: string };
};

type State = {
  loading: boolean;
  error?: string;
  snapshot?: LobbySnapshot;
  grantedTo: UserSummary[];
  grantedFrom: UserSummary[];
  pending: InvitePending[]; // alias for snapshot.pendingInvites
  // NEW (optional): incoming requests sent TO me
  requests?: IncomingRequest[];
};

export function useLobby(authToken?: string) {
  const [state, setState] = useState<State>({
    loading: false,
    snapshot: undefined,
    grantedTo: [],
    grantedFrom: [],
    pending: [],
    requests: [],
  });

  const refresh = useCallback(async () => {
    if (!authToken) return;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      // Always load your canonical snapshot first (keeps prior behavior)
      const snap = await LobbyAPI.snapshot(authToken);
      
      // Try to load incoming requests if the API supports it
      let incoming: IncomingRequest[] = [];
      try {
        const apiAny = LobbyAPI as any;
        if (typeof apiAny?.requests === 'function') {
          const r = await apiAny.requests(authToken);
          // Normalize shape defensively
          incoming = Array.isArray(r?.requests) ? r.requests : Array.isArray(r) ? r : [];
        } else {
          // Optional fallback via fetch if your API layer doesn't expose `requests`
          const base: string | undefined = apiAny?.BASE || apiAny?.base || apiAny?.BASE_URL || apiAny?.baseUrl;
          if (base) {
            const resp = await fetch(`${base}/lobby/requests`, {
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            });
            if (resp.ok) {
              const json = await resp.json();
              incoming = Array.isArray(json?.requests) ? json.requests : [];
            }
          }
        }
      } catch {
        // Silently ignore; feature not available yet
      }

      setState({
        loading: false,
        snapshot: snap,
        grantedTo: snap.grantedTo || [],
        grantedFrom: snap.grantedFrom || [],
        pending: snap.pendingInvites || [],
        requests: incoming || [],
      });
    } catch (e: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e?.details?.error || e?.message || 'Failed to load Lobby',
      }));
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return; // don't fire without JWT
    refresh();
  }, [authToken, refresh]);

  const counts = useMemo(
    () =>
      state.snapshot?.counts ?? {
        grantedTo: state.grantedTo.length,
        grantedFrom: state.grantedFrom.length,
        pending: state.pending.length,
        // You can read requests count directly from `state.requests?.length` when needed
      },
    [state.snapshot, state.grantedTo, state.grantedFrom, state.pending]
  );

  // ===== Same public API you already use =====
  const invite = useCallback(
    (email: string) => (authToken ? LobbyAPI.invite({ email }, authToken).then(refresh) : Promise.resolve()),
    [authToken, refresh]
  );

  const revokeInvite = useCallback(
    (token: string) => (authToken ? LobbyAPI.revokeInvite(token, authToken).then(refresh) : Promise.resolve()),
    [authToken, refresh]
  );

  const revokeAccess = useCallback(
    (targetUserId: string) => (authToken ? LobbyAPI.revokeAccess(targetUserId, authToken).then(refresh) : Promise.resolve()),
    [authToken, refresh]
  );

  const accept = useCallback(
    (token: string) => (authToken ? LobbyAPI.accept(token, authToken).then(refresh) : Promise.resolve()),
    [authToken, refresh]
  );

  // ===== NEW optional action: reject incoming invite by token (inviteCode) =====
  const reject = useCallback(
    async (token: string) => {
      if (!authToken) return;
      const apiAny = LobbyAPI as any;
      if (typeof apiAny?.reject === 'function') {
        await apiAny.reject(token, authToken);
      } else {
        // Best-effort fallback if base URL is discoverable
        const base: string | undefined = apiAny?.BASE || apiAny?.base || apiAny?.BASE_URL || apiAny?.baseUrl;
        if (base) {
          await fetch(`${base}/lobby/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ inviteCode: token }),
          });
        }
      }
      await refresh();
    },
    [authToken, refresh]
  );

  return {
    ...state,
    counts,
    refresh,
    invite,
    revokeInvite,
    revokeAccess,
    accept,
    // NEW (optional)
    requests: state.requests || [],
    reject,
  };
}
