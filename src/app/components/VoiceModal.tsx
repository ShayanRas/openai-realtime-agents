"use client";

import React, { useEffect, useRef, useState } from 'react';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioStream?: MediaStream | null;
  currentThreadId?: string | null;
}

export default function VoiceModal({ isOpen, onClose, audioStream, currentThreadId }: VoiceModalProps) {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen && audioStream) {
      setupAudioAnalysis();
    } else {
      cleanup();
    }

    return cleanup;
  }, [isOpen, audioStream]);

  const setupAudioAnalysis = () => {
    if (!audioStream) return;

    try {
      // Create audio context and analyser
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      // Connect audio stream to analyser
      const source = audioContextRef.current.createMediaStreamSource(audioStream);
      source.connect(analyserRef.current);

      // Start analyzing audio
      analyzeAudio();
    } catch (error) {
      console.error('Error setting up audio analysis:', error);
    }
  };

  const analyzeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const analyze = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average audio level
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1
      
      setAudioLevel(normalizedLevel);
      
      animationFrameRef.current = requestAnimationFrame(analyze);
    };
    
    analyze();
  };

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const handleClose = () => {
    cleanup();
    onClose();
    
    // Save current thread ID to restore after refresh
    if (currentThreadId) {
      localStorage.setItem('voice-session-thread-id', currentThreadId);
    }
    
    // Refresh the page to show updated transcript
    window.location.reload();
  };

  if (!isOpen) return null;

  // Calculate orb scale based on audio level
  const orbScale = 1 + (audioLevel * 0.3); // Scale from 1 to 1.3
  const glowIntensity = audioLevel * 0.8; // Glow intensity from 0 to 0.8

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
        aria-label="Close voice mode"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Voice orb */}
      <div className="relative">
        {/* Outer glow */}
        <div 
          className="absolute inset-0 rounded-full blur-3xl transition-all duration-300"
          style={{
            background: `radial-gradient(circle, rgba(59, 130, 246, ${glowIntensity}) 0%, transparent 70%)`,
            transform: `scale(${1.5 + audioLevel})`,
          }}
        />
        
        {/* Main orb */}
        <div
          className="relative w-32 h-32 rounded-full transition-all duration-150"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #60a5fa, #3b82f6, #2563eb)',
            transform: `scale(${orbScale})`,
            boxShadow: `
              0 0 40px rgba(59, 130, 246, 0.6),
              inset 0 0 20px rgba(255, 255, 255, 0.2),
              0 0 ${20 + audioLevel * 40}px rgba(59, 130, 246, ${0.4 + glowIntensity})
            `,
          }}
        >
          {/* Inner highlight */}
          <div 
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/20 blur-md"
            style={{
              transform: `scale(${1 + audioLevel * 0.5})`,
            }}
          />
        </div>
        
        {/* Pulse animation when idle */}
        {audioLevel < 0.1 && (
          <div className="absolute inset-0 rounded-full animate-ping bg-blue-400/30" />
        )}
      </div>

      {/* Status text */}
      <div className="absolute bottom-12 text-white/60 text-sm">
        {audioLevel > 0.1 ? 'Listening...' : 'Ready'}
      </div>
    </div>
  );
}