import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'message' | 'system' | 'thinking' | 'update' | 'state_update';
  metadata?: {
    step?: string;
    retryCount?: number;
    validationPassed?: boolean;
  };
}

export interface ScenarioContext {
  scenario: any;
  currentTime: number;
  errors: string[];
  isRunning: boolean;
}

export interface StateUpdate {
  step: string;
  message: string;
  timestamp: Date;
}

export function useAIChatEnhanced(endpoint: string = 'http://localhost:3002') {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your enhanced AI assistant with memory and reflection capabilities. I can help you build workflows, debug errors, and suggest improvements. What would you like to work on?',
      timestamp: new Date(),
      type: 'message'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [stateUpdates, setStateUpdates] = useState<StateUpdate[]>([]);
  const [isConnectedToSSE, setIsConnectedToSSE] = useState(false);
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const chatHistoryRef = useRef<Array<{ role: string; content: string }>>([]);

  // Connect to SSE for real-time updates
  useEffect(() => {
    const connectSSE = () => {
      try {
        const eventSource = new EventSource(`${endpoint}/api/stream`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnectedToSSE(true);
          console.log('📡 Connected to SSE stream');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'state_update') {
              // Add state update as a system message
              const updateMessage: ChatMessage = {
                id: `state_${Date.now()}`,
                role: 'system',
                content: `[${data.step}] ${data.message}`,
                timestamp: new Date(data.timestamp),
                type: 'state_update',
                metadata: { step: data.step }
              };

              setMessages(prev => [...prev, updateMessage]);
              setStateUpdates(prev => [...prev, data]);
            } else if (data.type === 'workflow_complete') {
              setIsLoading(false);
            } else if (data.type === 'workflow_error') {
              setIsLoading(false);
              toast({
                variant: "destructive",
                title: "Workflow Error",
                description: data.error,
              });
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          setIsConnectedToSSE(false);

          // Reconnect after 5 seconds
          setTimeout(() => {
            if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
              connectSSE();
            }
          }, 5000);
        };
      } catch (error) {
        console.error('Failed to connect SSE:', error);
        setIsConnectedToSSE(false);
      }
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsConnectedToSSE(false);
      }
    };
  }, [endpoint, toast]);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);

    // Update chat history for context
    if (message.role === 'user' || message.role === 'assistant') {
      chatHistoryRef.current = [
        ...chatHistoryRef.current.slice(-9), // Keep last 10 messages
        { role: message.role, content: message.content }
      ];
    }

    return newMessage.id;
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    scenarioContext: ScenarioContext
  ) => {
    if (!content.trim() || isLoading) return;

    // Clear previous state updates
    setStateUpdates([]);

    // Add user message
    const userMessageId = addMessage({
      role: 'user',
      content: content.trim(),
      type: 'message'
    });

    setIsLoading(true);

    // Add thinking message
    const thinkingId = addMessage({
      role: 'system',
      content: '🤔 Analyzing with enhanced reflection capabilities...',
      type: 'thinking'
    });

    try {
      const response = await fetch(`${endpoint}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          scenario: scenarioContext.scenario,
          history: chatHistoryRef.current // Send chat history for context
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      // Remove thinking message
      removeMessage(thinkingId);

      // Add AI response with metadata
      addMessage({
        role: 'assistant',
        content: data.message,
        type: 'message',
        metadata: {
          retryCount: data.debugInfo?.retryCount,
          validationPassed: data.operations?.[0]?.result?.validationPassed
        }
      });

      // If there's debug info about retries, show it
      if (data.debugInfo?.retryCount > 0) {
        addMessage({
          role: 'system',
          content: `📊 Workflow completed with ${data.debugInfo.retryCount} retry attempts. Decision: ${data.debugInfo.reflectionDecision}`,
          type: 'system'
        });
      }

      // Return the scenario if successful
      if (data.success && data.scenario) {
        return data.scenario;
      }

    } catch (error) {
      console.error('Chat error:', error);

      // Remove thinking message and add error
      removeMessage(thinkingId);
      addMessage({
        role: 'system',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
        type: 'system'
      });

      toast({
        variant: "destructive",
        title: "Chat Error",
        description: error instanceof Error ? error.message : "Failed to send message",
      });
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, isLoading, addMessage, removeMessage, toast]);

  const clearChat = useCallback(() => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Chat cleared! How can I help you with your scenario?',
        timestamp: new Date(),
        type: 'message'
      }
    ]);
    chatHistoryRef.current = [];
    setStateUpdates([]);
  }, []);

  const addSystemMessage = useCallback((
    content: string,
    type: 'system' | 'thinking' | 'update' | 'state_update' = 'system'
  ) => {
    return addMessage({
      role: 'system',
      content,
      type
    });
  }, [addMessage]);

  // Get filtered messages (optionally hide state updates)
  const getFilteredMessages = useCallback((includeStateUpdates: boolean = true) => {
    if (includeStateUpdates) return messages;
    return messages.filter(msg => msg.type !== 'state_update');
  }, [messages]);

  return {
    messages,
    isLoading,
    isConnectedToSSE,
    stateUpdates,
    sendMessage,
    clearChat,
    addSystemMessage,
    addMessage,
    removeMessage,
    updateMessage,
    getFilteredMessages,
    chatHistory: chatHistoryRef.current
  };
}