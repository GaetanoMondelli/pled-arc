import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ErrorDisplayProps {
  errorMessages: string[];
  onClearErrors: () => void;
}

/**
 * Error display overlay for simulation errors
 */
export function ErrorDisplay({ errorMessages, onClearErrors }: ErrorDisplayProps) {
  if (errorMessages.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 z-10 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg shadow-lg max-w-md">
      <div className="flex items-center mb-2">
        <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
        <span className="font-semibold">Simulation Errors ({errorMessages.length})</span>
      </div>
      <ScrollArea className="max-h-32">
        <ul className="text-sm space-y-1">
          {errorMessages.map((msg, index) => (
            <li key={index} className="flex items-start">
              <span className="text-red-500 mr-1">•</span> 
              <span>{msg}</span>
            </li>
          ))}
        </ul>
      </ScrollArea>
      <Button 
        variant="outline" 
        size="sm" 
        className="mt-3 border-red-300 text-red-700 hover:bg-red-50" 
        onClick={onClearErrors}
      >
        Clear Errors
      </Button>
    </div>
  );
}
