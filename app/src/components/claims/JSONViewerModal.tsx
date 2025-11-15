"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, X, Download } from "lucide-react";
import { Claim } from "@/core/types/claims";

interface JSONViewerModalProps {
  claim: Claim | null;
  onClose: () => void;
}

export function JSONViewerModal({ claim, onClose }: JSONViewerModalProps) {
  const [jsonContent, setJsonContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load JSON content when modal opens
  useEffect(() => {
    if (claim) {
      loadJSONContent();
    }
  }, [claim]);

  const loadJSONContent = async () => {
    if (!claim) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/claims/${claim.id}/json`);
      if (!response.ok) {
        throw new Error('Failed to fetch JSON file');
      }
      const content = await response.text();
      setJsonContent(content);
    } catch (error) {
      console.error('Error loading JSON:', error);
      setError(error instanceof Error ? error.message : 'Failed to load JSON file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonContent);
      // You could add a toast notification here
      alert('JSON copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    if (!claim || !jsonContent) return;

    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claim_${claim.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!claim) return null;

  return (
    <Dialog open={!!claim} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                JSON File: {claim.title}
              </DialogTitle>
              <div className="text-sm text-muted-foreground mt-2">
                <strong>Claim ID:</strong> {claim.id}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyToClipboard}
                disabled={isLoading || !!error}
                className="flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isLoading || !!error}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading JSON file...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <Button variant="outline" onClick={loadJSONContent}>
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-4">
                <pre className="bg-slate-900 text-slate-100 p-6 rounded-lg text-sm font-mono overflow-auto whitespace-pre-wrap break-words">
                  {jsonContent}
                </pre>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}