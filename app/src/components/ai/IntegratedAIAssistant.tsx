"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSimulationStore } from "@/stores/simulationStore";
import { nodeNavigationService } from "@/lib/services/claims/nodeNavigationService";
import ReactMarkdown from "react-markdown";
import { useSSEChat } from "@/hooks/useSSEChat";
import GitDiff from "@/components/ui/GitDiff";
import { 
  Send, 
  Loader2, 
  Settings,
  Hash,
  AtSign,
  Slash,
  Zap,
  Code2,
  Brain,
  Eye,
  GitBranch,
  Terminal,
  FileText,
  Cpu,
  ChevronDown,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

// Import shared semantic positioning library
import { getBestPositionForNewNode, fixCollisionsInPlace } from '@/lib/positioning/semantic-positioning';

// Legacy constants for backward compatibility
const NODE_WIDTH = 200;
const NODE_HEIGHT = 150;
const MARGIN = 50;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

type ScenarioNode = {
  nodeId: string;
  displayName?: string;
  type?: string;
  position?: { x: number; y: number };
};

// Removed legacy positioning helper functions - now using shared semantic positioning library

// Legacy positioning functions removed - using semantic positioning library

// fixCollisionsInPlace function removed - using shared semantic positioning library

interface ActionButton {
  text: string;
  action: string;
  variant: 'primary' | 'secondary';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'command' | 'context' | 'analysis' | 'suggestion' | 'system' | 'error' | 'message' | 'thinking' | 'update' | 'scenario_update' | 'validation';
  actionButtons?: ActionButton[];
  metadata?: {
    command?: string;
    context?: string[];
    nodes?: string[];
    patches?: any[];
    validationItems?: string[];
  };
}

interface Command {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'action' | 'context' | 'analysis';
}

interface DocumentContext {
  id: string;
  name: string;
  content: string;
  uploadedAt: string;
  type: string;
  extractionMethod: string;
}

interface IntegratedAIAssistantProps {
  className?: string;
  isEditMode?: boolean;
  scenarioContent?: string;
  onScenarioUpdate?: (newScenario: string) => void;
  loadScenario?: (scenario: any) => Promise<void>;
  documentContext?: DocumentContext;
  referenceDoc?: string;
  enableStreaming?: boolean; // New prop to enable SSE streaming
}

const SIMULATION_COMMANDS: Command[] = [
  { key: '/analyze', label: 'analyze', description: 'Analyze scenario structure', icon: <Brain className="h-4 w-4" />, category: 'analysis' },
  { key: '/debug', label: 'debug', description: 'Debug current errors', icon: <Terminal className="h-4 w-4" />, category: 'action' },
  { key: '/optimize', label: 'optimize', description: 'Suggest optimizations', icon: <Zap className="h-4 w-4" />, category: 'action' },
  { key: '/explain', label: 'explain', description: 'Explain simulation behavior', icon: <FileText className="h-4 w-4" />, category: 'analysis' },
];

const EDIT_COMMANDS: Command[] = [
  { key: '/validate', label: 'validate', description: 'Validate JSON structure', icon: <Brain className="h-4 w-4" />, category: 'analysis' },
  { key: '/add-node', label: 'add-node', description: 'Add new node to scenario', icon: <Sparkles className="h-4 w-4" />, category: 'action' },
  { key: '/fix-json', label: 'fix-json', description: 'Fix JSON syntax errors', icon: <Terminal className="h-4 w-4" />, category: 'action' },
  { key: '/generate', label: 'generate', description: 'Generate JSON snippets', icon: <Code2 className="h-4 w-4" />, category: 'action' },
  { key: '/refactor', label: 'refactor', description: 'Refactor JSON structure', icon: <GitBranch className="h-4 w-4" />, category: 'action' },
];

const SIMULATION_CONTEXTS = [
  { key: '@scenario', label: 'scenario', description: 'Current scenario data' },
  { key: '@errors', label: 'errors', description: 'Current error messages' },
  { key: '@ledger', label: 'ledger', description: 'Global ledger with all tokens' },
  { key: '@state', label: 'state', description: 'Simulation state' },
  { key: '@t', label: 't', description: 'Reference specific time (e.g., @t5s, @t10s)' },
];

const EDIT_CONTEXTS = [
  { key: '@json', label: 'json', description: 'Current JSON structure' },
  { key: '@schema', label: 'schema', description: 'JSON schema validation' },
  { key: '@nodes', label: 'nodes', description: 'Node definitions' },
  { key: '@connections', label: 'connections', description: 'Node connections' },
  { key: '@variables', label: 'variables', description: 'Scenario variables' },
];

// Helper function to extract nodes from scenario content
const extractNodesFromScenario = (scenarioContent?: string) => {
  if (!scenarioContent) return [];
  
  try {
    const scenario = JSON.parse(scenarioContent);
    const nodes: Array<{ key: string; label: string; description: string }> = [];
    
    // Extract nodes from different possible structures
    if (scenario.nodes && Array.isArray(scenario.nodes)) {
      scenario.nodes.forEach((node: any) => {
        // Handle various node ID and name patterns
        const nodeId = node.nodeId || node.id || node.name;
        const displayName = node.displayName || node.data?.label || node.label || node.name || nodeId;
        
        if (nodeId || displayName) {
          // Use displayName for the @ reference (like "Source A", "Queue B")
          const referenceKey = displayName || nodeId;
          nodes.push({
            key: `@${referenceKey}`,
            label: referenceKey,
            description: `${node.type || 'Node'}: ${displayName}${nodeId !== displayName ? ` (${nodeId})` : ''}`
          });
        }
      });
    }
    
    // Extract sources with human-readable names
    if (scenario.sources && Array.isArray(scenario.sources)) {
      scenario.sources.forEach((source: any) => {
        if (source.id || source.name) {
          const sourceId = source.id || source.name;
          const sourceName = source.name || source.label || sourceId;
          nodes.push({
            key: `@${sourceName}`,
            label: sourceName,
            description: `Source: ${sourceName}${source.type ? ` (${source.type})` : ''}`
          });
        }
      });
    }
    
    // Extract tokens from ledger if available
    if (scenario.ledger && Array.isArray(scenario.ledger)) {
      scenario.ledger.forEach((token: any) => {
        if (token.id || token.name) {
          const tokenId = token.id || token.name;
          const tokenName = token.name || token.label || tokenId;
          nodes.push({
            key: `@${tokenName}`,
            label: tokenName,
            description: `Token: ${tokenName}${token.type ? ` (${token.type})` : ''}`
          });
        }
      });
    }
    
    // Extract any other named entities
    Object.keys(scenario).forEach(key => {
      if (key !== 'nodes' && key !== 'sources' && key !== 'ledger' && typeof scenario[key] === 'object' && Array.isArray(scenario[key])) {
        scenario[key].forEach((item: any) => {
          if (item.id || item.name) {
            const itemId = item.id || item.name;
            const itemName = item.name || item.label || itemId;
            if (!nodes.find(n => n.label === itemName)) {
              nodes.push({
                key: `@${itemName}`,
                label: itemName,
                description: `${key}: ${itemName}`
              });
            }
          }
        });
      }
    });
    
    return nodes.sort((a, b) => a.label.localeCompare(b.label));
  } catch (error) {
    console.warn('Error parsing scenario for node extraction:', error);
    return [];
  }
};

const TAGS = [
  { key: '#performance', label: 'performance', description: 'Performance analysis' },
  { key: '#security', label: 'security', description: 'Security considerations' },
  { key: '#architecture', label: 'architecture', description: 'Architecture review' },
  { key: '#testing', label: 'testing', description: 'Testing strategies' },
  { key: '#documentation', label: 'documentation', description: 'Documentation needs' },
];

const SystemEventBubble = ({ message }: { message: ChatMessage }) => {
  const isScenarioUpdate = message.type === 'scenario_update';
  const isValidation = message.type === 'validation';

  return (
    <div className="mb-3 flex justify-center">
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-medium shadow-sm border max-w-[90%]",
        isScenarioUpdate
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : isValidation
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-slate-50 text-slate-600 border-slate-200"
      )}>
        {isScenarioUpdate && <Sparkles className="h-3 w-3" />}
        {isValidation && <Eye className="h-3 w-3" />}
        {!isScenarioUpdate && !isValidation && <Settings className="h-3 w-3" />}
        <span>{message.content}</span>
        <span className="text-[10px] opacity-60">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </span>
      </div>
    </div>
  );
};

const ValidationList = ({ items }: { items: string[] }) => {
  return (
    <div className="mb-3 mx-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold text-blue-700">Validation Checklist</span>
        </div>
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-2 text-xs text-blue-700">
              <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const SuggestionCheckboxList = ({
  suggestions,
  documentId,
  onIntegrateSelected
}: {
  suggestions: any;
  documentId: string;
  onIntegrateSelected: (selectedStatements: string[], documentId: string) => void;
}) => {
  const [selectedStatements, setSelectedStatements] = React.useState<string[]>([]);
  const [isIntegrating, setIsIntegrating] = React.useState(false);

  if (!suggestions || !suggestions.actionableStatements || suggestions.actionableStatements.length === 0) {
    return null;
  }

  const handleStatementToggle = (statement: string, checked: boolean) => {
    if (checked) {
      setSelectedStatements(prev => [...prev, statement]);
    } else {
      setSelectedStatements(prev => prev.filter(s => s !== statement));
    }
  };

  const handleIntegrate = async () => {
    if (selectedStatements.length === 0) return;

    setIsIntegrating(true);
    try {
      await onIntegrateSelected(selectedStatements, documentId);
    } finally {
      setIsIntegrating(false);
    }
  };

  return (
    <div className="mb-3 mx-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">Select Statements to Integrate</span>
          </div>
          <span className="text-xs text-emerald-600">{selectedStatements.length} selected</span>
        </div>

        <div className="space-y-2 mb-3">
          {suggestions.actionableStatements.map((statement: string, index: number) => (
            <div key={index} className="flex items-start gap-2">
              <Checkbox
                id={`statement-${index}`}
                checked={selectedStatements.includes(statement)}
                onCheckedChange={(checked) => handleStatementToggle(statement, checked as boolean)}
                className="mt-0.5"
              />
              <label
                htmlFor={`statement-${index}`}
                className="text-xs text-emerald-800 cursor-pointer leading-relaxed"
              >
                {statement}
              </label>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
          <button
            onClick={() => setSelectedStatements(suggestions.actionableStatements)}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            disabled={isIntegrating}
          >
            Select All
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedStatements([])}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              disabled={isIntegrating}
            >
              Clear
            </button>
            <Button
              onClick={handleIntegrate}
              disabled={selectedStatements.length === 0 || isIntegrating}
              size="sm"
              className="h-6 px-3 text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              {isIntegrating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Integrating...
                </>
              ) : (
                'Integrate Selected'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Step icons for progress display
const stepIcons: Record<string, string> = {
  'context_analysis': '•',
  'dsl_parsing': '•',
  'scenario_building': '•',
  'validation': '•',
  'positioning': '•',
  'reflection': '•',
  'response_generation': '•'
};

const InteractiveSuggestionsPanel = ({ suggestions, documentId, onApplySuggestion, onPreviewSuggestion, onBatchApply }: {
  suggestions: any[];
  documentId: string;
  onApplySuggestion: (suggestion: any) => void;
  onPreviewSuggestion: (suggestion: any) => void;
  onBatchApply: (suggestions: any[]) => void;
}) => {
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  const toggleSuggestion = (suggestionId: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(suggestionId)) {
      newSelected.delete(suggestionId);
    } else {
      newSelected.add(suggestionId);
    }
    setSelectedSuggestions(newSelected);
  };

  const getSelectedSuggestions = () => {
    return suggestions.filter(s => selectedSuggestions.has(s.id));
  };

  const getHighPrioritySuggestions = () => {
    return suggestions.filter(s => s.priority?.toLowerCase() === 'high');
  };

  return (
    <div className="mt-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-indigo-600" />
        <span className="text-sm font-semibold text-indigo-900">Interactive PLED Suggestions ({suggestions.length})</span>
      </div>

      <div className="space-y-4">
        {suggestions.map((suggestion, index) => (
          <div key={suggestion.id || index} className="p-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id={`suggestion-${suggestion.id || index}`}
                checked={selectedSuggestions.has(suggestion.id || index.toString())}
                onChange={() => toggleSuggestion(suggestion.id || index.toString())}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor={`suggestion-${suggestion.id || index}`} className="block text-sm font-medium text-gray-900 cursor-pointer">
                  {suggestion.title || `Suggestion ${index + 1}`}
                </label>
                {suggestion.description && (
                  <p className="text-xs text-gray-600 mt-1">{suggestion.description}</p>
                )}
                {suggestion.explanatoryText && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                    <strong>📋 Workflow Explanation:</strong>
                    <p className="mt-1">{suggestion.explanatoryText}</p>
                  </div>
                )}
                {suggestion.priority && (
                  <span className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${
                    suggestion.priority.toLowerCase() === 'high'
                      ? 'bg-red-100 text-red-800'
                      : suggestion.priority.toLowerCase() === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {suggestion.priority.toUpperCase()}
                  </span>
                )}

                {/* Architecture Reference Addition */}
                {suggestion.markdownForReference && (
                  <div className="mt-3">
                    <h5 className="text-xs font-semibold text-gray-700 mb-1">📄 Architecture Reference Addition:</h5>
                    <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs font-mono overflow-x-auto">
                      <pre className="whitespace-pre-wrap">{suggestion.markdownForReference}</pre>
                    </div>
                  </div>
                )}

                {/* Diagram Changes */}
                {suggestion.diagramChanges && (
                  <div className="mt-3">
                    <h5 className="text-xs font-semibold text-gray-700 mb-1">🔗 Diagram Changes:</h5>
                    <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                      {suggestion.diagramChanges.addNodes && suggestion.diagramChanges.addNodes.length > 0 && (
                        <div className="mb-2">
                          <strong>Add Nodes:</strong>
                          <ul className="list-disc list-inside ml-2">
                            {suggestion.diagramChanges.addNodes.map((node: any, idx: number) => (
                              <li key={idx}>
                                <code>{node.displayName}</code> ({node.type})
                                {(node.processing?.formula || node.processing?.aiPrompt) && (
                                  <span className="text-blue-700"> - {node.processing?.aiPrompt ? 'AI Prompt' : 'Formula'}: <code>{node.processing?.formula || node.processing?.aiPrompt}</code></span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {suggestion.diagramChanges.addConnections && suggestion.diagramChanges.addConnections.length > 0 && (
                        <div>
                          <strong>Add Connections:</strong>
                          <ul className="list-disc list-inside ml-2">
                            {suggestion.diagramChanges.addConnections.map((conn: any, idx: number) => (
                              <li key={idx}><code>{conn.from}</code> → <code>{conn.to}</code></li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onApplySuggestion(suggestion)}
                    className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                  >
                    Apply This Suggestion
                  </button>
                  <button
                    onClick={() => onPreviewSuggestion(suggestion)}
                    className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                  >
                    Preview Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Batch Actions */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
        <button
          onClick={() => onBatchApply(getHighPrioritySuggestions())}
          disabled={getHighPrioritySuggestions().length === 0}
          className="px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Apply All High Priority ({getHighPrioritySuggestions().length})
        </button>
        <button
          onClick={() => onBatchApply(getSelectedSuggestions())}
          disabled={selectedSuggestions.size === 0}
          className="px-3 py-2 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Apply Selected ({selectedSuggestions.size})
        </button>
        <button
          onClick={() => {
            const suggestionData = JSON.stringify(suggestions, null, 2);
            navigator.clipboard.writeText(suggestionData);
            alert('Suggestions exported to clipboard as JSON');
          }}
          className="px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Export as JSON
        </button>
      </div>
    </div>
  );
};

const MessageBubble = ({
  message,
  onActionButtonClick,
  scenarioContent,
  messages
}: {
  message: ChatMessage;
  onActionButtonClick: (action: string, message: ChatMessage) => Promise<void>;
  scenarioContent: string | null;
  messages: ChatMessage[];
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isError = message.type === 'error';
  const isSystemEvent = message.type === 'scenario_update' || message.type === 'validation';

  // Render system events differently
  if (isSystemEvent) {
    return <SystemEventBubble message={message} />;
  }

  // Render progress/thinking messages as streamlined updates (no avatar, no box)
  if (message.type === 'thinking') {
    const [expanded, setExpanded] = React.useState(false);
    const hasDetails = message.metadata?.step || message.metadata?.runId;

    return (
      <div className="my-2">
        <div className="flex items-start gap-2 text-[11px] text-slate-600">
          <div className="text-slate-400 mt-0.5">•</div>
          <div className="font-medium flex-1 prose prose-xs max-w-none text-[11px]">
            <ReactMarkdown
              components={{
                p: ({ children, ...props }) => (
                  <p className="inline text-[11px]" {...props}>{children}</p>
                ),
                strong: ({ children, ...props }) => (
                  <strong className="font-semibold text-[11px]" {...props}>{children}</strong>
                ),
                br: () => <span className="block h-1" />
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 shrink-0">
            {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
          {hasDetails && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-slate-500 hover:text-slate-700 ml-1"
            >
              {expanded ? '▼' : '▶'}
            </button>
          )}
        </div>
        {expanded && hasDetails && (
          <div className="ml-4 mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600 max-h-20 overflow-y-auto">
            {message.metadata?.step && <div><strong>Step:</strong> {message.metadata.step}</div>}
            {message.metadata?.runId && <div><strong>Run ID:</strong> {message.metadata.runId.substring(0, 8)}...</div>}
            {message.metadata?.timestamp && <div><strong>Server Time:</strong> {new Date(message.metadata.timestamp).toLocaleString()}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-2 max-w-full mb-3",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      <div className={cn(
        "flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[10px] font-semibold shadow-sm",
        isUser
          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
          : isSystem
            ? "bg-slate-100 text-slate-600 border border-slate-200"
            : isError
              ? "bg-gradient-to-br from-red-500 to-red-600 text-white"
              : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
      )}>
        {isUser ? "U" : isSystem ? "S" : isError ? "❌" : "AI"}
      </div>

      <div className={cn(
        "flex flex-col gap-1 max-w-[85%]",
        isUser ? "items-end" : "items-start"
      )}>
        {message.metadata?.command && (
          <Badge className="text-[10px] mb-1 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100">
            <Terminal className="h-2 w-2 mr-1" />
            /{message.metadata.command}
          </Badge>
        )}

        <div className={cn(
          "px-3 py-2 rounded-lg text-xs leading-relaxed shadow-sm",
          isUser
            ? "bg-slate-100 text-slate-800 border border-slate-300" // Professional B2B styling
            : isSystem
              ? "bg-slate-50 text-slate-700 border border-slate-200"
              : isError
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-white text-slate-800 border border-slate-200"
        )}>
          <div className="prose prose-xs max-w-none">
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
                // Customize markdown elements for compact display
                h1: ({ children, ...props }) => (
                  <h1 className="text-sm font-bold mb-1" {...props}>{children}</h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="text-xs font-semibold mb-1" {...props}>{children}</h2>
                ),
                p: ({ children, ...props }) => (
                  <p className="mb-1 last:mb-0 text-xs" {...props}>{children}</p>
                ),
                ul: ({ children, ...props }) => (
                  <ul className="list-disc list-outside ml-3 mb-1 text-xs" {...props}>{children}</ul>
                ),
                li: ({ children, ...props }) => (
                  <li className="mb-0.5 text-xs" {...props}>{children}</li>
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

          {/* Git-style diff display for reference document updates */}
          {(message as any).diffData && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">📝 Documentation Diff</h4>
              <GitDiff
                oldText={(message as any).diffData.originalContent}
                newText={(message as any).diffData.updatedContent}
                filename={(message as any).diffData.filename}
                className="text-xs"
              />
            </div>
          )}

          {/* Action buttons for special message types */}
          {message.actionButtons && message.actionButtons.length > 0 && (
            <div className="flex gap-2 mt-3 pt-2 border-t border-slate-200">
              {message.actionButtons.map((button: ActionButton, index: number) => (
                <Button
                  key={index}
                  size="sm"
                  variant={button.variant === 'primary' ? 'default' : 'outline'}
                  className="text-xs h-7"
                  onClick={() => onActionButtonClick(button.action, message)}
                >
                  {button.text}
                </Button>
              ))}
            </div>
          )}
        </div>

        <span className="text-[10px] text-slate-400 px-2 font-mono">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </span>
      </div>
    </div>
  );
};

const CommandSuggestions = ({ 
  input, 
  onSelect,
  isEditMode = false,
  scenarioContent,
  onSuggestionsChange
}: { 
  input: string; 
  onSelect: (suggestion: string) => void;
  isEditMode?: boolean;
  scenarioContent?: string;
  onSuggestionsChange?: (hassuggestions: boolean, suggestions?: any[]) => void;
}) => {
  const suggestions = useMemo(() => {
    const lastWord = input.split(' ').pop() || '';
    const commands = isEditMode ? EDIT_COMMANDS : SIMULATION_COMMANDS;
    const baseContexts = isEditMode ? EDIT_CONTEXTS : SIMULATION_CONTEXTS;
    
    // Extract dynamic nodes from scenario
    const dynamicNodes = extractNodesFromScenario(scenarioContent);
    
    // Generate time suggestions if typing @t
    const timeSuggestions = [];
    if (lastWord.startsWith('@t') && !isEditMode) {
      for (let i = 1; i <= 20; i++) {
        const timeKey = `@t${i}s`;
        if (timeKey.toLowerCase().includes(lastWord.toLowerCase())) {
          timeSuggestions.push({
            key: timeKey,
            label: `t${i}s`,
            description: `Time: ${i} second${i > 1 ? 's' : ''} into simulation`
          });
        }
      }
      // Add some common time formats
      ['@t30s', '@t60s', '@t120s'].forEach(timeKey => {
        if (timeKey.toLowerCase().includes(lastWord.toLowerCase())) {
          const seconds = parseInt(timeKey.slice(2, -1));
          timeSuggestions.push({
            key: timeKey,
            label: timeKey.slice(1),
            description: `Time: ${seconds} seconds into simulation`
          });
        }
      });
    }
    
    const allContexts = [...baseContexts, ...dynamicNodes, ...timeSuggestions];
    
    if (lastWord.startsWith('/')) {
      return commands.filter(cmd => 
        cmd.key.toLowerCase().includes(lastWord.toLowerCase())
      ).slice(0, 8);
    }
    
    if (lastWord.startsWith('@')) {
      return allContexts.filter(ctx => 
        ctx.key.toLowerCase().includes(lastWord.toLowerCase())
      ).slice(0, 12);
    }
    
    if (lastWord.startsWith('#')) {
      return TAGS.filter(tag => 
        tag.key.toLowerCase().includes(lastWord.toLowerCase())
      ).slice(0, 5);
    }
    
    return [];
  }, [input, isEditMode, scenarioContent]);

  // Notify parent about suggestions state
  React.useEffect(() => {
    onSuggestionsChange?.(suggestions.length > 0, suggestions);
  }, [suggestions, onSuggestionsChange]);

  if (suggestions.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl mb-2 z-50">
      <div className="p-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-4 w-4 text-slate-600" />
          <span className="text-xs font-semibold text-slate-700 font-mono">Smart Suggestions</span>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {suggestions.map((suggestion, index) => {
          const isDynamicNode = suggestion.key.startsWith('@') && !suggestion.key.match(/^@(json|schema|nodes|connections|variables|scenario|errors|state|ledger|t)$/);
          const isTimeReference = suggestion.key.match(/^@t\d+s$/);
          
          return (
            <button
              key={`${suggestion.key}-${index}`}
              onClick={() => {
                const parts = input.split(' ');
                parts[parts.length - 1] = suggestion.key + ' ';
                onSelect(parts.join(' '));
              }}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 text-sm border-b border-slate-50 last:border-b-0 transition-colors"
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold",
                isDynamicNode 
                  ? "bg-emerald-100 text-emerald-700" 
                  : isTimeReference
                    ? "bg-blue-100 text-blue-700"
                    : ('icon' in suggestion)
                      ? "bg-slate-100 text-slate-600"
                      : "bg-slate-100 text-slate-600"
              )}>
                {isDynamicNode ? (
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                ) : isTimeReference ? (
                  <div className="text-xs font-mono font-bold">T</div>
                ) : (
                  ('icon' in suggestion) && suggestion.icon
                )}
              </div>
              <div className="flex-1">
                <div className="font-mono font-semibold text-slate-800">{suggestion.key}</div>
                <div className="text-xs text-slate-500 font-mono">{suggestion.description}</div>
              </div>
              {isDynamicNode && (
                <div className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded">
                  Live
                </div>
              )}
              {isTimeReference && (
                <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                  Time
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function IntegratedAIAssistant({
  className,
  isEditMode = false,
  scenarioContent,
  onScenarioUpdate,
  loadScenario,
  documentContext,
  referenceDoc,
  enableStreaming = false
}: IntegratedAIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: isEditMode 
        ? 'Template Editor\n\nI can help with:\n- JSON structure validation\n- Adding and modifying nodes\n- Connecting data flows\n- Schema compliance\n\nUse / for commands, @ to reference nodes, # for tags'
        : 'Simulation Analysis\n\nI can help with:\n- Node behavior analysis\n- Debugging data flows\n- Performance optimization\n- Token tracking in ledger\n\nUse / for commands, @ to reference nodes, # for tags',
      timestamp: new Date(),
      type: 'system'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSuggestions, setHasSuggestions] = useState(false);
  const [currentSuggestions, setCurrentSuggestions] = useState<any[]>([]);
  const [documentSuggestions, setDocumentSuggestions] = useState<any>(null);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [processedDocumentId, setProcessedDocumentId] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null); // Track active requests
  const [isProcessing, setIsProcessing] = useState(false); // Additional processing lock
  const processingRef = useRef<Set<string>>(new Set()); // SYNCHRONOUS lock to prevent React StrictMode duplicates

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // SSE Chat hook for streaming mode
  const sseChat = useSSEChat({
    onProgress: (event) => {
      console.log('SSE Progress:', event);
      const icon = stepIcons[event.step] || '•';

      setMessages(prev => prev.map(msg =>
        msg.type === 'thinking' && msg.id.startsWith('thinking-')
          ? {
              ...msg,
              content: `🚀 **Real-time Streaming** (${event.currentStep}/${event.totalSteps})\n\n${icon} ${event.message}`,
              timestamp: new Date()
            }
          : msg
      ));
    },
    onComplete: (event) => {
      console.log('SSE Complete:', event);

      // Handle completion similar to regular chat
      if (event.success && event.scenario && onScenarioUpdate) {
        const updatedScenarioString = JSON.stringify(event.scenario, null, 2);
        onScenarioUpdate(updatedScenarioString);

        if (loadScenario) {
          loadScenario(event.scenario);
        }
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: event.message,
        timestamp: new Date(),
        type: 'suggestion'
      };

      setMessages(prev => [...prev.filter(msg => msg.type !== 'thinking'), aiMessage]);
      setIsLoading(false);
    },
    onError: (event) => {
      console.error('SSE Error:', event);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ **Streaming Error**: ${event.message}`,
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev.filter(msg => msg.type !== 'thinking'), errorMessage]);
      setIsLoading(false);
    },
    onConnected: () => {
      console.log('SSE Connected');
    }
  });

  // Get scenario context from simulation store
  const scenario = useSimulationStore(state => state.scenario);
  const currentTime = useSimulationStore(state => state.currentTime);
  const errorMessages = useSimulationStore(state => state.errorMessages);
  const isRunning = useSimulationStore(state => state.isRunning);

  // Handle document context and auto-generate suggestions
  useEffect(() => {
    let isActive = true; // Flag to prevent state updates if component unmounts


    // STRICT MODE PROTECTION: Check if already processing this exact document
    if (documentContext &&
        documentContext.id !== processedDocumentId &&
        !processingRef.current.has(documentContext.id)) {

      // SYNCHRONOUS lock to prevent React StrictMode double execution
      processingRef.current.add(documentContext.id);

      setIsProcessing(true);
      setProcessedDocumentId(documentContext.id);
      setActiveRequestId(documentContext.id);
      setIsGeneratingSuggestions(true);
      setCurrentPhase('Phase 1: Extracting document components');

      // Add initial message about document processing
      const documentMessage: ChatMessage = {
        id: `doc-${Date.now()}`,
        role: 'system',
        content: `📄 Processing document: "${documentContext.name}"`,
        timestamp: new Date(),
        type: 'system'
      };

      if (isActive) {
        setMessages(prev => [...prev, documentMessage]);

        // Start agent-style progress messages - separate message for each phase
        const phase1Message: ChatMessage = {
          id: `phase1-${Date.now()}`,
          role: 'assistant',
          content: 'Extracting document components...',
          timestamp: new Date(),
          type: 'thinking'
        };
        setMessages(prev => [...prev, phase1Message]);

        // Schedule phase 2 message
        setTimeout(() => {
          setCurrentPhase('Phase 2: Designing PLED architecture');
          const phase2Message: ChatMessage = {
            id: `phase2-${Date.now()}`,
            role: 'assistant',
            content: '🧠 **Phase 2: Designing PLED architecture**\n\n⚡ Creating intelligent DataSource → Queue → ProcessNode → Sink workflows...',
            timestamp: new Date(),
            type: 'thinking'
          };
          setMessages(prev => [...prev, phase2Message]);
        }, 20000); // After 20 seconds

        // Schedule phase 3 message
        setTimeout(() => {
          setCurrentPhase('Phase 3: Schema enforcement');
          const phase3Message: ChatMessage = {
            id: `phase3-${Date.now()}`,
            role: 'assistant',
            content: 'Converting to schema format...',
            timestamp: new Date(),
            type: 'thinking'
          };
          setMessages(prev => [...prev, phase3Message]);
        }, 40000); // After 40 seconds
      }

      // Generate suggestions
      fetch('/api/suggestions/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentContext,
          referenceDoc,
          currentDiagram: scenario
        })
      })
      .then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {

        // Check if we have suggestions data

        // ALWAYS process suggestions even if component unmounted due to Fast Refresh
        setDocumentSuggestions(data);

        let responseContent = '';
        if (data.alreadyIncluded) {
          responseContent = `📋 **Document Already Included**\n\nThe document "${documentContext.name}" is already integrated into the architecture reference.\n\nYou can:\n- Remove it from the architecture and regenerate suggestions\n- Review existing references tagged with [REF:${documentContext.id}]`;
        } else if (data.suggestions) {
          const { suggestions } = data;
          responseContent = `📄 **Document Analysis: "${documentContext.name}"**\n\n`;

          // Add document summary
          if (suggestions.documentSummary) {
            responseContent += `**📋 Summary:**\n${suggestions.documentSummary}\n\n`;
          }

          // Add relevance to architecture
          if (suggestions.relevanceToArchitecture) {
            responseContent += `**🔗 Relevance to Current Architecture:**\n${suggestions.relevanceToArchitecture}\n\n`;
          }

          responseContent += `**Architecture Enhancement Suggestions:**\n\n`;

          // Handle new unified suggestion format - store for special rendering
          if (suggestions.suggestions && Array.isArray(suggestions.suggestions) && suggestions.suggestions.length > 0) {
            // Set a flag to render special suggestion UI instead of plain markdown
            responseContent += `**🎯 Interactive Suggestions Available (${suggestions.suggestions.length} found)**\n\n`;
            responseContent += `[This message contains interactive suggestion components below]`;
          }

          // Fallback for legacy format
          if (suggestions.improvements && Array.isArray(suggestions.improvements) && suggestions.improvements.length > 0) {
            responseContent += `**📈 Improvements:**\n${suggestions.improvements.map((imp: string) => `- ${imp}`).join('\n')}\n\n`;
          }

          if (suggestions.newConcepts && Array.isArray(suggestions.newConcepts) && suggestions.newConcepts.length > 0) {
            responseContent += `**💡 New Concepts:**\n${suggestions.newConcepts.map((concept: string) => `- ${concept}`).join('\n')}\n\n`;
          }

          responseContent += `**📋 Summary:** ${suggestions.summary || 'Analysis completed'}\n\n`;
          responseContent += `💡 **Next Steps:**\n- Review suggestions above and select which to implement\n- Click "Apply This Suggestion" for individual implementation\n- Use batch actions to apply multiple suggestions\n- All changes will show as (unsaved) until you save the template`;
        }

        const suggestionMessage: ChatMessage = {
          id: `suggestions-${Date.now()}`,
          role: 'assistant',
          content: responseContent,
          timestamp: new Date(),
          type: 'suggestion',
          metadata: {
            documentId: documentContext.id,
            suggestions: data.suggestions,
            interactiveSuggestions: (data.suggestions && data.suggestions.suggestions) ? data.suggestions.suggestions : []
          }
        };

        // ALWAYS add suggestion message to prevent stuck UI
        console.log('✅ FRONTEND: Adding suggestion message to chat (forced)');
        setMessages(prev => [...prev, suggestionMessage]);

        // Phase updates completed - final message will be the AI suggestions
      })
      .catch(error => {
        console.error('Failed to generate suggestions:', error);
        if (isActive) {
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `❌ **Error generating suggestions:** ${error.message}`,
            timestamp: new Date(),
            type: 'error'
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      })
      .finally(() => {
        // ALWAYS clear loading state regardless of isActive to prevent stuck UI
        setIsGeneratingSuggestions(false);
        setCurrentPhase(''); // Reset phase
        setIsProcessing(false); // Reset processing lock
        setActiveRequestId(null); // Release the lock
        // UNLOCK synchronous lock
        if (documentContext?.id) {
          processingRef.current.delete(documentContext.id);
        }
      });
    }

    // Cleanup function
    return () => {
      isActive = false;
    };
  }, [documentContext?.id, processedDocumentId]); // Remove referenceDoc from dependencies

  // Handle integration of selected statements
  const handleIntegrateStatements = async (selectedStatements: string[], documentId: string) => {
    if (!documentContext) return;

    try {
      const response = await fetch('/api/architecture/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceId: documentId,
          resourceName: documentContext.name,
          resourceType: documentContext.type,
          uploadedAt: documentContext.uploadedAt,
          statements: selectedStatements
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Add success message to chat
      const successMessage: ChatMessage = {
        id: `integration-${Date.now()}`,
        role: 'assistant',
        content: `✅ **Integration Complete**\n\n${selectedStatements.length} statement${selectedStatements.length > 1 ? 's' : ''} from "${documentContext.name}" have been integrated into the architecture reference.\n\n**Added to Resources:**\n- ${result.resourceEntry}\n\n**Tagged Statements:**\n${selectedStatements.map((stmt: string) => `- ${stmt} [REF:${documentId}]`).join('\n')}`,
        timestamp: new Date(),
        type: 'system'
      };

      setMessages(prev => [...prev, successMessage]);

    } catch (error) {
      console.error('Failed to integrate statements:', error);
      const errorMessage: ChatMessage = {
        id: `integration-error-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Integration Failed:** ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Removed auto-scroll - it was hiding the top of the page

  // Handler for action buttons in chat messages
  const handleActionButtonClick = async (action: string, message: ChatMessage) => {
    if (action === 'update-reference-doc') {
      // Trigger reference document update
      try {
        // Add "Updating reference document..." message
        const updatingMessage: ChatMessage = {
          id: `updating-ref-${Date.now()}`,
          role: 'system',
          content: '📝 **Updating Reference Document**\n\nAnalyzing new workflow components and generating documentation updates...',
          timestamp: new Date(),
          type: 'thinking'
        };
        setMessages(prev => [...prev, updatingMessage]);

        // Get the current scenario to extract new nodes
        const currentScenarioString = scenarioContent || '{}';
        const currentScenario = JSON.parse(currentScenarioString);

        // Get ALL nodes from current scenario to document the complete workflow
        const allNodes = currentScenario.nodes || [];

        if (allNodes.length === 0) {
          throw new Error('No workflow components found to document');
        }

        // Generate documentation for ALL components in current scenario
        const nodeDescriptions = allNodes.map((node: any) => {
          const connections = currentScenario.edges?.filter((edge: any) =>
            edge.from === node.nodeId || edge.to === node.nodeId ||
            edge.sourceNodeId === node.nodeId || edge.targetNodeId === node.nodeId ||
            edge.destinationNodeId === node.nodeId
          ).map((edge: any) => {
            const isSource = edge.from === node.nodeId || edge.sourceNodeId === node.nodeId;
            const otherNodeId = isSource ? (edge.to || edge.targetNodeId || edge.destinationNodeId) : (edge.from || edge.sourceNodeId);
            const otherNode = allNodes.find((n: any) => n.nodeId === otherNodeId);
            return `${isSource ? 'outputs to' : 'receives from'} ${otherNode?.displayName || otherNodeId}`;
          }).join(', ');

          return {
            name: node.displayName || node.nodeId,
            type: node.type || 'Node',
            purpose: node.description || `${node.type} component for workflow processing`,
            connections: connections || 'Standalone component'
          };
        });

        const requestBody = {
          scenario: currentScenario,
          newComponents: nodeDescriptions,
          updateDescription: `Updated architecture documentation with current workflow containing ${allNodes.length} components`
        };

        console.log('Reference update request:', requestBody);

        // Call the architecture document update API
        const response = await fetch('/api/architecture/update-from-workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        console.log('Reference update response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Reference update error details:', errorData);
          throw new Error(`Failed to update reference document: ${response.status} ${response.statusText}${errorData.error ? ' - ' + errorData.error : ''}`);
        }

        const updateResult = await response.json();

        // Show diff preview in chat with visual diff component
        const diffMessage: ChatMessage = {
          id: `ref-diff-${Date.now()}`,
          role: 'assistant',
          content: `✅ Reference document updated

## Documentation changes

**Added Components:**
${nodeDescriptions.map((desc: any) => `- **${desc.name}** (${desc.type}): ${desc.purpose}`).join('\n')}

## 🔄 Architecture Changes
${updateResult.summary || 'Architecture documentation updated with new workflow components.'}

✅ **The reference document has been updated** to reflect your new workflow structure. You can view the complete updated documentation in the Resources tab.`,
          timestamp: new Date(),
          type: 'analysis',
          diffData: updateResult.originalContent && updateResult.updatedContent ? {
            originalContent: updateResult.originalContent,
            updatedContent: updateResult.updatedContent,
            filename: 'architecture_reference.md'
          } : null
        };

        setMessages(prev => [...prev, diffMessage]);

      } catch (error) {
        console.error('Failed to update reference document:', error);

        // Provide more specific error guidance
        let errorMessage = 'Unknown error occurred';
        let suggestion = 'You can manually update it by describing the new components in the Resources tab.';

        if (error instanceof Error) {
          if (error.message.includes('404') || error.message.includes('not found')) {
            errorMessage = 'No architecture reference document found';
            suggestion = 'Upload an architecture document in the Resources tab first, then try again.';
          } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
            errorMessage = 'Invalid request data';
            suggestion = 'This is likely a temporary issue. Try creating the workflow again.';
          } else {
            errorMessage = error.message;
          }
        }

        const errorMessageObj: ChatMessage = {
          id: `ref-error-${Date.now()}`,
          role: 'assistant',
          content: `❌ Reference document update failed

Error: ${errorMessage}

${suggestion}`,
          timestamp: new Date(),
          type: 'error'
        };

        setMessages(prev => [...prev, errorMessageObj]);
      }
    } else if (action === 'skip-reference-update') {
      // Just hide the message or mark as dismissed
      // Remove the message with action buttons from the chat
      setMessages(prev => prev.filter(msg => msg.id !== message.id));
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || sseChat.isStreaming) return;

    // Parse command/context from input
    const commandMatch = inputValue.match(/\/(\w+)/);
    const contextMatch = inputValue.match(/@([\w-]+)/g);
    const tagMatch = inputValue.match(/#(\w+)/g);
    
    // Extract referenced nodes from scenario
    const dynamicNodes = extractNodesFromScenario(scenarioContent);
    const referencedNodes = contextMatch?.filter(match => 
      dynamicNodes.some(node => node.key === match)
    ) || [];
    
    // Extract time references
    const timeReferences = contextMatch?.filter(match => 
      match.match(/^@t\d+s$/)
    ) || [];

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      type: commandMatch ? 'command' : 'analysis',
      metadata: {
        command: commandMatch?.[1],
        context: contextMatch,
      }
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Add initial thinking message that we'll update with progress
    const thinkingMessageId = `thinking-${Date.now()}`;
    const initialThinkingMessage: ChatMessage = {
      id: thinkingMessageId,
      role: 'system',
      content: enableStreaming ? '🚀 **Real-time Streaming**\n\nConnecting...' : '🤖 **AI Agent Working**\n\nReady',
      timestamp: new Date(),
      type: 'thinking'
    };
    setMessages(prev => [...prev, initialThinkingMessage]);

    // Choose streaming vs regular approach
    if (enableStreaming) {
      try {
        await sseChat.sendMessage(userMessage.content, scenario || (scenarioContent ? JSON.parse(scenarioContent) : null));
      } catch (error) {
        console.error('Streaming error:', error);
        setIsLoading(false);
      }
      return;
    }

    // Progress tracking - only use simulation if no real LangGraph data comes within timeout
    let progressTimeout: NodeJS.Timeout;
    let hasRealData = false;

    const simulateProgress = () => {
      // Only simulate if we haven't received real data yet
      if (hasRealData) return;

      const simulatedSteps = [
        { step: 'context_analysis', message: 'Analyzing context and chat history...' },
        { step: 'dsl_parsing', message: 'Parsing DSL request with AI...' },
        { step: 'scenario_building', message: 'Building workflow scenario...' },
        { step: 'validation', message: 'Validating scenario structure...' },
        { step: 'positioning', message: 'Calculating optimal node positions...' },
        { step: 'reflection', message: 'Analyzing results and deciding next steps...' }
      ];

      simulatedSteps.forEach((step, index) => {
        progressTimeout = setTimeout(() => {
          // Double-check real data hasn't arrived while we were waiting
          if (hasRealData) return;

          const icon = stepIcons[step.step] || '•';
          const progressMessage: ChatMessage = {
            id: `simulated-progress-${step.step}-${Date.now()}`,
            role: 'system',
            content: `${icon} ${step.message}`,
            timestamp: new Date(),
            type: 'thinking'
          };

          setMessages(prev => [...prev, progressMessage]);
        }, (index + 1) * 800);
      });
    };

    // Start simulation with a slight delay to allow real data to arrive first
    setTimeout(simulateProgress, 100);

    try {
      // Handle special /version command locally
      if (commandMatch && commandMatch[1] === 'version') {
        // Import version utilities
        const { getTaggedVersions } = await import('@/lib/utils/sync');
        const currentTemplate = useSimulationStore.getState().currentTemplate;

        if (!currentTemplate) {
          const assistantMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: '❌ No template loaded. Please load a template first to check versions.',
            timestamp: new Date(),
            type: 'error'
          };
          setMessages(prev => [...prev, assistantMessage]);
          setIsLoading(false);
          return;
        }

        // Get tagged versions
        const taggedVersions = getTaggedVersions(currentTemplate);

        let statusContent = '';
        if (taggedVersions.length === 0) {
          statusContent = `📋 **Template Versions**

Template: "${currentTemplate.name}"

**Current Version:** Saved (working copy)
**Tagged Versions:** None

Use "File → Save Version..." to create tagged versions like "v1.0", "production", etc.`;
        } else {
          const versionList = taggedVersions
            .sort((a, b) => b.timestamp - a.timestamp)
            .map(version => {
              const date = new Date(version.timestamp).toLocaleString();
              return `- **${version.name}** (${date})${version.description ? ` - ${version.description}` : ''}`;
            })
            .join('\n');

          statusContent = `📋 **Template Versions**

Template: "${currentTemplate.name}"

**Current Version:** Saved (working copy)

**Tagged Versions:**
${versionList}

Use "File → Save Version..." to create new tagged versions.`;
        }

        const assistantMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: statusContent,
          timestamp: new Date(),
          type: 'system'
        };

        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }

      // Handle /improve-agent command with resource tagging
      if (commandMatch && commandMatch[1] === 'improve-agent') {
        const resourceMatch = inputValue.match(/@resources\/([^\s]+)/);

        if (!resourceMatch) {
          const assistantMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `❌ **Missing Resource Reference**

Please specify a resource to improve using the format:
\`/improve-agent @resources/{document_name}\`

Example: \`/improve-agent @resources/EB119_repan08_AM0123_RE\`

You can find resource names in the Resources tab.`,
            timestamp: new Date(),
            type: 'error'
          };
          setMessages(prev => [...prev, assistantMessage]);
          setIsLoading(false);
          return;
        }

        const resourceName = resourceMatch[1];

        // Find resource by matching name or ID
        try {
          const response = await fetch('/api/resources/list');
          const { resources } = await response.json();

          const matchedResource = resources.find((r: any) =>
            r.id === resourceName ||
            r.originalName?.includes(resourceName) ||
            r.title?.includes(resourceName)
          );

          if (!matchedResource) {
            const assistantMessage: ChatMessage = {
              id: Date.now().toString(),
              role: 'assistant',
              content: `❌ **Resource Not Found**

Could not find resource: \`${resourceName}\`

Available resources:
${resources.slice(0, 5).map((r: any) => `- \`${r.id}\` - ${r.title || r.originalName}`).join('\n')}
${resources.length > 5 ? `\n... and ${resources.length - 5} more` : ''}

Use the exact resource ID or a matching part of the name.`,
              timestamp: new Date(),
              type: 'error'
            };
            setMessages(prev => [...prev, assistantMessage]);
            setIsLoading(false);
            return;
          }

          // Start the improvement process using LangGraph agent
          const initialMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `🚀 **Starting Document Improvement**

Resource: **${matchedResource.title || matchedResource.originalName}**
Agent: LangGraph Document Improvement v2.0

Connecting to workflow agent...`,
            timestamp: new Date(),
            type: 'thinking'
          };
          setMessages(prev => [...prev, initialMessage]);

          // Simulate progress steps while the agent works
          const progressSteps = [
            { step: 'fetching_resource', message: 'Fetching document content from Firebase...' },
            { step: 'chunking_document', message: 'Chunking large document for analysis...' },
            { step: 'analyzing_content', message: 'AI analyzing document content...' },
            { step: 'generating_insights', message: 'Generating improvement suggestions...' },
            { step: 'synthesizing', message: 'Synthesizing final recommendations...' }
          ];

          // Show progress messages
          progressSteps.forEach((step, index) => {
            setTimeout(() => {
              const progressMessage: ChatMessage = {
                id: `improve-progress-${step.step}-${Date.now()}`,
                role: 'system',
                content: step.message,
                timestamp: new Date(),
                type: 'thinking'
              };
              setMessages(prev => [...prev, progressMessage]);
            }, (index + 1) * 1000);
          });

          // Call the LangGraph improve documents endpoint
          const improveResponse = await fetch('https://workflow-agent-319413928411.us-central1.run.app/improve-documents-v2', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + (process.env.NEXT_PUBLIC_WORKFLOW_AGENT_API_KEY || 'default-key')
            },
            body: JSON.stringify({
              resourceId: matchedResource.id,
              currentArchitecture: scenarioContent || '{}' // Pass current architecture context
            })
          });

          if (!improveResponse.ok) {
            throw new Error(`Improve agent failed: ${improveResponse.statusText}`);
          }

          const improveData = await improveResponse.json();

          // Display final results
          const resultMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `✅ **Document Improvement Complete**

**Resource:** ${matchedResource.title || matchedResource.originalName}

## 🎯 Key Improvements
${improveData.suggestions?.improvements?.map((imp: string) => `- ${imp}`).join('\n') || '- Analysis complete'}

## 💡 New Concepts
${improveData.suggestions?.newConcepts?.map((concept: string) => `- ${concept}`).join('\n') || '- No new concepts identified'}

## 🔧 Diagram Changes
${improveData.suggestions?.diagramChanges?.map((change: string) => `- ${change}`).join('\n') || '- No diagram changes suggested'}

## Key insights
${improveData.suggestions?.keyInsights?.map((insight: string) => `- ${insight}`).join('\n') || '- Analysis insights documented'}

---
**Summary:** ${improveData.suggestions?.summary || 'Document analysis completed successfully'}

💾 Changes have been saved to the resource metadata.`,
            timestamp: new Date(),
            type: 'analysis'
          };

          setMessages(prev => [...prev, resultMessage]);
          setIsLoading(false);
          return;

        } catch (error) {
          console.error('Improve agent error:', error);

          const errorMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `❌ **Improvement Agent Failed**

Error: ${error instanceof Error ? error.message : 'Unknown error'}

The LangGraph document improvement agent encountered an issue. Please try again or use the manual "Improve" button in the Resources tab.`,
            timestamp: new Date(),
            type: 'error'
          };
          setMessages(prev => [...prev, errorMessage]);
          setIsLoading(false);
          return;
        }
      }

      // Call the working /api/chat endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          scenario: scenario || (scenarioContent ? JSON.parse(scenarioContent) : null)
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Failed to get AI response: ${errorMessage}`);
      }

      const data = await response.json();

      // 🚨 BROWSER CONSOLE DEBUGGING FOR WORKFLOW-AGENT RESPONSE
      console.log('🚨 WORKFLOW-AGENT RESPONSE RECEIVED:');
      console.log('='.repeat(80));
      console.log('✅ Success:', data.success);
      console.log('📝 Message:', data.message);
      console.log('Scenario nodes:', data.scenario?.nodes?.length || 0);
      console.log('🔧 Operations:', data.operations?.length || 0);
      console.log('🛤️  LangGraph State Journey:', data.langGraphExecution?.stateJourney?.length || 0, 'steps');
      console.log('📋 Full Response:', JSON.stringify(data, null, 2));
      console.log('='.repeat(80));

      // ✨ Process real LangGraph data and prevent simulation
      if (data.langGraphExecution?.stateJourney && Array.isArray(data.langGraphExecution.stateJourney)) {
        console.log('🎯 Real LangGraph state journey received - using real data only');
        hasRealData = true; // Prevent any future simulation
        clearTimeout(progressTimeout); // Stop any pending simulated progress

        // Remove any simulated progress messages and add real ones
        setMessages(prev => {
          // Remove simulated messages (they have IDs starting with 'simulated-progress-')
          const withoutSimulated = prev.filter(msg =>
            msg.type !== 'thinking' || !msg.id.startsWith('simulated-progress-')
          );

          // Add real progress steps with metadata for expandable details
          const realProgressMessages = data.langGraphExecution.stateJourney.map((step, index) => {
            const icon = stepIcons[step.step] || '•';
            return {
              id: `real-progress-${step.step}-${step.timestamp}`,
              role: 'system' as const,
              content: `${icon} ${step.message}`,
              timestamp: new Date(step.timestamp),
              type: 'thinking' as const,
              metadata: {
                step: step.step,
                runId: step.runId,
                timestamp: step.timestamp
              }
            };
          });

          return [...withoutSimulated, ...realProgressMessages];
        });
      }

      let responseContent = data.message;

      // 🚨 CRITICAL: Apply scenario update from workflow-agent if provided
      if (data.success && data.scenario && data.scenario.nodes && data.scenario.nodes.length > 0) {
        console.log('🚨 APPLYING WORKFLOW-AGENT SCENARIO UPDATE...');

        try {
          // Apply scenario update using the same mechanism as JSON patches
          if (onScenarioUpdate) {
            const updatedScenarioString = JSON.stringify(data.scenario, null, 2);
            console.log('📝 Updating scenario content:', updatedScenarioString.substring(0, 200) + '...');
            onScenarioUpdate(updatedScenarioString);
          }

          // Also trigger visual diagram update using loadScenario if available
          if (loadScenario) {
            console.log('Loading scenario into visual diagram...');
            await loadScenario(data.scenario);
            console.log('✅ Visual diagram updated successfully!');
          }

          console.log('✅ WORKFLOW-AGENT SCENARIO APPLIED SUCCESSFULLY!');

          // Add system message about the update (avoid duplicate success message)
          if (!responseContent.includes('Workflow Created Successfully')) {
            responseContent = `✅ **Workflow Created Successfully!**\n\n${responseContent}\n\n🎉 **${data.scenario.nodes.length} nodes** have been added to your diagram and are ready for simulation.`;
          } else {
            responseContent = `${responseContent}\n\n🎉 **${data.scenario.nodes.length} nodes** have been added to your diagram and are ready for simulation.`;
          }

        } catch (error) {
          console.error('❌ Failed to apply workflow-agent scenario:', error);
          responseContent = `⚠️ **Partial Success**: ${responseContent}\n\n❌ **Note**: The workflow was created but there was an issue updating the visual diagram. You may need to refresh the page.`;
        }
      }

      // Parse the AI response to extract different parts
      const summaryMatch = responseContent.match(/^- Summary:\s*(.+?)$/m);
      // Try both escaped and unescaped backticks
      const patchMatch = responseContent.match(/```json\s*(\[[\s\S]*?\])\s*```/) ||
                        responseContent.match(/\\`\\`\\`json\s*(\[[\s\S]*?\])\s*\\`\\`\\`/);
      const validationMatch = responseContent.match(/- Validation checklist:\s*([\s\S]*?)(?=\n\n|$)/);


      let mainContent = responseContent;
      let scenarioUpdated = false;
      let validationItems: string[] = [];

      // Extract summary if available
      if (summaryMatch) {
        mainContent = summaryMatch[1];
      }

      // Extract and parse validation checklist
      if (validationMatch) {
        validationItems = validationMatch[1]
          .split('\n')
          .map(line => line.replace(/^\s*-\s*/, '').trim())
          .filter(line => line.length > 0);
      }

      // Check if response contains JSON patch and apply it automatically
      if (patchMatch && scenarioContent && onScenarioUpdate) {
        try {
          const patchesJson = patchMatch[1];
          const patches = JSON.parse(patchesJson);
          const scenario = JSON.parse(scenarioContent);

          // Track existing node IDs BEFORE applying patches
          const existingNodeIds = new Set<string>();
          if (scenario.nodes && Array.isArray(scenario.nodes)) {
            scenario.nodes.forEach((node: any) => {
              if (node.nodeId) {
                existingNodeIds.add(node.nodeId);
              }
            });
          }

          // Apply minimal JSON Patch ops: add/replace (sufficient for assistant output)
          patches.forEach((patch: any, index: number) => {
            if (!patch || !patch.op || !patch.path) {
              return;
            }
            const parts = patch.path.split('/').filter((p: string) => p);
            let parent = scenario as any;
            for (let i = 0; i < parts.length - 1; i++) {
              const key = parts[i];
              if (Array.isArray(parent) && !isNaN(parseInt(key))) parent = parent[parseInt(key)];
              else parent = parent[key];
            }
            const finalKey = parts[parts.length - 1];
            if (patch.op === 'replace') {
              if (Array.isArray(parent) && !isNaN(parseInt(finalKey))) parent[parseInt(finalKey)] = patch.value;
              else parent[finalKey] = patch.value;
            } else if (patch.op === 'add') {
              if (Array.isArray(parent) && finalKey === '-') {
                parent.push(patch.value);
              }
              else if (Array.isArray(parent) && !isNaN(parseInt(finalKey))) parent.splice(parseInt(finalKey), 0, patch.value);
              else parent[finalKey] = patch.value;
            }
          });

          // Ensure Protocol V3 version field is present
          if (!scenario.version || scenario.version !== '3.0') {
            (scenario as any).version = '3.0';
          }

          // Fix collisions introduced by patches (only move new nodes, preserve existing ones)
          fixCollisionsInPlace(scenario, existingNodeIds);
          const updatedScenario = JSON.stringify(scenario, null, 2);

          onScenarioUpdate(updatedScenario);
          scenarioUpdated = true;
        } catch (error) {
          console.error('Failed to apply JSON patches:', error);
          mainContent = mainContent + '\n\n❌ **Error**: Failed to apply JSON patches automatically.';
        }
      }

      // Let the AI handle all node creation - no more hardcoded overrides!


      // Create the main AI response message
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: mainContent,
        timestamp: new Date(),
        type: commandMatch ? 'analysis' : 'suggestion',
        metadata: {
          command: commandMatch?.[1],
        }
      };

      const newMessages: ChatMessage[] = [aiMessage];

      // Add scenario update event if applicable
      if (scenarioUpdated) {
        newMessages.push({
          id: (Date.now() + 2).toString(),
          role: 'system',
          content: 'Scenario updated automatically',
          timestamp: new Date(),
          type: 'scenario_update',
        });
      }

      // Add validation checklist if available
      if (validationItems.length > 0) {
        newMessages.push({
          id: (Date.now() + 3).toString(),
          role: 'system',
          content: 'Validation completed',
          timestamp: new Date(),
          type: 'validation',
          metadata: {
            validationItems,
          }
        });
      }

      setMessages(prev => [...prev, ...newMessages]);
    } catch (error) {
      console.error('AI Assistant error:', error);

      // Create error message for user
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ **Error**: ${error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}`,
        timestamp: new Date(),
        type: 'error'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // If suggestions are open, accept the first one
      if (hasSuggestions && currentSuggestions.length > 0) {
        const firstSuggestion = currentSuggestions[0];
        const parts = inputValue.split(' ');
        parts[parts.length - 1] = firstSuggestion.key + ' ';
        setInputValue(parts.join(' '));
        textareaRef.current?.focus();
        return;
      }
      
      // Otherwise send the message
      handleSendMessage();
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-slate-50 min-h-0",
      className
    )}>
      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full px-3 py-2">
          <div className="space-y-1">
            {messages.map((message) => (
              <div key={message.id}>
                <MessageBubble
                  message={message}
                  onActionButtonClick={handleActionButtonClick}
                  scenarioContent={scenarioContent}
                  messages={messages}
                />
                {message.type === 'validation' && message.metadata?.validationItems && (
                  <ValidationList items={message.metadata.validationItems} />
                )}
                {message.type === 'suggestion' && message.metadata?.interactiveSuggestions && (
                  <InteractiveSuggestionsPanel
                    suggestions={message.metadata.interactiveSuggestions}
                    documentId={message.metadata.documentId}
                    onApplySuggestion={async (suggestion) => {
                      console.log('🚀 APPLYING SUGGESTION:', suggestion);
                      console.log('loadScenario available:', !!loadScenario);
                      console.log('onScenarioUpdate available:', !!onScenarioUpdate);
                      console.log('Current scenarioContent:', scenarioContent);

                      if (!suggestion?.diagramChanges?.addNodes) {
                        console.warn('⚠️  Cannot apply suggestion - missing nodes in suggestion');
                        return;
                      }

                      try {
                        // Get current scenario from simulation store (never create empty scenario!)
                        const { useSimulationStore } = await import('@/stores/simulationStore');
                        const store = useSimulationStore.getState();
                        let currentScenario: any = store.scenario;

                        // If no scenario in store, try parsing from scenarioContent
                        if (!currentScenario && scenarioContent) {
                          try {
                            currentScenario = JSON.parse(scenarioContent);
                          } catch (e) {
                            console.warn('Failed to parse scenario content');
                          }
                        }

                        // Only as last resort, create minimal scenario
                        if (!currentScenario) {
                          console.warn('No existing scenario found - creating minimal one');
                          currentScenario = {
                            version: '3.0',
                            nodes: [],
                            edges: [],
                            groups: { visualMode: "all", activeFilters: [] }
                          };
                        }

                        // Ensure edges array exists (required by core engine)
                        if (!currentScenario.edges) {
                          currentScenario.edges = [];
                        }

                        console.log('Current scenario has', currentScenario.nodes?.length || 0, 'existing nodes');

                        // Add new nodes from suggestion
                        const newNodes = suggestion.diagramChanges.addNodes;

                        // Ensure nodes array exists
                        if (!currentScenario.nodes) {
                          currentScenario.nodes = [];
                        }

                        // Store new nodes info for reference doc update later
                        console.log('🔧 STORING NEW NODES for reference doc:', newNodes.map(n => ({ id: n.nodeId, name: n.displayName, type: n.type })));

                        // Calculate smart GROUP positioning for new nodes (avoid overlaps completely)
                        const existingNodes = currentScenario.nodes || [];
                        console.log('📍 POSITIONING - Existing nodes:', existingNodes.length, 'New nodes:', newNodes.length);

                        // Define node dimensions and spacing
                        const nodeWidth = 160;
                        const nodeHeight = 80;
                        const padding = 40;

                        // STEP 1: Calculate relative positions for new nodes (treat as cohesive group)
                        const relativePositions = newNodes.map((node: any, index: number) => ({
                          x: index * (nodeWidth + padding),
                          y: index * 50  // Slight vertical offset for visual variety
                        }));

                        // STEP 2: Calculate bounding box of the new node group
                        const groupMinX = Math.min(...relativePositions.map(p => p.x));
                        const groupMaxX = Math.max(...relativePositions.map(p => p.x)) + nodeWidth;
                        const groupMinY = Math.min(...relativePositions.map(p => p.y));
                        const groupMaxY = Math.max(...relativePositions.map(p => p.y)) + nodeHeight;
                        const groupWidth = groupMaxX - groupMinX;
                        const groupHeight = groupMaxY - groupMinY;

                        // STEP 3: Find safe translation offset to avoid existing nodes
                        let offsetX = 50;  // Default starting position
                        let offsetY = 100;

                        if (existingNodes.length > 0) {
                          const positions = existingNodes
                            .filter((node: any) => node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number')
                            .map((node: any) => node.position);

                          if (positions.length > 0) {
                            const existingMinX = Math.min(...positions.map(p => p.x));
                            const existingMaxX = Math.max(...positions.map(p => p.x));
                            const existingMinY = Math.min(...positions.map(p => p.y));
                            const existingMaxY = Math.max(...positions.map(p => p.y));

                            console.log('📐 Existing bounds:', { existingMinX, existingMaxX, existingMinY, existingMaxY });
                            console.log('📦 New group size:', { groupWidth, groupHeight });

                            // Strategy 1: Try placing group to the right of existing diagram
                            offsetX = existingMaxX + nodeWidth + padding;
                            offsetY = existingMinY + (existingMaxY - existingMinY) / 2 - groupHeight / 2;

                            // Strategy 2: If group doesn't fit vertically, place below existing diagram
                            if (offsetY < existingMinY - 50 || offsetY + groupHeight > existingMaxY + 50) {
                              offsetX = existingMinX;
                              offsetY = existingMaxY + nodeHeight + padding;
                              console.log('🔄 Switching to below placement strategy');
                            }
                          }
                        }

                        console.log('🎯 Group translation offset:', { offsetX, offsetY });

                        // STEP 4: Create position function that applies group translation
                        const getSmartPosition = (index: number) => {
                          const relative = relativePositions[index];
                          return {
                            x: relative.x + offsetX,
                            y: relative.y + offsetY
                          };
                        };

                        // Add each node to the scenario with smart positioning
                        newNodes.forEach((node: any, index: number) => {
                          // Check if node already exists
                          const existingNode = currentScenario.nodes.find((n: any) => n.nodeId === node.nodeId);
                          if (!existingNode) {
                            // Check if node already has good coordinates (from workflow agent)
                            const hasGoodPosition = node.position &&
                              typeof node.position.x === 'number' &&
                              typeof node.position.y === 'number' &&
                              node.position.x >= 0 && node.position.x < 2000 &&  // Reasonable range
                              node.position.y >= -150 && node.position.y < 1200 && // Reasonable range (allow comments above)
                              !isNaN(node.position.x) && !isNaN(node.position.y); // Not NaN

                            if (!hasGoodPosition) {
                              // Apply smart positioning only if coordinates are bad/missing
                              console.log(`📍 Applying frontend positioning to ${node.nodeId} (bad position:`, node.position, ')');
                              node.position = getSmartPosition(index);
                            } else {
                              console.log(`✅ Preserving workflow agent position for ${node.nodeId}:`, node.position);
                            }

                            currentScenario.nodes.push(node);
                          } else {
                            console.log(`⚠️  Node ${node.nodeId} already exists, skipping`);
                          }
                        });

                        // Update the scenario
                        // Ensure V3 schema compliance
                        if (!currentScenario.version) {
                          currentScenario.version = '3.0';
                        }


                        // First update the scenario content
                        const updatedScenarioString = JSON.stringify(currentScenario, null, 2);
                        if (onScenarioUpdate) {
                          onScenarioUpdate(updatedScenarioString);
                        }

                        // Then trigger visual diagram update using loadScenario (like "Save to Firebase" does)
                        if (loadScenario) {

                          // Get store state for debug
                          const { useSimulationStore } = await import('@/stores/simulationStore');
                          const store = useSimulationStore.getState();
                          console.log('🧪 Store state before Apply:', {
                            isRunning: store.isRunning,
                            currentTime: store.currentTime,
                            currentExecutionId: store.currentExecutionId
                          });

                          // Reset simulation state to allow loading new scenario
                          console.log('🧪 Resetting simulation state first...');
                          store.endCurrentExecution();

                          const { validateScenario } = await import('@/lib/simulation/validation');
                          const validationResult = validateScenario(currentScenario);
                          if (validationResult.errors.length > 0) {
                            validationResult.errors.forEach((error, index) => {
                              console.error(`🚨 ERROR ${index + 1}: ${error}`);
                            });
                            console.error('🚨 FULL SCENARIO BEING VALIDATED:', JSON.stringify(currentScenario, null, 2));
                          } else {
                            console.log('✅ Scenario validation passed!');
                          }

                          await loadScenario(currentScenario);
                          console.log('✅ Visual diagram updated successfully!');
                        } else {
                          console.warn('⚠️  loadScenario not available - visual diagram will not update');
                        }

                        console.log('🎉 SUGGESTION APPLIED SUCCESSFULLY!');
                        console.log(`Total nodes in scenario: ${currentScenario.nodes.length}`);

                        // Add confirmation message to chat
                        const confirmationMessage: any = {
                          id: `apply-confirm-${Date.now()}`,
                          role: 'assistant',
                          content: `✅ Applied: ${suggestion.title}\n\nAdded ${newNodes.length} PLED nodes to your diagram:\n${newNodes.map((n: any) => `- ${n.displayName} (${n.type})`).join('\n')}\n\n💡 The nodes are now visible in your diagram and ready for simulation.`,
                          timestamp: new Date(),
                          type: 'system'
                        };
                        setMessages(prev => [...prev, confirmationMessage]);

                        // Add reference document sync prompt if nodes were actually added
                        if (newNodes.length > 0) {
                          setTimeout(() => {
                            const syncPromptMessage: ChatMessage = {
                              id: `sync-prompt-${Date.now()}`,
                              role: 'assistant',
                              content: `Reference Document Update\n\nNew workflow components have been added. Update the reference document to include explanations of these new nodes?\n\nThis will document the architecture changes for future reference.`,
                              timestamp: new Date(),
                              type: 'update',
                              actionButtons: [
                                {
                                  text: 'Update Reference Doc',
                                  action: 'update-reference-doc',
                                  variant: 'primary'
                                },
                                {
                                  text: 'Skip for now',
                                  action: 'skip-reference-update',
                                  variant: 'secondary'
                                }
                              ]
                            };
                            setMessages(prev => [...prev, syncPromptMessage]);
                          }, 2000); // Show after 2 seconds
                        }

                      } catch (error) {
                        console.error('❌ Failed to apply suggestion:', error);

                        // Add error message to chat
                        const errorMessage: any = {
                          id: `apply-error-${Date.now()}`,
                          role: 'assistant',
                          content: `❌ **Failed to apply suggestion**\n\nThere was an error applying "${suggestion.title}". Please check the console for details.`,
                          timestamp: new Date(),
                          type: 'system'
                        };
                        setMessages(prev => [...prev, errorMessage]);
                      }
                    }}
                    onPreviewSuggestion={(suggestion) => {}}
                    onBatchApply={(suggestions) => {}}
                  />
                )}
                {message.type === 'suggestion' && message.metadata?.suggestions && message.metadata?.documentId && !message.metadata?.interactiveSuggestions && (
                  <SuggestionCheckboxList
                    suggestions={message.metadata.suggestions}
                    documentId={message.metadata.documentId}
                    onIntegrateSelected={handleIntegrateStatements}
                  />
                )}
              </div>
            ))}
            {/* Old orange loading indicator removed - using new progress message system */}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>
      </div>

      {/* Enhanced Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 p-6 bg-white border-t border-slate-200 relative" style={{ minHeight: '220px', paddingBottom: '24px' }}>
        <CommandSuggestions
          input={inputValue}
          onSelect={(suggestion) => {
            setInputValue(suggestion);
            textareaRef.current?.focus();
          }}
          isEditMode={isEditMode}
          scenarioContent={scenarioContent}
          onSuggestionsChange={(hasSuggestions, suggestions) => {
            setHasSuggestions(hasSuggestions);
            setCurrentSuggestions(suggestions || []);
          }}
        />
        
        <div className="flex gap-2 mb-5 mt-6">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              placeholder="Ask me about your scenario..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[60px] max-h-[80px] resize-none text-[11px] font-mono bg-slate-50 border-slate-200 focus:border-indigo-300 focus:ring-indigo-200 rounded placeholder:text-[10px] placeholder:text-slate-400"
              disabled={isLoading || isGeneratingSuggestions}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-slate-400">
              <Hash className="h-2 w-2" />
              <AtSign className="h-2 w-2" />
              <Slash className="h-2 w-2" />
            </div>
          </div>
          <Button 
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading || isGeneratingSuggestions}
            className="self-end h-[60px] bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-lg flex-shrink-0"
          >
            {isLoading || isGeneratingSuggestions ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
        
        <div className="text-[10px] text-slate-500 mt-5 flex items-center justify-between flex-shrink-0 mb-6">
          <div className="flex items-center gap-3">
            <div>
              <kbd className="px-1 py-0.5 bg-slate-200 rounded text-slate-600">Enter</kbd> to send
            </div>
            {/* Streaming toggle */}
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={enableStreaming}
                onChange={() => {}} // Controlled by parent component
                disabled
                className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-500">
                {enableStreaming ? '🚀 Streaming' : '⚡ Standard'}
              </span>
            </label>
          </div>
          <span className="text-[10px] text-slate-500">Gemini Pro</span>
        </div>
      </div>
    </div>
  );
}