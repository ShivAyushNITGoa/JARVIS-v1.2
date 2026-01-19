'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Ring, Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useJarvisStore } from '@/lib/store';

// Particle System
function Particles({ count = 1000 }) {
  const points = useRef();
  
  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 5 + 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    return positions;
  }, [count]);

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.y += 0.001;
      points.current.rotation.x += 0.0005;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particlesPosition}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="#00d4ff"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// Holographic Ring
function HoloRing({ radius, speed, color, thickness = 0.02 }) {
  const ringRef = useRef();
  
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.x += speed;
      ringRef.current.rotation.z += speed * 0.5;
    }
  });

  return (
    <Ring
      ref={ringRef}
      args={[radius - thickness, radius, 64]}
    >
      <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
    </Ring>
  );
}

// JARVIS Core Sphere
function JarvisCore() {
  const coreRef = useRef();
  const { isListening, isSpeaking, isProcessing } = useJarvisStore();
  
  const color = isListening ? '#00ff88' : isSpeaking ? '#ffaa00' : '#00d4ff';
  
  useFrame((state) => {
    if (coreRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      coreRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group>
      {/* Core Sphere */}
      <Sphere ref={coreRef} args={[0.5, 32, 32]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
        />
      </Sphere>
      
      {/* Inner Glow */}
      <Sphere args={[0.6, 32, 32]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
        />
      </Sphere>
      
      {/* Rings */}
      <HoloRing radius={1} speed={0.02} color={color} />
      <HoloRing radius={1.3} speed={-0.015} color={color} />
      <HoloRing radius={1.6} speed={0.01} color={color} />
      <HoloRing radius={2} speed={-0.008} color={color} />
    </group>
  );
}

// Floating Text
function StatusText() {
  const { isListening, isSpeaking, isProcessing } = useJarvisStore();
  
  const status = isListening ? 'LISTENING' : 
                 isSpeaking ? 'SPEAKING' : 
                 isProcessing ? 'PROCESSING' : 
                 'ONLINE';
  
  const color = isListening ? '#00ff88' : 
                isSpeaking ? '#ffaa00' : 
                isProcessing ? '#00d4ff' : 
                '#ffffff';

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <Text
        position={[0, -2.5, 0]}
        fontSize={0.3}
        color={color}
        anchorX="center"
        anchorY="middle"
        font="/fonts/Orbitron-Bold.ttf"
      >
        {status}
      </Text>
    </Float>
  );
}

// Data Streams
function DataStream({ position, delay = 0 }) {
  const streamRef = useRef();
  
  useFrame((state) => {
    if (streamRef.current) {
      const y = ((state.clock.elapsedTime + delay) % 4) - 2;
      streamRef.current.position.y = y;
      streamRef.current.material.opacity = 1 - Math.abs(y) / 2;
    }
  });

  return (
    <mesh ref={streamRef} position={position}>
      <boxGeometry args={[0.02, 0.1, 0.02]} />
      <meshBasicMaterial color="#00d4ff" transparent />
    </mesh>
  );
}

// Main Scene
export default function ThreeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 50 }}
      style={{ background: 'transparent' }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#00d4ff" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ff00ff" />
      
      {/* JARVIS Core */}
      <JarvisCore />
      
      {/* Particles */}
      <Particles count={2000} />
      
      {/* Status Text */}
      <StatusText />
      
      {/* Data Streams */}
      {[...Array(20)].map((_, i) => (
        <DataStream
          key={i}
          position={[
            (Math.random() - 0.5) * 6,
            0,
            (Math.random() - 0.5) * 6,
          ]}
          delay={Math.random() * 4}
        />
      ))}
      
      {/* Controls */}
      <OrbitControls
        enableZoom={true}
        enablePan={false}
        minDistance={3}
        maxDistance={10}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}