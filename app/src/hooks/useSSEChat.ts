import { useState, useCallback, useRef } from 'react';

export interface SSEProgressEvent {
  step: string;
  message: string;
  timestamp: string;
  runId?: string;
  currentStep: number;
  totalSteps: number;
}

export interface SSECompleteEvent {
  success: boolean;
  message: string;
  scenario?: any;
  operations?: any[];
  langGraphExecution?: any;
}

export interface SSEErrorEvent {
  message: string;
  details?: string;
}

export interface UseSSEChatOptions {
  onProgress?: (event: SSEProgressEvent) => void;
  onComplete?: (event: SSECompleteEvent) => void;
  onError?: (event: SSEErrorEvent) => void;
  onConnected?: () => void;
}

export const useSSEChat = (options: UseSSEChatOptions = {}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<SSEProgressEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const sendMessage = useCallback(async (message: string, scenario?: any) => {
    if (isStreaming) {
      console.warn('SSE chat is already streaming');
      return;
    }

    setIsStreaming(true);
    setCurrentProgress(null);

    try {
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Start POST request to SSE endpoint
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, scenario }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body available for streaming');
      }

      // Create a readable stream from the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const eventType = line.substring(7).trim();
              continue;
            }

            if (line.startsWith('data: ')) {
              const eventData = line.substring(6).trim();

              if (!eventData) continue;

              try {
                const parsedData = JSON.parse(eventData);

                // Handle different event types based on the previous event line
                // For simplicity, we'll parse the event type from context
                if (parsedData.step && parsedData.message) {
                  // This is a progress event
                  const progressEvent: SSEProgressEvent = parsedData;
                  setCurrentProgress(progressEvent);
                  options.onProgress?.(progressEvent);
                } else if (parsedData.success !== undefined) {
                  // This is a complete event
                  const completeEvent: SSECompleteEvent = parsedData;
                  options.onComplete?.(completeEvent);
                } else if (parsedData.message && parsedData.details) {
                  // This is an error event
                  const errorEvent: SSEErrorEvent = parsedData;
                  options.onError?.(errorEvent);
                } else if (parsedData.message === 'Stream connected') {
                  // This is a connected event
                  options.onConnected?.();
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', parseError, eventData);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('SSE Chat error:', error);
      options.onError?.({
        message: error instanceof Error ? error.message : 'Unknown SSE error',
        details: 'Failed to establish SSE connection'
      });
    } finally {
      setIsStreaming(false);
      setCurrentProgress(null);
    }
  }, [isStreaming, options]);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    setCurrentProgress(null);
  }, []);

  return {
    sendMessage,
    stopStreaming,
    isStreaming,
    currentProgress,
  };
};