// services/deviceApi.ts
const RAW_BASE = process.env.EXPO_PUBLIC_DATABASE_API_BASE || 'https://virtual-me-auth.vercel.app';

// 🔹 normalize base once (no trailing slash, no spaces)
const API_BASE = RAW_BASE.trim().replace(/\s+/g, '').replace(/\/+$/, '');

// 🔹 small helper so we never end up with "/devices/ register"
function urlJoin(path: string) {
  const clean = ('/' + path).replace(/\/+/g, '/').replace(/\s+/g, '');
  return `${API_BASE}${clean}`;
}

let AUTH_TOKEN: string | null = null;
export function setDeviceApiAuthToken(token: string | null) {
  AUTH_TOKEN = token && token.trim() ? token : null;
}
function authHeaders(extra: Record<string, string> = {}) {
  return AUTH_TOKEN ? { ...extra, Authorization: `Bearer ${AUTH_TOKEN}` } : extra;
}

export type DeviceRecord = {
  id: string; label?: string; platform?: string; model?: string;
  sharing?: boolean; lastSeenAt?: string | null; ownerId?: string;
};

async function safeJson(resp: Response) {
  const t = await resp.text(); try { return JSON.parse(t); } catch { return t; }
}

export async function fetchMyDevice(id: string): Promise<DeviceRecord | null> {
  const url = urlJoin(`/devices/${encodeURIComponent(id)}`);
  const resp = await fetch(url, { headers: authHeaders({ Accept: 'application/json' }) });
  if (resp.status === 404) return null;
  if (resp.status === 401) throw new Error('Unauthorized. Sign in again.');
  if (!resp.ok) throw new Error(String(await safeJson(resp)));
  return await resp.json();
}

export async function registerThisDevice(body: { id: string; label?: string; platform?: string; model?: string; }): Promise<DeviceRecord> {
  const url = urlJoin('/devices/register');
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(String(await safeJson(resp)));
  return await resp.json();
}

export async function setDeviceSharing(id: string, sharing: boolean): Promise<DeviceRecord> {
  const url = urlJoin(`/devices/${encodeURIComponent(id)}/sharing`);
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify({ sharing }),
  });
  if (!resp.ok) throw new Error(String(await safeJson(resp)));
  return await resp.json();
}
