import React, { useState, useMemo } from "react";
import { Settings, Code, Save, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CodeHighlight } from "@/components/ui/CodeHighlight";

interface NodeConfigEditorProps {
  nodeConfig: any;
  showJson: boolean;
  onToggleJson: () => void;
  editedConfigText: string;
  onConfigTextChange: (text: string) => void;
  onSaveConfig: () => void;
  hasUnsavedChanges: boolean;
  onResetConfig: () => void;
  scenario: any;
  saveSnapshot: (description: string) => void;
  loadScenario: (scenario: any) => void;
  toast: any;
  updateNodeConfigInStore: (nodeId: string, newConfigData: any) => boolean;
  InputsOutputsEditor: React.ComponentType<any>;
}

export const NodeConfigEditor: React.FC<NodeConfigEditorProps> = ({ 
  nodeConfig, 
  showJson, 
  onToggleJson, 
  editedConfigText, 
  onConfigTextChange, 
  onSaveConfig, 
  hasUnsavedChanges, 
  onResetConfig, 
  scenario, 
  saveSnapshot, 
  loadScenario, 
  toast, 
  updateNodeConfigInStore,
  InputsOutputsEditor
}) => {
  const [expandedFormulas, setExpandedFormulas] = useState(new Set<number>());
  const [isExecutionEnvExpanded, setIsExecutionEnvExpanded] = useState(false);

  // Clean config (remove position and other UI stuff)
  const cleanConfig = useMemo(() => {
    const config = { ...nodeConfig };
    delete config.position;
    return config;
  }, [nodeConfig]);

  const toggleFormula = (index: number) => {
    const newExpanded = new Set(expandedFormulas);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFormulas(newExpanded);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Configuration
          {hasUnsavedChanges && showJson && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              Unsaved
            </span>
          )}
        </h3>
        <div className="flex gap-1">
          {showJson && hasUnsavedChanges && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
                onClick={onResetConfig}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reset
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={onSaveConfig}
              >
                <Save className="h-3 w-3 mr-1" />
                Apply
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onToggleJson}
          >
            <Code className="h-3 w-3 mr-1" />
            {showJson ? 'Hide' : 'Edit JSON'}
          </Button>
        </div>
      </div>
      
      {showJson ? (
        <Textarea
          value={editedConfigText}
          onChange={(e) => onConfigTextChange(e.target.value)}
          className="font-mono text-xs h-64 resize-none bg-slate-50 border-slate-200 focus:border-emerald-300 focus:ring-emerald-200"
          placeholder="Edit node configuration JSON..."
        />
      ) : (
        <div className="bg-slate-50 p-3 rounded-md space-y-3 text-sm">
          {/* Basic Info - Compact Layout */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div><span className="font-medium text-slate-600">ID:</span> <span className="font-mono text-slate-800">{nodeConfig.nodeId}</span></div>
            <div><span className="font-medium text-slate-600">Type:</span> {nodeConfig.type}</div>
            <div className="col-span-2"><span className="font-medium text-slate-600">Name:</span> {nodeConfig.displayName}</div>
          </div>

          {/* Description - Compact */}
          {nodeConfig.description && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-sm">
              <div className="text-blue-600 text-xs">{nodeConfig.description}</div>
            </div>
          )}

          <div className="space-y-3">

            {/* Node-specific Configuration */}
            <div className="border-t pt-2">
              <h4 className="font-semibold text-slate-700 mb-1 text-sm">Configuration</h4>
              <div className="space-y-1 text-xs">
                {nodeConfig.type === 'DataSource' && (
                  <>
                    <div><span className="font-medium text-slate-600">Interval:</span> {nodeConfig.interval}s</div>
                    <div><span className="font-medium text-slate-600">Generation Type:</span> {nodeConfig.generation.type}</div>
                    <div><span className="font-medium text-slate-600">Value Range:</span> {nodeConfig.generation.valueMin} - {nodeConfig.generation.valueMax}</div>
                  </>
                )}

                {nodeConfig.type === 'Queue' && (
                  <>
                    <div><span className="font-medium text-slate-600">Aggregation Method:</span> {nodeConfig.aggregation.method}</div>
                    <div><span className="font-medium text-slate-600">Time Window:</span> {nodeConfig.aggregation.trigger.window}s</div>
                    <div><span className="font-medium text-slate-600">Trigger Type:</span> {nodeConfig.aggregation.trigger.type}</div>
                    {nodeConfig.capacity && <div><span className="font-medium text-slate-600">Capacity:</span> {nodeConfig.capacity}</div>}
                    <div className="mt-2 p-2 bg-slate-100 rounded text-xs">
                      <span className="font-medium">Formula:</span> <span className="font-mono">{nodeConfig.aggregation.formula}</span>
                    </div>
                  </>
                )}

                {nodeConfig.type === 'Multiplexer' && (
                  <>
                    <div><span className="font-medium text-slate-600">Strategy:</span> {nodeConfig.multiplexing?.strategy || 'conditional'}</div>
                    <div><span className="font-medium text-slate-600">Outputs:</span> {nodeConfig.outputs?.length || 'auto'}</div>
                    {nodeConfig.multiplexing?.conditions && nodeConfig.multiplexing.conditions.length > 0 && (
                      <div className="mt-2">
                        <span className="font-medium text-slate-600">Conditions:</span>
                        <div className="mt-1 space-y-1">
                          {nodeConfig.multiplexing.conditions.map((condition: string, index: number) => (
                            <div key={index} className="text-xs bg-slate-100 p-2 rounded font-mono">
                              {condition}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}


                {nodeConfig.type === 'ProcessNode' && (
                  <>
                    {/* Environment Info for Determinism - Collapsible and Muted */}
                    <div className="p-2 bg-gray-50 border border-gray-200 rounded-sm">
                      <div
                        className="flex items-center justify-between cursor-pointer hover:bg-gray-100 -m-2 p-2 rounded-sm transition-colors"
                        onClick={() => setIsExecutionEnvExpanded(!isExecutionEnvExpanded)}
                      >
                        <div className="flex items-center gap-1">
                          {isExecutionEnvExpanded ? (
                            <ChevronDown className="h-3 w-3 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-gray-500" />
                          )}
                          <div className="text-gray-600 font-medium text-xs">⚙️ Execution Environment</div>
                        </div>
                        {scenario?.environment?.deterministicExecution?.notes && scenario.environment.deterministicExecution.notes.length > 0 && (
                          <div
                            className="group relative cursor-help"
                            title="Hover for determinism warnings"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-amber-600 hover:text-amber-700 text-sm">⚠️</span>
                            <div className="absolute right-0 top-6 w-80 p-3 bg-white border border-amber-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                              <div className="text-amber-700 font-medium text-xs mb-2">⚠️ Determinism Warnings:</div>
                              <ul className="list-disc list-inside space-y-1 text-xs text-amber-600 max-h-32 overflow-y-auto">
                                {scenario.environment.deterministicExecution.notes.map((note: string, index: number) => (
                                  <li key={index}>{note}</li>
                                ))}
                              </ul>
                              {scenario.environment.deterministicExecution.recommendations && (
                                <>
                                  <div className="text-green-700 font-medium text-xs mt-2 mb-1">💡 Recommendations:</div>
                                  <ul className="list-disc list-inside space-y-1 text-xs text-green-600">
                                    {scenario.environment.deterministicExecution.recommendations.slice(0, 2).map((rec: string, index: number) => (
                                      <li key={index}>{rec}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {isExecutionEnvExpanded && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div><span className="font-medium">Runtime:</span> {scenario?.environment?.runtime || (typeof window !== 'undefined' ? 'Browser' : 'Node.js')}</div>
                            <div><span className="font-medium">JS Engine:</span> {scenario?.environment?.jsEngine || (typeof window !== 'undefined' ? navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] || 'Unknown' : process?.version || 'Unknown')}</div>
                            <div><span className="font-medium">Platform:</span> {scenario?.environment?.platform || (typeof window !== 'undefined' ? navigator.platform : process?.platform || 'Unknown')}</div>
                            <div><span className="font-medium">Recorded:</span> {scenario?.environment?.recordedAt ? new Date(scenario.environment.recordedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</div>
                          </div>
                          <div className="text-xs text-gray-500 mt-2 italic">
                            💡 Global environment config shared across all ProcessNodes
                          </div>
                        </div>
                      )}
                    </div>


                    {/* Legacy Configuration (if no processing block) */}
                    {!nodeConfig.processing && nodeConfig.data && (
                      <>
                        {nodeConfig.data.transformation && (
                          <div><span className="font-medium text-slate-600">Transformation:</span> {nodeConfig.data.transformation}</div>
                        )}
                        {nodeConfig.processingTime && (
                          <div><span className="font-medium text-slate-600">Processing Time:</span> {nodeConfig.processingTime}ms</div>
                        )}
                        {nodeConfig.batchSize && (
                          <div><span className="font-medium text-slate-600">Batch Size:</span> {nodeConfig.batchSize}</div>
                        )}
                      </>
                    )}

                  </>
                )}
              </div>
            </div>

            {/* Inputs Section - Editable */}
            {(nodeConfig.type === 'ProcessNode' || nodeConfig.type === 'Queue' || nodeConfig.type === 'Sink' || nodeConfig.type === 'FSMProcessNode') && (
              <InputsOutputsEditor
                nodeConfig={nodeConfig}
                section="inputs"
                onUpdate={(updatedInputs) => {
                  if (scenario) {
                    saveSnapshot('Update node inputs');
                    const success = updateNodeConfigInStore(nodeConfig.nodeId, { ...nodeConfig, inputs: updatedInputs });
                    if (!success) {
                      toast({ variant: "destructive", title: "Update Failed", description: "Failed to update node inputs." });
                      return;
                    }
                    toast({ title: "Inputs Updated", description: "Node inputs have been updated successfully." });
                  }
                }}
              />
            )}

            {/* Outputs Section - Editable */}
            {(nodeConfig.type === 'DataSource' || nodeConfig.type === 'ProcessNode' || nodeConfig.type === 'Queue' || nodeConfig.type === 'FSMProcessNode') && (
              <InputsOutputsEditor
                nodeConfig={nodeConfig}
                section="outputs"
                onUpdate={(updatedOutputs) => {
                  if (scenario) {
                    saveSnapshot('Update node outputs');

                    let updatedNodeConfig;
                    if (nodeConfig.data?.outputs) {
                      // New structure: update data.outputs
                      updatedNodeConfig = {
                        ...nodeConfig,
                        data: {
                          ...nodeConfig.data,
                          outputs: updatedOutputs
                        }
                      };
                    } else {
                      // Old structure: update outputs array and potentially processing.formula
                      updatedNodeConfig = { ...nodeConfig, outputs: updatedOutputs };

                      // If there's an output with a formula, update processing.formula
                      if (Array.isArray(updatedOutputs)) {
                        const outputWithFormula = updatedOutputs.find(output => output.formula);
                        if (outputWithFormula) {
                          updatedNodeConfig.processing = {
                            ...nodeConfig.processing,
                            formula: outputWithFormula.formula
                          };
                        }
                      }
                    }

                    const success = updateNodeConfigInStore(nodeConfig.nodeId, updatedNodeConfig);
                    if (!success) {
                      toast({ variant: "destructive", title: "Update Failed", description: "Failed to update node outputs." });
                      return;
                    }
                    toast({ title: "Outputs Updated", description: "Node outputs have been updated successfully." });
                  }
                }}
              />
            )}

            {/* Group Node: Display aggregated inputs/outputs */}
            {nodeConfig.type === 'Group' && (
              <div className="border-t pt-4 space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">Contained Nodes</h4>
                  <div className="text-xs text-slate-600 space-y-1">
                    {nodeConfig.containedNodes?.map((nodeId: string) => (
                      <div key={nodeId} className="p-2 bg-slate-50 rounded">• {nodeId}</div>
                    )) || <div className="text-slate-400 italic">No nodes in group</div>}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">Inputs ({nodeConfig.inputs?.length || 0})</h4>
                  <div className="space-y-2">
                    {nodeConfig.inputs?.map((input: any, index: number) => (
                      <div key={index} className="border border-slate-200 rounded p-2 bg-slate-50">
                        <div className="font-medium text-sm text-slate-700">{input.name}</div>
                        <div className="text-xs text-slate-600 mt-1">
                          Interface: {input.interface?.type || 'N/A'}
                        </div>
                      </div>
                    )) || <div className="text-xs text-slate-400 italic">No inputs</div>}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">Outputs ({nodeConfig.outputs?.length || 0})</h4>
                  <div className="space-y-2">
                    {nodeConfig.outputs?.map((output: any, index: number) => (
                      <div key={index} className="border border-slate-200 rounded p-2 bg-slate-50">
                        <div className="font-medium text-sm text-slate-700">{output.name}</div>
                        <div className="text-xs text-slate-600 mt-1">
                          → {output.destinationNodeId || 'No destination'}
                        </div>
                        <div className="text-xs text-slate-600">
                          Interface: {output.interface?.type || 'N/A'}
                        </div>
                      </div>
                    )) || <div className="text-xs text-slate-400 italic">No outputs</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
