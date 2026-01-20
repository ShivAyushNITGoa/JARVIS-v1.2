'use client';

import { useRef, useEffect, useState } from 'react';

export default function ThreeScene() {
  const canvasRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    let animationId;
    let scene, camera, renderer, sphere;

    try {
      // Dynamically import Three.js
      import('three').then(THREE => {
        // Basic Three.js setup
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ 
          canvas: canvasRef.current, 
          antialias: true,
          alpha: true 
        });
        
        renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
        renderer.setClearColor(0x000000, 1);

        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);
        
        const pointLight = new THREE.PointLight(0x00d4ff, 1, 100);
        pointLight.position.set(10, 10, 10);
        scene.add(pointLight);

        // Create JARVIS core sphere
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshStandardMaterial({ 
          color: 0x00d4ff,
          emissive: 0x00d4ff,
          emissiveIntensity: 0.3,
          metalness: 0.8,
          roughness: 0.2
        });
        sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        camera.position.z = 5;

        // Animation loop
        const animate = () => {
          animationId = requestAnimationFrame(animate);
          
          if (sphere) {
            sphere.rotation.x += 0.01;
            sphere.rotation.y += 0.005;
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
          <div className="text-white">Loading 3D Scene...</div>
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
