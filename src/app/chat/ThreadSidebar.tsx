import React from 'react';
import type { ThreadSidebarProps } from '@/app/lib/types';

export default function ThreadSidebar({
  threads,
  currentThreadId,
  onThreadSelect,
  onNewThread,
  isOpen,
  onToggle,
}: ThreadSidebarProps) {
  return (
    <div
      className={`${
        isOpen ? 'w-64' : 'w-0'
      } transition-all duration-300 bg-gray-900 text-white flex flex-col overflow-hidden`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <button
          onClick={onNewThread}
          className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto p-2">
        {threads.length === 0 ? (
          <p className="text-gray-500 text-sm text-center mt-4">No conversations yet</p>
        ) : (
          <div className="space-y-1">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => onThreadSelect(thread.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors ${
                  currentThreadId === thread.id ? 'bg-gray-800' : ''
                }`}
              >
                <p className="font-medium truncate flex items-center gap-1">
                  {thread.title.includes('🎙️') && (
                    <span className="text-blue-400" title="Voice Session">🎙️</span>
                  )}
                  <span className={thread.title.includes('🎙️') ? 'ml-1' : ''}>
                    {thread.title.replace('🎙️ ', '')}
                  </span>
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(thread.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}