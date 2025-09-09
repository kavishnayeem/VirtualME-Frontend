import type { ObjectId, UserSummary, InvitePending } from './user';

export type LobbySnapshot = {
  me: UserSummary;
  grantedTo: UserSummary[];        // people I granted access to
  grantedFrom: UserSummary[];      // people who granted me access
  pendingInvites: InvitePending[]; // my outgoing pending invites
  counts: {
    grantedTo: number;
    grantedFrom: number;
    pending: number;
  };
};

export type InviteCreatePayload = {
  email: string;
};

export type InviteAcceptPayload = {
  token: string; // from querystring
};

export type LobbyApiError = {
  error: string;
  details?: any;
};
