import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

type Props = { intensity?: number };

const Web3DOrb: React.FC<Props> = ({ intensity = 0.6 }) => {
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [currentVolume, setCurrentVolume] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const ballRef = useRef<THREE.Mesh | null>(null);
  const originalPositionsRef = useRef<Float32Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const noise = useMemo(() => createNoise3D(), []);

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
    };
  }, [isListening]);

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

    const icosahedronGeometry = new THREE.IcosahedronGeometry(5, 8);
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
    renderer.setSize(size, size);

    const onResize = () => {
      if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;
      const s = Math.min(containerRef.current.clientWidth, 500);
      cameraRef.current.aspect = 1;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(s, s);
    };

    const renderLoop = () => {
      if (!groupRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      groupRef.current.rotation.y += 0.005;
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();
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

  useEffect(() => {
    if (isListening && ballRef.current) {
      updateBallMorph(ballRef.current, currentVolume, intensity, noise);
    } else if (!isListening && ballRef.current && originalPositionsRef.current) {
      resetBallMorph(ballRef.current, originalPositionsRef.current);
    }
  }, [currentVolume, isListening, intensity, noise]);

  const updateBallMorph = (
    mesh: THREE.Mesh,
    volume: number,
    intens: number,
    noise3D: ReturnType<typeof createNoise3D>
  ) => {
    const geometry = mesh.geometry as THREE.IcosahedronGeometry;
    const positionAttribute = (geometry as any).getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < positionAttribute.count; i++) {
      const vertex = new THREE.Vector3(
        positionAttribute.getX(i),
        positionAttribute.getY(i),
        positionAttribute.getZ(i)
      );

      const offset = 5;
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

    const color = new THREE.Color(`hsl(${volume * 120}, 100%, 50%)`);
    (mesh.material as THREE.MeshLambertMaterial).color = color;
  };

  const resetBallMorph = (mesh: THREE.Mesh, original: Float32Array) => {
    const geometry = mesh.geometry as THREE.IcosahedronGeometry;
    const positionAttribute = (geometry as any).getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < positionAttribute.count; i++) {
      positionAttribute.setXYZ(i, original[i * 3], original[i * 3 + 1], original[i * 3 + 2]);
    }
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    (mesh.material as THREE.MeshLambertMaterial).color.set(0xffffff);
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
      <div
        ref={containerRef}
        onClick={() => {
          setMicError(null);
          setIsListening((v) => !v);
        }}
        style={{ width: '100%', aspectRatio: '1', cursor: 'pointer' }}
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
    </div>
  );
};

export default Web3DOrb;


