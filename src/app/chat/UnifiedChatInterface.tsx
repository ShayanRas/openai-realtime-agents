"use client";

import React, { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import UnifiedMessageInput from './UnifiedMessageInput';
import ThreadSidebar from './ThreadSidebar';
import VoiceModal from '@/app/components/VoiceModal';
import { useUnifiedSession } from '@/app/hooks/useUnifiedSession';
import { useVoiceToChat } from '@/app/hooks/useVoiceToChat';
import useAudioDownload from '@/app/hooks/useAudioDownload';
import { v4 as uuidv4 } from 'uuid';
import type { 
  Thread, 
  Message, 
  FileUpload, 
  ChatInterfaceProps,
  ApiResponse 
} from '@/app/lib/types';

export default function UnifiedChatInterface() {
  const [sessionId, setSessionId] = useState<string>('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice thread ID for voice sessions
  const [voiceThreadId, setVoiceThreadId] = useState<string | null>(null);
  const voiceThreadIdRef = useRef<string | null>(null);
  
  // Audio recording for voice sessions
  const { startRecording, stopRecording, downloadRecording } = useAudioDownload();
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceAudioStream, setVoiceAudioStream] = useState<MediaStream | null>(null);
  const [speakingState, setSpeakingState] = useState<'idle' | 'user' | 'assistant'>('idle');

  // Unified session for handling both text and voice
  const unifiedSession = useUnifiedSession({
    onTranscriptionStart: async (itemId: string, role: 'user' | 'assistant') => {
      console.log('[onTranscriptionStart]', { itemId, role, voiceThreadId: voiceThreadIdRef.current });
      // Create a placeholder message when transcription starts
      if (voiceThreadIdRef.current) {
        const dbRole = role === 'user' ? 'USER' : 'ASSISTANT';
        const placeholderText = '[Transcribing...]';
        
        // Save placeholder to database and reload
        await saveMessageToThread(voiceThreadIdRef.current, placeholderText, dbRole, itemId);
        
        // Reload messages to show the placeholder
        if (currentThreadId === voiceThreadIdRef.current) {
          await loadMessages(voiceThreadIdRef.current);
        }
      }
    },
    onTranscriptionDelta: async (itemId: string, delta: string, role: 'user' | 'assistant') => {
      console.log('[onTranscriptionDelta]', { itemId, delta, role, voiceThreadId: voiceThreadIdRef.current });
      // Find the existing message in our messages array
      if (voiceThreadIdRef.current) {
        const existingMessage = messages.find(m => m.externalId === itemId);
        if (existingMessage) {
          const newText = existingMessage.content === '[Transcribing...]' ? delta : existingMessage.content + delta;
          
          // Update in database and reload
          await updateMessageInThread(voiceThreadIdRef.current, itemId, newText);
          
          // Reload messages to show the update
          if (currentThreadId === voiceThreadIdRef.current) {
            await loadMessages(voiceThreadIdRef.current);
          }
        } else {
          console.warn('[onTranscriptionDelta] Message not found:', itemId);
        }
      }
    },
    onTranscriptionComplete: async (itemId: string, text: string, role: 'user' | 'assistant') => {
      console.log('[onTranscriptionComplete]', { itemId, text, role, voiceThreadId: voiceThreadIdRef.current });
      // Finalize the transcribed message
      if (voiceThreadIdRef.current) {
        // Update with final text in database and reload
        await updateMessageInThread(voiceThreadIdRef.current, itemId, text);
        
        // Reload messages to show the final text
        if (currentThreadId === voiceThreadIdRef.current) {
          await loadMessages(voiceThreadIdRef.current);
        }
      }
    },
    onStatusChange: (status) => {
      console.log('Voice session status:', status);
      
      // Start recording when connected
      if (status === 'CONNECTED' && voiceThreadIdRef.current) {
        console.log('[onStatusChange] Starting recording...');
        // Get the audio element from the unified session
        const audioEl = document.querySelector('audio[autoplay]') as HTMLAudioElement;
        if (audioEl && audioEl.srcObject) {
          console.log('[onStatusChange] Found audio element with stream');
          audioElementRef.current = audioEl;
          const stream = audioEl.srcObject as MediaStream;
          setVoiceAudioStream(stream);
          startRecording(stream);
        } else {
          console.error('[onStatusChange] Could not find audio element or stream');
        }
      } else if (status === 'DISCONNECTED') {
        setVoiceAudioStream(null);
      }
    },
    onAgentHandoff: (agentName) => {
      console.log('Agent handoff to:', agentName);
    },
    onSpeechStarted: (role: 'user' | 'assistant') => {
      console.log('[Speech Started]', role);
      setSpeakingState(role);
    },
    onSpeechStopped: (role: 'user' | 'assistant') => {
      console.log('[Speech Stopped]', role);
      setSpeakingState('idle');
    }
  });

  // Initialize session
  useEffect(() => {
    const storedSessionId = localStorage.getItem('chat-session-id');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = uuidv4();
      localStorage.setItem('chat-session-id', newSessionId);
      setSessionId(newSessionId);
    }
    
    // Check if we're returning from a voice session
    const savedThreadId = localStorage.getItem('voice-session-thread-id');
    if (savedThreadId) {
      setCurrentThreadId(savedThreadId);
      // Clean up the saved thread ID
      localStorage.removeItem('voice-session-thread-id');
    }
  }, []);

  // Load threads when session is ready
  useEffect(() => {
    if (sessionId) {
      loadThreads();
    }
  }, [sessionId]);

  // Load messages when thread changes
  useEffect(() => {
    if (currentThreadId) {
      loadMessages(currentThreadId);
    }
  }, [currentThreadId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadThreads = async () => {
    try {
      const response = await fetch('/api/chat/threads', {
        headers: {
          'x-session-id': sessionId,
        },
      });
      const data = await response.json();
      setThreads(data.threads);
    } catch (error) {
      console.error('Error loading threads:', error);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const response = await fetch(`/api/chat/messages?threadId=${threadId}`);
      const data = await response.json();
      setMessages(data.messages);
    } catch (error) {
      console.error('[loadMessages] Error:', error);
    }
  };

  const createNewThread = async (titleOrFirstMessage?: string, isVoiceSession: boolean = false) => {
    try {
      console.log('[createNewThread] Creating thread:', { titleOrFirstMessage, isVoiceSession, sessionId });
      const response = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({
          title: isVoiceSession ? titleOrFirstMessage : (titleOrFirstMessage ? titleOrFirstMessage.slice(0, 50) : 'New Conversation'),
          firstMessage: isVoiceSession ? undefined : titleOrFirstMessage,
          mode: isVoiceSession ? 'VOICE' : 'CHAT',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('[createNewThread] Failed:', response.status, errorData);
        throw new Error(`Failed to create thread: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[createNewThread] Success:', data);
      setCurrentThreadId(data.thread.id);
      await loadThreads();
      return data.thread;
    } catch (error) {
      console.error('[createNewThread] Error:', error);
      return null;
    }
  };

  const saveMessageToThread = async (threadId: string, content: string, role: 'USER' | 'ASSISTANT', externalId?: string) => {
    try {
      console.log('[saveMessageToThread] Saving message:', { threadId, content, role, externalId });
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId,
          content,
          role,
          contentType: 'TEXT',
          externalId, // Use the itemId from voice session as externalId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('[saveMessageToThread] Failed:', response.status, errorData);
        throw new Error(`Failed to save message: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[saveMessageToThread] Success:', data);
    } catch (error) {
      console.error('[saveMessageToThread] Error:', error);
    }
  };

  const updateMessageInThread = async (threadId: string, externalId: string, content: string) => {
    try {
      console.log('[updateMessageInThread] Updating message:', { threadId, externalId, content });
      const response = await fetch('/api/chat/messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId,
          externalId,
          content,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('[updateMessageInThread] Failed:', response.status, errorData);
        throw new Error(`Failed to update message: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[updateMessageInThread] Success:', data);
    } catch (error) {
      console.error('[updateMessageInThread] Error:', error);
    }
  };

  const sendMessage = async (content: string, attachments: FileUpload[] = []) => {
    if (!content.trim() && attachments.length === 0) return;

    let threadId = currentThreadId;
    if (!threadId) {
      threadId = await createNewThread(content);
      if (!threadId) return;
    }

    // If voice mode is active, send to voice session
    if (unifiedSession.isVoiceMode && unifiedSession.isConnected) {
      console.log('[sendMessage] Sending text in voice mode:', content);
      unifiedSession.sendUserText(content);
      // Voice response will be handled by the onVoiceMessage callback
      return;
    }

    // Otherwise, handle as regular text chat
    setIsLoading(true);

    try {
      // Optimistically add user message
      const userMessage: Message = {
        id: uuidv4(),
        threadId,
        role: 'USER',
        content,
        contentType: attachments.length > 0 ? 'MULTIMODAL' : 'TEXT',
        attachments,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Get AI response
      const response = await fetch('/api/chat/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId,
          message: content,
          attachments,
        }),
      });

      const data = await response.json();
      
      // Update messages with server response
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== userMessage.id);
        return [...filtered, data.userMessage, data.assistantMessage];
      });

      await loadThreads();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceToggle = async (enabled: boolean) => {
    console.log('[handleVoiceToggle]', { enabled });
    if (enabled) {
      // Create a new thread for voice session
      const voiceThread = await createNewThread('🎙️ Voice Session', true);
      if (voiceThread) {
        console.log('[handleVoiceToggle] Created voice thread:', voiceThread.id);
        setVoiceThreadId(voiceThread.id);
        voiceThreadIdRef.current = voiceThread.id;  // Update ref
        setCurrentThreadId(voiceThread.id);
        console.log('[handleVoiceToggle] Set currentThreadId to:', voiceThread.id);
        setShowVoiceModal(true);
        await unifiedSession.toggleVoiceMode(true);
      }
    } else {
      // Disable voice mode
      stopRecording();
      await unifiedSession.toggleVoiceMode(false);
      setVoiceThreadId(null);
      voiceThreadIdRef.current = null;  // Update ref
      setShowVoiceModal(false);
    }
  };

  const handleCloseVoiceModal = () => {
    handleVoiceToggle(false);
  };

  const copyTranscript = async () => {
    if (!messages.length) return;
    
    const transcript = messages
      .map(msg => {
        // Convert role to proper case for display
        const displayRole = msg.role === 'USER' ? 'User' : 
                          msg.role === 'ASSISTANT' ? 'Assistant' : msg.role;
        return `${displayRole}: ${msg.content}`;
      })
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(transcript);
      // Could add a toast notification here
      console.log('Transcript copied to clipboard');
      alert('Transcript copied to clipboard!'); // Add user feedback
    } catch (error) {
      console.error('Failed to copy transcript:', error);
      alert('Failed to copy transcript. Please try again.');
    }
  };

  return (
    <>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
      <ThreadSidebar
        threads={threads}
        currentThreadId={currentThreadId}
        onThreadSelect={setCurrentThreadId}
        onNewThread={() => createNewThread()}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg md:hidden"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold">
            {threads.find((t) => t.id === currentThreadId)?.title || 'New Chat'}
          </h1>
          
          {/* Voice Mode Indicator */}
          {currentThreadId === voiceThreadId && unifiedSession.isVoiceMode && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${
                unifiedSession.isConnected ? 'bg-green-500 animate-pulse' : 
                unifiedSession.isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <span className="text-sm font-medium text-blue-700">
                {unifiedSession.isConnected ? '🎙️ Voice Active' : 
                 unifiedSession.isConnecting ? 'Connecting...' : 'Voice Disconnected'}
              </span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">Start a new conversation</p>
                <p className="text-sm">Type a message, upload an image, or switch to voice mode</p>
              </div>
            </div>
          ) : (
            <MessageList messages={messages} />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <UnifiedMessageInput 
          onSendMessage={sendMessage}
          isLoading={isLoading}
          voiceSession={unifiedSession}
          onVoiceToggle={handleVoiceToggle}
          onDownloadAudio={voiceThreadId ? downloadRecording : undefined}
          onCopyTranscript={voiceThreadId ? copyTranscript : undefined}
        />
      </div>
    </div>
    
    {/* Voice Modal */}
    <VoiceModal
      isOpen={showVoiceModal}
      onClose={handleCloseVoiceModal}
      audioStream={voiceAudioStream}
      currentThreadId={currentThreadId}
      speakingState={speakingState}
    />
    </>
  );
}