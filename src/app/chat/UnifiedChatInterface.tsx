"use client";

import React, { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import UnifiedMessageInput from './UnifiedMessageInput';
import ThreadSidebar from './ThreadSidebar';
import { useUnifiedSession } from '@/app/hooks/useUnifiedSession';
import { useVoiceToChat } from '@/app/hooks/useVoiceToChat';
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

  // Unified session for handling both text and voice
  const unifiedSession = useUnifiedSession({
    onTranscriptionComplete: async (itemId: string, text: string, role: 'user' | 'assistant') => {
      // When voice message is transcribed, save it to the voice thread
      if (voiceThreadId) {
        const dbRole = role === 'user' ? 'USER' : 'ASSISTANT';
        await saveMessageToThread(voiceThreadId, text, dbRole);
        
        // If viewing the voice thread, reload messages
        if (currentThreadId === voiceThreadId) {
          await loadMessages(voiceThreadId);
        }
      }
    },
    onStatusChange: (status) => {
      console.log('Voice session status:', status);
    },
    onAgentHandoff: (agentName) => {
      console.log('Agent handoff to:', agentName);
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
      console.error('Error loading messages:', error);
    }
  };

  const createNewThread = async (titleOrFirstMessage?: string, isVoiceSession: boolean = false) => {
    try {
      const response = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({
          title: isVoiceSession ? titleOrFirstMessage : (titleOrFirstMessage ? titleOrFirstMessage.slice(0, 50) : 'New Conversation'),
          firstMessage: isVoiceSession ? undefined : titleOrFirstMessage,
        }),
      });
      const data = await response.json();
      setCurrentThreadId(data.thread.id);
      await loadThreads();
      return data.thread;
    } catch (error) {
      console.error('Error creating thread:', error);
      return null;
    }
  };

  const saveMessageToThread = async (threadId: string, content: string, role: 'USER' | 'ASSISTANT') => {
    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId,
          content,
          role,
          contentType: 'TEXT',
        }),
      });
    } catch (error) {
      console.error('Error saving message:', error);
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
      unifiedSession.sendTextMessage(content);
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
    if (enabled) {
      // Create a new thread for voice session
      const voiceThread = await createNewThread('🎙️ Voice Session', true);
      if (voiceThread) {
        setVoiceThreadId(voiceThread.id);
        setCurrentThreadId(voiceThread.id);
        await unifiedSession.toggleVoiceMode(true);
      }
    } else {
      // Disable voice mode
      await unifiedSession.toggleVoiceMode(false);
      setVoiceThreadId(null);
    }
  };

  return (
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
        />
      </div>
    </div>
  );
}