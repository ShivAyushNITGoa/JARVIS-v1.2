'use client';

import { useEffect, useRef } from 'react';

export default function JarvisCore({ isListening, isSpeaking, isProcessing }) {
  const coreRef = useRef(null);

  useEffect(() => {
    if (!coreRef.current) return;
    
    // Remove all state classes
    coreRef.current.classList.remove('listening', 'speaking', 'processing');
    
    // Add appropriate class
    if (isListening) {
      coreRef.current.classList.add('listening');
    } else if (isSpeaking) {
      coreRef.current.classList.add('speaking');
    } else if (isProcessing) {
      coreRef.current.classList.add('processing');
    }
  }, [isListening, isSpeaking, isProcessing]);

  return (
    <div className="relative">
      {/* Main Core */}
      <div ref={coreRef} className="jarvis-core">
        <div className="reactor-ring ring-1" />
        <div className="reactor-ring ring-2" />
        <div className="reactor-ring ring-3" />
        <div className="reactor-ring ring-4" />
        <div className="reactor-core" />
      </div>
      
      {/* Status Text */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center">
        <span className={`text-sm font-medium tracking-wider ${
          isListening ? 'text-jarvis-green' :
          isSpeaking ? 'text-jarvis-orange' :
          isProcessing ? 'text-jarvis-blue animate-pulse' :
          'text-white/60'
        }`}>
          {isListening ? 'LISTENING' :
           isSpeaking ? 'SPEAKING' :
           isProcessing ? 'PROCESSING' :
           'STANDBY'}
        </span>
      </div>
      
      {/* Voice Visualizer */}
      {(isListening || isSpeaking) && (
        <div className={`voice-visualizer mt-12 ${isListening ? 'listening' : ''}`}>
          <div className="bar" />
          <div className="bar" />
          <div className="bar" />
          <div className="bar" />
          <div className="bar" />
        </div>
      )}
    </div>
  );
}