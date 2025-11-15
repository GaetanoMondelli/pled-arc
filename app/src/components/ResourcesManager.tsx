'use client';

import React, { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, Lightbulb, AlertCircle, Loader2, Eye, Zap, Clock, Type, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Resource {
  id: string;
  name: string;
  uploadedAt: string;
  type: string;
  content: string;
  tags: string[];
  contributedChanges: any[];
}

interface ResourcesManagerProps {
  onImprovementGenerated?: (suggestions: any) => void;
  currentArchitecture?: string;
  onSwitchToAIChat?: (resourceId: string, documentContext: any) => void;
}

export default function ResourcesManager({
  onImprovementGenerated,
  currentArchitecture = "",
  onSwitchToAIChat
}: ResourcesManagerProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingResource, setDeletingResource] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [extractingResources, setExtractingResources] = useState<Set<string>>(new Set());
  const [viewingResource, setViewingResource] = useState<Resource | null>(null);
  const [useAsyncUpload, setUseAsyncUpload] = useState(true); // Toggle for new async workflow
  const [markdownView, setMarkdownView] = useState(true); // Toggle for markdown vs raw text view

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      const response = await fetch('/api/resources/list');
      const data = await response.json();
      if (data.resources) {
        setResources(data.resources);
      }
    } catch (err) {
      setError('Failed to load resources');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (useAsyncUpload) {
      await handleAsyncFileUpload(file, event);
    } else {
      await handleSyncFileUpload(file, event);
    }
  };

  // New async upload function (non-blocking)
  const handleAsyncFileUpload = async (file: File, event: React.ChangeEvent<HTMLInputElement>) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('🚀 Using async upload workflow...');
      const response = await fetch('/api/resources/upload-async', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ Fast upload completed for resource: ${data.resourceId}`);

        // Add to extracting resources set immediately
        setExtractingResources(prev => new Set(prev).add(data.resourceId));

        // Refresh resources list to show the uploaded document
        await loadResources();

        // Reset file input
        event.target.value = '';

        // Start polling for background processing completion
        pollForAsyncProcessing(data.resourceId);
      } else {
        setError(data.error || 'Async upload failed');
      }
    } catch (err) {
      console.error('❌ Async upload error:', err);
      setError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  // Original sync upload function (blocking)
  const handleSyncFileUpload = async (file: File, event: React.ChangeEvent<HTMLInputElement>) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('⏳ Using sync upload workflow (blocking)...');
      const response = await fetch('/api/resources/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Add to extracting resources set
        setExtractingResources(prev => new Set(prev).add(data.resourceId));

        await loadResources();
        // Reset file input
        event.target.value = '';

        // Set up polling to check for text extraction completion
        pollForTextExtraction(data.resourceId);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const pollForTextExtraction = (resourceId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/resources/list');
        const data = await response.json();
        if (data.resources) {
          const resource = data.resources.find((r: Resource) => r.id === resourceId);
          if (resource && !resource.content.includes('🔄 Extracting text content...')) {
            // Text extraction completed
            setExtractingResources(prev => {
              const newSet = new Set(prev);
              newSet.delete(resourceId);
              return newSet;
            });
            setResources(data.resources);
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error('Failed to poll for text extraction:', err);
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setExtractingResources(prev => {
        const newSet = new Set(prev);
        newSet.delete(resourceId);
        return newSet;
      });
    }, 120000);
  };

  // New polling function for async processing using status endpoint
  const pollForAsyncProcessing = (resourceId: string) => {
    console.log(`🔄 Starting async processing polling for resource: ${resourceId}`);

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/resources/status/${resourceId}`);
        const data = await response.json();

        if (data.success && data.resource) {
          const { status, content } = data.resource;
          console.log(`📊 Resource ${resourceId} status: ${status}`);

          if (status === 'completed' || status === 'failed') {
            // Processing completed
            setExtractingResources(prev => {
              const newSet = new Set(prev);
              newSet.delete(resourceId);
              return newSet;
            });

            // Refresh resources list to show updated content
            await loadResources();
            clearInterval(pollInterval);

            if (status === 'completed') {
              console.log(`✅ Async processing completed for resource: ${resourceId}`);
            } else {
              console.log(`❌ Async processing failed for resource: ${resourceId}`);
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll async processing status:', err);
      }
    }, 3000); // Poll every 3 seconds for async processing

    // Stop polling after 10 minutes (longer timeout for async processing)
    setTimeout(() => {
      clearInterval(pollInterval);
      setExtractingResources(prev => {
        const newSet = new Set(prev);
        newSet.delete(resourceId);
        return newSet;
      });
      console.log(`⏱️ Async processing polling timeout for resource: ${resourceId}`);
    }, 600000);
  };

  const handleDeleteResource = async (resourceId: string, resourceName: string) => {
    setDeletingResource({ id: resourceId, name: resourceName });
  };

  const confirmDeleteResource = async () => {
    if (!deletingResource) return;

    setIsDeleting(true);
    try {
      // Check if this is an architecture document and route to correct endpoint
      const isArchitectureDoc = deletingResource.id.startsWith('architecture_doc_') ||
                               deletingResource.name.toLowerCase().includes('architecture');

      const response = isArchitectureDoc
        ? await fetch(`/api/architecture/delete?id=${deletingResource.id}`, {
            method: 'DELETE',
          })
        : await fetch(`/api/resources/${deletingResource.id}`, {
            method: 'DELETE',
          });

      const data = await response.json();

      if (data.success) {
        await loadResources();
        setDeletingResource(null);
        // TODO: Handle cleanup of contributed changes if needed
      } else {
        setError(data.error || 'Delete failed');
      }
    } catch (err) {
      setError('Failed to delete resource');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateImprovements = async (resourceId: string) => {
    setGenerating(resourceId);
    setError(null);

    try {
      // Get the resource details for document context
      const resource = resources.find(r => r.id === resourceId);
      if (!resource) {
        setError('Resource not found');
        return;
      }

      const documentContext = {
        id: resourceId,
        name: resource.name,
        content: resource.content,
        uploadedAt: resource.uploadedAt,
        type: resource.type,
        extractionMethod: 'docling'
      };

      // Switch to AI Chat with document context
      console.log('🔍 onSwitchToAIChat callback:', !!onSwitchToAIChat);
      if (onSwitchToAIChat) {
        console.log('✅ Using new AI Chat workflow');
        onSwitchToAIChat(resourceId, documentContext);
        return; // Exit early to prevent fallback execution
      } else {
        console.log('⚠️ Falling back to old improve API');
        // Fallback: generate improvements the old way if AI Chat callback not provided
        const response = await fetch('/api/resources/improve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resourceId,
            currentArchitecture,
          }),
        });

        const data = await response.json();

        if (data.success) {
          await loadResources();
          if (onImprovementGenerated) {
            onImprovementGenerated(data.suggestions);
          }
        } else {
          setError(data.error || 'Failed to generate improvements');
        }
      }
    } catch (err) {
      setError('Failed to generate improvements');
    } finally {
      setGenerating(null);
    }
  };

  const handleImproveWithAgent = async (resourceId: string) => {
    setGenerating(resourceId);
    setError(null);

    try {
      // Get the resource details for document context
      const resource = resources.find(r => r.id === resourceId);
      if (!resource) {
        setError('Resource not found');
        return;
      }

      const documentContext = {
        id: resourceId,
        name: resource.name,
        content: resource.content,
        uploadedAt: resource.uploadedAt,
        type: resource.type,
        extractionMethod: 'docling',
        useImproveAgent: true // Flag to indicate this should use the LangGraph agent
      };

      // Switch to AI Chat with document context for real-time feedback
      console.log('🤖 Using LangGraph Improve Agent with chat interface...');
      if (onSwitchToAIChat) {
        console.log('✅ Switching to AI Chat for LangGraph workflow with real-time updates');
        onSwitchToAIChat(resourceId, documentContext);
        setGenerating(null); // Clear generating state as chat takes over
        return;
      } else {
        console.log('⚠️ Falling back to direct API call (no chat interface available)');
        // Fallback: call API directly if no chat callback available
        const response = await fetch('https://workflow-agent-319413928411.us-central1.run.app/improve-documents-v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resourceId,
            documentContent: resource.content,
            currentArchitecture,
          }),
        });

        const data = await response.json();

        if (data.success) {
          await loadResources();
          if (onImprovementGenerated) {
            onImprovementGenerated(data.suggestions);
          }
          console.log(`✅ LangGraph Agent completed: ${data.metadata?.chunksProcessed} chunks processed`);
        } else {
          setError(data.error || 'Failed to generate improvements with agent');
        }
      }

    } catch (err) {
      console.error('❌ LangGraph Agent failed:', err);
      setError('Failed to generate improvements with agent');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Compact Upload Section */}
      <div className="p-3 border-b border-slate-200 flex-shrink-0">
        {/* Upload Mode Toggle */}
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="text-slate-600">Upload Mode:</span>
          <button
            onClick={() => setUseAsyncUpload(!useAsyncUpload)}
            className={`flex items-center space-x-1 px-2 py-1 rounded-full transition-colors ${
              useAsyncUpload
                ? 'bg-green-100 text-green-700'
                : 'bg-orange-100 text-orange-700'
            }`}
            title={useAsyncUpload ? 'Fast async processing (recommended)' : 'Blocking sync processing (legacy)'}
          >
            {useAsyncUpload ? (
              <>
                <Zap className="h-3 w-3" />
                <span>Async</span>
              </>
            ) : (
              <>
                <Clock className="h-3 w-3" />
                <span>Sync</span>
              </>
            )}
          </button>
        </div>

        <div className="border border-dashed border-slate-300 rounded-md p-3">
          <div className="text-center">
            <label className="cursor-pointer block">
              <Upload className="mx-auto h-6 w-6 text-slate-400 mb-2" />
              <span className="text-xs font-medium text-blue-600 hover:text-blue-500 block">
                Upload PDF Document
              </span>
              <span className="text-xs text-slate-500 block mt-1">
                {useAsyncUpload ? 'Fast upload + background processing' : 'Full processing (slower)'}
              </span>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {uploading && (
              <p className="text-xs text-blue-600 mt-1">
                {useAsyncUpload ? 'Uploading...' : 'Processing...'}
              </p>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-2 mt-2">
            <div className="flex items-start">
              <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-800 ml-2">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Resources List */}
      <div className="flex-1 overflow-y-auto">
        {resources.length === 0 ? (
          <div className="text-center py-8 px-3">
            <FileText className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">No resources uploaded yet</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {resources.map((resource) => (
              <div key={resource.id} className="bg-slate-50 border border-slate-200 rounded-md p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-medium text-slate-900 truncate">{resource.name}</h4>
                        <p className="text-xs text-slate-500">
                          {new Date(resource.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="text-xs text-slate-600 mb-2">
                  {resource.content.includes('🔄 Extracting text content...') || extractingResources.has(resource.id) ? (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="italic">Processing document (usually takes 15-30 seconds)...</span>
                    </div>
                  ) : (
                    <div
                      className="line-clamp-2 cursor-pointer hover:bg-slate-100 p-1 rounded"
                      onClick={() => setViewingResource(resource)}
                      title="Click to view full content"
                    >
                      {resource.content.substring(0, 120)}...
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    {!resource.content.includes('🔄 Extracting text content...') && !extractingResources.has(resource.id) && (
                      <button
                        onClick={() => setViewingResource(resource)}
                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-slate-700 bg-slate-100 hover:bg-slate-200"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </button>
                    )}

                    <button
                      onClick={() => handleGenerateImprovements(resource.id)}
                      disabled={generating === resource.id}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:opacity-50"
                    >
                      <Lightbulb className="h-3 w-3 mr-1" />
                      {generating === resource.id ? 'Gen...' : 'Improve'}
                    </button>

                    <button
                      onClick={() => handleImproveWithAgent(resource.id)}
                      disabled={generating === resource.id}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-purple-700 bg-purple-100 hover:bg-purple-200 disabled:opacity-50"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      {generating === resource.id ? 'Agent...' : 'Improve Agent'}
                    </button>

                    <button
                      onClick={() => handleDeleteResource(resource.id, resource.name)}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Contribution indicator */}
                  {resource.contributedChanges.length > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {resource.contributedChanges.length} contrib.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingResource && (
        <Dialog open={!!deletingResource} onOpenChange={() => setDeletingResource(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center text-red-600">
                <AlertCircle className="h-5 w-5 mr-2" />
                Delete Resource
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the resource and all its associated data.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-red-800">Resource to be deleted:</span>
                </div>
                <div className="text-sm text-red-700">
                  <strong>{deletingResource.name}</strong>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDeletingResource(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteResource}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Resource
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* View Content Modal */}
      {viewingResource && (
        <Dialog open={!!viewingResource} onOpenChange={() => setViewingResource(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-slate-800">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Extracted Content
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setMarkdownView(!markdownView)}
                    className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      markdownView
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {markdownView ? (
                      <>
                        <Type className="h-3 w-3 mr-1" />
                        Formatted
                      </>
                    ) : (
                      <>
                        <Code className="h-3 w-3 mr-1" />
                        Raw Text
                      </>
                    )}
                  </button>
                </div>
              </DialogTitle>
              <DialogDescription>
                Full text content extracted from: <strong>{viewingResource.name}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 min-h-[200px]">
                {markdownView ? (
                  <div className="prose prose-sm max-w-none prose-slate">
                    <ReactMarkdown
                      components={{
                        table: ({ children }) => (
                          <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse border border-gray-300">
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left font-medium">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="border border-gray-300 px-3 py-2">
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {viewingResource.content || 'No content available'}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-mono">
                    {viewingResource.content || 'No content available'}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex-shrink-0">
              <div className="flex items-center justify-between w-full">
                <div className="text-xs text-slate-500">
                  {viewingResource.content.length} characters • Uploaded {new Date(viewingResource.uploadedAt).toLocaleDateString()}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setViewingResource(null)}
                >
                  Close
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}