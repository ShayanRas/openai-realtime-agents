import { useEffect, useRef } from 'react';
import { useTranscript } from '@/app/contexts/TranscriptContext';

interface VoiceToChatOptions {
  isVoiceMode: boolean;
  currentThreadId: string | null;
  onVoiceMessage: (content: string, role: 'USER' | 'ASSISTANT') => void;
}

export function useVoiceToChat({ isVoiceMode, currentThreadId, onVoiceMessage }: VoiceToChatOptions) {
  const { transcriptItems } = useTranscript();
  const processedItemsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!isVoiceMode || !currentThreadId) return;

    // Process new transcript items
    transcriptItems.forEach((item) => {
      // Skip if already processed
      if (processedItemsRef.current.has(item.itemId)) return;

      // Only process message items
      if (item.type === 'MESSAGE' && item.role && item.text) {
        // Mark as processed immediately to avoid duplicates
        processedItemsRef.current.add(item.itemId);

        // Convert role to our database format
        const role = item.role === 'user' ? 'USER' : 'ASSISTANT';
        
        // Send to database
        onVoiceMessage(item.text, role);
      }
    });
  }, [transcriptItems, isVoiceMode, currentThreadId, onVoiceMessage]);

  // Clear processed items when voice mode is disabled or thread changes
  useEffect(() => {
    if (!isVoiceMode) {
      processedItemsRef.current.clear();
    }
  }, [isVoiceMode, currentThreadId]);

  return {
    processedItemsCount: processedItemsRef.current.size
  };
}