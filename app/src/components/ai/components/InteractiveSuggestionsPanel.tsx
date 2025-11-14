// Interactive suggestions panel component
// Extracted from IntegratedAIAssistant.tsx for better organization

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles } from "lucide-react";

interface InteractiveSuggestionsPanelProps {
  suggestions: any[];
  documentId: string;
  onApplySuggestion: (suggestion: any) => void;
  onPreviewSuggestion: (suggestion: any) => void;
  onBatchApply: (suggestions: any[]) => void;
}

export const InteractiveSuggestionsPanel = ({
  suggestions,
  documentId,
  onApplySuggestion,
  onPreviewSuggestion,
  onBatchApply
}: InteractiveSuggestionsPanelProps) => {
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

export const SuggestionCheckboxList = ({
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