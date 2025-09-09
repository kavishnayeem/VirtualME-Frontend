// Minimal fetch wrapper. Caller passes authToken from your AuthProvider.
const API_BASE_DATABASE = process.env.EXPO_PUBLIC_DATABASE_API_BASE ?? 'https://virtual-me-auth.vercel.app';

export async function apiGET<T>(path: string, authToken?: string): Promise<T> {
  const r = await fetch(`${API_BASE_DATABASE}${path}`, {
    headers: {
      'Accept': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    },
  });
  if (!r.ok) throw await toApiError(r);
  return r.json();
}

export async function apiPOST<T>(path: string, body: any, authToken?: string): Promise<T> {
  const r = await fetch(`${API_BASE_DATABASE}${path}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw await toApiError(r);
  return r.json();
}

export async function apiDELETE<T>(path: string, authToken?: string): Promise<T> {
  const r = await fetch(`${API_BASE_DATABASE}${path}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    },
  });
  if (!r.ok) throw await toApiError(r);
  return r.json();
}

async function toApiError(r: Response) {
  let details: any = null;
  try { details = await r.json(); } catch {}
  return { error: `HTTP ${r.status}`, details };
}
