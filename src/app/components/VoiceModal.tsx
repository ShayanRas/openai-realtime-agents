"use client";

import React, { useEffect, useRef, useState } from 'react';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioStream?: MediaStream | null;
  currentThreadId?: string | null;
  speakingState?: 'idle' | 'user' | 'assistant';
}

interface AudioData {
  volume: number;
  bass: number;
  mid: number;
  treble: number;
  waveform: number[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  life: number;
}

export default function VoiceModal({ isOpen, onClose, audioStream, currentThreadId, speakingState = 'idle' }: VoiceModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  
  // Audio data state
  const [audioData, setAudioData] = useState<AudioData>({
    volume: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    waveform: []
  });
  
  // Smoothed values for animation
  const smoothedDataRef = useRef<AudioData>({
    volume: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    waveform: []
  });
  
  // Animation state
  const timeRef = useRef(0);
  const speakingStateRef = useRef<'idle' | 'user' | 'ai'>('idle');
  
  // Color transition state
  const colorStateRef = useRef({
    primaryHue: 220,
    secondaryHue: 260,
    targetPrimaryHue: 220,
    targetSecondaryHue: 260
  });
  
  // State transition animation
  const stateTransitionRef = useRef({
    pulseIntensity: 0,
    previousState: 'idle' as 'idle' | 'user' | 'assistant'
  });

  useEffect(() => {
    if (isOpen && audioStream) {
      setupAudioAnalysis();
      initializeParticles();
    } else {
      cleanup();
    }

    return cleanup;
  }, [isOpen, audioStream]);
  
  // Update color targets when speaking state changes
  useEffect(() => {
    // Trigger pulse when state changes
    if (stateTransitionRef.current.previousState !== speakingState) {
      stateTransitionRef.current.pulseIntensity = 1;
      stateTransitionRef.current.previousState = speakingState;
    }
    
    if (speakingState === 'user') {
      colorStateRef.current.targetPrimaryHue = 280;
      colorStateRef.current.targetSecondaryHue = 320;
    } else if (speakingState === 'assistant') {
      colorStateRef.current.targetPrimaryHue = 200;
      colorStateRef.current.targetSecondaryHue = 180;
    } else {
      colorStateRef.current.targetPrimaryHue = 220;
      colorStateRef.current.targetSecondaryHue = 260;
    }
  }, [speakingState]);

  const initializeParticles = () => {
    particlesRef.current = [];
    for (let i = 0; i < 50; i++) {
      particlesRef.current.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.1,
        life: 1
      });
    }
  };

  const setupAudioAnalysis = () => {
    if (!audioStream) return;

    try {
      // Create audio context and analyser with higher resolution
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048; // Higher resolution for better frequency analysis
      analyserRef.current.smoothingTimeConstant = 0.8; // Smooth the analysis

      // Connect audio stream to analyser
      const source = audioContextRef.current.createMediaStreamSource(audioStream);
      source.connect(analyserRef.current);

      // Start the animation loop
      animate();
    } catch (error) {
      console.error('Error setting up audio analysis:', error);
    }
  };

  const analyzeAudio = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    const waveformData = new Uint8Array(analyserRef.current.fftSize);
    
    // Get frequency and waveform data
    analyserRef.current.getByteFrequencyData(frequencyData);
    analyserRef.current.getByteTimeDomainData(waveformData);
    
    // Calculate volume (RMS of waveform) with better sensitivity
    let sum = 0;
    let peakAmplitude = 0;
    for (let i = 0; i < waveformData.length; i++) {
      const amplitude = (waveformData[i] - 128) / 128;
      sum += amplitude * amplitude;
      peakAmplitude = Math.max(peakAmplitude, Math.abs(amplitude));
    }
    const rms = Math.sqrt(sum / waveformData.length);
    // Combine RMS and peak for better voice detection
    const volume = Math.min((rms * 6 + peakAmplitude * 2) / 2, 1); // Increased amplification
    
    // Calculate frequency bands
    const bassEnd = Math.floor(bufferLength * 0.1); // 0-10%
    const midEnd = Math.floor(bufferLength * 0.5);  // 10-50%
    
    let bassSum = 0, midSum = 0, trebleSum = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const value = frequencyData[i] / 255;
      if (i < bassEnd) {
        bassSum += value;
      } else if (i < midEnd) {
        midSum += value;
      } else {
        trebleSum += value;
      }
    }
    
    const bass = bassSum / bassEnd;
    const mid = midSum / (midEnd - bassEnd);
    const treble = trebleSum / (bufferLength - midEnd);
    
    // Sample waveform for visualization
    const waveformSamples = [];
    const sampleRate = Math.floor(waveformData.length / 64);
    for (let i = 0; i < waveformData.length; i += sampleRate) {
      waveformSamples.push((waveformData[i] - 128) / 128);
    }
    
    setAudioData({
      volume,
      bass,
      mid,
      treble,
      waveform: waveformSamples
    });
  };

  const smoothAudioData = () => {
    const smoothingFactor = 0.2; // Increased for better responsiveness
    const decayFactor = 0.95; // Natural decay when no sound
    
    // Apply smoothing with decay
    smoothedDataRef.current.volume = smoothedDataRef.current.volume * decayFactor + (audioData.volume - smoothedDataRef.current.volume * decayFactor) * smoothingFactor;
    smoothedDataRef.current.bass = smoothedDataRef.current.bass * decayFactor + (audioData.bass - smoothedDataRef.current.bass * decayFactor) * smoothingFactor;
    smoothedDataRef.current.mid = smoothedDataRef.current.mid * decayFactor + (audioData.mid - smoothedDataRef.current.mid * decayFactor) * smoothingFactor;
    smoothedDataRef.current.treble = smoothedDataRef.current.treble * decayFactor + (audioData.treble - smoothedDataRef.current.treble * decayFactor) * smoothingFactor;
    
    // Clamp values
    smoothedDataRef.current.volume = Math.max(0, Math.min(1, smoothedDataRef.current.volume));
    smoothedDataRef.current.bass = Math.max(0, Math.min(1, smoothedDataRef.current.bass));
    smoothedDataRef.current.mid = Math.max(0, Math.min(1, smoothedDataRef.current.mid));
    smoothedDataRef.current.treble = Math.max(0, Math.min(1, smoothedDataRef.current.treble));
  };

  const updateParticles = (centerX: number, centerY: number) => {
    const { volume, bass } = smoothedDataRef.current;
    
    // Add new particles when volume is high
    if (volume > 0.3 && particlesRef.current.length < 100) {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = 1 + volume * 3;
        particlesRef.current.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          radius: Math.random() * 3 + 1,
          alpha: 0.8,
          life: 1
        });
      }
    }
    
    // Update existing particles
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      particle.life -= 0.01;
      particle.alpha = particle.life * 0.8;
      
      // Attract to center with bass
      const dx = centerX - particle.x;
      const dy = centerY - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 50) {
        particle.vx += (dx / distance) * bass * 0.1;
        particle.vy += (dy / distance) * bass * 0.1;
      }
      
      return particle.life > 0;
    });
  };

  const drawOrb = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => {
    const { volume, bass, mid, treble } = smoothedDataRef.current;
    const time = timeRef.current;
    
    // Main orb size based on volume with more dynamic scaling
    const baseRadius = 80;
    const radius = baseRadius + volume * 50 + bass * 30 + Math.sin(time * 2) * 5;
    
    // Smooth color transitions
    const colorTransitionSpeed = 0.1;
    colorStateRef.current.primaryHue += (colorStateRef.current.targetPrimaryHue - colorStateRef.current.primaryHue) * colorTransitionSpeed;
    colorStateRef.current.secondaryHue += (colorStateRef.current.targetSecondaryHue - colorStateRef.current.secondaryHue) * colorTransitionSpeed;
    
    const primaryHue = colorStateRef.current.primaryHue;
    const secondaryHue = colorStateRef.current.secondaryHue;
    
    // Energy intensity based on speaking state
    let energyIntensity = volume * 0.2;
    if (speakingState === 'user') {
      energyIntensity = volume * 0.3 + 0.1;
    } else if (speakingState === 'assistant') {
      energyIntensity = volume * 0.25 + 0.05;
    }
    
    // Draw outer energy field
    const energyGradient = ctx.createRadialGradient(centerX, centerY, radius, centerX, centerY, radius * 2);
    energyGradient.addColorStop(0, `hsla(${primaryHue}, 80%, 50%, ${energyIntensity})`);
    energyGradient.addColorStop(0.5, `hsla(${secondaryHue}, 70%, 40%, ${energyIntensity * 0.5})`);
    energyGradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = energyGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw morphing orb shape using bezier curves
    ctx.save();
    ctx.translate(centerX, centerY);
    
    const points = 12;
    ctx.beginPath();
    
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const nextAngle = ((i + 1) / points) * Math.PI * 2;
      
      // Add wave distortion based on frequencies
      const waveOffset1 = Math.sin(angle * 3 + time * 3) * bass * 15;
      const waveOffset2 = Math.sin(angle * 5 + time * 2) * mid * 10;
      const waveOffset3 = Math.sin(angle * 7 + time * 4) * treble * 5;
      
      const r = radius + waveOffset1 + waveOffset2 + waveOffset3;
      
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Control points for smooth curves
        const cp1x = Math.cos(angle - 0.1) * (r + 10);
        const cp1y = Math.sin(angle - 0.1) * (r + 10);
        const cp2x = Math.cos(angle + 0.1) * (r + 10);
        const cp2y = Math.sin(angle + 0.1) * (r + 10);
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      }
    }
    
    ctx.closePath();
    
    // Dynamic gradient based on audio
    const gradient = ctx.createRadialGradient(
      -radius * 0.3, 
      -radius * 0.3, 
      0,
      0, 
      0, 
      radius
    );
    
    // Color shifts based on frequency content and speaking state
    const hue = primaryHue + mid * 40 + Math.sin(time) * 10;
    const saturation = 60 + treble * 30 + (speakingState !== 'idle' ? 10 : 0);
    const lightness = 50 + volume * 30;
    
    gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness + 30}%, 0.9)`);
    gradient.addColorStop(0.3, `hsla(${hue + 20}, ${saturation}%, ${lightness + 10}%, 0.7)`);
    gradient.addColorStop(0.6, `hsla(${hue - 20}, ${saturation + 10}%, ${lightness}%, 0.5)`);
    gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness - 20}%, 0.2)`);
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.restore();
    
    // Draw frequency rings with rotation
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(time * (0.5 + i * 0.2) * (i % 2 === 0 ? 1 : -1));
      
      const ringRadius = radius + 30 + i * 20;
      const lineWidth = 1 + (i === 0 ? bass : i === 1 ? mid : i === 2 ? treble : volume) * 3;
      
      ctx.strokeStyle = `hsla(${hue + i * 30}, ${saturation}%, ${lightness + 10}%, ${0.4 - i * 0.08})`;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([10 + i * 5, 15 + i * 3]);
      
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.restore();
    }
    
    // Draw waveform with glow
    if (audioData.waveform.length > 0) {
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = `hsla(${hue}, ${saturation}%, 70%, 0.8)`;
      
      ctx.strokeStyle = `hsla(${hue}, ${saturation}%, 80%, 0.6)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      const waveRadius = radius + 60;
      for (let i = 0; i < audioData.waveform.length; i++) {
        const angle = (i / audioData.waveform.length) * Math.PI * 2 - Math.PI / 2;
        const nextAngle = ((i + 1) / audioData.waveform.length) * Math.PI * 2 - Math.PI / 2;
        
        const waveHeight = audioData.waveform[i] * 30 * (0.5 + volume);
        const smoothedHeight = waveHeight * (0.8 + Math.sin(angle * 4 + time * 3) * 0.2);
        
        const x = centerX + Math.cos(angle) * (waveRadius + smoothedHeight);
        const y = centerY + Math.sin(angle) * (waveRadius + smoothedHeight);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevAngle = ((i - 1) / audioData.waveform.length) * Math.PI * 2 - Math.PI / 2;
          const cpx = centerX + Math.cos(prevAngle + (angle - prevAngle) / 2) * (waveRadius + smoothedHeight * 1.2);
          const cpy = centerY + Math.sin(prevAngle + (angle - prevAngle) / 2) * (waveRadius + smoothedHeight * 1.2);
          ctx.quadraticCurveTo(cpx, cpy, x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();
      
      ctx.restore();
    }
    
    // Inner core with pulse
    const coreRadius = 20 + volume * 10;
    const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
    coreGradient.addColorStop(0, `hsla(${hue + 40}, 90%, 90%, ${0.8 + volume * 0.2})`);
    coreGradient.addColorStop(0.5, `hsla(${hue + 20}, 80%, 70%, ${0.5 + volume * 0.1})`);
    coreGradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add energy pulses
    if (volume > 0.5) {
      const pulseAlpha = (volume - 0.5) * 2 * (0.5 + Math.sin(time * 10) * 0.5);
      ctx.strokeStyle = `hsla(${hue}, 90%, 80%, ${pulseAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 100 * volume, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // State transition pulse effect
    if (stateTransitionRef.current.pulseIntensity > 0) {
      ctx.strokeStyle = `hsla(${primaryHue}, 90%, 70%, ${stateTransitionRef.current.pulseIntensity * 0.8})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 50 * stateTransitionRef.current.pulseIntensity, 0, Math.PI * 2);
      ctx.stroke();
      
      // Decay the pulse
      stateTransitionRef.current.pulseIntensity *= 0.92;
      if (stateTransitionRef.current.pulseIntensity < 0.01) {
        stateTransitionRef.current.pulseIntensity = 0;
      }
    }
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    // Particle colors based on speaking state
    let particleR = 100, particleG = 150, particleB = 255; // Default blue
    
    if (speakingState === 'user') {
      particleR = 200; particleG = 100; particleB = 255; // Purple
    } else if (speakingState === 'assistant') {
      particleR = 100; particleG = 255; particleB = 220; // Cyan
    }
    
    particlesRef.current.forEach(particle => {
      ctx.fillStyle = `rgba(${particleR}, ${particleG}, ${particleB}, ${particle.alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Update time
    timeRef.current += 0.016; // ~60fps
    
    // Analyze audio
    analyzeAudio();
    smoothAudioData();
    
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Slight trail effect
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Update and draw particles
    updateParticles(centerX, centerY);
    drawParticles(ctx);
    
    // Draw main orb
    drawOrb(ctx, centerX, centerY);
    
    // Continue animation
    animationFrameRef.current = requestAnimationFrame(animate);
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
    particlesRef.current = [];
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
      <div className="absolute bottom-8 flex flex-col items-center gap-2 z-10">
        <div className="flex items-center gap-3">
          {/* Volume indicator */}
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 h-3 bg-white/30 rounded-full transition-all duration-150"
                style={{
                  height: `${12 + i * 3}px`,
                  backgroundColor: smoothedDataRef.current.volume > (i + 1) / 5 
                    ? `hsla(${200 + smoothedDataRef.current.mid * 60}, 80%, 70%, ${0.7 + i * 0.06})`
                    : 'rgba(255, 255, 255, 0.2)',
                  transform: smoothedDataRef.current.volume > (i + 1) / 5 ? 'scaleY(1.2)' : 'scaleY(1)'
                }}
              />
            ))}
          </div>
          
          {/* Status text */}
          <div className="text-white/80 text-sm font-medium">
            {speakingState === 'user' ? 'You are speaking' :
             speakingState === 'assistant' ? 'Assistant is speaking' :
             smoothedDataRef.current.volume > 0.05 ? 'Detecting...' : 'Ready'}
          </div>
          
          {/* Frequency indicator */}
          <div className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: speakingState === 'user' ? 
                  `hsla(${280 + smoothedDataRef.current.bass * 40}, 80%, 60%, ${0.5 + smoothedDataRef.current.bass * 0.5})` :
                  speakingState === 'assistant' ?
                  `hsla(${200 + smoothedDataRef.current.bass * 40}, 80%, 60%, ${0.5 + smoothedDataRef.current.bass * 0.5})` :
                  `hsla(${220 + smoothedDataRef.current.bass * 40}, 80%, 60%, ${0.5 + smoothedDataRef.current.bass * 0.5})`,
                transform: `scale(${1 + smoothedDataRef.current.bass})`
              }}
            />
            <div 
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: speakingState === 'user' ? 
                  `hsla(${300 + smoothedDataRef.current.mid * 20}, 80%, 60%, ${0.5 + smoothedDataRef.current.mid * 0.5})` :
                  speakingState === 'assistant' ?
                  `hsla(${190 + smoothedDataRef.current.mid * 20}, 80%, 60%, ${0.5 + smoothedDataRef.current.mid * 0.5})` :
                  `hsla(${240 + smoothedDataRef.current.mid * 20}, 80%, 60%, ${0.5 + smoothedDataRef.current.mid * 0.5})`,
                transform: `scale(${1 + smoothedDataRef.current.mid})`
              }}
            />
            <div 
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: speakingState === 'user' ? 
                  `hsla(${320 + smoothedDataRef.current.treble * 20}, 80%, 60%, ${0.5 + smoothedDataRef.current.treble * 0.5})` :
                  speakingState === 'assistant' ?
                  `hsla(${180 + smoothedDataRef.current.treble * 20}, 80%, 60%, ${0.5 + smoothedDataRef.current.treble * 0.5})` :
                  `hsla(${260 + smoothedDataRef.current.treble * 20}, 80%, 60%, ${0.5 + smoothedDataRef.current.treble * 0.5})`,
                transform: `scale(${1 + smoothedDataRef.current.treble})`
              }}
            />
          </div>
        </div>
        
        {/* Instructions */}
        <div className="text-white/40 text-xs">
          Speak naturally • Press X to exit
        </div>
      </div>
    </div>
  );
}