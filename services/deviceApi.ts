// services/deviceApi.ts
const API_BASE = process.env.EXPO_PUBLIC_DATABASE_API_BASE || 'https://virtual-me-auth.vercel.app';

type RegisterBody = {
  id: string;            // deviceId
  label?: string;
  platform?: string;     // ios | android | web
  model?: string;
};

export type DeviceRecord = {
  id: string;
  label?: string;
  platform?: string;
  model?: string;
  sharing?: boolean;
  lastSeenAt?: string | null;
};

async function safeJson(resp: Response) {
  const text = await resp.text();
  try { return JSON.parse(text); } catch { return text; }
}

// GET /devices/:id  -> 200 {id, label, sharing, ...} | 404
export async function fetchMyDevice(id: string): Promise<DeviceRecord | null> {
  try {
    const resp = await fetch(`${API_BASE}/devices/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Fetch device failed (${resp.status})`);
    return (await resp.json()) as DeviceRecord;
  } catch (e) {
    // Until backend exists, just return null (unregistered)
    return null;
  }
}

// POST /devices/register  body: { id, label, platform, model } -> {id,...}
export async function registerThisDevice(body: RegisterBody): Promise<DeviceRecord> {
  try {
    const resp = await fetch(`${API_BASE}/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const j = await safeJson(resp);
      throw new Error(typeof j === 'string' ? j : j?.error || `Register failed (${resp.status})`);
    }
    return (await resp.json()) as DeviceRecord;
  } catch (e: any) {
    // Front-end only mode: fake a record so UI keeps working
    return {
      id: body.id,
      label: body.label,
      platform: body.platform,
      model: body.model,
      sharing: false,
      lastSeenAt: null,
    };
  }
}

// POST /devices/:id/sharing  body: { sharing: boolean } -> updated record
export async function setDeviceSharing(id: string, sharing: boolean): Promise<DeviceRecord> {
  try {
    const resp = await fetch(`${API_BASE}/devices/${encodeURIComponent(id)}/sharing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sharing }),
    });
    if (!resp.ok) {
      const j = await safeJson(resp);
      throw new Error(typeof j === 'string' ? j : j?.error || `Set sharing failed (${resp.status})`);
    }
    return (await resp.json()) as DeviceRecord;
  } catch {
    // Front-end only mode: pretend it toggled
    return {
      id,
      sharing,
      lastSeenAt: null,
    } as DeviceRecord;
  }
}
