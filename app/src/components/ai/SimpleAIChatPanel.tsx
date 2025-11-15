"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSimulationStore } from "@/stores/simulationStore";
import { nodeNavigationService } from "@/lib/services/claims/nodeNavigationService";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  Send,
  User,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface SimpleAIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn(
      "flex gap-3 max-w-full",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isUser ? "bg-blue-500" : "bg-green-500"
      )}>
        {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
      </div>
      
      <div className={cn(
        "flex flex-col gap-1 max-w-[80%]",
        isUser ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "px-4 py-2 rounded-2xl text-sm",
          isUser 
            ? "bg-blue-500 text-white" 
            : "bg-gray-100 text-gray-800"
        )}>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                // Handle clickable node links
                a: ({ href, children, ...props }) => {
                  if (href?.startsWith('#node-')) {
                    const nodeId = href.replace('#node-', '');
                    return (
                      <button
                        className="text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer inline"
                        onClick={(e) => {
                          e.preventDefault();
                          nodeNavigationService.navigateToNode({
                            nodeId,
                            highlight: true,
                            zoom: 1.5
                          });
                        }}
                        {...props}
                      >
                        {children}
                      </button>
                    );
                  }
                  return <a href={href} {...props}>{children}</a>;
                },
                // Customize other markdown elements
                h1: ({ children, ...props }) => (
                  <h1 className="text-lg font-bold mb-2" {...props}>{children}</h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="text-base font-semibold mb-2" {...props}>{children}</h2>
                ),
                p: ({ children, ...props }) => (
                  <p className="mb-2 last:mb-0" {...props}>{children}</p>
                ),
                ul: ({ children, ...props }) => (
                  <ul className="list-disc list-outside ml-4 mb-2" {...props}>{children}</ul>
                ),
                li: ({ children, ...props }) => (
                  <li className="mb-1" {...props}>{children}</li>
                ),
                strong: ({ children, ...props }) => (
                  <strong className="font-semibold" {...props}>{children}</strong>
                ),
                code: ({ children, ...props }) => (
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
        <span className="text-xs text-muted-foreground px-2">
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
    </div>
  );
};

export default function SimpleAIChatPanel({ isOpen, onClose }: SimpleAIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your AI assistant for scenario editing. How can I help you?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get scenario context from simulation store
  const scenario = useSimulationStore(state => state.scenario);
  const currentTime = useSimulationStore(state => state.currentTime);
  const errorMessages = useSimulationStore(state => state.errorMessages);
  const isRunning = useSimulationStore(state => state.isRunning);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Simple mock response for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I received your message: "${userMessage.content}". This is a test response. Current simulation time is ${currentTime}s.`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Chat cleared! How can I help you with your scenario?',
        timestamp: new Date()
      }
    ]);
  };

  console.log('SimpleAIChatPanel rendering, isOpen:', isOpen);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-green-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-lg font-semibold">AI Assistant</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Simple test version
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={clearChat}>
              Clear
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-4">
            <div className="space-y-6">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  placeholder="Type your message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[60px] max-h-[120px] resize-none"
                  disabled={isLoading}
                />
              </div>
              <Button 
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="self-end"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}