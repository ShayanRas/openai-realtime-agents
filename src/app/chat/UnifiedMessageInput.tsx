import React, { useState, useRef, KeyboardEvent } from 'react';
import type { FileUpload } from '@/app/lib/types';

interface UnifiedMessageInputProps {
  onSendMessage: (content: string, attachments: FileUpload[]) => Promise<void>;
  isLoading: boolean;
  voiceSession: {
    isVoiceMode: boolean;
    isConnected: boolean;
    isConnecting: boolean;
    isPTTActive: boolean;
    interrupt: () => void;
    mute: (muted: boolean) => void;
    updateTurnDetection: (usePTT: boolean) => void;
    handlePTTStart: () => void;
    handlePTTEnd: () => void;
  };
  onVoiceToggle: (enabled: boolean) => Promise<void>;
  onDownloadAudio?: () => void;
  onCopyTranscript?: () => void;
}

export default function UnifiedMessageInput({ 
  onSendMessage, 
  isLoading, 
  voiceSession,
  onVoiceToggle,
  onDownloadAudio,
  onCopyTranscript 
}: UnifiedMessageInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<FileUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if ((message.trim() || attachments.length > 0) && !isLoading) {
      await onSendMessage(message, attachments);
      setMessage('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/chat/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        return response.json();
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setAttachments((prev) => [...prev, ...uploadedFiles.map((f) => ({ ...f, type: 'image' }))]);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVoiceToggle = async () => {
    setIsVoiceLoading(true);
    try {
      await onVoiceToggle(!voiceSession.isVoiceMode);
    } catch (error) {
      console.error('Error toggling voice mode:', error);
    } finally {
      setIsVoiceLoading(false);
    }
  };

  const handlePTTStart = () => {
    if (voiceSession.isConnected) {
      setIsPTTActive(true);
      voiceSession.handlePTTStart();
    }
  };

  const handlePTTEnd = () => {
    if (voiceSession.isConnected && isPTTActive) {
      setIsPTTActive(false);
      voiceSession.handlePTTEnd();
    }
  };

  const handlePTTToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    if (voiceSession.isConnected) {
      voiceSession.updateTurnDetection(enabled);
    }
  };

  const isVoiceAvailable = voiceSession.isVoiceMode && voiceSession.isConnected;
  const showVoiceControls = voiceSession.isVoiceMode;

  return (
    <div className="border-t bg-white">
      {/* Voice Mode Controls Bar */}
      {showVoiceControls && (
        <div className="px-4 py-2 bg-blue-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                voiceSession.isConnected ? 'bg-green-500' : 
                voiceSession.isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <span className="text-sm font-medium">
                {voiceSession.isConnected ? 'Voice Active' : 
                 voiceSession.isConnecting ? 'Connecting...' : 'Voice Disconnected'}
              </span>
            </div>
            
            {isVoiceAvailable && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={voiceSession.isPTTActive}
                    onChange={handlePTTToggle}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm">Push to Talk</span>
                </label>
                
                {voiceSession.isPTTActive && (
                  <button
                    onMouseDown={handlePTTStart}
                    onMouseUp={handlePTTEnd}
                    onTouchStart={handlePTTStart}
                    onTouchEnd={handlePTTEnd}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      isPTTActive 
                        ? 'bg-red-500 text-white' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {isPTTActive ? 'Release to Send' : 'Hold to Talk'}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onCopyTranscript && (
              <button
                onClick={onCopyTranscript}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center gap-2"
                title="Copy Transcript"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            )}
            
            {onDownloadAudio && (
              <button
                onClick={onDownloadAudio}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center gap-2"
                title="Download Audio"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Download
              </button>
            )}
            
            <button
              onClick={() => voiceSession.mute(true)}
              className="p-1 hover:bg-blue-100 rounded text-blue-600"
              title="Mute"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Input Area */}
      <div className="p-4">
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {attachments.map((attachment, index) => (
              <div key={index} className="relative group">
                <img
                  src={attachment.url}
                  alt={attachment.filename}
                  className="w-20 h-20 object-cover rounded-lg border"
                />
                <button
                  onClick={() => removeAttachment(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Upload image"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Voice toggle button */}
          <button
            onClick={handleVoiceToggle}
            disabled={isVoiceLoading}
            className={`p-2 rounded-lg transition-colors ${
              voiceSession.isVoiceMode
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title={voiceSession.isVoiceMode ? 'Disable voice mode' : 'Enable voice mode'}
          >
            {isVoiceLoading ? (
              <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            )}
          </button>

          {/* Message input */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              showVoiceControls 
                ? "Type a message or use voice..." 
                : "Type a message..."
            }
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || (!message.trim() && attachments.length === 0)}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}