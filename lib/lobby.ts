const API_BASE = process.env.EXPO_PUBLIC_DATABASE_API_BASE ?? 'https://virtual-me-auth.vercel.app';

export type UserSummary = {
  _id: string;
  email: string;
  name?: string;
  picture?: string;
};

export async function fetchMeAndGranted(token?: string): Promise<{ me: UserSummary; grantedFrom: UserSummary[] }> {
  const hdrs: Record<string, string> = { Accept: 'application/json' };
  if (token) hdrs.Authorization = `Bearer ${token}`;

  // Try /lobby/granted first
  try {
    const r = await fetch(`${API_BASE}/lobby/granted`, { headers: hdrs });
    if (r.ok) {
      const j = await r.json();
      // Common shapes:
      // 1) { me: {...}, granted: [{ status, owner, guest }] (you are guest, owner granted you)
      // 2) [{ status, owner, guest }] without `me`
      let me: UserSummary | undefined;
      let items: any[] = [];

      if (Array.isArray(j)) items = j;
      else if (j && Array.isArray(j.granted)) items = j.granted;

      if (!me && j && j.me && j.me._id) me = j.me;

      const grantedFrom = items
        .filter((g) => g && g.status === 'active')
        .map((g) => g.owner || g.from || g.user || g) // be liberal
        .filter(Boolean);

      // if me not included, ask /me minimally
      if (!me) {
        try {
          const r2 = await fetch(`${API_BASE}/me`, { headers: hdrs });
          if (r2.ok) me = await r2.json();
        } catch {}
      }

      if (!me) throw new Error('Missing `me`');

      // normalize
      const norm = (u: any): UserSummary => ({
        _id: String(u._id ?? ''),
        email: String(u.email ?? ''),
        name: u.name ? String(u.name) : undefined,
        picture: u.picture ? String(u.picture) : undefined,
      });

      return {
        me: norm(me),
        grantedFrom: grantedFrom.map(norm).filter((u) => u._id && u.email),
      };
    }
  } catch { /* fallthrough to /lobby/summary */ }

  // Fallback /lobby/summary (your existing code path)
  const r2 = await fetch(`${API_BASE}/lobby/summary`, { headers: hdrs });
  if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
  const s = await r2.json() as {
    me: UserSummary;
    received?: Array<{ status: 'active' | string; owner: UserSummary }>;
  };

  const me = s.me;
  const grantedFrom = Array.isArray(s.received)
    ? s.received.filter((g) => g.status === 'active').map((g) => g.owner)
    : [];

  return { me, grantedFrom };
}
