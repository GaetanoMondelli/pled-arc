import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'message' | 'system' | 'thinking' | 'update';
}

export interface ScenarioContext {
  scenario: any;
  currentTime: number;
  errors: string[];
  isRunning: boolean;
}

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your AI assistant for scenario editing. I can help you understand your simulation, debug errors, and suggest improvements. What would you like to work on?',
      timestamp: new Date(),
      type: 'message'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
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
      content: 'Analyzing your scenario and thinking...',
      type: 'thinking'
    });

    try {
      const response = await fetch('http://localhost:3002/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          scenario: scenarioContext.scenario
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      // Remove thinking message and add AI response
      removeMessage(thinkingId);
      addMessage({
        role: 'assistant',
        content: data.message,
        type: 'message'
      });

    } catch (error) {
      console.error('Chat error:', error);
      
      // Remove thinking message and add error
      removeMessage(thinkingId);
      addMessage({
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
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
  }, [messages, isLoading, addMessage, removeMessage, toast]);

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
  }, []);

  const addSystemMessage = useCallback((
    content: string, 
    type: 'system' | 'thinking' | 'update' = 'system'
  ) => {
    return addMessage({
      role: 'system',
      content,
      type
    });
  }, [addMessage]);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    addSystemMessage,
    addMessage,
    removeMessage,
    updateMessage
  };
}