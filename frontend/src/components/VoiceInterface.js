'use client';

import { useState, useEffect, useRef } from 'react';
import { useJarvisStore } from '@/lib/store';
import { jarvisAPI } from '@/lib/api';

export default function VoiceInterface() {
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(null);
  
  const {
    isListening,
    setListening,
    setSpeaking,
    setProcessing,
    addMessage,
  } = useJarvisStore();

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onstart = () => {
        setListening(true);
      };
      
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        setTranscript(interimTranscript || finalTranscript);
        
        if (finalTranscript) {
          processCommand(finalTranscript);
        }
      };
      
      recognitionRef.current.onend = () => {
        setListening(false);
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setListening(false);
      };
    }
    
    synthesisRef.current = window.speechSynthesis;
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranscript('');
      recognitionRef.current?.start();
    }
  };

  const processCommand = async (text) => {
    setListening(false);
    setProcessing(true);
    
    // Add user message
    addMessage('user', text);
    
    try {
      // Send to JARVIS
      const response = await jarvisAPI.chat(text);
      
      if (response.success) {
        addMessage('jarvis', response.response);
        speak(response.response);
      } else {
        addMessage('jarvis', 'I encountered an error processing your request.');
      }
    } catch (error) {
      addMessage('jarvis', 'Connection error. Please try again.');
    }
    
    setProcessing(false);
  };

  const speak = (text) => {
    if (!synthesisRef.current) return;
    
    // Cancel any ongoing speech
    synthesisRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    
    // Try to use a male voice
    const voices = synthesisRef.current.getVoices();
    const maleVoice = voices.find(v => 
      v.name.includes('Male') || 
      v.name.includes('David') || 
      v.name.includes('Daniel')
    );
    if (maleVoice) utterance.voice = maleVoice;
    
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    
    synthesisRef.current.speak(utterance);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Mic Button */}
      <button
        onClick={toggleListening}
        className={`btn-icon w-16 h-16 text-2xl transition-all ${
          isListening 
            ? 'bg-jarvis-green/20 border-jarvis-green text-jarvis-green animate-pulse' 
            : ''
        }`}
      >
        {isListening ? '🔴' : '🎤'}
      </button>
      
      {/* Transcript */}
      {transcript && (
        <div className="glass px-4 py-2 rounded-lg text-sm text-white/80 max-w-xs text-center">
          {transcript}
        </div>
      )}
      
      {/* Instructions */}
      <p className="text-white/40 text-sm">
        {isListening ? 'Listening...' : 'Click to speak'}
      </p>
    </div>
  );
}