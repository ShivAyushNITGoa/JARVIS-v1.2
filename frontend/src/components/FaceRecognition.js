'use client';

import { useEffect, useRef, useState } from 'react';
import { useJarvisStore } from '@/lib/store';

export default function FaceRecognition() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [model, setModel] = useState(null);
  const [faces, setFaces] = useState([]);
  
  const { setFaceDetected } = useJarvisStore();

  // Initialize camera and model
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      // Load TensorFlow.js Face Detection
      const tf = await import('@tensorflow/tfjs');
      const faceDetection = await import('@tensorflow-models/face-landmarks-detection');
      
      await tf.ready();
      
      const detector = await faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',
          refineLandmarks: true,
          maxFaces: 3,
        }
      );
      
      setModel(detector);
      setIsActive(true);
      
    } catch (error) {
      console.error('Camera/Model error:', error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsActive(false);
    setFaces([]);
    setFaceDetected(false);
  };

  // Detection loop
  useEffect(() => {
    if (!isActive || !model || !videoRef.current) return;
    
    let animationId;
    
    const detect = async () => {
      try {
        const predictions = await model.estimateFaces(videoRef.current);
        
        setFaces(predictions);
        setFaceDetected(predictions.length > 0);
        
        // Draw on canvas
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          predictions.forEach((face) => {
            const box = face.box;
            
            // Draw bounding box
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2;
            ctx.strokeRect(box.xMin, box.yMin, box.width, box.height);
            
            // Draw landmarks
            ctx.fillStyle = '#00d4ff';
            face.keypoints.forEach((point) => {
              ctx.beginPath();
              ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI);
              ctx.fill();
            });
            
            // Draw label
            ctx.fillStyle = '#00ff88';
            ctx.font = '14px Arial';
            ctx.fillText('Face Detected', box.xMin, box.yMin - 5);
          });
        }
      } catch (error) {
        console.error('Detection error:', error);
      }
      
      animationId = requestAnimationFrame(detect);
    };
    
    detect();
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive, model]);

  return (
    <div className="glass p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-jarvis-blue font-semibold flex items-center gap-2">
          👁️ Face Recognition
        </h3>
        <button
          onClick={isActive ? stopCamera : startCamera}
          className={`px-4 py-2 rounded-lg ${
            isActive 
              ? 'bg-jarvis-red/20 text-jarvis-red border border-jarvis-red/30' 
              : 'bg-jarvis-green/20 text-jarvis-green border border-jarvis-green/30'
          }`}
        >
          {isActive ? 'Stop' : 'Start'}
        </button>
      </div>
      
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          width={640}
          height={480}
        />
        
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40">
            Click Start to enable face recognition
          </div>
        )}
      </div>
      
      {/* Status */}
      <div className="mt-4 flex items-center gap-4">
        <div className={`status-badge ${faces.length > 0 ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          {faces.length > 0 ? `${faces.length} Face(s) Detected` : 'No Face Detected'}
        </div>
      </div>
    </div>
  );
}