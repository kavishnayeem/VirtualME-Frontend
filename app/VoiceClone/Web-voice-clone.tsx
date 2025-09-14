// Web-voice-clone.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Platform, TextInput, StyleSheet, ScrollView, Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { useAuth } from '../../providers/AuthProvider';

const SERVER_URL = 'https://virtual-me-backend.vercel.app';
const AUTH_BASE = 'https://virtual-me-auth.vercel.app';

const getSampleText = (userName?: string) => {
  const name = userName || 'yourself';
  return (
    `Hello, my name is ${name}. I am excited to introduce you to VirtualMe, a platform designed to help you stay connected and present, even when you are busy. With VirtualMe, your voice can deliver messages, share updates, and interact with your friends and family just as you would. Imagine being able to send a warm greeting, remind your loved ones about important events, or simply check in, all in your own voice. This technology ensures that your unique tone and personality shine through every message. Whether you are at work, traveling, or simply taking a break, VirtualMe keeps you close to those who matter most. Experience the comfort of knowing that your presence is felt, your words are heard, and your relationships remain strong. Welcome to a new era of communication, where your voice truly represents you, anytime and anywhere.`
  );
};

export default function VoiceCloneScreen() {
  const { token,user } = useAuth();

  // Always return a concrete object to satisfy TS's HeadersInit
  const authedHeaders = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [voiceIdInput, setVoiceIdInput] = useState<string>(''); // allow paste / override
  const [busy, setBusy] = useState(false);

  // Native playback
  const soundRef = useRef<Audio.Sound | null>(null);
  const [nativeAudioUri, setNativeAudioUri] = useState<string | null>(null);

  // Web playback
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [webSrc, setWebSrc] = useState<string | null>(null);

  // Record & Clone (web + mobile)
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const saveVoiceId = useCallback(async () => {
    const id = (voiceIdInput || '').trim();
    if (!id) return Alert.alert('Missing', 'Paste a voice ID first.');
    if (!token) return Alert.alert('Sign in', 'Please sign in first.');
  
    try {
      setBusy(true);
      const resp = await fetch(`${AUTH_BASE}/me/voice-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authedHeaders },
        body: JSON.stringify({ voiceId: id }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Save failed: ${resp.status} ${t}`);
      }
      const data = await resp.json();
      setVoiceId(data.voiceId);            // keep local state in sync
      Alert.alert('Saved', 'Voice ID updated in your profile.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to save voice ID');
    } finally {
      setBusy(false);
    }
  }, [voiceIdInput, token, authedHeaders]);
  
  // preload saved voiceId from backend
  const loadMyVoice = useCallback(async () => {
    if (!token) return; // not signed in
    try {
      setBusy(true);
      const resp = await fetch(`${SERVER_URL}/me/voice`, { headers: authedHeaders });
      if (resp.ok) {
        const json = await resp.json();
        if (json?.voiceId) {
          setVoiceId(json.voiceId);
          setVoiceIdInput(json.voiceId);
        }
      } else if (resp.status === 401) {
        // Not authed; ignore
      }
    } catch (e) {
      console.warn('Failed to load /me/voice', e);
    } finally {
      setBusy(false);
    }
  }, [token, authedHeaders]);

  useEffect(() => { loadMyVoice(); }, [loadMyVoice]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setBusy(true);
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Microphone permission is required to record your voice.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setRecordedUri(null);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to start recording');
    } finally {
      setBusy(false);
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      setBusy(true);
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecordedUri(uri || null);
      Alert.alert('Recording saved', 'You can now upload and clone your voice.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to stop recording');
    } finally {
      setBusy(false);
    }
  }, [recording]);

  // Upload and clone
  const uploadAndClone = useCallback(async () => {
    if (!token) return Alert.alert('Sign in', 'Please sign in first.');
    if (!recordedUri) {
      Alert.alert('No recording', 'Please record your voice first.');
      return;
    }
    try {
      setBusy(true);
      const form = new FormData();
      form.append('name', 'MyVoice');

      if (Platform.OS === 'web') {
        const fileBlob = await fetch(recordedUri).then(r => r.blob());
        const filename = 'sample.webm';
        const mime = fileBlob.type || 'audio/webm';
        // @ts-ignore - React Native web's File is fine on web
        form.append('audio', new File([fileBlob], filename, { type: mime }));
      } else {
        // @ts-ignore React Native FormData file shape
        form.append('audio', { uri: recordedUri, name: 'sample.m4a', type: 'audio/m4a' });
      }

      const resp = await fetch(`${SERVER_URL}/clone`, {
        method: 'POST',
        body: form,
        headers: authedHeaders,
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Clone failed: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      setVoiceId(data.voice_id);
      setVoiceIdInput(data.voice_id);
      Alert.alert('Voice cloned', `Saved voice_id: ${data.voice_id}`);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to clone voice');
    } finally {
      setBusy(false);
    }
  }, [recordedUri, token, authedHeaders]);

  // Generate & Play (use pasted/cloned voice if set; else let backend fallback to DEFAULT_VOICE_ID)
  const generateAndPlay = useCallback(async () => {
    const id = (voiceIdInput?.trim() || voiceId || '').trim();
    try {
      setBusy(true);
      const body: any = { text: getSampleText(user?.name) };
      // Only include voiceId if we actually have one; otherwise backend will use DEFAULT_VOICE_ID
      if (id) body.voiceId = id;

      const resp = await fetch(`${SERVER_URL}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authedHeaders },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`TTS failed: ${resp.status} ${t}`);
      }

      const blob = await resp.blob();

      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        if (webSrc && webSrc.startsWith('blob:')) URL.revokeObjectURL(webSrc);
        setWebSrc(url); // user taps Play
      } else {
        const base64 = await blobToBase64Compat(blob, setBusy);
        const fileUri = `${FileSystem.cacheDirectory}tts-${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        setNativeAudioUri(fileUri);

        if (soundRef.current) {
          try { await soundRef.current.stopAsync(); } catch {}
          try { await soundRef.current.unloadAsync(); } catch {}
          soundRef.current = null;
        }
        const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
        soundRef.current = sound;
        await sound.playAsync();
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to synthesize');
    } finally {
      setBusy(false);
    }
  }, [voiceId, voiceIdInput, webSrc, authedHeaders]);

  // Cleanup web/native audio
  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
      if (webSrc && webSrc.startsWith('blob:')) URL.revokeObjectURL(webSrc);
    };
  }, [webSrc]);

  // Play back the recorded sample (before upload)
  const playRecording = useCallback(async () => {
    if (!recordedUri) return;
    try {
      setBusy(true);
      setIsPlayingRecording(true);
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); } catch {}
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: recordedUri });
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if ((status as any).didJustFinish) {
          setIsPlayingRecording(false);
          sound.setOnPlaybackStatusUpdate(null);
        }
      });

      await sound.playAsync();
    } catch (e: any) {
      setIsPlayingRecording(false);
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to play recording');
    } finally {
      setBusy(false);
    }
  }, [recordedUri]);

  // Stop playback of the recorded sample
  const stopPlayingRecording = useCallback(async () => {
    setIsPlayingRecording(false);
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, []);

  // If user navigates away or recording changes, stop playback
  useEffect(() => {
    return () => {
      setIsPlayingRecording(false);
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, [recordedUri]);

  const windowWidth = Dimensions.get('window').width;
  const cardMaxWidth = Math.min(windowWidth - 24, 480);

  return (
    <View style={[styles.container, { backgroundColor: '#18181b' }]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', minHeight: '100%' }}
        keyboardShouldPersistTaps="handled"
        style={{ width: '100%' }}
      >
        <View style={[styles.card, { maxWidth: cardMaxWidth, width: '100%' }]}>
          <Text style={styles.title}>
            Voice <Text style={styles.titleAccent}>Cloning</Text>
          </Text>

          <Text style={styles.subtitle}>
            <Text style={styles.step}>•</Text> Paste an existing voice ID and play a sample, or{' '}
            <Text style={styles.step}>Record & Clone</Text> once to create one.
          </Text>

          {/* Voice ID input / reuse */}
          <Text style={[styles.label]}>Voice ID</Text>
          <TextInput
            value={voiceIdInput}
            onChangeText={setVoiceIdInput}
            placeholder="e.g. 6tX...your-voice-id"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
              disabled={!voiceIdInput || busy}
              onPress={saveVoiceId}
              style={[styles.btn, (!voiceIdInput || busy) ? styles.btnDisabled : styles.btnHollow]}
            >
              <Text style={styles.btnText}>Use This Voice ID</Text>
            </Pressable>

          {/* Record & Clone */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Pressable
              disabled={busy || !!recording}
              onPress={startRecording}
              style={[
                styles.btn,
                { flex: 1, marginRight: 5 },
                (busy || !!recording) ? styles.btnDisabled : styles.btnPrimary,
              ]}
            >
              <Text style={styles.btnText}>{recording ? 'Recording...' : 'Start Recording'}</Text>
            </Pressable>
            <Pressable
              disabled={busy || !recording}
              onPress={stopRecording}
              style={[
                styles.btn,
                { flex: 1, marginLeft: 5 },
                (busy || !recording) ? styles.btnDisabled : styles.btnSecondary,
              ]}
            >
              <Text style={styles.btnText}>Stop Recording</Text>
            </Pressable>
          </View>

          {recordedUri && (
            <View style={{ marginBottom: 10 }}>
              <Pressable
                disabled={busy}
                onPress={isPlayingRecording ? stopPlayingRecording : playRecording}
                style={[styles.btn, busy ? styles.btnDisabled : styles.btnHollow]}
              >
                <Text style={styles.btnText}>
                  {isPlayingRecording ? 'Stop Playing' : 'Play Recording'}
                </Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={uploadAndClone}
                style={[styles.btn, busy ? styles.btnDisabled : styles.btnPrimary]}
              >
                <Text style={styles.btnText}>Upload & Clone</Text>
              </Pressable>
              <Text style={[styles.badgeText, { color: '#a5b4fc', textAlign: 'center', marginTop: 4 }]}>
                Recording ready: {recordedUri.length > 40 ? recordedUri.slice(-40) : recordedUri}
              </Text>
            </View>
          )}

          {/* Generate */}
          <Pressable
            disabled={busy}
            onPress={generateAndPlay}
            style={[styles.btn, busy ? styles.btnDisabled : styles.btnSecondary]}
          >
            <Text style={styles.btnText}>Generate & Prepare Sample</Text>
          </Pressable>

          {busy && (
            <View style={{ marginVertical: 16 }}>
              <ActivityIndicator size="large" />
            </View>
          )}

          {(voiceId || voiceIdInput) && (
            <View style={[styles.badge, { borderColor: '#3730a3' }]}>
              <Text style={[styles.badgeText, { color: '#a5b4fc' }]}>
                voice_id: <Text style={{ color: '#e0e7ff' }}>{(voiceIdInput || voiceId)}</Text>
              </Text>
            </View>
          )}

          {/* Web audio controls */}
          {Platform.OS === 'web' && webSrc ? (
            <View style={{ marginTop: 12 }}>
              <audio ref={audioElRef} src={webSrc} controls style={{ width: '100%' }} />
              <Text style={[styles.badgeText, { color: '#9ca3af', textAlign: 'center', marginTop: 6 }]}>
                Click Play to hear the sample in your browser.
              </Text>
            </View>
          ) : null}

          {/* Native info */}
          {Platform.OS !== 'web' && nativeAudioUri ? (
            <View style={[styles.badge, { borderColor: '#6b21a8' }]}>
              <Text style={[styles.badgeText, { color: '#d8b4fe' }]}>
                Saved audio: <Text style={{ color: '#faf5ff' }}>{nativeAudioUri}</Text>
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

// -------- helpers --------
async function blobToBase64Compat(blob: any, setBusy?: (b: boolean) => void): Promise<string> {
  // 1. Try arrayBuffer (web, modern RN)
  if (typeof blob?.arrayBuffer === 'function') {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      if (typeof global.btoa === 'function') {
        return global.btoa(binary);
      } else if (typeof Buffer !== 'undefined') {
        return Buffer.from(arrayBuffer).toString('base64');
      } else {
        throw new Error('No base64 encoder available');
      }
    } catch {}
  }

  // 2. React Native fetch polyfill: blob._data.blobId (Android/iOS)
  if (blob && blob._data && blob._data.blobId) {
    const blobId = blob._data.blobId;
    if (typeof blobId === 'string' && (blobId.startsWith('file://') || blobId.startsWith('/'))) {
      try {
        const base64 = await FileSystem.readAsStringAsync(blobId, { encoding: FileSystem.EncodingType.Base64 });
        return base64;
      } catch (e) {
        try {
          if (setBusy) setBusy(true);
          const tempPath = FileSystem.cacheDirectory + 'temp-blob-' + Date.now();
          await FileSystem.copyAsync({ from: blobId, to: tempPath });
          const base64 = await FileSystem.readAsStringAsync(tempPath, { encoding: FileSystem.EncodingType.Base64 });
          await FileSystem.deleteAsync(tempPath, { idempotent: true });
          return base64;
        } finally {
          if (setBusy) setBusy(false);
        }
      }
    }
  }

  // 3. Expo fetch polyfill: blob.uri
  if (blob && typeof blob === 'object' && typeof blob.uri === 'string') {
    const base64 = await FileSystem.readAsStringAsync(blob.uri, { encoding: FileSystem.EncodingType.Base64 });
    return base64;
  }

  // 4. If blob is a string (path or already base64)
  if (typeof blob === 'string') {
    if (blob.startsWith('file://') || blob.startsWith('/')) {
      const base64 = await FileSystem.readAsStringAsync(blob, { encoding: FileSystem.EncodingType.Base64 });
      return base64;
    }
    return blob;
  }

  // 5. If blob is a File (web)
  if (typeof File !== 'undefined' && blob instanceof File) {
    const arrayBuffer = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    if (typeof global.btoa === 'function') return global.btoa(binary);
    if (typeof Buffer !== 'undefined') return Buffer.from(arrayBuffer).toString('base64');
    throw new Error('No base64 encoder available');
  }

  // 6. If blob is a Blob (web)
  if (typeof Blob !== 'undefined' && blob instanceof Blob) {
    const arrayBuffer = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    if (typeof global.btoa === 'function') return global.btoa(binary);
    if (typeof Buffer !== 'undefined') return Buffer.from(arrayBuffer).toString('base64');
    throw new Error('No base64 encoder available');
  }

  throw new Error(`Unsupported blob type for base64 conversion.`);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  card: {
    width: '100%',
    minWidth: 0,
    maxWidth: 480,
    justifyContent: 'space-evenly',
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: '#23272f',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    color: '#ffffff',
    marginBottom: 8,
  },
  titleAccent: { color: '#818cf8', fontWeight: '700' },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#d1d5db',
    marginBottom: 16,
  },
  step: { fontWeight: '700', color: '#a5b4fc' },
  label: {
    color: '#e5e7eb',
    marginTop: 8,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#2a2f3a',
    backgroundColor: '#0f1115',
    color: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
    width: '100%',
    minWidth: 0,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    minWidth: 0,
  },
  btnPrimary: { backgroundColor: '#6366f1' },
  btnSecondary: { backgroundColor: '#8b5cf6' },
  btnHollow: { borderWidth: 1, borderColor: '#374151' },
  btnDisabled: { backgroundColor: '#374151', opacity: 0.6 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 15, letterSpacing: 0.3, textAlign: "center" },
  badge: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#23272f',
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 0,
  },
  badgeText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#cbd5e1',
  },
});
