import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, Platform, ScrollView, AppState } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

import { useAudioRecorder, RecordingPresets, setAudioModeAsync, AudioModule } from 'expo-audio';
import AudioRecord from 'react-native-audio-record';
import { toByteArray } from 'base64-js';
import { useFocusEffect } from '@react-navigation/native';

let Voice: any = null;
try {
  Voice = require('@react-native-voice/voice').default || require('@react-native-voice/voice');
} catch { Voice = null; }

export type Mobile3DOrbProps = { intensity?: number };

/** --------- Tunables (stabler speech detection) ---------- **/
const VAD_UP_THRESHOLD = 0.14;     // become "speaking" when smoothed >= this
const VAD_DOWN_THRESHOLD = 0.09;   // become "not speaking" when smoothed < this (hysteresis)
const MIN_SPEECH_MS = 250;         // require this much continuous "speaking" to start
const MIN_SILENCE_MS = 1800;       // require this much continuous "not speaking" to finalize
const RESTART_DELAY_MS = 350;      // delay before restarting Voice after finalize
const SMOOTH_WINDOW = 10;          // moving-average window over last N rms frames (200ms tick => ~2s)
const PARTIAL_SILENT_RESET_MS = 4000; // if no results for long, force restart

/** ---------- helpers ---------- **/
const dbToLinear = (db: number | undefined | null) => {
  if (db == null || Number.isNaN(db)) return 0;
  const linear = Math.pow(10, Math.max(-60, Math.min(0, db)) / 20);
  return Math.min(1, linear * 2.5);
};
const base64ToInt16 = (b64: string): Int16Array => {
  const bytes = toByteArray(b64);
  const out = new Int16Array(bytes.length / 2);
  for (let i = 0, j = 0; i < out.length; i++, j += 2) {
    let val = (bytes[j + 1] << 8) | bytes[j];
    if (val & 0x8000) val -= 0x10000;
    out[i] = val;
  }
  return out;
};
const int16Rms01 = (samples: Int16Array) => {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] / 32768;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / samples.length);
  return Math.min(1, rms * 2.5);
};

const ORB_RADIUS = 7;
const ORB_DETAIL = 10;

const Mobile3DOrb: React.FC<Mobile3DOrbProps> = ({ intensity = 0.6 }) => {
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalTranscripts, setFinalTranscripts] = useState<string[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [speechDetected, setSpeechDetected] = useState(false);

  const activeRef = useRef(false);
  const audioInitedRef = useRef(false);
  const dataHandlerRef = useRef<((b64: string) => void) | null>(null);

  const glRef = useRef<any>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const ballRef = useRef<THREE.Mesh | null>(null);
  const originalPositionsRef = useRef<Float32Array | null>(null);
  const frameRef = useRef<number | null>(null);

  const volumeRef = useRef(0);
  const smoothedVolumeRef = useRef(0);
  const rmsWindowRef = useRef<number[]>([]);

  // VAD FSM
  const speakingRef = useRef(false);
  const lastStateChangeRef = useRef<number>(Date.now());
  const lastAnySpeechRef = useRef<number>(0);         // last time speakingRef was true
  const lastPartialOrFinalRef = useRef<number>(0);    // to detect dead sessions
  const cooldownRef = useRef(false);                  // avoid thrashing restarts

  const pauseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioBufferRef = useRef<string[]>([]);
  const noise3D = useMemo(() => createNoise3D(), []);

  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true },
    (status) => {
      // Cast status to any so we can read metering
      const db = (status as any)?.metering as number | undefined;
      if (typeof db === 'number') pushRms(dbToLinear(db));
    }
  );

  /** --------- ANDROID: raw PCM metering ---------- **/
  const handleAudioChunk = useCallback((b64: string) => {
    if (!activeRef.current) return;
    const i16 = base64ToInt16(b64);
    pushRms(int16Rms01(i16));
  }, []);

  /** --------- pushRms -> moving average + hysteresis ---------- **/
  const pushRms = (val: number) => {
    const win = rmsWindowRef.current;
    win.push(val);
    if (win.length > SMOOTH_WINDOW) win.shift();

    const avg = win.reduce((a, b) => a + b, 0) / win.length;
    volumeRef.current = avg;

    // Hysteresis switching
    const now = Date.now();
    if (!speakingRef.current) {
      if (avg >= VAD_UP_THRESHOLD) {
        if (now - lastStateChangeRef.current >= MIN_SPEECH_MS) {
          speakingRef.current = true;
          lastStateChangeRef.current = now;
          lastAnySpeechRef.current = now;
          setSpeechDetected(true);
        }
      } else {
        lastStateChangeRef.current = now; // keep extending not-speaking window
      }
    } else {
      if (avg < VAD_DOWN_THRESHOLD) {
        if (now - lastAnySpeechRef.current >= MIN_SILENCE_MS) {
          speakingRef.current = false;
          lastStateChangeRef.current = now;
          setSpeechDetected(false);
          // finalize ONCE after long silence
          void finalizeAndMaybeRestart();
        }
      } else {
        lastAnySpeechRef.current = now;
      }
    }
  };

  /** --------- Voice permission / availability ---------- **/
  useEffect(() => {
    (async () => {
      try {
        if (!Voice) return;
        if (Platform.OS === 'ios' && typeof Voice.requestAuthorization === 'function') {
          const auth = await Voice.requestAuthorization();
          if (auth !== 'authorized') {
            setMicError('Speech recognition permission not granted.');
            return;
          }
        }
        if (typeof Voice.isAvailable === 'function') {
          const ok = await Voice.isAvailable();
          if (!ok) console.warn('Speech recognition not available on this device');
        }
      } catch (err: any) {
        setMicError('Speech init error: ' + (err?.message ?? String(err)));
      }
    })();
  }, []);

  /** --------- Voice events ---------- **/
  useEffect(() => {
    if (!Voice) return;

    const onSpeechStart = () => {
      // console.log('speechStart');
      setIsTranscribing(true);
      lastPartialOrFinalRef.current = Date.now();
    };
    const onSpeechEnd = () => {
      // console.log('speechEnd');
      setIsTranscribing(false);
    };
    const onSpeechResults = (e: any) => {
      lastPartialOrFinalRef.current = Date.now();
      if (Array.isArray(e?.value) && e.value[0]) {
        setFinalTranscripts((p) => [...p, e.value[0]]);
        setLiveTranscript('');
      }
      setIsTranscribing(false);
    };
    const onSpeechPartialResults = (e: any) => {
      lastPartialOrFinalRef.current = Date.now();
      if (Array.isArray(e?.value) && e.value[0]) {
        setLiveTranscript(e.value[0]);
      }
    };
    const onSpeechError = (_e: any) => {
      setIsTranscribing(false);
      // force restart on error after a small delay
      setTimeout(() => { if (isListening) startVoice(); }, RESTART_DELAY_MS);
    };

    if (Voice.removeAllListeners) Voice.removeAllListeners();
    if (Voice.addListener) {
      Voice.addListener('onSpeechStart', onSpeechStart);
      Voice.addListener('onSpeechEnd', onSpeechEnd);
      Voice.addListener('onSpeechResults', onSpeechResults);
      Voice.addListener('onSpeechPartialResults', onSpeechPartialResults);
      Voice.addListener('onSpeechError', onSpeechError);
    } else {
      Voice.onSpeechStart = onSpeechStart;
      Voice.onSpeechEnd = onSpeechEnd;
      Voice.onSpeechResults = onSpeechResults;
      Voice.onSpeechPartialResults = onSpeechPartialResults;
      Voice.onSpeechError = onSpeechError;
    }

    return () => {
      try {
        if (typeof Voice.destroy === 'function') {
          Voice.destroy().then(() => {
            if (typeof Voice.removeAllListeners === 'function') Voice.removeAllListeners();
          });
        }
      } catch {}
    };
  }, [isListening]); // eslint-disable-line

  /** --------- start/stop Voice (stable) ---------- **/
  const startVoice = useCallback(async () => {
    if (!Voice || typeof Voice.start !== 'function' || cooldownRef.current) return;
    try {
      setIsTranscribing(true);
      setLiveTranscript('');

      if (Platform.OS === 'android') {
        try { await Voice.cancel(); } catch {}
        try { await Voice.destroy(); } catch {}
      }

      const opts = Platform.select({
        ios: {},
        android: {
          EXTRA_PARTIAL_RESULTS: true,
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
          REQUEST_PERMISSIONS_AUTO: true,
          EXTRA_MAX_RESULTS: 3,
          EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
        },
      });

      await Voice.start('en-US', opts);
      lastPartialOrFinalRef.current = Date.now();
    } catch (e: any) {
      setMicError('Speech start error: ' + (e?.message || String(e)));
      setIsTranscribing(false);
    }
  }, []);

  const stopVoice = useCallback(async () => {
    if (!Voice) return;
    try { await Voice.stop(); } catch {}
    setIsTranscribing(false);
  }, []);

  /** --------- finalize once & restart after cooldown ---------- **/
  const finalizeAndMaybeRestart = useCallback(async () => {
    if (!Voice || cooldownRef.current) return;
    cooldownRef.current = true;
    try { await Voice.stop(); } catch {}
    setTimeout(() => {
      cooldownRef.current = false;
      if (isListening) startVoice();
    }, RESTART_DELAY_MS);
  }, [startVoice, isListening]);

  /** --------- watchdog: dead session with no partials ---------- **/
  useEffect(() => {
    if (!isListening) return;
    const t = setInterval(() => {
      if (!Voice) return;
      const now = Date.now();
      if (now - lastPartialOrFinalRef.current > PARTIAL_SILENT_RESET_MS && !cooldownRef.current) {
        // Force a gentle restart if session looks frozen
        void finalizeAndMaybeRestart();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [isListening, finalizeAndMaybeRestart]);

  /** --------- AppState: ensure running when foregrounded ---------- **/
  useEffect(() => {
    const handleAppState = (state: string) => {
      if (state === 'active' && isListening) startVoice();
    };
    const sub = AppState.addEventListener?.('change', handleAppState);
    return () => sub?.remove?.();
  }, [isListening, startVoice]);

  /** --------- iOS dummy buffer tick to mirror Android metering path ---------- **/
  useEffect(() => {
    if (!isListening || Platform.OS !== 'ios') return;
    const interval = setInterval(() => {
      // we don't push dummy chunks; metering comes from recorder callback
      // but we still want the VAD to evaluate regularly:
      const avg = volumeRef.current;
      pushRms(avg); // keep state machine ticking even if callback cadence varies
    }, 200);
    return () => clearInterval(interval);
  }, [isListening]);

  /** --------- Layout ---------- **/
  const onLayoutSquare = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (rendererRef.current && glRef.current) {
      const height = width;
      rendererRef.current.setSize(width, height);
      if (cameraRef.current) {
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
      }
      glRef.current.viewport(0, 0, width, height);
    }
  }, []);

  /** --------- Metering start/stop ---------- **/
  const startMetering = useCallback(async () => {
    try {
      setMicError(null);
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) throw new Error('Microphone permission denied.');

      if (Platform.OS === 'android') {
        if (!audioInitedRef.current) {
          AudioRecord.init({
            sampleRate: 44100, channels: 1, bitsPerSample: 16, audioSource: 1, wavFile: 'temp.wav',
          });
          audioInitedRef.current = true;
        }
        if (!dataHandlerRef.current) {
          dataHandlerRef.current = (b64: string) => {
            const rms = int16Rms01(base64ToInt16(b64));
            pushRms(rms);
          };
          AudioRecord.on('data', dataHandlerRef.current as any);
        }
        await AudioRecord.start();
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e: any) {
      activeRef.current = false;
      setMicError('Microphone error: ' + (e?.message || String(e)));
      throw e;
    }
  }, [recorder]);

  const stopMetering = useCallback(async () => {
    try {
      if (Platform.OS === 'android') { try { await AudioRecord.stop(); } catch {} }
      else { try { await recorder.stop(); } catch {} }
    } finally {
      volumeRef.current = 0;
      smoothedVolumeRef.current = 0;
      rmsWindowRef.current = [];
      audioBufferRef.current = [];
      speakingRef.current = false;
      setLiveTranscript('');
      setSpeechDetected(false);
    }
  }, [recorder]);

  const startAll = useCallback(async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    try { await startMetering(); } catch { activeRef.current = false; }
  }, [startMetering]);

  const stopAll = useCallback(async () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    await stopMetering();
  }, [stopMetering]);

  /** --------- Focus lifecycle ---------- **/
  useFocusEffect(
    useCallback(() => {
      setIsListening(true);
      void startAll();
      void startVoice();
      return () => {
        setIsListening(false);
        if (activeRef.current) void stopAll();
        void stopVoice();
      };
    }, [startAll, stopAll, startVoice, stopVoice])
  );

  useEffect(() => { if (micError) setIsListening(false); }, [micError]);

  /** --------- Orb ---------- **/
  const updateBallMorph = useCallback(
    (mesh: THREE.Mesh, volume: number, original: Float32Array | null) => {
      const geometry = mesh.geometry as THREE.IcosahedronGeometry;
      mesh.scale.set(1.3, 1.3, 1.3);
      const positionAttribute = (geometry as any).getAttribute('position') as THREE.BufferAttribute;

      for (let i = 0; i < positionAttribute.count; i++) {
        const baseX = original ? original[i * 3]     : positionAttribute.getX(i);
        const baseY = original ? original[i * 3 + 1] : positionAttribute.getY(i);
        const baseZ = original ? original[i * 3 + 2] : positionAttribute.getZ(i);

        const vertex = new THREE.Vector3(baseX, baseY, baseZ);
        const offset = 5;
        const amp = 2.5 * intensity;
        const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
        vertex.normalize();
        const rf = 0.00001;

        const v = volume;
        const distance =
          offset + v * 4 * intensity +
          noise3D(vertex.x + t * rf * 7, vertex.y + t * rf * 8, vertex.z + t * rf * 9) * amp * v;

        vertex.multiplyScalar(distance);
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }

      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();
      const color = new THREE.Color(`hsl(${volume * 120}, 100%, 50%)`);
      (mesh.material as THREE.MeshLambertMaterial).color = color;
    },
    [intensity, noise3D]
  );

  const resetBallMorph = useCallback((mesh: THREE.Mesh, original: Float32Array) => {
    const geometry = new THREE.IcosahedronGeometry(ORB_RADIUS, ORB_DETAIL);
    const positionAttribute = (geometry as any).getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < positionAttribute.count; i++) {
      positionAttribute.setXYZ(i, original[i * 3], original[i * 3 + 1], original[i * 3 + 2]);
    }
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    (mesh.material as THREE.MeshLambertMaterial).color.set(0xffffff);
  }, []);

  const onContextCreate = useCallback(async (gl: any) => {
    glRef.current = gl;

    const renderer = new Renderer({ gl, antialias: true });
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const group = new THREE.Group();

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 20);
    camera.lookAt(scene.position);

    sceneRef.current = scene;
    cameraRef.current = camera;
    groupRef.current = group;

    const icosahedronGeometry = new THREE.IcosahedronGeometry(ORB_RADIUS, ORB_DETAIL);
    const lambertMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: true });
    const ball = new THREE.Mesh(icosahedronGeometry, lambertMaterial);
    ball.position.set(0, 0, 0);
    ballRef.current = ball;
    originalPositionsRef.current = (
      (ball.geometry as THREE.BufferGeometry).attributes.position.array as Float32Array
    ).slice();
    group.add(ball);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const spot = new THREE.SpotLight(0xffffff, 0.9);
    spot.position.set(-10, 40, 20);
    spot.target = ball;
    scene.add(spot);
    scene.add(group);

    const render = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

      if (groupRef.current) groupRef.current.rotation.y += 0.040;

      const raw = volumeRef.current;
      let smoothed = smoothedVolumeRef.current;
      const attack = 1, release = 0.5;
      if (raw > smoothed) smoothed = smoothed + (raw - smoothed) * attack;
      else smoothed = smoothed + (raw - smoothed) * release;
      smoothedVolumeRef.current = smoothed;

      if (ballRef.current) {
        if (isListening && activeRef.current) {
          updateBallMorph(ballRef.current, smoothed, originalPositionsRef.current);
        } else if (originalPositionsRef.current) {
          resetBallMorph(ballRef.current, originalPositionsRef.current);
        }
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      gl.endFrameEXP();
      frameRef.current = requestAnimationFrame(render);
    };
    render();
  }, [isListening, resetBallMorph, updateBallMorph]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (rendererRef.current) {
        // @ts-ignore
        rendererRef.current.forceContextLoss?.();
        // @ts-ignore
        rendererRef.current.dispose?.();
      }
      sceneRef.current = null;
      cameraRef.current = null;
      groupRef.current = null;
      ballRef.current = null;
      if (activeRef.current) void stopAll();
      if (pauseTimerRef.current) clearInterval(pauseTimerRef.current as any);
    };
  }, [stopAll]);

  return (
    <View style={styles.container}>
      <View style={styles.pressable}>
        <GLView style={styles.gl} onLayout={onLayoutSquare} onContextCreate={onContextCreate} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {isListening ? (speechDetected ? 'Listening… (speaking)' : 'Listening…') : micError ? 'Mic error' : ''}
          </Text>
        </View>
      </View>

      {micError ? (
        <View style={styles.errorBox}><Text style={styles.errorText}>{micError}</Text></View>
      ) : null}

      <View style={styles.transcriptBox}>
        <Text style={styles.transcriptTitle}>Transcripts:</Text>
        <ScrollView style={{ maxHeight: 140 }}>
          {liveTranscript ? <Text style={styles.transcriptText}>{liveTranscript}</Text> : null}
          {finalTranscripts.map((t, i) => (
            <Text key={i} style={styles.transcriptText}>{t}</Text>
          ))}
          {!liveTranscript && finalTranscripts.length === 0 && !isTranscribing && !micError && (
            <Text style={styles.transcriptText}>
              {speechDetected ? 'Speech detected, transcribing…' : 'Waiting for speech…'}
            </Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

export default Mobile3DOrb;

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center' },
  pressable: { width: '100%', maxWidth: 500, aspectRatio: 1 },
  gl: { width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden' },
  badge: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 12, alignItems: 'center',
  },
  badgeText: { color: 'white', fontSize: 14 },
  errorBox: { marginTop: 8, padding: 8, backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: 8 },
  errorText: { color: '#c00' },
  transcriptBox: {
    marginTop: 12, width: '90%', backgroundColor: 'rgba(0,0,0,0.07)',
    borderRadius: 8, padding: 8, minHeight: 40, maxHeight: 160,
  },
  transcriptTitle: { fontWeight: 'bold', color: '#333', marginBottom: 4, fontSize: 13 },
  transcriptText: { color: '#222', fontSize: 14, marginBottom: 2 },
});
