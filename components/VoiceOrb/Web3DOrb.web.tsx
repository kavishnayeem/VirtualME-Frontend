import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { usePersonaTarget } from '../../hooks/usePersonaTarget'; // 🔹 NEW
import { useAuth } from '../../providers/AuthProvider';

type Props = {
  intensity?: number;

  /** Persona fields passed to backend (optional; defaults match your backend) */
  profileName?: string;      // e.g., "Kavish Nayeem"
  preferredName?: string;    // e.g., "Kavish"
  /** Voice ID selection (optional; backend will validate & fallback) */
  voiceId?: string;
  /** Optional external convo id; if not provided, we persist one in localStorage */
  conversationId?: string;
  /** Optional extra context you want model to consider (short text) */
  hints?: string;
};

// ========= CONFIG: point this to your server =========
const BACKEND_URL = 'https://virtual-me-voice-agent.vercel.app'; // <-- change to your LAN IP or tunnel URL
const ORB_RADIUS = 7; // Keep orb radius constant

// Persisted conversation id so calls thread together
const CONVO_KEY = 'vm_conversation_id';

function ensureConversationId(externalId?: string): string {
  // prefer caller-provided id
  if (externalId && externalId.trim()) return externalId.trim();

  // try stored id
  let stored = '';
  try {
    stored = localStorage.getItem(CONVO_KEY) ?? '';
  } catch {
    stored = '';
  }
  if (stored) return stored;

  // create a new one
  const fresh =
    (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function')
      ? (crypto as any).randomUUID()
      : `cid_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  try {
    localStorage.setItem(CONVO_KEY, fresh); // fresh is string
  } catch { /* ignore */ }

  return fresh;
}

const Web3DOrb: React.FC<Props> = ({
  intensity = 0.6,
  profileName = 'Kavish Nayeem',
  preferredName = 'Kavish',
  voiceId,
  conversationId,
  hints,
}) => {
  const { target } = usePersonaTarget();                 // 🔹 NEW
  const targetUserId = target?._id;                      // 🔹 NEW
  const targetLabel = target ? (target.name?.trim() || target.email) : null; // 🔹 NEW
  const { token } = useAuth?.() ?? ({ token: undefined } as any);

  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string>('Tap the orb to start/stop.');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // New: server-returned metadata (useful for debugging / captions)
  const [serverLang, setServerLang] = useState<string | null>(null);
  const [serverVoiceId, setServerVoiceId] = useState<string | null>(null);
  const [serverConvoId, setServerConvoId] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  // New: state for output audio volume (for orb vibration)
  const [outputVolume, setOutputVolume] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const ballRef = useRef<THREE.Mesh | null>(null);
  const originalPositionsRef = useRef<Float32Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // For recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // For output audio
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputDataArrayRef = useRef<Uint8Array | null>(null);
  const outputAnimationFrameRef = useRef<number | null>(null);

  // Track if we've ever created a MediaElementAudioSourceNode for this audio element
  const audioElementSourceCreatedRef = useRef<boolean>(false);

  const noise = useMemo(() => createNoise3D(), []);

  // Handle mic and volume
  useEffect(() => {
    let animationId: number | null = null;
    let audioStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let dataArray: Uint8Array | null = null;

    if (!isListening) {
      setCurrentVolume(0);
      return;
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream = stream;
        audioStreamRef.current = stream;
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateAmplitude = () => {
          if (analyser && dataArray) {
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const v = (dataArray[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            setCurrentVolume(Math.min(1, rms * 2.5));
          }
          animationId = requestAnimationFrame(updateAmplitude);
        };
        updateAmplitude();
      } catch {
        setMicError('Microphone access denied or unavailable.');
        setCurrentVolume(0);
      }
    })();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (audioStream) audioStream.getTracks().forEach((t) => t.stop());
      if (audioContext) audioContext.close();
      audioStreamRef.current = null;
    };
  }, [isListening]);

  // Orb rendering and animation
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 20);
    camera.lookAt(scene.position);

    scene.add(camera);
    sceneRef.current = scene;
    groupRef.current = group;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    rendererRef.current = renderer;

    renderer.setPixelRatio(window.devicePixelRatio || 1);

    const icosahedronGeometry = new THREE.IcosahedronGeometry(ORB_RADIUS, 7);
    const lambertMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      wireframe: true,
    });

    const ball = new THREE.Mesh(icosahedronGeometry, lambertMaterial);
    ball.position.set(0, 0, 0);
    ballRef.current = ball;
    originalPositionsRef.current = (ball.geometry.attributes.position.array as Float32Array).slice();
    group.add(ball);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const spot = new THREE.SpotLight(0xffffff, 0.9);
    spot.position.set(-10, 40, 20);
    spot.lookAt(ball.position);
    spot.castShadow = true;
    scene.add(spot);

    scene.add(group);

    containerRef.current.appendChild(renderer.domElement);
    const size = Math.min(containerRef.current.clientWidth, 500);
    renderer.setSize(size, size, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const onResize = () => {
      if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;
      const s = Math.min(containerRef.current.clientWidth, 500);
      cameraRef.current.aspect = 1;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setPixelRatio(window.devicePixelRatio || 1);
      rendererRef.current.setSize(s, s, false);
    };

    // time-based rotation
    let lastTime = performance.now();
    const renderLoop = (now?: number) => {
      if (!groupRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      const currentTime = now !== undefined ? now : performance.now();
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const ROTATION_SPEED = 0.5;
      groupRef.current.rotation.y += ROTATION_SPEED * delta;

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        // @ts-ignore
        rendererRef.current.forceContextLoss?.();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  // Orb morphing
  useEffect(() => {
    const vibrate = isSpeaking && outputVolume > 0.01;
    const morphVolume = vibrate ? outputVolume : (isListening ? currentVolume : 0);

    if (ballRef.current && originalPositionsRef.current) {
      updateBallMorph(
        ballRef.current,
        morphVolume,
        intensity,
        noise,
        originalPositionsRef.current,
        isListening || vibrate
      );
    }
  }, [currentVolume, isListening, intensity, noise, outputVolume, isSpeaking]);

  // Orb morph function
  const updateBallMorph = (
    mesh: THREE.Mesh,
    volume: number,
    intens: number,
    noise3D: ReturnType<typeof createNoise3D>,
    original: Float32Array,
    listening: boolean
  ) => {
    const geometry = mesh.geometry as THREE.IcosahedronGeometry;
    const positionAttribute = (geometry as any).getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < positionAttribute.count; i++) {
      const baseX = original[i * 3];
      const baseY = original[i * 3 + 1];
      const baseZ = original[i * 3 + 2];

      const vertex = new THREE.Vector3(baseX, baseY, baseZ);

      const offset = ORB_RADIUS;
      const amp = 2.5 * intens;
      const time = performance.now();
      vertex.normalize();
      const rf = 0.00001;

      const distance =
        offset +
        volume * 4 * intens +
        noise3D(vertex.x + time * rf * 7, vertex.y + time * rf * 8, vertex.z + time * rf * 9) * amp * volume;

      vertex.multiplyScalar(distance);
      positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();

    if (listening) {
      // Color: blue for output, green for input
      let color;
      if (isSpeaking && outputVolume > 0.01) {
        color = new THREE.Color(`hsl(${200 + outputVolume * 40}, 100%, 60%)`);
        (mesh.material as THREE.MeshLambertMaterial).color = color;
      } else {
        color = new THREE.Color(`hsl(${volume * 120}, 100%, 50%)`);
        (mesh.material as THREE.MeshLambertMaterial).color = color;
      }
    } else {
      (mesh.material as THREE.MeshLambertMaterial).color.set(0xffffff);
    }
  };

  // --- Audio recording and backend upload logic ---

  const handleOrbClick = async () => {
    setMicError(null);

    if (!isListening) {
      // Start listening and recording
      setIsListening(true);
      setStatus('Recording… (tap to stop)');
      setAudioUrl(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          setIsBusy(true);
          setStatus('Uploading to backend…');
          try {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.wav');

            // Attach persona, voice, convo, hints
            const cid = ensureConversationId(conversationId);
            formData.append('conversationId', cid);
            formData.append('profileName', profileName);
            formData.append('preferredName', preferredName);
            if (targetUserId) formData.append('targetUserId', String(targetUserId)); // 🔹 NEW
            if (token) formData.append('authToken', token);
            if (voiceId) formData.append('voiceId', voiceId);
            if (hints) formData.append('hints', hints);

            const resp = await fetch(`${BACKEND_URL}/voice`, {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              body: formData,
            });

            if (!resp.ok) {
              const txt = await resp.text();
              setStatus(`Server error: ${txt.slice(0, 160)}`);
              setIsBusy(false);
              return;
            }

            // Read headers for metadata
            const replyHeader = resp.headers.get('x-reply-text');
            const langHeader = resp.headers.get('x-language');
            const voiceHeader = resp.headers.get('x-voice-id');
            const convoHeader = resp.headers.get('x-conversation-id');
            const transcriptHeader = resp.headers.get('x-transcript');

            const replyText = replyHeader ? decodeURIComponent(replyHeader) : '';
            const serverTranscript = transcriptHeader ? decodeURIComponent(transcriptHeader) : '';

            setServerLang(langHeader ? decodeURIComponent(langHeader) : null);
            setServerVoiceId(voiceHeader ? decodeURIComponent(voiceHeader) : null);
            setServerConvoId(convoHeader ? decodeURIComponent(convoHeader) : cid || null);
            setLastTranscript(serverTranscript || null);

            if (replyText) setStatus(`Captions: ${replyText}`);
            else setStatus('Downloading reply…');

            // Try to get audio file (mp3 or wav)
            const contentType = resp.headers.get('content-type') || '';
            const ab = await resp.arrayBuffer();
            let mime = 'audio/wav';
            if (contentType.includes('audio/mp3') || contentType.includes('audio/mpeg')) mime = 'audio/mp3';
            else if (contentType.includes('audio/wav')) mime = 'audio/wav';

            const blob = new Blob([ab], { type: mime });
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            setStatus('Reply audio ready.');
          } catch (e: any) {
            setStatus('Error uploading or playing audio.');
          }
          setIsBusy(false);
        };

        mediaRecorder.start();
      } catch (e: any) {
        setMicError(e?.message || String(e));
        setIsListening(false);
        setStatus('Mic error');
      }
    } else {
      // Stop listening and recording
      setIsListening(false);
      setStatus('Processing…');
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
    }
  };

  // Output audio analysis for orb vibration
  useEffect(() => {
    // Clean up previous audio context if any
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
      outputAnalyserRef.current = null;
      outputDataArrayRef.current = null;
    }
    if (outputAnimationFrameRef.current) {
      cancelAnimationFrame(outputAnimationFrameRef.current);
      outputAnimationFrameRef.current = null;
    }
    setOutputVolume(0);
    setIsSpeaking(false);

    // Reset the MediaElementAudioSourceNode creation flag
    audioElementSourceCreatedRef.current = false;

    if (!audioUrl) return;

    // Wait for audio element to be ready
    const audioEl = audioElementRef.current;
    if (!audioEl) return;

    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let dataArray: Uint8Array | null = null;

    const setup = () => {
      if (audioElementSourceCreatedRef.current) {
        setMicError(
          "Audio playback error: This browser does not allow connecting the same <audio> element to multiple AudioContexts. Please reload the page."
        );
        setIsSpeaking(false);
        setOutputVolume(0);
        return;
      }

      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      let source: MediaElementAudioSourceNode;
      try {
        source = ctx.createMediaElementSource(audioEl);
        audioElementSourceCreatedRef.current = true;
      } catch (err) {
        setMicError('Audio playback error: ' + (err instanceof Error ? err.message : String(err)));
        setIsSpeaking(false);
        setOutputVolume(0);
        return;
      }
      source.connect(analyser);
      analyser.connect(ctx.destination);
      dataArray = new Uint8Array(analyser.frequencyBinCount);

      outputAudioContextRef.current = ctx;
      outputAnalyserRef.current = analyser;
      outputDataArrayRef.current = dataArray;

      const update = () => {
        if (analyser && dataArray) {
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          setOutputVolume(Math.min(1, rms * 2.5));

          if (!audioEl.paused && !audioEl.ended) {
            setIsSpeaking(true);
          } else {
            setIsSpeaking(false);
            setOutputVolume(0);
          }
        }
        outputAnimationFrameRef.current = requestAnimationFrame(update);
      };
      update();
    };

    const onLoaded = () => {
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
        outputAnalyserRef.current = null;
        outputDataArrayRef.current = null;
      }
      if (outputAnimationFrameRef.current) {
        cancelAnimationFrame(outputAnimationFrameRef.current);
        outputAnimationFrameRef.current = null;
      }
      setIsSpeaking(false);
      setOutputVolume(0);

      setup();
      audioEl.currentTime = 0;
      audioEl.play().catch(() => {});
    };

    audioEl.addEventListener('loadedmetadata', onLoaded);
    audioEl.addEventListener('ended', () => {
      setIsSpeaking(false);
      setOutputVolume(0);
    });
    audioEl.addEventListener('pause', () => {
      setIsSpeaking(false);
      setOutputVolume(0);
    });

    if (audioEl.readyState >= 1) {
      onLoaded();
    }

    return () => {
      audioEl.removeEventListener('loadedmetadata', onLoaded);
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
        outputAnalyserRef.current = null;
        outputDataArrayRef.current = null;
      }
      if (outputAnimationFrameRef.current) {
        cancelAnimationFrame(outputAnimationFrameRef.current);
        outputAnimationFrameRef.current = null;
      }
      setIsSpeaking(false);
      setOutputVolume(0);
      audioElementSourceCreatedRef.current = false;
    };
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
        outputAnalyserRef.current = null;
        outputDataArrayRef.current = null;
      }
      if (outputAnimationFrameRef.current) {
        cancelAnimationFrame(outputAnimationFrameRef.current);
        outputAnimationFrameRef.current = null;
      }
      audioElementSourceCreatedRef.current = false;
    };
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
      <div
        ref={containerRef}
        onClick={handleOrbClick}
        style={{
          width: '100%',
          aspectRatio: '1',
          cursor: isBusy ? 'wait' : 'pointer',
          filter: isSpeaking ? 'drop-shadow(0 0 24px #4af)' : undefined,
          transition: 'filter 0.2s',
        }}
        title="Tap to start/stop"
      />
      {micError && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 0,
            right: 0,
            padding: 8,
            backgroundColor: 'rgba(255,0,0,0.1)',
            borderRadius: 8,
            color: '#c00',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          {micError}
        </div>
      )}
      <div
        style={{
          marginTop: 12,
          width: '90%',
          backgroundColor: 'rgba(0,0,0,0.07)',
          borderRadius: 8,
          padding: 8,
          minHeight: 70,
          color: '#333',
          fontSize: 14,
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: 6, fontSize: 13 }}>Status</div>
        <div style={{ color: '#888', wordBreak: 'break-word' }}>{status}</div>
        {targetLabel && (
          <div style={{ color: '#666', marginTop: 6, fontSize: 12 }}>
            Acting for: <span style={{ color: '#444', fontWeight: 600 }}>{targetLabel}</span>
          </div>
        )}
        {isBusy && <div style={{ color: '#888', marginTop: 4 }}>Working…</div>}
        {isSpeaking && (
          <div style={{ color: '#4af', marginTop: 4, fontWeight: 500 }}>
            <span role="img" aria-label="speaking">🔊</span> Orb is speaking...
          </div>
        )}
        {(serverLang || serverVoiceId || serverConvoId) && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            {serverLang && <div>Language: {serverLang}</div>}
            {serverVoiceId && <div>Voice: {serverVoiceId}</div>}
            {serverConvoId && <div>Conversation: {serverConvoId}</div>}
            {lastTranscript && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontWeight: 600 }}>Heard:</div>
                <div style={{ color: '#555' }}>{lastTranscript}</div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Hidden audio element for output, auto-play */}
      <audio
        key={audioUrl || 'none'} // Force a new <audio> element each time (avoids MediaElementAudioSource reuse issue)
        ref={audioElementRef}
        src={audioUrl || undefined}
        style={{ display: 'none' }}
        autoPlay
        controls={false}
      />
    </div>
  );
};

export default Web3DOrb;
