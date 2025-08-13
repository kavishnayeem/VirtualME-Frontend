// Mobile3DOrb.native.tsx
// Deps:
//   npx expo install expo-gl expo-three three
//   npm i simplex-noise react-native-audio-record base64-js
//   npm i expo-audio
//
// iOS: uses expo-audio metering (Dev Client or recent Expo Go).
// Android: uses react-native-audio-record (requires Dev Client).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, Text, StyleSheet, LayoutChangeEvent, Platform } from 'react-native';
import { GLView } from 'expo-gl/src';
import { Renderer } from 'expo-three/src';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

import { useAudioRecorder, RecordingPresets, setAudioModeAsync, AudioModule } from 'expo-audio/src';
import AudioRecord from 'react-native-audio-record';
import { toByteArray } from 'base64-js';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
// --- Speech-to-text (caption) support (required for this feature) ---
let Voice: any = null;
try {
  // Only works in Dev Client (not Expo Go). Safe to ignore if not installed.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Voice = require('@react-native-voice/voice');
} catch {
  Voice = null;
}

export type Mobile3DOrbProps = { intensity?: number };

// --- helpers (match Web3DOrb behavior: RMS * 2.5, 0..1) ---
const dbToLinear = (db: number | undefined | null) => {
  if (db == null || Number.isNaN(db)) return 0;
  const linear = Math.pow(10, Math.max(-60, Math.min(0, db)) / 20);
  return Math.min(1, linear * 2.5);
};
const base64ToInt16 = (b64: string): Int16Array => {
  const bytes = toByteArray(b64);
  const out = new Int16Array(bytes.length / 2);
  for (let i = 0, j = 0; i < out.length; i++, j += 2) {
    let val = (bytes[j + 1] << 8) | bytes[j]; // little-endian
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

// --- Captions state ---
type CaptionState = { text: string; visible: boolean; lastSpoken: number };
const CAPTION_HIDE_DELAY = 2000; // ms after last update to hide

const Mobile3DOrb: React.FC<Mobile3DOrbProps> = ({ intensity = 0.6 }) => {
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  // Only keep the latest recognized text, always visible at the bottom when listening
  const [captionText, setCaptionText] = useState<string>('');

  const isFocused = useIsFocused();

  // guards to avoid duplicate starts/stops
  const activeRef = useRef(false);                           // mic/STT currently running?
  const audioInitedRef = useRef(false);                      // AudioRecord.init called?
  const dataHandlerRef = useRef<((b64: string) => void) | null>(null); // Android PCM listener attached?
  const voiceAttachedRef = useRef(false);                    // Voice listeners attached?

  // three/expo-gl refs
  const glRef = useRef<any>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const ballRef = useRef<THREE.Mesh | null>(null);
  const originalPositionsRef = useRef<Float32Array | null>(null);
  const frameRef = useRef<number | null>(null);

  // shared volume for render loop (exact feed like web)
  const volumeRef = useRef(0);

  // noise
  const noise3D = useMemo(() => createNoise3D(), []);

  // expo-audio recorder for iOS (metering callback)
  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true },
    (status) => {
      // @ts-expect-error metering is present at runtime
      const db = typeof status?.metering === 'number' ? status.metering : undefined;
      if (typeof db === 'number') volumeRef.current = dbToLinear(db); // no smoothing, match web
    }
  );

  // --- Speech-to-text (caption) listeners (attach once) ---
  useEffect(() => {
    if (!Voice || voiceAttachedRef.current) return;

    Voice.onSpeechResults = (e: any) => {
      if (e?.value?.length) setCaptionText(e.value[0]);
    };
    Voice.onSpeechPartialResults = (e: any) => {
      if (e?.value?.length) setCaptionText(e.value[0]);
    };
    Voice.onSpeechError = (e: any) => {
      setMicError('Speech recognition error: ' + (e?.error?.message || JSON.stringify(e)));
    };

    voiceAttachedRef.current = true;
    return () => {
      try { Voice?.destroy(); } catch {}
      try { Voice?.removeAllListeners?.(); } catch {}
      voiceAttachedRef.current = false;
    };
  }, []);

  // Clear caption text when not listening
  useEffect(() => {
    if (!isListening) setCaptionText('');
  }, [isListening]);

  const startSpeechToText = useCallback(async () => {
    if (!Voice) return;
    try {
      // iOS permission if available
      if (Platform.OS === 'ios' && typeof Voice.requestAuthorization === 'function') {
        const auth = await Voice.requestAuthorization();
        if (auth !== 'authorized') return;
      }
      await Voice.start('en-US', {
        EXTRA_PARTIAL_RESULTS: true,
        EXTRA_MAX_RESULTS: 3,
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 600,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 600,
      } as any);
      setCaptionText('');
    } catch (e: any) {
      setMicError('Speech recognition error: ' + (e?.message || String(e)));
    }
  }, []);

  const stopSpeechToText = useCallback(async () => {
    if (!Voice) return;
    try { await Voice.stop(); } catch {}
    try { await Voice.destroy(); } catch {}
    setCaptionText('');
  }, []);

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

  // ---------------- START/STOP MIC (guarded) ----------------
  const startMetering = useCallback(async () => {
    try {
      setMicError(null);

      // mic permission (works for both platforms)
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) throw new Error('Microphone permission denied.');

      if (Platform.OS === 'android') {
        // init once
        if (!audioInitedRef.current) {
          AudioRecord.init({
            sampleRate: 44100,
            channels: 1,
            bitsPerSample: 16,
            audioSource: 1,  // MIC
            wavFile: 'temp.wav',
          });
          audioInitedRef.current = true;
        }
        // attach listener once
        if (!dataHandlerRef.current) {
          dataHandlerRef.current = (b64: string) => {
            if (!activeRef.current) return; // ignore frames after stop
            const i16 = base64ToInt16(b64);
            volumeRef.current = int16Rms01(i16); // identical to web scaling
          };
          AudioRecord.on('data', dataHandlerRef.current as any);
        }
        await AudioRecord.start();
        return;
      }

      // iOS: use expo-audio
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e: any) {
      activeRef.current = false; // roll back active flag if we set it
      setMicError('Microphone error: ' + (e?.message || String(e)));
      throw e;
    }
  }, [recorder]);

  const stopMetering = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        try { await AudioRecord.stop(); } catch {}
        // keep listener attached; guarded by activeRef
      } else {
        try { await recorder.stop(); } catch {}
      }
    } finally {
      volumeRef.current = 0;
    }
  }, [recorder]);

  // wrap with idempotent start/stop that run on focus
  const startAll = useCallback(async () => {
    if (activeRef.current) return;     // ❗ prevent double-start
    activeRef.current = true;
    setCaptionText('');

    try {
      await startMetering();
      // start STT if available (required)
      await startSpeechToText();
    } catch {
      activeRef.current = false;
    }
  }, [startMetering, startSpeechToText]);

  const stopAll = useCallback(async () => {
    if (!activeRef.current) return;    // ❗ prevent double-stop
    activeRef.current = false;

    await stopSpeechToText();
    await stopMetering();
  }, [stopMetering, stopSpeechToText]);

  // Start/stop when THIS SCREEN gains/loses focus
  useFocusEffect(
    useCallback(() => {
      // on focus
      if (isListening) void startAll();

      return () => {
        // on blur
        if (activeRef.current) void stopAll();
      };
    }, [isListening, startAll, stopAll])
  );

  // Also react when the user taps the toggle while focused
  useEffect(() => {
    if (!isFocused) return;
    if (isListening) void startAll();
    else void stopAll();
  }, [isListening, isFocused, startAll, stopAll]);

  // ---------------- RENDERING ----------------
  const updateBallMorph = useCallback(
    (mesh: THREE.Mesh, volume: number, original: Float32Array | null) => {
      const geometry = mesh.geometry as THREE.IcosahedronGeometry;
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

        // EXACT same as web: no baseline, no smoothing
        const v = volume;
        const distance =
          offset +
          v * 4 * intensity +
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
    const geometry = mesh.geometry as THREE.IcosahedronGeometry;
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

    // The size of the mesh orb is defined here:
    // The first argument to THREE.IcosahedronGeometry is the radius of the orb.
    // In this case, the radius is 5.
    const icosahedronGeometry = new THREE.IcosahedronGeometry(7, 12);
    //                ^--- orb size (radius = 5)
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

      if (groupRef.current) groupRef.current.rotation.y += 0.010;

      if (ballRef.current) {
        if (isListening && activeRef.current) {
          updateBallMorph(ballRef.current, volumeRef.current, originalPositionsRef.current);
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

  // Cleanup GL on unmount
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
      // ensure mic is stopped if unmounted
      if (activeRef.current) void stopAll();
    };
  }, [stopAll]);

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setIsListening((v) => !v)} style={styles.pressable}>
        <GLView style={styles.gl} onLayout={onLayoutSquare} onContextCreate={onContextCreate} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {isListening ? 'Listening… (tap to stop)' : 'Tap to start mic'}
          </Text>
        </View>
      </Pressable>
      {/* Always show the caption at the bottom of the orb when listening */}
      {isListening && !!captionText && (
        <View style={styles.captionBoxBottom}>
          <Text style={styles.captionText} numberOfLines={2} ellipsizeMode="tail">
            {captionText}
          </Text>
        </View>
      )}
      {micError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{micError}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default Mobile3DOrb;

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center' },
  pressable: { width: '100%', maxWidth: 500, aspectRatio: 1 },
  gl: { width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden' },
  badge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
    alignItems: 'center',
  },
  badgeText: { color: 'white', fontSize: 14 },
  // New style for caption at the bottom of the orb
  captionBoxBottom: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 10,
    maxWidth: 500,
  },
  captionText: { color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  errorBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(255,0,0,0.1)',
    borderRadius: 8,
  },
  errorText: { color: '#c00' },
});
