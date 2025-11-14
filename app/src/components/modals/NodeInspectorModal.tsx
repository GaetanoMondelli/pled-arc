"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Code, Settings, Eye, EyeOff } from "lucide-react";
import NodeStateMachineDiagram from "@/components/ui/node-state-machine-diagram";
import { useToast } from "@/hooks/use-toast";
import {
  useNodeInspectorStore,
  useNodeConfigEditor,
  useNodeTagsEditor,
  useNodeStateActions,
  useNodeInspectorUIState,
} from "./hooks";
import { useTemplateEditor } from "@/app/template-editor/hooks/useTemplateEditor";
import {
  MessageInterfaceDisplay,
  InterfacesSummary,
  InterfaceValidation,
  NodeConfigEditor,
  NodeStateDisplay,
  ActivityLogEnhanced,
  NodeTagsEditor,
  StateActionsEditor,
  JsonViewer,
  InputOutputEditor,
} from "./node-inspector";

interface NodeInspectorModalProps {
  engine?: any; // Core engine instance
  templateId?: string; // For server-side API calls
  executionId?: string; // For server-side API calls
  currentStep?: number; // Current simulation step
}

const NodeInspectorModal: React.FC<NodeInspectorModalProps> = ({
  engine,
  templateId,
  executionId,
  currentStep
}) => {
  // Custom hooks
  const store = useNodeInspectorStore();
  const { toast } = useToast();
  const editor = useTemplateEditor();

  // Use passed engine or fall back to editor engine
  const activeEngine = engine || editor.engine;

  // Debug logging for engine status
  React.useEffect(() => {
    console.log('🔍 [NODE INSPECTOR] Engine state:', {
      hasPassedEngine: !!engine,
      hasEditorEngine: !!editor.engine,
      hasActiveEngine: !!activeEngine,
      isRunning: editor.isRunning,
      tick: editor.tick,
      scenario: !!editor.scenario
    });
  }, [engine, editor.engine, activeEngine, editor.isRunning, editor.tick]);

  const configEditor = useNodeConfigEditor({
    nodeConfig: store.selectedNodeId ? store.nodesConfig[store.selectedNodeId] : null,
    selectedNodeId: store.selectedNodeId,
    scenario: store.scenario,
    updateNodeConfigInStore: store.updateNodeConfigInStore,
    toast,
  });

  const tagsEditor = useNodeTagsEditor({
    selectedNodeId: store.selectedNodeId,
    nodesConfig: store.nodesConfig,
    updateNodeConfigInStore: store.updateNodeConfigInStore,
    toast,
  });

  const stateActionsEditor = useNodeStateActions({
    selectedNodeId: store.selectedNodeId,
    scenario: store.scenario,
    nodeConfig: store.selectedNodeId ? store.nodesConfig[store.selectedNodeId] : null,
    nodesConfig: store.nodesConfig,
    updateNodeConfigInStore: store.updateNodeConfigInStore,
    toast,
  });

  const uiState = useNodeInspectorUIState({
    selectedNodeId: store.selectedNodeId,
    nodesConfig: store.nodesConfig,
    nodeStates: store.nodeStates,
    nodeActivityLogs: store.nodeActivityLogs,
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      store.setSelectedNodeId(null);
      configEditor.setEditedConfigText("");
    }
  };

  if (!uiState.isOpen || !uiState.nodeConfig) {
    return null;
  }

  return (
    <Dialog open={uiState.isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="font-headline">Node Inspector: {uiState.nodeConfig.displayName}</DialogTitle>
          <DialogDescription>
            ID: {uiState.nodeConfig.nodeId} | Type: {uiState.nodeConfig.type}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto py-4 pr-3">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className={`grid w-full ${uiState.nodeConfig.type === 'FSMProcessNode' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {uiState.nodeConfig.type === 'FSMProcessNode' && (
                <TabsTrigger value="fsm">FSM</TabsTrigger>
              )}
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-4">
              {/* Full-width Configuration */}
              <NodeConfigEditor
                nodeConfig={uiState.nodeConfig}
                showJson={configEditor.showConfigJson}
                onToggleJson={() => configEditor.setShowConfigJson(!configEditor.showConfigJson)}
                editedConfigText={configEditor.editedConfigText}
                onConfigTextChange={configEditor.setEditedConfigText}
                onSaveConfig={configEditor.handleSaveConfig}
                hasUnsavedChanges={configEditor.hasUnsavedChanges}
                onResetConfig={configEditor.handleResetConfig}
                scenario={store.scenario}
                saveSnapshot={store.saveSnapshot}
                loadScenario={store.loadScenario}
                toast={toast}
                updateNodeConfigInStore={store.updateNodeConfigInStore}
                InputsOutputsEditor={InputOutputEditor}
              />

              {/* Tags Section - full width below the grid */}
              <div className="mt-6">
                <NodeTagsEditor
                  nodeConfig={uiState.nodeConfig}
                  onTagsUpdate={tagsEditor.handleTagsUpdate}
                />
              </div>


              {/* Interface Validation Section - if available */}
              <div className="mt-6">
                <InterfaceValidation nodeConfig={uiState.nodeConfig} />
              </div>
            </TabsContent>

            {/* FSM Tab - only for FSMProcessNode */}
            {uiState.nodeConfig.type === 'FSMProcessNode' && (
              <TabsContent value="fsm" className="mt-4">
                <div className="space-y-4">
                  {/* FSL/JSON Configuration */}
                  <div>
                    <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      {uiState.nodeConfig.fsl ? 'FSL Definition' : 'FSM Configuration (JSON)'}
                    </h3>
                    <div className="bg-slate-50 border rounded-lg p-3">
                      {uiState.nodeConfig.fsl ? (
                        <pre className="text-sm font-mono whitespace-pre-wrap text-slate-800">
                          {uiState.nodeConfig.fsl}
                        </pre>
                      ) : (
                        <pre className="text-xs font-mono whitespace-pre-wrap text-slate-800 max-h-64 overflow-y-auto">
                          {JSON.stringify(uiState.nodeConfig.fsm, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* FSM Summary */}
                  <div>
                    <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      FSM Summary
                    </h3>

                    {/* Quick Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <div className="font-semibold text-blue-700">{uiState.nodeConfig.fsm?.states?.length || 0}</div>
                        <div className="text-xs text-blue-600">States</div>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="font-semibold text-green-700">{uiState.nodeConfig.fsm?.transitions?.length || 0}</div>
                        <div className="text-xs text-green-600">Transitions</div>
                      </div>
                      <div className="text-center p-2 bg-purple-50 rounded">
                        <div className="font-semibold text-purple-700">{uiState.nodeConfig.fsm?.initialState || 'None'}</div>
                        <div className="text-xs text-purple-600">Initial State</div>
                      </div>
                    </div>

                    {/* States List - Compact Badges */}
                    <div className="mb-4">
                      <h4 className="font-medium text-sm mb-2">States</h4>
                      <div className="flex flex-wrap gap-2">
                        {uiState.nodeConfig.fsm?.states?.map((state: any, index: number) => {
                          const stateName = typeof state === 'string' ? state : state.name;
                          const isInitial = stateName === uiState.nodeConfig.fsm?.initialState;

                          return (
                            <Badge
                              key={index}
                              variant={isInitial ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {stateName}
                              {isInitial && ' (initial)'}
                            </Badge>
                          );
                        }) || <div className="text-sm text-slate-500">No states defined</div>}
                      </div>
                    </div>

                    {/* Transitions - Compact */}
                    <div className="mb-4">
                      <h4 className="font-medium text-sm mb-2">Transitions</h4>
                      <div className="space-y-1">
                        {uiState.nodeConfig.fsm?.transitions?.map((transition: any, index: number) => (
                          <div key={index} className="text-xs bg-slate-50 rounded p-1.5 flex items-center justify-between">
                            <span className="font-mono text-slate-700">
                              {transition.from} → {transition.to}
                            </span>
                            <span className="text-slate-500 text-xs">
                              {transition.trigger}
                              {transition.condition && ` (when: ${transition.condition})`}
                            </span>
                          </div>
                        )) || <div className="text-sm text-slate-500 italic">No transitions defined</div>}
                      </div>
                    </div>

                    {/* Note about detailed view */}
                    <div className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded">
                      💡 See the JSON configuration above for complete details including state actions, formulas, and variables.
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}

            <TabsContent value="activity" className="mt-4">
              <div className="flex flex-col space-y-3">
                {/* State Machine - prominent for FSM nodes, toggleable for others */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {uiState.nodeConfig.type === 'FSMProcessNode' ? (
                        <h3 className="font-semibold text-primary">State Machine Behavior</h3>
                      ) : (
                        <>
                          <h3 className="font-semibold text-primary">Activity Log</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-6 px-2"
                            onClick={() => uiState.setShowStateMachine(!uiState.showStateMachine)}
                          >
                            {uiState.showStateMachine ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                            State Machine
                          </Button>
                        </>
                      )}
                    </div>
                    {uiState.selectedEventState && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => uiState.setSelectedEventState(null)}
                      >
                        Clear Selection
                      </Button>
                    )}
                  </div>

                  {/* State Machine - always visible for FSM nodes, toggleable for others */}
                  {(uiState.nodeConfig.type === 'FSMProcessNode' || uiState.showStateMachine) && (
                    <div className="flex justify-center bg-muted/20 border rounded-lg p-2 mb-3">
                      <NodeStateMachineDiagram
                        nodeConfig={uiState.nodeConfig}
                        stateMachineInfo={(uiState.nodeState as any)?.stateMachine}
                        width={600}
                        height={uiState.nodeConfig.type === 'FSMProcessNode' ? 300 : 200}
                        overrideActiveState={uiState.selectedEventState}
                        showVariables={true}
                        activityLogs={uiState.logs}
                        selectedLogEntry={uiState.selectedLogEntry}
                      />
                    </div>
                  )}
                </div>

                {/* Runtime State - only for FSM nodes */}
                {uiState.nodeConfig.type === 'FSMProcessNode' && (
                  <div className="bg-slate-50 p-3 rounded-md">
                    <NodeStateDisplay
                      nodeState={uiState.nodeState}
                      showJson={uiState.showStateJson}
                      onToggleJson={() => uiState.setShowStateJson(!uiState.showStateJson)}
                    />
                  </div>
                )}

                {/* Activity Log */}
                <div className="flex flex-col">
                  <ActivityLogEnhanced
                    nodeId={store.selectedNodeId}
                    stateMachineInfo={(uiState.nodeState as any)?.stateMachine}
                    engine={activeEngine}
                    templateId={templateId}
                    executionId={executionId}
                    currentStep={currentStep}
                    onEventClick={(event, stateAtTime) => {
                      // Handle event click to show state at that time
                      console.log('Event clicked:', event, 'State at time:', stateAtTime);
                      uiState.setSelectedEventState(stateAtTime as any ?? null);
                      uiState.setSelectedLogEntry(event);
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="pt-4 border-t border-border mt-auto flex-shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NodeInspectorModal;
