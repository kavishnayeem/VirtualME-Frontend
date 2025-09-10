import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { usePersonaTarget } from './usePersonaTarget';

const API_BASE = process.env.EXPO_PUBLIC_DATABASE_API_BASE ?? 'https://virtual-me-auth.vercel.app';

// You can adapt these to your real endpoints
const pathForLocation = (userId: string) => `${API_BASE}/people/${encodeURIComponent(userId)}/location/snapshot`;
const pathForAgenda   = (userId: string, limit = 3) => `${API_BASE}/people/${encodeURIComponent(userId)}/calendar/next?limit=${limit}`;

export type LocationSnapshot = {
  lat: number;
  lng: number;
  when?: string;   // ISO string
  label?: string;  // e.g., "Home" or reverse geocode
};

export type CalendarItem = {
  id: string;
  title: string;
  start: string;   // ISO
  end?: string;    // ISO
  location?: string;
};

export function usePersonaResources(opts?: { agendaLimit?: number }) {
  const { token } = useAuth?.() ?? ({ token: undefined } as any);
  const { target } = usePersonaTarget();
  const [loc, setLoc] = useState<LocationSnapshot | null>(null);
  const [events, setEvents] = useState<CalendarItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const userId = target?._id || null;
  const limit = opts?.agendaLimit ?? 3;

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLoc(null); setEvents(null); setErr(null);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        // fetch in parallel
        const [rLoc, rCal] = await Promise.allSettled([
          fetch(pathForLocation(userId), { headers }),
          fetch(pathForAgenda(userId, limit), { headers }),
        ]);

        if (!cancelled) {
          // location
          if (rLoc.status === 'fulfilled' && rLoc.value.ok) {
            const j = await rLoc.value.json();
            const snap: LocationSnapshot = {
              lat: Number(j.lat ?? j.latitude ?? 0),
              lng: Number(j.lng ?? j.longitude ?? 0),
              when: typeof j.when === 'string' ? j.when : (j.updatedAt || j.timestamp || undefined),
              label: typeof j.label === 'string' ? j.label : undefined,
            };
            setLoc(snap);
          } else {
            setLoc(null);
          }

          // calendar
          if (rCal.status === 'fulfilled' && rCal.value.ok) {
            const arr = await rCal.value.json();
            const next: CalendarItem[] = Array.isArray(arr) ? arr.map((e: any) => ({
              id: String(e.id ?? e._id ?? e.eventId ?? Math.random().toString(36).slice(2)),
              title: String(e.title ?? e.summary ?? 'Event'),
              start: String(e.start?.dateTime ?? e.start ?? e.startTime ?? ''),
              end: e.end ? String(e.end?.dateTime ?? e.end ?? e.endTime) : undefined,
              location: e.location ? String(e.location) : undefined,
            })) : [];
            setEvents(next);
          } else {
            setEvents(null);
          }
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load persona resources');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, token, limit]);

  return useMemo(() => ({ userId, location: loc, events, loading, error: err }), [userId, loc, events, loading, err]);
}
