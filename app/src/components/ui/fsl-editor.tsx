"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  Code,
  Eye,
  Settings,
  FileText,
  Zap
} from "lucide-react";
import type { FSMDefinition, FSMState, FSMTransition } from "@/lib/simulation/types";

interface FSLEditorProps {
  isOpen: boolean;
  onClose: () => void;
  fsmDefinition?: FSMDefinition;
  fslCode?: string;
  onSave: (fsm: FSMDefinition, fsl: string) => void;
  title?: string;
}

interface ParsedFSL {
  states: FSMState[];
  transitions: FSMTransition[];
  variables: Record<string, any>;
  errors: string[];
}

// Simple FSL parser for demonstration
const parseFSL = (fslCode: string): ParsedFSL => {
  const result: ParsedFSL = {
    states: [],
    transitions: [],
    variables: {},
    errors: []
  };

  try {
    const lines = fslCode.split('\n').map(line => line.trim()).filter(Boolean);

    let currentState: Partial<FSMState> | null = null;

    for (const line of lines) {
      // State definition: state stateName { ... }
      if (line.startsWith('state ')) {
        if (currentState) {
          result.states.push(currentState as FSMState);
        }

        const stateMatch = line.match(/state\s+(\w+)\s*\{?/);
        if (stateMatch) {
          currentState = {
            name: stateMatch[1],
            onEntry: [],
            onExit: []
          };
        }
      }
      // Transition: on trigger -> targetState
      else if (line.includes('->')) {
        const transitionMatch = line.match(/on\s+(.+?)\s*->\s*(\w+)/);
        if (transitionMatch && currentState) {
          const trigger = transitionMatch[1].trim();
          const targetState = transitionMatch[2];

          // Check if it's a condition-based transition
          if (trigger.includes('.') || trigger.includes('>') || trigger.includes('<') || trigger.includes('=')) {
            result.transitions.push({
              from: currentState.name!,
              to: targetState,
              trigger: 'condition',
              condition: trigger
            });
          } else {
            result.transitions.push({
              from: currentState.name!,
              to: targetState,
              trigger: trigger
            });
          }
        }
      }
      // Actions: on_entry { action(...) }
      else if (line.includes('on_entry') && currentState) {
        const actionMatch = line.match(/(\w+)\((.+?)\)/);
        if (actionMatch) {
          const action = actionMatch[1];
          const params = actionMatch[2].replace(/['"]/g, '');

          if (!currentState.onEntry) currentState.onEntry = [];

          if (action === 'log') {
            currentState.onEntry.push({
              action: 'log',
              value: params
            });
          } else if (action === 'emit') {
            const [target, formula] = params.split(',').map(s => s.trim());
            currentState.onEntry.push({
              action: 'emit',
              target,
              formula
            });
          }
        }
      }
      // Closing brace
      else if (line === '}' && currentState) {
        result.states.push(currentState as FSMState);
        currentState = null;
      }
    }

    // Add the last state if not closed
    if (currentState) {
      result.states.push(currentState as FSMState);
    }

    // Mark first state as initial if not explicitly set
    if (result.states.length > 0 && !result.states.some(s => s.isInitial)) {
      result.states[0].isInitial = true;
    }

  } catch (error) {
    result.errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
};

// Generate FSL code from FSM definition
const generateFSL = (fsm: FSMDefinition): string => {
  let fsl = '';

  fsm.states.forEach(state => {
    fsl += `state ${state.name}`;
    if (state.isInitial) fsl += ' [initial]';
    if (state.isFinal) fsl += ' [final]';
    fsl += ' {\n';

    // On-entry actions
    if (state.onEntry && state.onEntry.length > 0) {
      state.onEntry.forEach(action => {
        if (action.action === 'log') {
          fsl += `  on_entry { log("${action.value}") }\n`;
        } else if (action.action === 'emit') {
          fsl += `  on_entry { emit(${action.target}, ${action.formula}) }\n`;
        }
      });
    }

    // Transitions from this state
    const transitions = fsm.transitions.filter(t => t.from === state.name);
    transitions.forEach(transition => {
      if (transition.trigger === 'condition' && transition.condition) {
        fsl += `  on ${transition.condition} -> ${transition.to}\n`;
      } else {
        fsl += `  on ${transition.trigger} -> ${transition.to}\n`;
      }
    });

    fsl += '}\n\n';
  });

  return fsl.trim();
};

const FSLEditor: React.FC<FSLEditorProps> = ({
  isOpen,
  onClose,
  fsmDefinition,
  fslCode: initialFslCode,
  onSave,
  title = "FSL Editor"
}) => {
  const [fslCode, setFslCode] = useState(initialFslCode || (fsmDefinition ? generateFSL(fsmDefinition) : ''));
  const [activeTab, setActiveTab] = useState<'code' | 'visual'>('code');
  const [parsedFSL, setParsedFSL] = useState<ParsedFSL>(() => parseFSL(fslCode));

  const handleFSLChange = useCallback((newCode: string) => {
    setFslCode(newCode);
    setParsedFSL(parseFSL(newCode));
  }, []);

  const handleSave = () => {
    if (parsedFSL.errors.length === 0) {
      const fsmDefinition: FSMDefinition = {
        states: parsedFSL.states,
        transitions: parsedFSL.transitions,
        variables: parsedFSL.variables
      };
      onSave(fsmDefinition, fslCode);
      onClose();
    }
  };

  const insertTemplate = (template: string) => {
    const templates = {
      'simple': `state idle {
  on token_received -> processing
}

state processing {
  on_entry { log("Processing started") }
  on input.data.value > 50 -> emit_high
  on input.data.value <= 50 -> emit_low
}

state emit_high {
  on_entry { emit(outputHigh, input.data.value * 2) }
  on emission_complete -> idle
}

state emit_low {
  on_entry { emit(outputLow, input.data.value * 0.5) }
  on emission_complete -> idle
}`,
      'counter': `state idle {
  on token_received -> counting
}

state counting {
  on_entry { increment(counter) }
  on counter >= 5 -> reset
  on token_received -> counting
}

state reset {
  on_entry {
    emit(output, counter)
    set_variable(counter, 0)
  }
  on emission_complete -> idle
}`
    };

    handleFSLChange(templates[template as keyof typeof templates] || '');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 text-orange-700 rounded-lg flex items-center justify-center">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                Design finite state machine behavior using FSL (Finite State Language)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('code')}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2",
              activeTab === 'code'
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <Code className="h-4 w-4" />
            FSL Code
          </button>
          <button
            onClick={() => setActiveTab('visual')}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2",
              activeTab === 'visual'
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <Eye className="h-4 w-4" />
            Visual Preview
          </button>
        </div>

        <div className="flex-1 min-h-0 flex gap-4">
          {activeTab === 'code' && (
            <>
              {/* Code Editor */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-700">FSL Code</h3>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertTemplate('simple')}
                      className="text-xs"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Simple
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertTemplate('counter')}
                      className="text-xs"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Counter
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={fslCode}
                  onChange={(e) => handleFSLChange(e.target.value)}
                  className="font-mono text-sm flex-1 min-h-0 resize-none"
                  placeholder="Enter FSL code here..."
                />
              </div>

              {/* Validation Panel */}
              <div className="w-80 flex flex-col">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Validation</h3>
                <div className="flex-1 bg-slate-50 rounded-lg border p-3">
                  {parsedFSL.errors.length === 0 ? (
                    <div className="flex items-center gap-2 text-green-700 mb-3">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Valid FSL</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-700 mb-3">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Validation Errors</span>
                    </div>
                  )}

                  <ScrollArea className="h-32">
                    {parsedFSL.errors.length > 0 ? (
                      <div className="space-y-2">
                        {parsedFSL.errors.map((error, i) => (
                          <div key={i} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            {error}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs font-medium text-slate-600">States:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {parsedFSL.states.map(state => (
                              <Badge key={state.name} variant="secondary" className="text-xs">
                                {state.name}
                                {state.isInitial && <span className="ml-1">●</span>}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-600">Transitions:</span>
                          <div className="text-xs text-slate-600 mt-1">
                            {parsedFSL.transitions.length} defined
                          </div>
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </>
          )}

          {activeTab === 'visual' && (
            <div className="flex-1 flex flex-col">
              <h3 className="text-sm font-medium text-slate-700 mb-2">State Machine Preview</h3>
              <div className="flex-1 bg-slate-50 rounded-lg border p-4">
                <div className="text-center text-slate-500 text-sm">
                  Visual state machine diagram coming soon...
                  <br />
                  <span className="text-xs">
                    For now, use the code editor to define your FSM behavior
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={parsedFSL.errors.length > 0}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Save FSM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FSLEditor;