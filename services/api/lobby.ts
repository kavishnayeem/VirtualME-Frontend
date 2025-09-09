// services/api/lobby.ts
import { apiGET, apiPOST } from './index';
import type { LobbySnapshot, InviteCreatePayload } from '../../types/lobby';
import type { UserSummary, InvitePending } from '../../types/user';

type SummaryGrantTo = {
  status: 'active' | 'pending' | string;
  inviteCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
  id?: string;
  grantId?: string;
  guest: UserSummary;
};

type SummaryGrantFrom = {
  status: 'active' | 'pending' | string;
  createdAt?: string;
  updatedAt?: string;
  id?: string;
  grantId?: string;
  owner: UserSummary;
};

type LobbySummaryResponse = {
  me: UserSummary;
  granted?: SummaryGrantTo[];
  received?: SummaryGrantFrom[];
};

const SUMMARY_PATH = '/lobby/summary';
const INVITE_PATH  = '/lobby/invite';
const ACCEPT_PATH  = '/lobby/accept';
const REVOKE_PATH  = '/lobby/revoke';
const REQUESTS_PATH = '/lobby/requests';
const REJECT_PATH   = '/lobby/reject';
// ---- helpers --------------------------------------------------

async function fetchSummary(authToken?: string): Promise<LobbySummaryResponse> {
  return apiGET<LobbySummaryResponse>(SUMMARY_PATH, authToken);
}

function toGrantId(g: { id?: string; grantId?: string }) {
  return g.grantId || g.id || '';
}

function mapSummaryToSnapshot(s: LobbySummaryResponse): LobbySnapshot {
  const me = s.me;

  const grantedActive = (s.granted ?? []).filter(g => g?.status === 'active' && g?.guest);
  const grantedPending = (s.granted ?? []).filter(g => g?.status === 'pending' && g?.guest);
  const receivedActive = (s.received ?? []).filter(g => g?.status === 'active' && g?.owner);

  const grantedTo: UserSummary[]   = grantedActive.map(g => g.guest);
  const grantedFrom: UserSummary[] = receivedActive.map(g => g.owner);

  const pendingInvites: InvitePending[] = grantedPending.map(g => ({
    email: g.guest.email,
    token: g.inviteCode || '',
    createdAt: g.createdAt || '',
    // expiresAt?: keep undefined unless your API provides it
  }));

  const counts = {
    grantedTo: grantedTo.length,
    grantedFrom: grantedFrom.length,
    pending: pendingInvites.length,
  };

  return { me, grantedTo, grantedFrom, pendingInvites, counts };
}

// ---- public API ----------------------------------------------

export const LobbyAPI = {
  // Canonical snapshot (maps /lobby/summary into your LobbySnapshot shape)
  async snapshot(authToken?: string): Promise<LobbySnapshot> {
    const s = await fetchSummary(authToken);
    return mapSummaryToSnapshot(s);
  },

  // Derived helpers (still available if something else calls them)
  async grantedTo(authToken?: string) {
    const s = await fetchSummary(authToken);
    return (s.granted ?? [])
      .filter(g => g?.status === 'active' && g?.guest)
      .map(g => g.guest) as UserSummary[];
  },

  async grantedFrom(authToken?: string) {
    const s = await fetchSummary(authToken);
    return (s.received ?? [])
      .filter(g => g?.status === 'active' && g?.owner)
      .map(g => g.owner) as UserSummary[];
  },

  // Keep the old return shape { pending: InvitePending[] } for any callers using it
  async pending(authToken?: string) {
    const snap = await LobbyAPI.snapshot(authToken);
    return { pending: snap.pendingInvites };
  },

  invite(payload: InviteCreatePayload, authToken?: string) {
    return apiPOST<{ ok: true } | { error: string }>(INVITE_PATH, payload, authToken);
  },

  // Revoke a pending invite (token = inviteCode)
  revokeInvite(token: string, authToken?: string) {
    return apiPOST<{ ok: true } | { error: string }>(REVOKE_PATH, { inviteCode: token }, authToken);
  },

  // Revoke active access by finding the grantId via /lobby/summary first
  async revokeAccess(targetUserId: string, authToken?: string) {
    const s = await fetchSummary(authToken);
    const match = (s.granted ?? []).find(
      g => g?.guest?._id === targetUserId && g.status === 'active'
    );
    const grantId = match ? toGrantId(match) : '';
    if (!grantId) return { error: 'grant_not_found' } as { error: string };
    return apiPOST<{ ok: true } | { error: string }>(REVOKE_PATH, { grantId }, authToken);
  },
  requests(authToken?: string) {
    // server returns: { requests: [{ inviteCode?: string|null, createdAt?: string, owner: UserSummary }] }
    return apiGET<{ requests: Array<{ inviteCode?: string | null; createdAt?: string; owner: UserSummary }> }>(
      REQUESTS_PATH,
      authToken
    );
  },
  reject(token: string, authToken?: string) {
    return apiPOST<{ ok: true } | { error: string }>(REJECT_PATH, { inviteCode: token }, authToken);
  },
  // Accept an invite (token = inviteCode)
  accept(token: string, authToken?: string) {
    return apiPOST<{ ok: true } | { error: string }>(ACCEPT_PATH, { inviteCode: token }, authToken);
  },
};
