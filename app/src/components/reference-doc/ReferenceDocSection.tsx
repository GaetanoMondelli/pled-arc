import React, { useState, useCallback, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Edit3, Eye, Sparkles, RefreshCw, Save, Check, FolderOpen, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useSimulationStore } from '@/stores/simulationStore';

// Lazy load ResourcesManager to avoid blocking the main app
const ResourcesManager = lazy(() => import('@/components/ResourcesManager'));

interface ReferenceDocSectionProps {
  className?: string;
  referenceDoc?: string;
  isEditMode?: boolean;
  scenarioContent?: string;
  onReferenceDocUpdate?: (newDoc: string) => void;
  onGenerateDoc?: () => Promise<string>;
  onUpdateDoc?: () => Promise<string>;
  onNavigateToNode?: (nodeId: string) => void;
  onSwitchToAIChat?: (documentContext: any) => void;
}

export function ReferenceDocSection({
  className,
  referenceDoc = '',
  isEditMode = false,
  scenarioContent = '',
  onReferenceDocUpdate,
  onGenerateDoc,
  onUpdateDoc,
  onNavigateToNode,
  onSwitchToAIChat,
}: ReferenceDocSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(referenceDoc);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'doc' | 'resources'>('doc');
  const { toast } = useToast();

  // Sync editContent with referenceDoc prop changes
  React.useEffect(() => {
    console.log('📄 ReferenceDocSection: referenceDoc prop changed to:', referenceDoc ? `${referenceDoc.length} characters` : 'EMPTY/UNDEFINED');
    setEditContent(referenceDoc || '');
  }, [referenceDoc]);

  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      setEditContent(referenceDoc);
    }
    setIsEditing(!isEditing);
  }, [isEditing, referenceDoc]);

  const handleSave = useCallback(async () => {
    if (onReferenceDocUpdate && editContent !== referenceDoc) {
      await onReferenceDocUpdate(editContent);
      toast({
        title: "Reference Doc Updated",
        description: "Documentation has been saved successfully.",
      });
    }
    setIsEditing(false);
  }, [editContent, referenceDoc, onReferenceDocUpdate, toast]);

  const handleGenerate = useCallback(async () => {
    if (!onGenerateDoc) return;

    setIsGenerating(true);
    try {
      console.log('🤖 Starting AI documentation generation...');
      const generatedDoc = await onGenerateDoc();
      console.log('🤖 Generated doc length:', generatedDoc.length, 'characters');
      console.log('🤖 Generated doc preview:', generatedDoc.substring(0, 200) + '...');

      setEditContent(generatedDoc);

      if (onReferenceDocUpdate) {
        console.log('💾 Saving generated documentation to template...');
        await onReferenceDocUpdate(generatedDoc);
        console.log('💾 Documentation saved successfully');
      }

      toast({
        title: "Documentation Generated",
        description: "AI has generated reference documentation based on your current architecture.",
      });
    } catch (error) {
      console.error('❌ Generation failed:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate documentation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerateDoc, onReferenceDocUpdate, toast]);

  const handleUpdate = useCallback(async () => {
    if (!onUpdateDoc) return;

    setIsUpdating(true);
    try {
      const updatedDoc = await onUpdateDoc();
      setEditContent(updatedDoc);
      if (onReferenceDocUpdate) {
        await onReferenceDocUpdate(updatedDoc);
      }
      toast({
        title: "Documentation Updated",
        description: "Reference documentation has been updated with current configuration.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update documentation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }, [onUpdateDoc, onReferenceDocUpdate, toast]);

  const handleNodeLinkClick = useCallback((nodeId: string) => {
    if (onNavigateToNode) {
      onNavigateToNode(nodeId);
    }
  }, [onNavigateToNode]);

  const renderMarkdown = useCallback((content: string) => {
    // Convert markdown to JSX elements with improved formatting
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];
    let codeBlockLanguage = '';

    const finishParagraph = () => {
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ');
        if (paragraphText.trim()) {
          elements.push(
            <p key={elements.length} className="mb-3 text-slate-700 leading-relaxed">
              {parseInlineContent(paragraphText)}
            </p>
          );
        }
        currentParagraph = [];
      }
    };

    const finishCodeBlock = () => {
      if (codeBlockLines.length > 0) {
        elements.push(
          <div key={elements.length} className="mb-3">
            <pre className="bg-slate-50 text-slate-700 px-3 py-2 rounded-md overflow-x-auto text-xs font-mono leading-tight">
              <code className={`language-${codeBlockLanguage}`}>
                {codeBlockLines.join('\n')}
              </code>
            </pre>
          </div>
        );
        codeBlockLines = [];
        codeBlockLanguage = '';
      }
    };

    const parseInlineContent = (text: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let key = 0;

      while (remaining) {
        // Check for node links: [NodeName](node:nodeId) or [NodeName](node://nodeId)
        const nodeLinkMatch = remaining.match(/\[([^\]]+)\]\(node:\/?\/?([^)]+)\)/);
        if (nodeLinkMatch) {
          const beforeLink = remaining.substring(0, nodeLinkMatch.index);
          if (beforeLink) {
            parts.push(processTextFormatting(beforeLink, key++));
          }

          parts.push(
            <button
              key={key++}
              onClick={() => handleNodeLinkClick(nodeLinkMatch[2])}
              className="text-blue-600 hover:text-blue-800 underline cursor-pointer font-medium"
            >
              {nodeLinkMatch[1]}
            </button>
          );

          remaining = remaining.substring(nodeLinkMatch.index! + nodeLinkMatch[0].length);
        } else {
          // No more node links, process remaining text
          parts.push(processTextFormatting(remaining, key++));
          break;
        }
      }

      return parts;
    };

    const processTextFormatting = (text: string, key: number): React.ReactNode => {
      // Create React elements to handle formatting properly
      const formatText = (input: string): React.ReactNode[] => {
        const parts: React.ReactNode[] = [];
        let remaining = input;
        let partKey = 0;

        while (remaining) {
          // Check for inline code first (backticks)
          const codeMatch = remaining.match(/`([^`]+)`/);
          if (codeMatch) {
            const beforeCode = remaining.substring(0, codeMatch.index);
            if (beforeCode) {
              parts.push(formatBasicText(beforeCode, partKey++));
            }

            parts.push(
              <code key={partKey++} className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-xs font-mono italic">
                {codeMatch[1]}
              </code>
            );

            remaining = remaining.substring(codeMatch.index! + codeMatch[0].length);
          } else {
            // No more inline code, process remaining text
            parts.push(formatBasicText(remaining, partKey++));
            break;
          }
        }

        return parts;
      };

      const formatBasicText = (input: string, partKey: number): React.ReactNode => {
        // Process bold and italic with proper React elements
        const boldMatch = input.match(/\*\*(.*?)\*\*/);
        if (boldMatch) {
          const beforeBold = input.substring(0, boldMatch.index);
          const afterBold = input.substring(boldMatch.index! + boldMatch[0].length);

          return (
            <span key={partKey}>
              {beforeBold}
              <strong className="font-semibold text-slate-800">{boldMatch[1]}</strong>
              {formatBasicText(afterBold, partKey + 1000)}
            </span>
          );
        }

        const italicMatch = input.match(/\*(.*?)\*/);
        if (italicMatch) {
          const beforeItalic = input.substring(0, italicMatch.index);
          const afterItalic = input.substring(italicMatch.index! + italicMatch[0].length);

          return (
            <span key={partKey}>
              {beforeItalic}
              <em className="italic">{italicMatch[1]}</em>
              {formatBasicText(afterItalic, partKey + 1000)}
            </span>
          );
        }

        return input;
      };

      return <span key={key}>{formatText(text)}</span>;
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Code blocks
      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          finishCodeBlock();
          inCodeBlock = false;
        } else {
          // Start of code block
          finishParagraph();
          inCodeBlock = true;
          codeBlockLanguage = trimmedLine.substring(3) || 'text';
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line); // Preserve original indentation
        return;
      }

      // Headers
      if (trimmedLine.startsWith('### ')) {
        finishParagraph();
        elements.push(
          <h3 key={elements.length} className="text-lg font-semibold mt-6 mb-3 text-slate-800">
            {parseInlineContent(trimmedLine.substring(4))}
          </h3>
        );
      } else if (trimmedLine.startsWith('## ')) {
        finishParagraph();
        elements.push(
          <h2 key={elements.length} className="text-xl font-semibold mt-8 mb-4 text-slate-800 border-b border-slate-200 pb-2">
            {parseInlineContent(trimmedLine.substring(3))}
          </h2>
        );
      } else if (trimmedLine.startsWith('# ')) {
        finishParagraph();
        elements.push(
          <h1 key={elements.length} className="text-2xl font-bold mt-8 mb-6 text-slate-900 border-b-2 border-slate-300 pb-3">
            {parseInlineContent(trimmedLine.substring(2))}
          </h1>
        );
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        finishParagraph();
        const listContent = trimmedLine.substring(2);

        elements.push(
          <div key={elements.length} className="mb-2 flex items-start">
            <span className="text-slate-600 mr-3 mt-1 text-sm">•</span>
            <div className="flex-1">
              {parseInlineContent(listContent)}
            </div>
          </div>
        );
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        // Handle numbered lists (1. 2. 3. etc.)
        finishParagraph();
        const numberMatch = trimmedLine.match(/^(\d+)\.\s(.*)$/);
        if (numberMatch) {
          const number = numberMatch[1];
          const listContent = numberMatch[2];

          elements.push(
            <div key={elements.length} className="mb-2 flex items-start">
              <span className="text-slate-600 mr-3 mt-1 text-sm font-medium min-w-[1.5rem]">{number}.</span>
              <div className="flex-1">
                {parseInlineContent(listContent)}
              </div>
            </div>
          );
        }
      } else if (trimmedLine === '') {
        finishParagraph();
      } else {
        currentParagraph.push(trimmedLine);
      }
    });

    // Finish any remaining content
    finishParagraph();
    finishCodeBlock();

    return <div className="prose prose-sm max-w-none space-y-1">{elements}</div>;
  }, [handleNodeLinkClick]);

  const isEmpty = !referenceDoc?.trim();

  const handleSwitchToAIChat = useCallback((resourceId: string, documentContext: any) => {
    console.log('🤖 Switching to AI Chat for resource:', resourceId);
    if (onSwitchToAIChat) {
      onSwitchToAIChat(documentContext);
    }
  }, [onSwitchToAIChat]);

  const handleImprovementGenerated = useCallback((suggestions: any) => {
    if (onReferenceDocUpdate) {
      // Append AI suggestions to current reference doc
      const currentDoc = referenceDoc || '';
      const newSection = `\n\n## AI Improvement Suggestions\n\n${suggestions.summary}\n\n### Key Improvements\n${suggestions.improvements?.map((imp: string) => `- ${imp}`).join('\n') || ''}\n\n### New Concepts\n${suggestions.newConcepts?.map((concept: string) => `- ${concept}`).join('\n') || ''}\n`;

      const updatedDoc = currentDoc + newSection;
      onReferenceDocUpdate(updatedDoc);

      toast({
        title: "Architecture Improved",
        description: "AI suggestions have been added to your reference documentation.",
      });
    }
  }, [referenceDoc, onReferenceDocUpdate, toast]);

  // Debug logging for render state
  console.log('📄 ReferenceDocSection RENDER:');
  console.log('📄 - referenceDoc prop:', referenceDoc ? `"${referenceDoc.substring(0, 100)}..."` : 'NULL/UNDEFINED');
  console.log('📄 - editContent state:', editContent ? `"${editContent.substring(0, 100)}..."` : 'NULL/UNDEFINED');
  console.log('📄 - isEmpty:', isEmpty);
  console.log('📄 - isEditing:', isEditing);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with Tabs */}
      <div className="px-3 py-2 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-800 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reference & Resources
            {referenceDoc && <span className="text-xs text-green-600">({referenceDoc.length})</span>}
          </h3>
          {activeTab === 'doc' && (
            <div className="flex items-center gap-1">
              {!isEmpty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleEdit}
                  className="h-6 px-2"
                >
                  {isEditing ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <Edit3 className="h-3 w-3" />
                  )}
                </Button>
              )}
              {isEmpty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="h-6 px-2"
                >
                  {isGenerating ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                </Button>
              )}
              {!isEmpty && !isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="h-6 px-2"
                >
                  {isUpdating ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              )}
              {isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  className="h-6 px-2"
                  title="Confirm changes locally"
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-100 rounded-md p-0.5">
          <button
            onClick={() => setActiveTab('doc')}
            className={cn(
              "flex-1 px-2 py-1 text-xs font-medium rounded transition-all flex items-center justify-center gap-1",
              activeTab === 'doc'
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <FileText className="h-3 w-3" />
            Documentation
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={cn(
              "flex-1 px-2 py-1 text-xs font-medium rounded transition-all flex items-center justify-center gap-1",
              activeTab === 'resources'
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <FolderOpen className="h-3 w-3" />
            Resources
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'doc' ? (
          // Documentation Tab Content
          isEmpty ? (
            <Card className="m-3 p-4 border-dashed border-slate-300">
              <div className="text-center">
                <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 mb-3">
                  No reference documentation available
                </p>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  size="sm"
                  className="gap-2"
                >
                  {isGenerating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generate with AI
                </Button>
              </div>
            </Card>
          ) : isEditing ? (
            <div className="p-3 h-full flex flex-col gap-2">
              <Textarea
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value);
                  // Mark as unsaved when user types
                  if (e.target.value !== referenceDoc) {
                    useSimulationStore.getState().markAsUnsavedChanges();
                  }
                }}
                placeholder="Write your reference documentation in markdown..."
                className="flex-1 min-h-0 resize-none text-sm font-mono"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleEdit}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={editContent === referenceDoc}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3 h-full overflow-y-auto">
              <div className="text-sm text-slate-700 leading-relaxed">
                {renderMarkdown(referenceDoc)}
              </div>
            </div>
          )
        ) : (
          // Resources Tab Content
          <div className="h-full overflow-hidden">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-sm text-slate-500">Loading resources...</div>
              </div>
            }>
              <ResourcesManager
                onImprovementGenerated={handleImprovementGenerated}
                currentArchitecture={referenceDoc || scenarioContent || ''}
                onSwitchToAIChat={handleSwitchToAIChat}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}