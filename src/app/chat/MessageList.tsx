import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { MessageListProps } from '@/app/lib/types';

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="px-4 py-6 space-y-6">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'USER' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-3xl px-4 py-3 rounded-lg ${
              message.role === 'USER'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-2 space-y-2">
                {message.attachments.map((attachment, idx) => (
                  <div key={idx}>
                    {attachment.type === 'image' && (
                      <img
                        src={attachment.url}
                        alt={attachment.filename || 'Uploaded image'}
                        className="max-w-sm rounded-lg"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Message content */}
            {message.role === 'USER' ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert">
                {message.content}
              </ReactMarkdown>
            )}

            {/* Timestamp */}
            <p
              className={`text-xs mt-2 ${
                message.role === 'USER' ? 'text-blue-200' : 'text-gray-500'
              }`}
            >
              {new Date(message.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}