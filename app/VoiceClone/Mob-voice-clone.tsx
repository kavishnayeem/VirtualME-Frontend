// Mob-voice-clone.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Platform, TextInput, StyleSheet, ScrollView, Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { useAuth } from '../../providers/AuthProvider';
const AUTH_BASE = 'https://virtual-me-auth.vercel.app';

const SERVER_URL = 'https://virtual-me-backend.vercel.app';

// About 150 words, using the user's name dynamically
const getSampleText = (userName?: string) => {
  const name = userName || 'yourself';
  return (
    `Hello, my name is ${name}. I am excited to introduce you to VirtualMe, a platform designed to help you stay connected and present, even when you are busy. With VirtualMe, your voice can deliver messages, share updates, and interact with your friends and family just as you would. Imagine being able to send a warm greeting, remind your loved ones about important events, or simply check in, all in your own voice. This technology ensures that your unique tone and personality shine through every message. Whether you are at work, traveling, or simply taking a break, VirtualMe keeps you close to those who matter most. Experience the comfort of knowing that your presence is felt, your words are heard, and your relationships remain strong. Welcome to a new era of communication, where your voice truly represents you, anytime and anywhere.`
  );
};

export default function MobVoiceCloneScreen() {
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [voiceIdInput, setVoiceIdInput] = useState<string>(''); // paste an existing voice_id here
  const [busy, setBusy] = useState(false);
  const { token, user } = useAuth();
  
  // Native playback
  const soundRef = useRef<Audio.Sound | null>(null);
  const [nativeAudioUri, setNativeAudioUri] = useState<string | null>(null);

  // For playing generated sample
  const [isPlayingSample, setIsPlayingSample] = useState(false);

  // ---- Record & Clone (mobile only) ----
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);

  // --- Track if recording is being played back ---
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const saveVoiceId = useCallback(async () => {
    const id = (voiceIdInput || '').trim();
    if (!id) return Alert.alert('Missing', 'Paste a voice ID first.');
    if (!token) return Alert.alert('Sign in', 'Please sign in first.');
  
    try {
      setBusy(true);
      const resp = await fetch(`${AUTH_BASE}/me/voice-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ voiceId: id }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Save failed: ${resp.status} ${t}`);
      }
      const data = await resp.json();
      setVoiceId(data.voiceId);
      Alert.alert('Saved', 'Voice ID updated in your profile.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to save voice ID');
    } finally {
      setBusy(false);
    }
  }, [voiceIdInput, token]);
  
  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setBusy(true);
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Microphone permission is required to record your voice.');
        setBusy(false);
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        // No change here for recording
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
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
    if (!recordedUri) {
      Alert.alert('No recording', 'Please record your voice first.');
      return;
    }
    try {
      setBusy(true);
      const form = new FormData();
      form.append('name', 'KavishVoice');
      // On native, use the file URI
      // @ts-ignore
      form.append('audio', {
        uri: recordedUri,
        name: 'sample.m4a',
        type: 'audio/m4a',
      });

      const resp = await fetch(`${SERVER_URL}/clone`, {
        method: 'POST',
        body: form,
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Clone failed: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      setVoiceId(data.voice_id);
      setVoiceIdInput(data.voice_id); // show in input for reuse
      Alert.alert('Voice cloned', `Saved voice_id: ${data.voice_id}`);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to clone voice');
    } finally {
      setBusy(false);
    }
  }, [recordedUri]);

  // ---- Generate & Play using current voiceId (pasted or cloned) ----
  const generateAndPlay = useCallback(async () => {
    const id = (voiceIdInput?.trim() || voiceId || '').trim();
    if (!id) return Alert.alert('No voice ID', 'Paste a voice_id or clone one first.');

    try {
      setBusy(true);
      const resp = await fetch(`${SERVER_URL}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: id, text: getSampleText(user?.name) }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`TTS failed: ${resp.status} ${t}`);
      }

      // Audio as Blob
      const arrayBuffer = await resp.arrayBuffer();
      // Write to cache and play with expo-av
      // The backend returns audio/wav (PCM 44100), so we must save as .wav
      const fileUri = `${FileSystem.cacheDirectory}tts-${Date.now()}.wav`;

      // Convert arrayBuffer to base64 manually (no Buffer in React Native)
      function arrayBufferToBase64(buffer: ArrayBuffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        // btoa is available in React Native JS runtime
        return global.btoa(binary);
      }

      const base64 = arrayBufferToBase64(arrayBuffer);
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      setNativeAudioUri(fileUri);

      // Do not auto-play here; let user play manually
      // Stop & unload previous
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); } catch {}
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to synthesize');
    } finally {
      setBusy(false);
    }
  }, [voiceId, voiceIdInput]);

  // Play the generated sample (nativeAudioUri)
  const playSample = useCallback(async () => {
    if (!nativeAudioUri) return;
    try {
      setBusy(true);
      setIsPlayingSample(true);
      // Set audio mode to play through speaker on iOS
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        ...(Platform.OS === 'ios'
          ? { defaultToSpeaker: true }
          : {}),
        // Note: interruptionModeIOS and interruptionModeAndroid removed because they do not exist on Audio
      });

      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); } catch {}
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: nativeAudioUri });
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if ((status as any).didJustFinish) {
          setIsPlayingSample(false);
          sound.setOnPlaybackStatusUpdate(null);
        }
      });

      await sound.playAsync();
    } catch (e: any) {
      setIsPlayingSample(false);
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to play sample');
    } finally {
      setBusy(false);
    }
  }, [nativeAudioUri]);

  // Stop playback of the generated sample
  const stopPlayingSample = useCallback(async () => {
    setIsPlayingSample(false);
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  // Play back the recorded sample (before upload)
  const playRecording = useCallback(async () => {
    if (!recordedUri) return;
    try {
      setBusy(true);
      setIsPlayingRecording(true);
      // Set audio mode to play through speaker on iOS for playback
      // Fixed: Remove non-existent Audio.INTERRUPTION_MODE_* constants, use documented values
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: 1, // 1 = DO_NOT_MIX, see Expo Audio docs
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1, // 1 = DO_NOT_MIX, see Expo Audio docs
        playThroughEarpieceAndroid: false,
        ...(Platform.OS === 'ios'
          ? { defaultToSpeaker: true }
          : {}),
      });

      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); } catch {}
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: recordedUri });
      soundRef.current = sound;

      // Listen for playback end to update state
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
      setIsPlayingSample(false);
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, [recordedUri, nativeAudioUri]);

  // Use a View with backgroundColor as a fallback for LinearGradient
  // Fix: Use minHeight and maxWidth for card, and ScrollView for overflow
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
            Voice <Text style={styles.titleAccent}>Cloning (Mobile)</Text>
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
            disabled={busy || !(voiceIdInput || voiceId)}
            onPress={generateAndPlay}
            style={[styles.btn, (busy || !(voiceIdInput || voiceId)) ? styles.btnDisabled : styles.btnSecondary]}
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

          {/* Native info - now with play/stop button */}
          {nativeAudioUri ? (
            <View style={[styles.badge, { borderColor: '#6b21a8', alignItems: 'center' }]}>
              <Text style={[styles.badgeText, { color: '#d8b4fe', marginBottom: 6 }]}>
                Generated Sample Ready
              </Text>
              <Pressable
                disabled={busy}
                onPress={isPlayingSample ? stopPlayingSample : playSample}
                style={[
                  styles.btn,
                  busy ? styles.btnDisabled : styles.btnHollow,
                  { marginBottom: 0, minWidth: 120 }
                ]}
              >
                <Text style={styles.btnText}>
                  {isPlayingSample ? 'Stop Sample' : 'Play Sample'}
                </Text>
              </Pressable>
              <Text style={[styles.badgeText, { color: '#faf5ff', marginTop: 6, fontSize: 10 }]}>
                {nativeAudioUri.length > 40 ? nativeAudioUri.slice(-40) : nativeAudioUri}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

// ----------- Styles -----------
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
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'System' }),
    color: '#cbd5e1',
  },
  footer: { marginTop: 24, fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  footerAccent: { color: '#818cf8', fontWeight: '600' },
});

/*
  NOTE for backend:
  - The mobile app expects the /speak endpoint to return audio/wav (PCM 44100) as a binary stream.
  - The mobile app saves the response as a .wav file and plays it with expo-av.
  - If you want to support mp3 output, you can change output_format to "mp3_44100_128" in the backend payload.
  - If you want to support both web and mobile, consider allowing the client to specify the output_format.
*/
