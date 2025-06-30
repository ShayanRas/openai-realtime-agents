"use client";

import React, { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ThreadSidebar from './ThreadSidebar';
import { v4 as uuidv4 } from 'uuid';
import type { 
  Thread, 
  Message, 
  FileUpload, 
  ChatInterfaceProps,
  ApiResponse 
} from '@/app/lib/types';

export default function ChatInterface() {
  const [sessionId, setSessionId] = useState<string>('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const createNewThread = async (firstMessage?: string) => {
    try {
      const response = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({
          title: firstMessage ? firstMessage.slice(0, 50) : 'New Conversation',
          firstMessage,
        }),
      });
      const data = await response.json();
      setCurrentThreadId(data.thread.id);
      await loadThreads();
      return data.thread.id;
    } catch (error) {
      console.error('Error creating thread:', error);
      return null;
    }
  };

  const sendMessage = async (content: string, attachments: FileUpload[] = []) => {
    if (!content.trim() && attachments.length === 0) return;

    let threadId = currentThreadId;
    if (!threadId) {
      threadId = await createNewThread(content);
      if (!threadId) return;
    }

    setIsLoading(true);

    try {
      // Optimistically add user message
      const userMessage: Message = {
        id: uuidv4(),
        role: 'USER',
        content,
        contentType: attachments.length > 0 ? 'MULTIMODAL' : 'TEXT',
        attachments,
        createdAt: new Date().toISOString(),
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
          <div className="w-8" />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">Start a new conversation</p>
                <p className="text-sm">Type a message or upload an image to begin</p>
              </div>
            </div>
          ) : (
            <MessageList messages={messages} />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <MessageInput onSendMessage={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}