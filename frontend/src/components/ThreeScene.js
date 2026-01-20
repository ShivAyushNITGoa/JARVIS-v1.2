'use client';

import { useRef, useEffect, useState } from 'react';
import { useJarvisStore } from '../lib/store';

export default function ThreeScene() {
  const canvasRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const controlRef = useRef({ rotateDelta: 0, zoomDelta: 0, pulse: 0, activeGesture: null, confidence: 0 });
  const settingsRef = useRef({});
  const zoomRef = useRef(8);

  const { hologramControl, hologramSettings } = useJarvisStore();

  useEffect(() => {
    controlRef.current = hologramControl || controlRef.current;
  }, [hologramControl]);

  useEffect(() => {
    if (hologramSettings) {
      settingsRef.current = hologramSettings;
      zoomRef.current = hologramSettings.baseZoom ?? zoomRef.current;
    }
  }, [hologramSettings]);

  useEffect(() => {
    if (!canvasRef.current) return;

    let animationId;
    let scene, camera, renderer;
    let coreSphere, innerCore, rings = [], particles = [], holograms = [];

    try {
      // Dynamically import Three.js
      import('three').then(THREE => {
        
        // Scene setup
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.0008);

        // Camera setup
        const startZoom = settingsRef.current?.baseZoom ?? zoomRef.current ?? 8;
        zoomRef.current = startZoom;
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 2, startZoom);
        camera.lookAt(0, 0, 0);

        // Renderer setup
        renderer = new THREE.WebGLRenderer({ 
          canvas: canvasRef.current, 
          antialias: true,
          alpha: true 
        });
        renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
        renderer.setClearColor(0x000000, 1);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Lighting setup
        const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        scene.add(ambientLight);

        const coreLight = new THREE.PointLight(0x00d4ff, 2, 50);
        coreLight.position.set(0, 0, 0);
        coreLight.castShadow = true;
        scene.add(coreLight);

        const accentLight1 = new THREE.PointLight(0xff6b00, 1, 30);
        accentLight1.position.set(10, 5, 10);
        scene.add(accentLight1);

        const accentLight2 = new THREE.PointLight(0x00d4ff, 0.8, 30);
        accentLight2.position.set(-10, -5, -10);
        scene.add(accentLight2);

        // JARVIS Core - Central holographic sphere
        const coreGeometry = new THREE.SphereGeometry(0.8, 64, 64);
        const coreMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x00d4ff,
          emissive: 0x00d4ff,
          emissiveIntensity: 0.4,
          metalness: 0.9,
          roughness: 0.1,
          transmission: 0.6,
          thickness: 0.5,
          transparent: true,
          opacity: 0.8
        });
        coreSphere = new THREE.Mesh(coreGeometry, coreMaterial);
        coreSphere.castShadow = true;
        scene.add(coreSphere);

        // Inner core - pulsing energy
        const innerCoreGeometry = new THREE.SphereGeometry(0.3, 32, 32);
        const innerCoreMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 1
        });
        innerCore = new THREE.Mesh(innerCoreGeometry, innerCoreMaterial);
        coreSphere.add(innerCore);

        // Holographic rings
        for (let i = 0; i < 4; i++) {
          const ringGeometry = new THREE.TorusGeometry(1.5 + i * 0.5, 0.05, 32, 100);
          const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00d4ff,
            emissive: 0x00d4ff,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.6 - i * 0.1,
            side: THREE.DoubleSide
          });
          const ring = new THREE.Mesh(ringGeometry, ringMaterial);
          ring.rotation.x = Math.PI / 2;
          rings.push(ring);
          scene.add(ring);
        }

        // Orbiting data nodes
        for (let i = 0; i < 8; i++) {
          const nodeGeometry = new THREE.OctahedronGeometry(0.15, 0);
          const nodeMaterial = new THREE.MeshPhysicalMaterial({
            color: i % 2 === 0 ? 0xff6b00 : 0x00d4ff,
            emissive: i % 2 === 0 ? 0xff6b00 : 0x00d4ff,
            emissiveIntensity: 0.3,
            metalness: 0.8,
            roughness: 0.2
          });
          const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
          
          const angle = (i / 8) * Math.PI * 2;
          const radius = 3;
          node.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle * 2) * 0.5,
            Math.sin(angle) * radius
          );
          
          holograms.push(node);
          scene.add(node);

          // Connection lines
          if (i > 0) {
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(0, 0, 0),
              node.position
            ]);
            const lineMaterial = new THREE.LineBasicMaterial({
              color: 0x00d4ff,
              transparent: true,
              opacity: 0.3
            });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            scene.add(line);
          }
        }

        // Particle field
        const particleCount = 500;
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 20;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
          
          const color = new THREE.Color();
          color.setHSL(0.55 + Math.random() * 0.1, 1, 0.5 + Math.random() * 0.3);
          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
        }

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMaterial = new THREE.PointsMaterial({
          size: 0.05,
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending
        });

        const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particleSystem);

        // Animation loop
        const time = { value: 0 };
        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

        const animate = () => {
          animationId = requestAnimationFrame(animate);
          time.value += 0.01;

          const control = controlRef.current || {};
          const settings = settingsRef.current || {};
          const autoRotateSpeed = settings.autoRotate === false ? 0 : (settings.autoRotateSpeed ?? 0.004);

          // Zoom control from gestures
          const minZoom = settings.minZoom ?? 4;
          const maxZoom = settings.maxZoom ?? 12;
          if (control.zoomDelta) {
            zoomRef.current = clamp(zoomRef.current + control.zoomDelta, minZoom, maxZoom);
          }
          camera.position.z = zoomRef.current;

          // Rotate core
          if (coreSphere) {
            coreSphere.rotation.y += 0.005 + control.rotateDelta + autoRotateSpeed;
            coreSphere.rotation.x = Math.sin(time.value) * 0.1;
          }

          // Animate rings
          rings.forEach((ring, i) => {
            ring.rotation.z += (0.01 + autoRotateSpeed) * (i % 2 === 0 ? 1 : -1);
            ring.rotation.y += 0.005 + control.rotateDelta * 0.5;
            const scale = 1 + Math.sin(time.value * 2 + i) * 0.1 + (control.pulse ? 0.05 : 0);
            ring.scale.set(scale, scale, scale);
          });

          // Orbit nodes
          holograms.forEach((node, i) => {
            const angle = (i / 8) * Math.PI * 2 + time.value * 0.5 + control.rotateDelta * 20;
            const radius = 3 + Math.sin(time.value + i) * 0.5;
            node.position.x = Math.cos(angle) * radius;
            node.position.y = Math.sin(angle * 2) * 0.5;
            node.position.z = Math.sin(angle) * radius;
            node.rotation.x += 0.02 + control.rotateDelta * 5;
            node.rotation.y += 0.03 + control.rotateDelta * 5;
          });

          if (innerCore) {
            const pulseStrength = control.pulse ? 0.15 : 0.08;
            const pulse = 1 + Math.sin(time.value * 3) * pulseStrength;
            innerCore.scale.set(pulse, pulse, pulse);
            innerCore.material.emissiveIntensity = 1 + (control.confidence ?? 0) * 0.5;
          }

          // Animate particles
          if (particleSystem) {
            particleSystem.rotation.y += 0.001;
            particleSystem.rotation.x += 0.0005;
          }

          renderer.render(scene, camera);
        };

        // Handle resize
        const handleResize = () => {
          if (!canvasRef.current) return;
          camera.aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
        };

        window.addEventListener('resize', handleResize);
        animate();
        setIsLoaded(true);

        return () => {
          window.removeEventListener('resize', handleResize);
          if (animationId) {
            cancelAnimationFrame(animationId);
          }
          if (renderer) {
            renderer.dispose();
          }
        };

      }).catch(error => {
        console.error('Failed to load Three.js:', error);
        setHasError(true);
      });

    } catch (error) {
      console.error('Three.js initialization failed:', error);
      setHasError(true);
    }
  }, []);

  if (hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 animate-pulse"></div>
          <h3 className="text-white text-xl font-bold mb-2">JARVIS 3D</h3>
          <p className="text-gray-400 text-sm">3D visualization unavailable</p>
          <p className="text-gray-500 text-xs mt-2">Using enhanced 2D mode</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="text-white">Initializing JARVIS Holographic Interface...</div>
        </div>
      )}
      <canvas 
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  );
}
