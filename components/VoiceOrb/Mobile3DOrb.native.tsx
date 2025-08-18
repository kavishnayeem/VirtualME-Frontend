import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, Pressable, Platform, ScrollView } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

import AudioRecord from 'react-native-audio-record';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { toByteArray } from 'base64-js';

// ========= Orb constants =========
const ORB_RADIUS = 7;
const ORB_DETAIL = 10;

// ========= EMA smoothing =========
const EMA_ALPHA = 0.22;

// ========= Helpers =========
const base64ToInt16 = (b64: string): Int16Array => {
  const bytes = toByteArray(b64);
  const out = new Int16Array(bytes.length / 2);
  for (let i = 0, j = 0; i < out.length; i++, j += 2) {
    let v = (bytes[j + 1] << 8) | bytes[j];
    if (v & 0x8000) v -= 0x10000;
    out[i] = v;
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
  return Math.max(0, Math.min(1, rms * 2.5));
};

const toFileUri = (p?: string | null) => {
  if (!p) return '';
  return p.startsWith('file://') ? p : `file://${p}`;
};

type Mobile3DOrbProps = { intensity?: number };

const Mobile3DOrb: React.FC<Mobile3DOrbProps> = ({ intensity = 0.6 }) => {
  // UI
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedUri, setSavedUri] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Refs
  const isRecordingRef = useRef(isRecording);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // GL / Three refs
  const glRef = useRef<any>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const ballRef = useRef<THREE.Mesh | null>(null);
  const originalPositionsRef = useRef<Float32Array | null>(null);
  const frameRef = useRef<number | null>(null);

  // Volume for orb (EMA of RMS)
  const emaRef = useRef(0);
  const volRef = useRef(0);

  // AudioRecord data handler
  const dataHandlerRef = useRef<((b64: string) => void) | null>(null);

  const noise3D = useMemo(() => createNoise3D(), []);

  const pushRms = (rms: number) => {
    const prev = emaRef.current || 0;
    const ema = prev + EMA_ALPHA * (rms - prev);
    emaRef.current = ema;
    volRef.current = ema;
  };

  // ========= Start recording =========
  const startRecording = useCallback(async () => {
    try {
      setMicError(null);
      setSaveError(null);
      setSavedUri('');

      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) throw new Error('Microphone permission denied.');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Use WAV, 16k mono (speech-friendly)
      const fileName = `rec-${Date.now()}.wav`;
      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 1,
        wavFile: fileName, // recorder decides exact folder
      });

      if (!dataHandlerRef.current) {
        dataHandlerRef.current = (b64: string) => {
          if (!isRecordingRef.current) return;
          try {
            const i16 = base64ToInt16(b64);
            pushRms(int16Rms01(i16));
          } catch {}
        };
        // @ts-ignore
        AudioRecord.on('data', dataHandlerRef.current);
      }

      await AudioRecord.start();
      setIsRecording(true);
    } catch (e: any) {
      setMicError(e?.message || String(e));
      setIsRecording(false);
    }
  }, []);

  // ========= Stop recording: keep recorder's path (no copy) =========
  const stopRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      setIsSaving(true);

      const rawPath: string = await AudioRecord.stop(); // returns absolute path (no scheme)
      const uri = toFileUri(rawPath);

      // Confirm it exists; if it does, just use it.
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        setSaveError(`Recorded file not found at ${uri}`);
      } else {
        setSavedUri(uri);      // <- keep original file; ready for upload later
        setSaveError(null);
      }
    } catch (e: any) {
      setSaveError('Stop/save failed: ' + (e?.message || String(e)));
    } finally {
      emaRef.current = 0;
      volRef.current = 0;
      setIsSaving(false);
    }
  }, []);

  const onPressOrb = useCallback(async () => {
    if (isRecordingRef.current) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [startRecording, stopRecording]);

  // ========= Layout =========
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

  // ========= Orb morph =========
  const updateBallMorph = useCallback(
    (mesh: THREE.Mesh, volume: number, original: Float32Array | null) => {
      const geometry = mesh.geometry as any;
      mesh.scale.set(1.3, 1.3, 1.3);
      const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;

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

  // ========= GL init + render loop =========
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

      const vol = volRef.current; // EMA from PCM
      if (ballRef.current) {
        if (isRecording) {
          updateBallMorph(ballRef.current, vol, originalPositionsRef.current);
        } else if (originalPositionsRef.current) {
          resetBallMorph(ballRef.current, originalPositionsRef.current);
        }
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      gl.endFrameEXP();
      frameRef.current = requestAnimationFrame(render);
    };
    render();
  }, [isRecording, resetBallMorph, updateBallMorph]);

  // ========= cleanup =========
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
      try { AudioRecord.stop(); } catch {}
    };
  }, []);

  return (
    <View style={styles.container}>
      <Pressable style={styles.pressable} onPress={onPressOrb}>
        <GLView style={styles.gl} onLayout={onLayoutSquare} onContextCreate={onContextCreate} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {micError
              ? 'Mic error'
              : isSaving
                ? 'Saving…'
                : isRecording
                  ? 'Recording… (tap to stop)'
                  : 'Tap to record'}
          </Text>
        </View>
      </Pressable>

      {!!micError && (
        <View style={styles.errorBox}><Text style={styles.errorText}>{micError}</Text></View>
      )}
      {!!saveError && (
        <View style={styles.errorBox}><Text style={styles.errorText}>{saveError}</Text></View>
      )}

      <View style={styles.fileBox}>
        <Text style={styles.fileTitle}>Last recording:</Text>
        <ScrollView style={{ maxHeight: 120 }}>
          <Text style={styles.filePath}>
            {savedUri || 'No file yet. Tap to record, then tap again to stop.'}
          </Text>
        </ScrollView>
        {/* Upload later using fetch+FormData with the file:// URI */}
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
  fileBox: {
    marginTop: 12, width: '90%',
    backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 8, padding: 8,
    minHeight: 60, maxHeight: 160,
  },
  fileTitle: { fontWeight: 'bold', color: '#333', marginBottom: 6, fontSize: 13 },
  filePath: { color: '#222', fontSize: 13 },
});
