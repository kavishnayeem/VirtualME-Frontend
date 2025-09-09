export type ObjectId = string;

export type LatestLocation = {
  lat: number;
  lon: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  deviceId?: string;
  ts: string;
} | null;

export type DeviceInfo = {
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  make?: string;
  model?: string;
  pushToken?: string;
  createdAt?: string;
  lastSeenAt?: string;
};

export type UserSummary = {
  _id: ObjectId;
  email: string;
  name?: string;
  picture?: string;
};

export type UserDoc = UserSummary & {
  accessGrantedToUserIds?: ObjectId[];
  accessGrantedFromUserIds?: ObjectId[];
  pendingInvites?: InvitePending[];
  devices?: DeviceInfo[];
  latestLocation?: LatestLocation;
};

export type InvitePending = {
  email: string;
  token: string;
  createdAt: string;
  expiresAt?: string;
};
