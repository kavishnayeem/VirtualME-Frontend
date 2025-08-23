// app/VoiceCloneScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Platform, TextInput, StyleSheet, ScrollView, Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

const SERVER_URL = 'https://virtual-me-backend.vercel.app';

const SAMPLE_TEXT = `
English:
Welcome to VirtualMe — your personal digital companion. 
With VirtualMe, your voice becomes your presence, even when you are away. 
It understands your schedule, shares updates with your loved ones, and speaks just like you. 
Think of it as your trusted reflection, always ready to represent you with warmth and clarity.

Hyderabadi Hindi/Urdu:
آداب! یہ ہے VirtualMe — آپ کا اپنا ڈجیٹل ساتھی۔ 
جب آپ مصروف رہتے ہیں، تو VirtualMe آپ کی جگہ بات کرتا ہے، 
آپ کے گھر والوں کو حال چال بتاتا ہے، اور بالکل آپ ہی کے انداز میں جواب دیتا ہے۔ 
سمجھو جیسے آپ کا اپنا影، جو ہر وقت آپ کے ساتھ ہے، اور آپ کی بات سب تک پہنچاتا ہے۔ 
حیدرآباد کی گلیوں جیسا اپنائیت بھرا انداز، بس یہی ہے VirtualMe!

Arabic (Surah Al-Fatiha):
بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ
الْـحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ
الرَّحْمَـٰنِ الرَّحِيمِ
مَالِكِ يَوْمِ الدِّينِ
إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ
اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ
صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ
غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ
آمِين
`;

export default function VoiceCloneScreen() {
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [voiceIdInput, setVoiceIdInput] = useState<string>(''); // paste an existing voice_id here
  const [busy, setBusy] = useState(false);

  // Native playback
  const soundRef = useRef<Audio.Sound | null>(null);
  const [nativeAudioUri, setNativeAudioUri] = useState<string | null>(null);

  // Web playback
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [webSrc, setWebSrc] = useState<string | null>(null);

  // ---- Record & Clone (works on both web and mobile) ----
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);

  // --- Track if recording is being played back ---
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setBusy(true);
      // Ask for permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Microphone permission is required to record your voice.');
        setBusy(false);
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
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

      if (Platform.OS === 'web') {
        // On web, fetch the blob from the URI
        const fileBlob = await fetch(recordedUri).then(r => r.blob());
        const filename = 'sample.webm';
        let mime = fileBlob.type || 'audio/webm';
        form.append('audio', new File([fileBlob], filename, { type: mime }));
      } else {
        // On native, use the file URI
        // @ts-ignore
        form.append('audio', {
          uri: recordedUri,
          name: 'sample.m4a',
          type: 'audio/m4a',
        });
      }

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
        body: JSON.stringify({ voiceId: id, text: SAMPLE_TEXT }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`TTS failed: ${resp.status} ${t}`);
      }

      // Audio as Blob
      const blob = await resp.blob();

      if (Platform.OS === 'web') {
        // Use <audio> element (prevents AbortError races)
        const url = URL.createObjectURL(blob);
        // Clean up old URL if any
        if (webSrc && webSrc.startsWith('blob:')) URL.revokeObjectURL(webSrc);
        setWebSrc(url);
        // Do NOT auto-play; user can click Play in controls
      } else {
        // Native: write to cache and play with expo-av
        const base64 = await blobToBase64Compat(blob, setBusy);
        const fileUri = `${FileSystem.cacheDirectory}tts-${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        setNativeAudioUri(fileUri);

        // Stop & unload previous
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
  }, [voiceId, voiceIdInput, webSrc]);

  // Cleanup
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
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, [recordedUri]);

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
            onPress={() => {
              setVoiceId(voiceIdInput.trim());
              Alert.alert('Voice set', 'Using pasted voice_id for synthesis.');
            }}
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
              <Text style={[styles.badgeText, { color: '#d8b4fe' }]}>Saved audio: <Text style={{ color: '#faf5ff' }}>{nativeAudioUri}</Text></Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

// -------- helpers --------
// Improved: More robust blob-to-base64 conversion for Android/React Native
// This version tries to handle all possible blob/file types and gives more detailed error messages.
// FIX: If blob._data.blobId is not a file path, do NOT try to copy or read it as a file.
// Instead, check for blob.uri and use that, or fallback to arrayBuffer.
async function blobToBase64Compat(blob: any, setBusy?: (b: boolean) => void): Promise<string> {
  // 1. Try arrayBuffer (web, modern RN)
  if (typeof blob?.arrayBuffer === 'function') {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      // Use global.btoa if available, else Buffer fallback (for Node polyfills)
      if (typeof global.btoa === 'function') {
        return global.btoa(binary);
      } else if (typeof Buffer !== 'undefined') {
        return Buffer.from(arrayBuffer).toString('base64');
      } else {
        throw new Error('No base64 encoder available');
      }
    } catch (e) {
      // Continue to next fallback
    }
  }

  // 2. React Native fetch polyfill: blob._data.blobId (Android, iOS)
  // Fix: Only try to read as file if blobId looks like a file path (starts with file:// or /)
  if (blob && blob._data && blob._data.blobId) {
    const blobId = blob._data.blobId;
    if (typeof blobId === 'string' && (blobId.startsWith('file://') || blobId.startsWith('/'))) {
      try {
        const base64 = await FileSystem.readAsStringAsync(blobId, { encoding: FileSystem.EncodingType.Base64 });
        return base64;
      } catch (e) {
        // Try to recover by copying the file to a new location and reading again (Android bug workaround)
        try {
          if (setBusy) setBusy(true);
          const tempPath = FileSystem.cacheDirectory + 'temp-blob-' + Date.now();
          await FileSystem.copyAsync({ from: blobId, to: tempPath });
          const base64 = await FileSystem.readAsStringAsync(tempPath, { encoding: FileSystem.EncodingType.Base64 });
          // Clean up temp file
          await FileSystem.deleteAsync(tempPath, { idempotent: true });
          return base64;
        } catch (e2) {
          throw new Error(
            `Failed to convert blob to base64 on Android. blob._data.blobId: ${blobId}, error: ${e2}`
          );
        } finally {
          if (setBusy) setBusy(false);
        }
      }
    }
    // If blobId is not a file path, try blob.uri next
  }

  // 3. Expo fetch polyfill: blob.uri (Android, iOS)
  if (blob && typeof blob === 'object' && typeof blob.uri === 'string') {
    try {
      const base64 = await FileSystem.readAsStringAsync(blob.uri, { encoding: FileSystem.EncodingType.Base64 });
      return base64;
    } catch (e) {
      throw new Error(`Failed to convert file URI blob to base64: ${blob.uri}, error: ${e}`);
    }
  }

  // 4. If blob is a string (already base64 or file path)
  if (typeof blob === 'string') {
    // Heuristic: if it looks like a file path, try to read as base64
    if (blob.startsWith('file://') || blob.startsWith('/')) {
      try {
        const base64 = await FileSystem.readAsStringAsync(blob, { encoding: FileSystem.EncodingType.Base64 });
        return base64;
      } catch (e) {
        throw new Error(`Failed to convert string file path to base64: ${blob}, error: ${e}`);
      }
    }
    // Otherwise, assume it's already base64
    return blob;
  }

  // 5. If blob is a File (web)
  if (typeof File !== 'undefined' && blob instanceof File) {
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
    } catch (e) {
      throw new Error(`Failed to convert File to base64: ${e}`);
    }
  }

  // 6. If blob is a Blob (web)
  if (typeof Blob !== 'undefined' && blob instanceof Blob) {
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
    } catch (e) {
      throw new Error(`Failed to convert Blob to base64: ${e}`);
    }
  }

  // If all else fails, throw with details
  throw new Error(
    `Unsupported blob type for base64 conversion. blob: ${JSON.stringify(blob)}`
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    // backgroundColor: '#18181b', // moved to inline style for fallback
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
