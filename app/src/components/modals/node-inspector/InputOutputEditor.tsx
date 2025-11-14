import React, { useState } from "react";
import { Plus, X, Brain, Code2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSimulationStore } from "@/stores/simulationStore";
import { CodeHighlight } from "@/components/ui/CodeHighlight";
import { CodeEditor } from "@/components/ui/CodeEditor";

interface InputOutputEditorProps {
  nodeConfig: any;
  section: 'inputs' | 'outputs';
  onUpdate: (updated: any[]) => void;
}

export const InputOutputEditor: React.FC<InputOutputEditorProps> = ({ 
  nodeConfig, 
  section, 
  onUpdate 
}) => {
  const scenario = useSimulationStore(state => state.scenario);
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedProcessing, setExpandedProcessing] = useState(new Set<number>());
  const [inlineEditingIndex, setInlineEditingIndex] = useState<number | null>(null);
  const [inlineEditData, setInlineEditData] = useState<any>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    nodeId: '',
    sourceOutputName: '',
    destinationNodeId: '',
    destinationInputName: '',
    // Interface type will be auto-determined
    required: false,
    formula: '',
    aiPrompt: '',
    environment: 'javascript', // 'javascript' | 'ai'
  });

  // Handle both old and new output structures
  // Auto-determine interface type based on node type and environment
  const getInterfaceType = (currentNodeType: string, environment: string) => {
    if (environment === 'ai') {
      return 'AIResult';
    }

    switch (currentNodeType) {
      case 'DataSource':
        return 'SimpleValue';
      case 'Queue':
        return 'AggregationResult';
      case 'ProcessNode':
      case 'FSMProcessNode':
        return 'TransformationResult';
      default:
        return 'SimpleValue';
    }
  };

  const items = section === 'outputs' && nodeConfig.data?.outputs
    ? Object.entries(nodeConfig.data.outputs).map(([name, config]: [string, any]) => ({
        name,
        destinationNodeId: config.destinationNodeId,
        destinationInputName: config.destinationInputName,
        interface: config.interface,
        formula: config.formula,
        aiPrompt: config.aiPrompt,
        environment: config.aiPrompt ? 'ai' : 'javascript',
      }))
    : (nodeConfig[section] || []).map((item: any) => ({
        ...item,
        // For old structure, if this is an output and there's a processing formula, use it
        formula: item.formula || item.transformation?.formula ||
          (section === 'outputs' && nodeConfig.processing?.formula ? nodeConfig.processing.formula : ''),
        environment: item.aiPrompt ? 'ai' : 'javascript',
        // Add processing info for outputs
        ...(section === 'outputs' && nodeConfig.processing && {
          processingType: nodeConfig.processing.type,
          processingDescription: nodeConfig.processing.description,
        }),
      }));
  const availableNodes = scenario?.nodes.filter((n: any) => n.nodeId !== nodeConfig.nodeId) || [];

  const toggleProcessing = (index: number) => {
    const newExpanded = new Set(expandedProcessing);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedProcessing(newExpanded);
  };

  const startInlineEdit = (index: number) => {
    const item = items[index];
    setInlineEditingIndex(index);
    setInlineEditData({
      name: item.name,
      destinationNodeId: item.destinationNodeId || '',
      destinationInputName: item.destinationInputName || '',
      formula: item.formula || item.transformation?.formula || '',
      aiPrompt: item.aiPrompt || '',
      environment: item.aiPrompt ? 'ai' : 'javascript',
      processingDescription: item.processingDescription || '',
    });
    // Auto-expand processing when editing
    const newExpanded = new Set(expandedProcessing);
    newExpanded.add(index);
    setExpandedProcessing(newExpanded);
  };

  const saveInlineEdit = () => {
    if (inlineEditingIndex === null) return;

    if (section === 'inputs') {
      // Handle inputs (simplified for now)
      const updated = [...items];
      updated[inlineEditingIndex] = {
        ...items[inlineEditingIndex],
        name: inlineEditData.name,
        destinationNodeId: inlineEditData.destinationNodeId,
      };
      onUpdate(updated);
    } else {
      // Handle outputs with new structure
      if (nodeConfig.data?.outputs) {
        // New structure: update data.outputs
        const currentOutputs = nodeConfig.data.outputs;
        const outputName = items[inlineEditingIndex].name;
        const updatedOutputs = {
          ...currentOutputs,
          [outputName]: {
            ...currentOutputs[outputName],
            formula: inlineEditData.environment === 'javascript' ? inlineEditData.formula : undefined,
            aiPrompt: inlineEditData.environment === 'ai' ? inlineEditData.aiPrompt : undefined,
          },
        };
        onUpdate(updatedOutputs);
      } else {
        // Old structure: update outputs array and processing.formula
        const updated = [...items];
        updated[inlineEditingIndex] = {
          ...items[inlineEditingIndex],
          formula: inlineEditData.formula,
        };
        onUpdate(updated);
      }
    }

    setInlineEditingIndex(null);
    setInlineEditData({});
  };

  const cancelInlineEdit = () => {
    setInlineEditingIndex(null);
    setInlineEditData({});
  };

  const handleAdd = () => {
    if (!formData.name.trim()) {
      return; // Name is required
    }

    if (section === 'inputs') {
      const newItem = {
        name: formData.name,
        nodeId: formData.nodeId || '',
        sourceOutputName: formData.sourceOutputName || 'output',
        interface: {
          type: 'SimpleValue', // Inputs are always simple values
          requiredFields: ['data.value'],
        },
        alias: formData.alias || undefined,
        required: formData.required,
      };
      onUpdate([...items, newItem]);
    } else {
      // For outputs, use new data.outputs structure
      const newOutputConfig = {
        destinationNodeId: formData.destinationNodeId || '',
        destinationInputName: formData.destinationInputName || 'input',
        interface: {
          type: getInterfaceType(nodeConfig.type, formData.environment),
          requiredFields: [],
        },
        ...(formData.environment === 'javascript' && formData.formula && { formula: formData.formula }),
        ...(formData.environment === 'ai' && formData.aiPrompt && { aiPrompt: formData.aiPrompt }),
      };

      // Update using new structure
      const currentOutputs = nodeConfig.data?.outputs || {};
      const updatedOutputs = {
        ...currentOutputs,
        [formData.name]: newOutputConfig,
      };

      // Call onUpdate with the outputs object for new structure
      onUpdate(updatedOutputs);
    }
    resetForm();
  };

  const handleEdit = (index: number) => {
    const item = items[index];
    if (section === 'inputs') {
      setFormData({
        ...formData,
        name: item.name,
        alias: item.alias || '',
        nodeId: item.nodeId || '',
        sourceOutputName: item.sourceOutputName || '',
        required: item.required || false,
      });
    } else {
      setFormData({
        ...formData,
        name: item.name,
        destinationNodeId: item.destinationNodeId || '',
        destinationInputName: item.destinationInputName || '',
        formula: item.formula || item.transformation?.formula || '',
        aiPrompt: item.aiPrompt || '',
        environment: item.aiPrompt ? 'ai' : 'javascript',
      });
    }
    setEditingIndex(index);
    setIsAdding(true);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !formData.name.trim()) return;

    if (section === 'inputs') {
      const updated = [...items];
      const editedItem = {
        name: formData.name,
        nodeId: formData.nodeId,
        sourceOutputName: formData.sourceOutputName,
        interface: {
          type: 'SimpleValue', // Inputs are always simple values
          requiredFields: ['data.value'],
        },
        alias: formData.alias || undefined,
        required: formData.required,
      };
      updated[editingIndex] = editedItem;
      onUpdate(updated);
    } else {
      // For outputs, update the specific output in data.outputs structure
      const currentOutputs = nodeConfig.data?.outputs || {};
      const outputName = items[editingIndex].name;
      const updatedOutputs = {
        ...currentOutputs,
        [outputName]: {
          destinationNodeId: formData.destinationNodeId || '',
          destinationInputName: formData.destinationInputName || 'input',
          interface: {
            type: getInterfaceType(nodeConfig.type, formData.environment),
            requiredFields: [],
          },
          ...(formData.environment === 'javascript' && formData.formula && { formula: formData.formula }),
          ...(formData.environment === 'ai' && formData.aiPrompt && { aiPrompt: formData.aiPrompt }),
        },
      };
      onUpdate(updatedOutputs);
    }
    resetForm();
  };

  const handleDelete = (index: number) => {
    if (section === 'inputs') {
      const updated = items.filter((_: any, i: number) => i !== index);
      onUpdate(updated);
    } else {
      // For outputs, remove from data.outputs structure
      const currentOutputs = nodeConfig.data?.outputs || {};
      const outputNameToDelete = items[index].name;
      const updatedOutputs = { ...currentOutputs };
      delete updatedOutputs[outputNameToDelete];
      onUpdate(updatedOutputs);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      alias: '',
      nodeId: '',
      sourceOutputName: '',
      destinationNodeId: '',
      destinationInputName: '',
      required: false,
      formula: '',
      aiPrompt: '',
      environment: 'javascript',
    });
    setIsAdding(false);
    setEditingIndex(null);
  };

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-slate-700">
          {section === 'inputs' ? 'Inputs' : 'Outputs'} ({items.length})
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={() => setIsAdding(!isAdding)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Existing Items */}
      <div className="space-y-2 mb-3">
        {items.map((item: any, index: number) => (
          <div key={index} className="border border-slate-200 rounded p-2 bg-slate-50 group relative">
            <button
              onClick={() => handleDelete(index)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              title="Remove"
            >
              <X className="h-2.5 w-2.5" />
            </button>

            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm text-slate-700">{item.name}</span>
              {inlineEditingIndex === index ? (
                <div className="flex gap-1 opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs bg-green-50 text-green-700 hover:bg-green-100"
                    onClick={saveInlineEdit}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs bg-gray-50 text-gray-700 hover:bg-gray-100"
                    onClick={cancelInlineEdit}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-xs opacity-0 group-hover:opacity-100"
                  onClick={() => startInlineEdit(index)}
                >
                  Edit
                </Button>
              )}
            </div>

            <div className="text-xs text-slate-600 space-y-0.5">
              {section === 'inputs' ? (
                <>
                  {item.nodeId && <div>Source: {item.nodeId}</div>}
                  {item.alias && <div>Alias: {item.alias}</div>}
                </>
              ) : (
                <>
                  {item.destinationNodeId && <div>→ {item.destinationNodeId}</div>}

                  {/* Processing Info for this output - Collapsible */}
                  {item.processingType && (
                    <div className="mt-1 bg-gray-50 border border-gray-200 rounded-sm">
                      <div
                        className="p-2 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleProcessing(index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {expandedProcessing.has(index) ? (
                              <ChevronDown className="h-3 w-3 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-gray-500" />
                            )}
                            <Code2 className="h-3 w-3 text-gray-600" />
                            <span className="text-[10px] font-medium text-gray-700">
                              Processing: {item.processingType}
                            </span>
                          </div>
                        </div>
                      </div>

                      {expandedProcessing.has(index) && (
                        <div className="px-2 pb-2 border-t border-gray-200 pt-2">
                          {item.processingDescription && (
                            <div className="text-[10px] text-gray-600 mb-2">{item.processingDescription}</div>
                          )}

                          {/* Environment Selection when editing */}
                          {inlineEditingIndex === index && (
                            <div className="mb-2">
                              <div className="text-[10px] font-medium text-gray-700 mb-1">Processing Environment:</div>
                              <select
                                value={inlineEditData.environment || 'javascript'}
                                onChange={(e) => setInlineEditData({ ...inlineEditData, environment: e.target.value })}
                                className="w-full h-6 text-[10px] border rounded px-1 bg-white"
                              >
                                <option value="javascript">JavaScript Formula</option>
                                <option value="ai">AI Prompt</option>
                              </select>
                            </div>
                          )}

                          {/* Formula Display/Edit */}
                          {(item.formula || inlineEditingIndex === index) && (
                            <div>
                              <div className="text-[10px] font-medium text-gray-700 mb-1">
                                {inlineEditingIndex === index && inlineEditData.environment === 'javascript'
                                  ? 'JavaScript Formula:'
                                  : inlineEditingIndex === index && inlineEditData.environment === 'ai'
                                  ? 'AI Prompt:'
                                  : 'JavaScript Formula:'}
                              </div>

                              {inlineEditingIndex === index ? (
                                <div className="space-y-1">
                                  {/* Available Inputs Hint */}
                                  {inlineEditData.environment === 'javascript' && nodeConfig.inputs && nodeConfig.inputs.length > 0 && (
                                    <div className="text-[10px] p-1 bg-blue-50 border border-blue-200 rounded">
                                      <span className="font-medium text-blue-700">Available inputs:</span>{' '}
                                      <span className="text-blue-600 font-mono">
                                        {nodeConfig.inputs.map((input: any, idx: number) => (
                                          <span key={idx}>
                                            {input.alias || input.name}
                                            {idx < nodeConfig.inputs.length - 1 ? ', ' : ''}
                                          </span>
                                        ))}
                                      </span>
                                    </div>
                                  )}

                                  {/* Editable Formula/Prompt with Syntax Highlighting */}
                                  {inlineEditData.environment === 'javascript' ? (
                                    <CodeEditor
                                      value={inlineEditData.formula || ''}
                                      onChange={(value) => setInlineEditData({
                                        ...inlineEditData,
                                        formula: value
                                      })}
                                      placeholder="return energyData.value * 0.4; // Use available inputs above"
                                      language="javascript"
                                      className="w-full"
                                    />
                                  ) : (
                                    <textarea
                                      value={inlineEditData.aiPrompt || ''}
                                      onChange={(e) => setInlineEditData({
                                        ...inlineEditData,
                                        aiPrompt: e.target.value
                                      })}
                                      placeholder="Describe what the AI should do with the input data..."
                                      className="w-full h-16 text-[10px] border rounded px-2 py-1 resize-none"
                                    />
                                  )}
                                </div>
                              ) : (
                                // Read-only view with syntax highlighting
                                item.formula.length > 80 ? (
                                  <div className="bg-white p-2 rounded text-[10px] max-h-16 overflow-y-auto border">
                                    <CodeHighlight
                                      code={item.formula}
                                      language="javascript"
                                      className="text-[10px] bg-transparent p-0 border-0"
                                    />
                                  </div>
                                ) : (
                                  <div className="bg-white px-2 py-1 rounded border">
                                    <CodeHighlight
                                      code={item.formula}
                                      language="javascript"
                                      className="text-[10px] bg-transparent p-0 border-0"
                                    />
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fallback: Show formula without processing info (for new structure) */}
                  {!item.processingType && item.formula && (
                    <div className="mt-1">
                      <div className="flex items-center gap-1 mb-1">
                        <Code2 className="h-3 w-3 text-blue-500" />
                        <span className="text-[10px] text-blue-600 font-medium">JavaScript Formula</span>
                      </div>
                      {item.formula.length > 80 ? (
                        <div className="bg-gray-50 p-2 rounded text-[10px] max-h-16 overflow-y-auto">
                          <CodeHighlight
                            code={item.formula}
                            language="javascript"
                            className="text-[10px] bg-transparent p-0 border-0"
                          />
                        </div>
                      ) : (
                        <div className="font-mono text-[10px] text-gray-700 bg-gray-50 px-2 py-1 rounded">
                          {item.formula}
                        </div>
                      )}
                    </div>
                  )}
                  {item.transformation?.formula && (
                    <div className="mt-1">
                      <div className="flex items-center gap-1 mb-1">
                        <Code2 className="h-3 w-3 text-blue-500" />
                        <span className="text-[10px] text-blue-600 font-medium">JavaScript Formula</span>
                      </div>
                      {item.transformation.formula.length > 80 ? (
                        <div className="bg-gray-50 p-2 rounded text-[10px] max-h-16 overflow-y-auto">
                          <CodeHighlight
                            code={item.transformation.formula}
                            language="javascript"
                            className="text-[10px] bg-transparent p-0 border-0"
                          />
                        </div>
                      ) : (
                        <div className="font-mono text-[10px] text-gray-700 bg-gray-50 px-2 py-1 rounded">
                          {item.transformation.formula}
                        </div>
                      )}
                    </div>
                  )}
                  {item.aiPrompt && (
                    <div className="flex items-center gap-1">
                      <Brain className="h-3 w-3 text-purple-500" />
                      <div className="text-[10px] truncate text-purple-600">{item.aiPrompt}</div>
                    </div>
                  )}
                </>
              )}
              <div>Interface: {item.interface?.type}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <div className="border border-blue-200 rounded p-3 bg-blue-50 space-y-2">
          <Input
            placeholder="Name (required)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="h-7 text-xs"
            autoFocus
          />

          {section === 'inputs' ? (
            <>
              <select
                value={formData.nodeId}
                onChange={(e) => setFormData({ ...formData, nodeId: e.target.value })}
                className="w-full h-7 text-xs border rounded px-2 bg-white"
              >
                <option value="">Select Source Node (optional)</option>
                {availableNodes.map((node: any) => (
                  <option key={node.nodeId} value={node.nodeId}>{node.displayName}</option>
                ))}
              </select>

              <Input
                placeholder="Alias (optional)"
                value={formData.alias}
                onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                className="h-7 text-xs"
              />
            </>
          ) : (
            <>
              <select
                value={formData.destinationNodeId}
                onChange={(e) => setFormData({ ...formData, destinationNodeId: e.target.value })}
                className="w-full h-7 text-xs border rounded px-2 bg-white"
              >
                <option value="">No destination (optional)</option>
                {availableNodes.map((node: any) => (
                  <option key={node.nodeId} value={node.nodeId}>{node.displayName}</option>
                ))}
              </select>

              {/* Environment Selector */}
              <div className="border-t pt-2 mt-2">
                <div className="mb-2">
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Processing Environment</label>
                  <select
                    value={formData.environment}
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value as 'javascript' | 'ai' })}
                    className="w-full h-7 text-xs border rounded px-2 bg-white"
                  >
                    <option value="javascript">JavaScript Formula</option>
                    <option value="ai">AI Prompt</option>
                  </select>
                </div>

                {formData.environment === 'javascript' ? (
                  <div>
                    {/* Show available input variables */}
                    {nodeConfig.inputs && nodeConfig.inputs.length > 0 && (
                      <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                        <div className="font-medium text-blue-700 mb-1">Available inputs:</div>
                        <div className="text-blue-600 font-mono">
                          {nodeConfig.inputs.map((input: any, idx: number) => (
                            <span key={idx}>
                              {input.alias || input.name}
                              {idx < nodeConfig.inputs.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <Input
                      placeholder="return energyData.value * 0.4; // Use available inputs above"
                      value={formData.formula}
                      onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
                      <div className="font-medium text-purple-700 mb-1">💡 Example AI prompt:</div>
                      <div className="text-purple-600 italic">
                        "Analyze the energy data and calculate carbon credits based on renewable energy usage"
                      </div>
                    </div>
                    <Input
                      placeholder="Describe what the AI should do with the input data..."
                      value={formData.aiPrompt}
                      onChange={(e) => setFormData({ ...formData, aiPrompt: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-6 text-xs"
              onClick={editingIndex !== null ? handleSaveEdit : handleAdd}
              disabled={!formData.name.trim()}
            >
              {editingIndex !== null ? 'Save' : 'Add'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={resetForm}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
