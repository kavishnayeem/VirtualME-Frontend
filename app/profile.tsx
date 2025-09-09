import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useAuth } from '../providers/AuthProvider';

// Point to your deployed auth backend
const BACKEND_BASE = 'https://virtual-me-auth.vercel.app';

// ---- Types ----
export type ProfileFields = {
  character: string;
  homeAddress: string;
  usualPlaces: string[]; // comma-separated in UI
  languages: string[];
  timeZone: string;
  availability: string; // e.g., "Weekdays 9–6"
  voiceStyle: string;   // e.g., "Warm, concise"
  aiPersona: string;    // short bio used by GROQ
  calendarPrefs: string; // e.g., "buffer 10m before meetings"
  locationSharingOptIn: boolean;
};

export type MeResponse = {
  _id?: string;
  name?: string;
  email?: string;
  picture?: string;
  profile?: ProfileFields;
};

export default function ProfileScreen() {
  const { user, isAuthed, loading, signInWithGoogle, signOut, token, ready } = useAuth();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Local form state (mirrors profile)
  const [character, setCharacter] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [usualPlacesCsv, setUsualPlacesCsv] = useState('');
  const [languagesCsv, setLanguagesCsv] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [availability, setAvailability] = useState('');
  const [voiceStyle, setVoiceStyle] = useState('');
  const [aiPersona, setAiPersona] = useState('');
  const [calendarPrefs, setCalendarPrefs] = useState('');
  const [locationSharingOptIn, setLocationSharingOptIn] = useState(false);

  const authedHeaders = useMemo(() => {
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthed || !token) {
        setMe(null);
        setInitialLoaded(true);
        return;
      }
      try {
        const res = await fetch(`${BACKEND_BASE}/me`, { headers: authedHeaders });
        const data: MeResponse = await res.json();
        if (cancelled) return;
        setMe(data);
        // Seed form
        const p = data.profile || ({} as ProfileFields);
        setCharacter(p.character || '');
        setHomeAddress(p.homeAddress || '');
        setUsualPlacesCsv((p.usualPlaces || []).join(', '));
        setLanguagesCsv((p.languages || []).join(', '));
        setTimeZone(p.timeZone || '');
        setAvailability(p.availability || '');
        setVoiceStyle(p.voiceStyle || '');
        setAiPersona(p.aiPersona || '');
        setCalendarPrefs(p.calendarPrefs || '');
        setLocationSharingOptIn(!!p.locationSharingOptIn);
      } catch (e) {
        console.error('Failed to load /me', e);
      } finally {
        if (!cancelled) setInitialLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthed, token]);

  async function saveProfile() {
    if (!token) return alert('No session token; sign in first.');
    setSaving(true);
    try {
      const body = {
        profile: {
          character,
          homeAddress,
          usualPlaces: splitCsv(usualPlacesCsv),
          languages: splitCsv(languagesCsv),
          timeZone,
          availability,
          voiceStyle,
          aiPersona,
          calendarPrefs,
          locationSharingOptIn,
        },
      };
      const res = await fetch(`${BACKEND_BASE}/me`, {
        method: 'PUT',
        headers: { ...authedHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `Save failed: ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) msg += ` — ${j.error}`;
        } catch {}
        throw new Error(msg);
      }
      const updated: MeResponse = await res.json();
      setMe(updated);
      setEditMode(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !initialLoaded) {
    return (
      <ThemedView style={styles.containerCenter}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!isAuthed || !user) {
    return (
      <ThemedView style={styles.containerCenter}>
        <ThemedText style={{ opacity: 0.8, marginBottom: 16 }}>
          Sign in to sync your calendar and personalize VirtualMe.
        </ThemedText>
        <Pressable
            style={styles.btn}
            onPress={() => {
              console.log('[UI] Continue with Google pressed');
              signInWithGoogle();
            }}
          >
              <ThemedText style={{ color: 'black' }}>Continue with Google</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  // ---- Authed UI ----
  return (
    <ThemedView style={styles.container}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {user.picture ? <Image source={{ uri: user.picture }} style={styles.avatar} /> : null}
          <View style={{ marginLeft: 12, flex: 1 }}>
            <ThemedText type="title" style={{ marginBottom: 2 }}>{user.name || 'Signed in'}</ThemedText>
            <ThemedText style={{ opacity: 0.8 }}>{user.email}</ThemedText>
            {!!me?._id && (
              <ThemedText style={{ opacity: 0.6, fontSize: 12, marginTop: 4 }}>ID: {me._id}</ThemedText>
            )}
          </View>
          <Pressable style={[styles.btnSm, styles.btnSecondary]} onPress={signOut}>
            <ThemedText style={{ color: 'black' }}>Sign out</ThemedText>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Edit/View Toggle */}
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle">Personalization for VirtualMe</ThemedText>
          <Pressable style={[styles.btnSm, styles.btnOutline]} onPress={() => setEditMode((v) => !v)}>
            <ThemedText>{editMode ? 'Cancel' : 'Edit'}</ThemedText>
          </Pressable>
        </View>

        {/* Form or Readonly */}
        {editMode ? (
          <View style={styles.card}>
            <FormText label="Character" placeholder="e.g., Empathetic, direct, playful" value={character} onChangeText={setCharacter} />
            <FormText label="Home Address" placeholder="Street, City, State" value={homeAddress} onChangeText={setHomeAddress} />
            <FormText label="Usual Places (comma‑separated)" placeholder="Gym, H‑E‑B, TAMU‑CC, Coffee shop" value={usualPlacesCsv} onChangeText={setUsualPlacesCsv} />
            <FormText label="Languages (comma‑separated)" placeholder="English, Hindi/Urdu, Arabic" value={languagesCsv} onChangeText={setLanguagesCsv} />
            <FormText label="Time Zone" placeholder="America/Chicago" value={timeZone} onChangeText={setTimeZone} />
            <FormText label="Availability" placeholder="Weekdays 9–6; weekends flexible" value={availability} onChangeText={setAvailability} />
            <FormText label="Voice Style" placeholder="Warm, concise, enthusiastic" value={voiceStyle} onChangeText={setVoiceStyle} />
            <FormText label="AI Persona (short bio)" placeholder="Helps Kavish plan the day, tracks calendar/location, concise suggestions" value={aiPersona} onChangeText={setAiPersona} multiline />
            <FormText label="Calendar Prefs" placeholder="Add 10m buffers; warn if overlap > 15m" value={calendarPrefs} onChangeText={setCalendarPrefs} />

            {/* Simple boolean toggle */}
            <Pressable
              onPress={() => setLocationSharingOptIn((v) => !v)}
              style={[styles.toggleRow, locationSharingOptIn && styles.toggleRowOn]}
            >
              <ThemedText>Location Sharing Opt‑In: {locationSharingOptIn ? 'On' : 'Off'}</ThemedText>
            </Pressable>

            <Pressable style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.5 }]} onPress={saveProfile} disabled={saving}>
              <ThemedText style={{ color: 'black' }}>{saving ? 'Saving…' : 'Save'}</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>            
            <ReadOnlyRow label="Character" value={me?.profile?.character} />
            <ReadOnlyRow label="Home Address" value={me?.profile?.homeAddress} />
            <ReadOnlyRow label="Usual Places" value={(me?.profile?.usualPlaces || []).join(', ')} />
            <ReadOnlyRow label="Languages" value={(me?.profile?.languages || []).join(', ')} />
            <ReadOnlyRow label="Time Zone" value={me?.profile?.timeZone} />
            <ReadOnlyRow label="Availability" value={me?.profile?.availability} />
            <ReadOnlyRow label="Voice Style" value={me?.profile?.voiceStyle} />
            <ReadOnlyRow label="AI Persona" value={me?.profile?.aiPersona} />
            <ReadOnlyRow label="Calendar Prefs" value={me?.profile?.calendarPrefs} />
            <ReadOnlyRow label="Location Sharing Opt‑In" value={me?.profile?.locationSharingOptIn ? 'On' : 'Off'} />
          </View>
        )}

        {/* Example: test calendar call remains */}
        <Pressable
          style={[styles.btn, styles.btnOutline, { marginTop: 12 }]}
          onPress={async () => {
            try {
              if (!token) {
                alert('No session token, sign in first.');
                return;
              }
              const res = await fetch(`${BACKEND_BASE}/calendar/next`, { headers: authedHeaders });
              const data = await res.json();
              alert(`Next event: ${data?.summary || data?.message || 'None found'}`);
            } catch (e) {
              alert('Failed to fetch calendar');
              console.error(e);
            }
          }}
        >
          <ThemedText>Test Calendar: Next event</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

function splitCsv(s: string): string[] {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function ReadOnlyRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>      
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText style={styles.rowValue}>{value || '—'}</ThemedText>
    </View>
  );
}

function FormText({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <ThemedText style={{ marginBottom: 6 }}>{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.4)"
        style={[styles.input, multiline && { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
        multiline={!!multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  containerCenter: { flex: 1, padding: 20, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },

  headerCard: {
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  card: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  btn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, backgroundColor: 'white', alignSelf: 'center' },
  btnPrimary: { backgroundColor: '#fff' },
  btnSecondary: { backgroundColor: '#eee' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  btnSm: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'white' },

  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },

  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  rowLabel: { opacity: 0.7, marginBottom: 4 },
  rowValue: { fontSize: 16 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
  },

  toggleRow: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 18,
    alignItems: 'center',
  },
  toggleRowOn: {
    borderColor: 'rgba(144,238,144,0.8)',
    backgroundColor: 'rgba(144,238,144,0.06)'
  }
});