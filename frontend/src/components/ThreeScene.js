'use client';

import { useState, useEffect, Suspense } from 'react';

// Fallback component when 3D fails to load
function FallbackScene() {
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

// Main component with error boundary
export default function ThreeScene() {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for WebGL support
    const timer = setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
          setHasError(true);
        }
      } catch (e) {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-white">Loading 3D Scene...</div>
      </div>
    );
  }

  if (hasError) {
    return <FallbackScene />;
  }

  // Try to load the actual 3D scene
  return (
    <Suspense fallback={<FallbackScene />}>
      <ThreeSceneInner />
    </Suspense>
  );
}

// The actual 3D implementation
function ThreeSceneInner() {
  const [Component, setComponent] = useState(null);

  useEffect(() => {
    // Dynamically import the heavy 3D components
    import('@react-three/fiber').then(({ Canvas }) => {
      import('@react-three/drei').then(({ OrbitControls, Sphere, Box }) => {
        const SceneComponent = () => (
          <Canvas
            camera={{ position: [0, 0, 5], fov: 75 }}
            style={{ background: 'linear-gradient(to bottom, #0a0a0a, #000000)' }}
            gl={{ antialias: true }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} color="#00d4ff" />
            <pointLight position={[-10, -10, -5]} intensity={0.5} color="#ff6b00" />
            
            {/* JARVIS Core */}
            <Sphere args={[1, 32, 32]} position={[0, 0, 0]}>
              <meshStandardMaterial 
                color="#00d4ff" 
                emissive="#00d4ff" 
                emissiveIntensity={0.3}
                metalness={0.8}
                roughness={0.2}
              />
            </Sphere>
            
            {/* Orbiting Elements */}
            <group>
              {[0, 1, 2].map((i) => (
                <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
                  <Box 
                    args={[0.2, 0.2, 0.2]} 
                    position={[2, 0, 0]}
                  >
                    <meshStandardMaterial 
                      color="#ff6b00" 
                      emissive="#ff6b00" 
                      emissiveIntensity={0.2}
                    />
                  </Box>
                </group>
              ))}
            </group>
            
            <OrbitControls 
              enableZoom={true}
              enablePan={false}
              enableRotate={true}
              autoRotate={true}
              autoRotateSpeed={0.5}
              minDistance={3}
              maxDistance={10}
            />
          </Canvas>
        );
        setComponent(() => SceneComponent);
      }).catch(() => {
        setComponent(() => FallbackScene);
      });
    }).catch(() => {
      setComponent(() => FallbackScene);
    });
  }, []);

  if (!Component) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-white">Initializing 3D...</div>
      </div>
    );
  }

  return <Component />;
}
