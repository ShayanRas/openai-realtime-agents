"use client";

import React, { useEffect, useRef, useState } from 'react';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  localAudioStream?: MediaStream | null;
  remoteAudioStream?: MediaStream | null;
  currentThreadId?: string | null;
  speakingState?: 'idle' | 'user' | 'assistant';
}

interface AudioAnalyzer {
  analyser: AnalyserNode;
  dataArray: Uint8Array;
  context: AudioContext;
}

export default function VoiceModal({ 
  isOpen, 
  onClose, 
  localAudioStream, 
  remoteAudioStream, 
  currentThreadId, 
  speakingState = 'idle' 
}: VoiceModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const localAnalyzerRef = useRef<AudioAnalyzer | null>(null);
  const remoteAnalyzerRef = useRef<AudioAnalyzer | null>(null);
  
  // Audio levels
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  
  // Animation state
  const animationStateRef = useRef({
    time: 0,
    localLevel: 0,
    remoteLevel: 0,
    targetLocalLevel: 0,
    targetRemoteLevel: 0,
    primaryScale: 1,
    targetScale: 1,
    colorPhase: 0,
    targetColorPhase: 0,
  });

  // Set up audio analyzers
  useEffect(() => {
    if (isOpen && localAudioStream) {
      setupLocalAnalyzer(localAudioStream);
    } else {
      cleanupLocalAnalyzer();
    }
  }, [isOpen, localAudioStream]);

  useEffect(() => {
    if (isOpen && remoteAudioStream) {
      setupRemoteAnalyzer(remoteAudioStream);
    } else {
      cleanupRemoteAnalyzer();
    }
  }, [isOpen, remoteAudioStream]);

  // Start/stop animation
  useEffect(() => {
    if (isOpen) {
      startAnimation();
    } else {
      stopAnimation();
    }
    return () => stopAnimation();
  }, [isOpen]);

  // Update animation targets based on speaking state
  useEffect(() => {
    const state = animationStateRef.current;
    
    switch (speakingState) {
      case 'user':
        state.targetScale = 1.2;
        state.targetColorPhase = 1; // Purple
        break;
      case 'assistant':
        state.targetScale = 1.15;
        state.targetColorPhase = -1; // Cyan
        break;
      default:
        state.targetScale = 1;
        state.targetColorPhase = 0; // Blue
    }
  }, [speakingState]);

  const setupLocalAnalyzer = (stream: MediaStream) => {
    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      localAnalyzerRef.current = { analyser, dataArray, context };
      console.log('Local audio analyzer set up');
    } catch (error) {
      console.error('Error setting up local audio analyzer:', error);
    }
  };

  const setupRemoteAnalyzer = (stream: MediaStream) => {
    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      remoteAnalyzerRef.current = { analyser, dataArray, context };
      console.log('Remote audio analyzer set up');
    } catch (error) {
      console.error('Error setting up remote audio analyzer:', error);
    }
  };

  const cleanupLocalAnalyzer = () => {
    if (localAnalyzerRef.current) {
      localAnalyzerRef.current.context.close();
      localAnalyzerRef.current = null;
    }
  };

  const cleanupRemoteAnalyzer = () => {
    if (remoteAnalyzerRef.current) {
      remoteAnalyzerRef.current.context.close();
      remoteAnalyzerRef.current = null;
    }
  };

  const analyzeAudio = () => {
    let localLevel = 0;
    let remoteLevel = 0;

    // Analyze local audio
    if (localAnalyzerRef.current) {
      const { analyser, dataArray } = localAnalyzerRef.current;
      analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      localLevel = sum / (dataArray.length * 255);
    }

    // Analyze remote audio
    if (remoteAnalyzerRef.current) {
      const { analyser, dataArray } = remoteAnalyzerRef.current;
      analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      remoteLevel = sum / (dataArray.length * 255);
    }

    setLocalAudioLevel(localLevel);
    setRemoteAudioLevel(remoteLevel);
    
    // Update animation targets
    animationStateRef.current.targetLocalLevel = localLevel;
    animationStateRef.current.targetRemoteLevel = remoteLevel;
  };

  const startAnimation = () => {
    if (animationFrameRef.current) return;
    animate();
  };

  const stopAnimation = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Analyze audio
    analyzeAudio();
    
    // Update animation state
    const state = animationStateRef.current;
    state.time += 0.016;
    
    // Smooth transitions
    const smoothing = 0.15;
    state.localLevel += (state.targetLocalLevel - state.localLevel) * smoothing;
    state.remoteLevel += (state.targetRemoteLevel - state.remoteLevel) * smoothing;
    state.primaryScale += (state.targetScale - state.primaryScale) * smoothing * 0.5;
    state.colorPhase += (state.targetColorPhase - state.colorPhase) * smoothing * 0.5;
    
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.98)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw visualization
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    drawVisualization(ctx, centerX, centerY);
    
    // Continue animation
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const drawVisualization = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => {
    const state = animationStateRef.current;
    
    // Determine which audio level to use based on speaking state
    let audioLevel = 0;
    if (speakingState === 'user') {
      audioLevel = state.localLevel;
    } else if (speakingState === 'assistant') {
      audioLevel = state.remoteLevel;
    } else {
      // Use the louder of the two when idle
      audioLevel = Math.max(state.localLevel * 0.5, state.remoteLevel * 0.5);
    }
    
    // Base radius with audio-driven scaling
    const baseRadius = 80;
    const radius = baseRadius * state.primaryScale * (1 + audioLevel * 0.3);
    
    // Color based on state
    let r = 100, g = 150, b = 255; // Blue (idle)
    
    if (state.colorPhase > 0) {
      // Transition to purple (user)
      const t = state.colorPhase;
      r = 100 + t * 100;
      g = 150 - t * 50;
      b = 255;
    } else if (state.colorPhase < 0) {
      // Transition to cyan (assistant)
      const t = -state.colorPhase;
      r = 100 - t * 50;
      g = 150 + t * 105;
      b = 255 - t * 35;
    }
    
    // Draw frequency rings based on actual audio
    if ((speakingState === 'user' && localAnalyzerRef.current) || 
        (speakingState === 'assistant' && remoteAnalyzerRef.current)) {
      const analyzer = speakingState === 'user' ? localAnalyzerRef.current : remoteAnalyzerRef.current;
      if (analyzer) {
        const { dataArray } = analyzer;
        
        // Draw frequency visualization
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const slices = 32;
        for (let i = 0; i < slices; i++) {
          const angle = (i / slices) * Math.PI * 2;
          const freqIndex = Math.floor(i * dataArray.length / slices);
          const freqValue = dataArray[freqIndex] / 255;
          const radiusOffset = freqValue * 40;
          
          const x = centerX + Math.cos(angle) * (radius + 20 + radiusOffset);
          const y = centerY + Math.sin(angle) * (radius + 20 + radiusOffset);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    
    // Outer glow
    const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 2);
    glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${audioLevel * 0.4})`);
    glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${audioLevel * 0.2})`);
    glowGradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Main orb
    const orbGradient = ctx.createRadialGradient(
      centerX - radius * 0.3,
      centerY - radius * 0.3,
      0,
      centerX,
      centerY,
      radius
    );
    
    orbGradient.addColorStop(0, `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, 0.9)`);
    orbGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.7)`);
    orbGradient.addColorStop(1, `rgba(${r * 0.5}, ${g * 0.5}, ${b * 0.5}, 0.3)`);
    
    ctx.fillStyle = orbGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner core that pulses with audio
    const coreRadius = radius * 0.3 * (1 + audioLevel * 0.5);
    const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
    coreGradient.addColorStop(0, `rgba(255, 255, 255, ${0.6 + audioLevel * 0.4})`);
    coreGradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleClose = () => {
    stopAnimation();
    cleanupLocalAnalyzer();
    cleanupRemoteAnalyzer();
    onClose();
    
    // Save current thread ID to restore after refresh
    if (currentThreadId) {
      localStorage.setItem('voice-session-thread-id', currentThreadId);
    }
    
    // Refresh the page to show updated transcript
    window.location.reload();
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Canvas for animation */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-10"
        aria-label="Close voice mode"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Status display */}
      <div className="absolute bottom-12 flex flex-col items-center gap-3 z-10">
        {/* Audio level indicators */}
        <div className="flex items-center gap-6">
          {/* Local audio level */}
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">You</span>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={`local-${i}`}
                  className="w-2 transition-all duration-150"
                  style={{
                    height: `${8 + i * 3}px`,
                    backgroundColor: localAudioLevel > (i + 1) / 5 
                      ? 'rgba(200, 100, 255, 0.8)'
                      : 'rgba(255, 255, 255, 0.2)',
                  }}
                />
              ))}
            </div>
          </div>
          
          {/* Status text */}
          <div className="text-white/90 text-lg font-medium">
            {speakingState === 'user' ? 'You are speaking' :
             speakingState === 'assistant' ? 'Assistant is speaking' :
             'Ready'}
          </div>
          
          {/* Remote audio level */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={`remote-${i}`}
                  className="w-2 transition-all duration-150"
                  style={{
                    height: `${8 + i * 3}px`,
                    backgroundColor: remoteAudioLevel > (i + 1) / 5 
                      ? 'rgba(100, 255, 220, 0.8)'
                      : 'rgba(255, 255, 255, 0.2)',
                  }}
                />
              ))}
            </div>
            <span className="text-white/60 text-sm">Assistant</span>
          </div>
        </div>
        
        {/* Instructions */}
        <div className="text-white/50 text-sm">
          Speak naturally • Click X to exit
        </div>
      </div>
    </div>
  );
}