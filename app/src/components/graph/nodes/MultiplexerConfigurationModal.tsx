"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GitBranch,
  Plus,
  Trash2,
  Target,
  ArrowRight,
  Code,
  Play,
  Save,
  TestTube,
  CheckCircle,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StateMultiplexerNode } from "@/lib/simulation/types";
import { useSimulationStore } from "@/stores/simulationStore";
import { StateMultiplexer, StateContext } from "@/lib/fsm/StateMultiplexer";

interface MultiplexerConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  currentConfig: StateMultiplexerNode;
}

const MultiplexerConfigurationModal: React.FC<MultiplexerConfigurationModalProps> = ({
  isOpen,
  onClose,
  nodeId,
  currentConfig
}) => {
  const updateNodeConfigInStore = useSimulationStore(state => state.updateNodeConfigInStore);

  // Visual editor state
  const [routes, setRoutes] = useState(currentConfig.routes || []);
  const [outputs, setOutputs] = useState(currentConfig.outputs || []);
  const [defaultOutput, setDefaultOutput] = useState(currentConfig.defaultOutput || "");
  const [newOutputName, setNewOutputName] = useState("");

  // JSON editor state
  const [jsonConfig, setJsonConfig] = useState("");
  const [jsonError, setJsonError] = useState("");

  // Test state
  const [testInput, setTestInput] = useState(JSON.stringify({
    data: {
      currentState: "processing",
      context: { value: 42 }
    }
  }, null, 2));
  const [testResults, setTestResults] = useState<any>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setRoutes(currentConfig.routes || []);
      setOutputs(currentConfig.outputs || []);
      setDefaultOutput(currentConfig.defaultOutput || "");
      setJsonConfig(JSON.stringify(currentConfig, null, 2));
      setJsonError("");
      setTestResults(null);
    }
  }, [isOpen, currentConfig]);

  const addOutput = () => {
    if (newOutputName.trim() && !outputs.some(o => o.name === newOutputName.trim())) {
      const newOutput = {
        name: newOutputName.trim(),
        destinationNodeId: "",
        destinationInputName: "input",
        interface: { type: "Any", requiredFields: [] }
      };
      setOutputs([...outputs, newOutput]);
      setNewOutputName("");
    }
  };

  const removeOutput = (outputName: string) => {
    setOutputs(outputs.filter(o => o.name !== outputName));
    // Remove routes that reference this output
    setRoutes(routes.filter(r => r.outputName !== outputName));
  };

  const addRoute = () => {
    if (outputs.length > 0) {
      const newRoute = {
        condition: "input.data.currentState === 'processing'",
        outputName: outputs[0].name,
        action: {
          type: "emit",
          data: "input.data.context"
        }
      };
      setRoutes([...routes, newRoute]);
    }
  };

  const updateRoute = (index: number, field: string, value: any) => {
    const newRoutes = [...routes];
    if (field === 'action.type' || field === 'action.data') {
      const actionField = field.split('.')[1];
      newRoutes[index] = {
        ...newRoutes[index],
        action: {
          ...newRoutes[index].action,
          [actionField]: value
        }
      };
    } else {
      newRoutes[index] = { ...newRoutes[index], [field]: value };
    }
    setRoutes(newRoutes);
  };

  const removeRoute = (index: number) => {
    setRoutes(routes.filter((_, i) => i !== index));
  };

  const testConfiguration = () => {
    try {
      const inputData = JSON.parse(testInput);

      // Create a mock StateContext from input
      const mockContext: StateContext = {
        currentState: inputData.data?.currentState || 'unknown',
        previousState: inputData.data?.previousState,
        variables: inputData.data?.variables || {},
        context: inputData.data?.context || inputData,
        timestamp: new Date().toISOString()
      };

      // Create multiplexer with current config
      const multiplexer = new StateMultiplexer(nodeId, {
        routes,
        defaultOutput
      });

      const result = multiplexer.processStateContext(mockContext);
      setTestResults(result);
    } catch (error) {
      setTestResults({
        error: error instanceof Error ? error.message : 'Test failed',
        outputs: [],
        matchedRoutes: []
      });
    }
  };

  const updateFromJSON = () => {
    try {
      const parsed = JSON.parse(jsonConfig);

      // Validate basic structure
      if (!parsed.routes || !Array.isArray(parsed.routes)) {
        throw new Error("Config must have 'routes' array");
      }
      if (!parsed.outputs || !Array.isArray(parsed.outputs)) {
        throw new Error("Config must have 'outputs' array");
      }

      setRoutes(parsed.routes);
      setOutputs(parsed.outputs);
      setDefaultOutput(parsed.defaultOutput || "");
      setJsonError("");
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const syncToJSON = () => {
    const config = {
      ...currentConfig,
      routes,
      outputs,
      defaultOutput: defaultOutput || undefined
    };
    setJsonConfig(JSON.stringify(config, null, 2));
  };

  const handleSave = () => {
    const updatedConfig = {
      ...currentConfig,
      routes,
      outputs,
      defaultOutput: defaultOutput || undefined
    };

    const success = updateNodeConfigInStore(nodeId, updatedConfig);
    if (success) {
      console.log("Multiplexer configuration saved successfully");
      onClose();
    } else {
      console.error("Failed to save Multiplexer configuration");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Configure Multiplexer: {currentConfig.displayName}
          </DialogTitle>
          <DialogDescription>
            Configure routing conditions and outputs for the Multiplexer node.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="visual" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="visual" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Visual Editor
              </TabsTrigger>
              <TabsTrigger value="json" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                JSON Editor
              </TabsTrigger>
              <TabsTrigger value="test" className="flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Test Routes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visual" className="flex-1 overflow-hidden">
              <div className="grid grid-cols-2 gap-4 h-full">
                {/* Outputs Panel */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Outputs ({outputs.length})</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        placeholder="Output name"
                        value={newOutputName}
                        onChange={(e) => setNewOutputName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addOutput()}
                      />
                      <Button onClick={addOutput} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-32 border rounded p-2">
                    <div className="space-y-2">
                      {outputs.map((output, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <Badge variant="outline" className="text-xs">
                            {output.name}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeOutput(output.name)}
                            className="h-6 px-2"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Default Output */}
                  <div>
                    <Label className="text-sm font-medium">Default Output (optional)</Label>
                    <select
                      value={defaultOutput}
                      onChange={(e) => setDefaultOutput(e.target.value)}
                      className="w-full mt-1 border rounded px-2 py-1 text-sm"
                    >
                      <option value="">None</option>
                      {outputs.map(output => (
                        <option key={output.name} value={output.name}>{output.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Routes Panel */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Routes ({routes.length})</Label>
                    <Button onClick={addRoute} size="sm" disabled={outputs.length === 0}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Route
                    </Button>
                  </div>

                  <ScrollArea className="h-80 border rounded p-2">
                    <div className="space-y-3">
                      {routes.map((route, index) => (
                        <div key={index} className="p-3 border rounded space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-600">Route #{index + 1}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeRoute(index)}
                              className="h-6 px-2"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs">Condition</Label>
                              <Input
                                placeholder="e.g., input.data.currentState === 'processing'"
                                value={route.condition}
                                onChange={(e) => updateRoute(index, 'condition', e.target.value)}
                                className="text-xs font-mono"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Output</Label>
                                <select
                                  value={route.outputName}
                                  onChange={(e) => updateRoute(index, 'outputName', e.target.value)}
                                  className="w-full border rounded px-2 py-1 text-xs"
                                >
                                  {outputs.map(output => (
                                    <option key={output.name} value={output.name}>{output.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <Label className="text-xs">Action Type</Label>
                                <select
                                  value={route.action.type}
                                  onChange={(e) => updateRoute(index, 'action.type', e.target.value)}
                                  className="w-full border rounded px-2 py-1 text-xs"
                                >
                                  <option value="emit">Emit</option>
                                  <option value="log">Log</option>
                                  <option value="custom">Custom</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs">Action Data</Label>
                              <Input
                                placeholder="e.g., input.data.context"
                                value={route.action.data}
                                onChange={(e) => updateRoute(index, 'action.data', e.target.value)}
                                className="text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {routes.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                          No routes configured. Add an output first, then create routes.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="json" className="flex-1 overflow-hidden">
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">JSON Configuration</Label>
                  <div className="space-x-2">
                    <Button onClick={syncToJSON} variant="outline" size="sm">
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Sync from Visual
                    </Button>
                    <Button onClick={updateFromJSON} variant="outline" size="sm">
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Apply JSON
                    </Button>
                  </div>
                </div>

                {jsonError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {jsonError}
                  </div>
                )}

                <Textarea
                  value={jsonConfig}
                  onChange={(e) => setJsonConfig(e.target.value)}
                  placeholder="Enter JSON configuration here..."
                  className="font-mono text-sm flex-1 min-h-96"
                />
              </div>
            </TabsContent>

            <TabsContent value="test" className="flex-1 overflow-hidden">
              <div className="grid grid-cols-2 gap-4 h-full">
                {/* Test Input */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Test Input</Label>
                    <p className="text-xs text-slate-600">Enter sample input data to test routes</p>
                  </div>

                  <Textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Enter test input JSON..."
                    className="font-mono text-sm h-64"
                  />

                  <Button onClick={testConfiguration} className="w-full">
                    <Play className="h-4 w-4 mr-1" />
                    Test Routes
                  </Button>
                </div>

                {/* Test Results */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Test Results</Label>

                  {testResults && (
                    <ScrollArea className="h-80 border rounded p-3">
                      {testResults.error ? (
                        <div className="text-red-600 text-sm">
                          <XCircle className="h-4 w-4 inline mr-1" />
                          Error: {testResults.error}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-medium text-green-600 flex items-center gap-1">
                              <CheckCircle className="h-4 w-4" />
                              Routes Matched: {testResults.matchedRoutes.length}
                            </h4>
                          </div>

                          {testResults.matchedRoutes.map((route: any, index: number) => (
                            <div key={index} className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                              <div className="font-mono text-green-700">
                                {route.condition} → {route.outputName}
                              </div>
                            </div>
                          ))}

                          <div>
                            <h4 className="text-sm font-medium text-blue-600">
                              Outputs Generated: {testResults.outputs.length}
                            </h4>
                          </div>

                          {testResults.outputs.map((output: any, index: number) => (
                            <div key={index} className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                              <div className="font-medium">{output.outputName}</div>
                              <div className="font-mono text-blue-700 text-xs">
                                {typeof output.data === 'object'
                                  ? JSON.stringify(output.data, null, 2)
                                  : String(output.data)
                                }
                              </div>
                            </div>
                          ))}

                          {testResults.outputs.length === 0 && (
                            <div className="text-slate-500 text-sm italic">
                              No outputs generated. Check your conditions.
                            </div>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                  )}

                  {!testResults && (
                    <div className="h-80 border rounded p-3 flex items-center justify-center text-slate-400 text-sm">
                      Click "Test Routes" to see results
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MultiplexerConfigurationModal;