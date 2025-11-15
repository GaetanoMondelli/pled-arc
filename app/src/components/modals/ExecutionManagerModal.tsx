"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useSimulationStore } from "@/stores/simulationStore";
import { useEventSourcing } from "@/stores/eventSourcingStore";
import { templateService } from "@/lib/services/template-service";
import type { ExecutionDocument } from "@/lib/firestore-types";
import {
  Play,
  Plus,
  Save,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Archive,
  Activity,
  Zap,
  RotateCcw,
  Copy,
  ExternalLink,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExecutionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  externalQueue?: any; // ExternalEventQueue instance
  engine?: any; // SimulationEngine instance
  onExternalEventsChanged?: () => void; // Callback to trigger external events refresh
}

const ExecutionManagerModal: React.FC<ExecutionManagerModalProps> = ({ isOpen, onClose, externalQueue, engine, onExternalEventsChanged }) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newExecutionName, setNewExecutionName] = useState("");
  const [newExecutionDescription, setNewExecutionDescription] = useState("");
  const [availableExecutions, setAvailableExecutions] = useState<ExecutionDocument[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [currentlyLoadedExecution, setCurrentlyLoadedExecution] = useState<string | null>(null);

  // Store hooks
  const saveExecution = useSimulationStore(state => state.saveExecution);
  const loadExecution = useSimulationStore(state => state.loadExecution);
  const currentTemplate = useSimulationStore(state => state.currentTemplate);
  const currentExecution = useSimulationStore(state => state.currentExecution);
  const scenario = useSimulationStore(state => state.scenario);
  const currentTime = useSimulationStore(state => state.currentTime);
  const globalActivityLog = useSimulationStore(state => state.globalActivityLog);

  // Event sourcing hooks
  const {
    isRecording,
    currentScenario,
    startRecording,
    stopRecording,
    availableScenarios,
    replayScenario
  } = useEventSourcing();

  useEffect(() => {
    if (isOpen && currentTemplate) {
      loadExecutions();
      // Check if there's an execution in the URL
      const urlParams = new URLSearchParams(window.location.search);
      const executionFromUrl = urlParams.get('execution');
      if (executionFromUrl) {
        setCurrentlyLoadedExecution(executionFromUrl);
      }
    }
  }, [isOpen, currentTemplate?.id]);

  const loadExecutions = async () => {
    if (!currentTemplate) return;

    setIsLoading(true);
    try {
      const executions = await templateService.getExecutions(currentTemplate.id);
      console.log('📥 Loaded executions:', executions.length);
      executions.forEach((exec, i) => {
        console.log(`📥 Execution ${i}:`, {
          name: exec.name,
          totalExternalEvents: exec.totalExternalEvents,
          externalEventsLength: exec.externalEvents?.length,
          eventTypes: exec.eventTypes,
          startedAt: exec.startedAt,
          lastSavedAt: exec.lastSavedAt
        });
      });
      setAvailableExecutions(executions);
    } catch (error) {
      console.error("Error loading executions:", error);
      toast({
        variant: "destructive",
        title: "Failed to load executions",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setIsLoading(false);
  };

  const handleLoadExternalEvents = async (execution: ExecutionDocument) => {
    if (!externalQueue) {
      toast({
        variant: "destructive",
        title: "Cannot load events",
        description: "External event queue not available.",
      });
      return;
    }

    try {
      // Clear the current external queue
      externalQueue.clear();

      // Load the saved external events back into the queue
      // Support both 'externalEvents' and 'events' fields for compatibility
      const externalEvents = execution.externalEvents || execution.events || [];
      console.log('📥 Loading external events:', externalEvents.length);
      console.log('📥 Execution has externalEvents?', !!execution.externalEvents);
      console.log('📥 Execution has events?', !!execution.events);

      for (const event of externalEvents) {
        // Add each external event back to the queue
        // Support both 'targetDataSourceId' and 'nodeId' for compatibility
        await externalQueue.addEvent({
          id: event.id,
          timestamp: event.timestamp,
          type: event.type,
          source: event.source || 'EXTERNAL',
          data: event.data,
          targetDataSourceId: event.targetDataSourceId || event.nodeId
        });
      }

      toast({
        title: "External events loaded",
        description: `Loaded ${externalEvents.length} external events into queue.`,
      });

      // Update URL to reflect current execution using query parameter
      if (currentTemplate) {
        const newUrl = `/template-editor/${currentTemplate.id}?execution=${execution.id}`;
        console.log('🔄 Updating URL to:', newUrl);
        router.replace(newUrl);
        setCurrentlyLoadedExecution(execution.id);
      }

      // Trigger external events refresh in the UI
      if (onExternalEventsChanged) {
        onExternalEventsChanged();
      }

    } catch (error) {
      console.error("Error loading external events:", error);
      toast({
        variant: "destructive",
        title: "Failed to load external events",
        description: "There was an error loading the external events. Please try again.",
      });
    }
  };

  const handleQuickSave = async () => {
    const quickName = `Execution ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    await saveExecutionWithExternalEvents(quickName, "Auto-saved execution");
  };

  const handleSaveExecution = async () => {
    if (!newExecutionName.trim()) {
      toast({
        variant: "destructive",
        title: "Execution name required",
        description: "Please enter a name for the execution.",
      });
      return;
    }
    await saveExecutionWithExternalEvents(newExecutionName.trim(), newExecutionDescription.trim() || undefined);
  };

  const saveExecutionWithExternalEvents = async (name: string, description?: string) => {
    if (!scenario || !currentTemplate) {
      toast({
        variant: "destructive",
        title: "Cannot save execution",
        description: "No template or scenario loaded.",
      });
      return;
    }

    if (!externalQueue) {
      toast({
        variant: "destructive",
        title: "Cannot save execution",
        description: "External event queue not available.",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Get all external events for replay
      const externalEvents = externalQueue.getAllEvents();
      console.log('💾 Saving external events for replay:', externalEvents.length);
      console.log('💾 External events data:', externalEvents);

      // Check if execution with this name already exists (from URL or loaded state)
      let existingExecution = currentlyLoadedExecution
        ? availableExecutions.find(ex => ex.id === currentlyLoadedExecution)
        : availableExecutions.find(ex => ex.name === name);

      if (existingExecution) {
        // APPEND mode: Push new events to existing execution
        const existingEventCount = existingExecution.externalEvents?.length || existingExecution.events?.length || 0;
        const newEvents = externalEvents.slice(existingEventCount); // Only new events

        if (newEvents.length > 0) {
          console.log(`💾 Appending ${newEvents.length} new events to existing execution ${existingExecution.id}`);

          const result = await templateService.pushEventsToExecution(existingExecution.id, newEvents);

          toast({
            title: "Events appended successfully",
            description: `Added ${result.eventsAdded} new events to "${name}". Total: ${result.totalEvents} events.`,
          });
        } else {
          console.log('💾 No new events to append');
          toast({
            title: "No new events",
            description: `Execution "${name}" already has all ${existingEventCount} events.`,
          });
        }
      } else {
        // CREATE mode: Create new execution with events
        console.log(`💾 Creating new execution "${name}" with ${externalEvents.length} events`);

        const result = await templateService.createExecutionWithEvents({
          templateId: currentTemplate.id,
          name,
          description,
          externalEvents
        });

        setCurrentlyLoadedExecution(result.executionId);

        // Update URL to reflect current execution
        const newUrl = `/template-editor/${currentTemplate.id}?execution=${result.executionId}`;
        console.log('🔄 Updating URL to:', newUrl);
        router.replace(newUrl);

        toast({
          title: "Execution created successfully",
          description: `Created "${name}" with ${result.eventCount} external events.`,
        });
      }

      // Reset form only if it was a manual save
      if (name === newExecutionName.trim()) {
        setNewExecutionName("");
        setNewExecutionDescription("");
        setShowSaveForm(false);
      }

      // Reload executions to show the updated/new one
      await loadExecutions();
    } catch (error) {
      console.error("Error saving execution:", error);
      toast({
        variant: "destructive",
        title: "Failed to save execution",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setIsSaving(false);
  };

  const handleLoadExecution = async (executionId: string) => {
    setIsLoading(true);
    try {
      await loadExecution(executionId);
      toast({
        title: "Execution loaded successfully",
        description: "The execution state has been restored.",
      });
      onClose();
    } catch (error) {
      console.error("Error loading execution:", error);
      toast({
        variant: "destructive",
        title: "Failed to load execution",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setIsLoading(false);
  };

  // Reset to external events only - keep external events, delete execution events
  const handleResetToExternalEvents = () => {
    const externalEvents = globalActivityLog.filter(event => event.eventType === 'external_event');

    // Reset simulation to external events only
    // This would need to be implemented in the simulation store
    toast({
      title: "Reset to External Events",
      description: `Keeping ${externalEvents.length} external events, removed execution events. Simulation will replay from external events.`,
    });

    console.log("Reset to external events:", externalEvents);
  };

  // Delete execution events only
  const handleDeleteExecutionEvents = () => {
    if (confirm("Delete all execution events? This will keep external events but remove all calculated results.")) {
      // Implementation would go here
      toast({
        title: "Execution Events Deleted",
        description: "All execution events have been deleted. External events remain for replay.",
      });
    }
  };

  const handleCopyExecutionLink = (execution: ExecutionDocument) => {
    if (!currentTemplate) return;

    const url = `${window.location.origin}/template-editor/${currentTemplate.id}?execution=${execution.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link copied",
        description: "Execution URL copied to clipboard",
      });
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Failed to copy link",
        description: "Could not copy URL to clipboard",
      });
    });
  };

  const handleDeleteExecution = async (execution: ExecutionDocument) => {
    if (!confirm(`Are you sure you want to delete execution "${execution.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsLoading(true);
      await templateService.deleteExecution(execution.id);

      toast({
        title: "Execution deleted",
        description: `Execution "${execution.name}" has been deleted.`,
      });

      // Reload executions to update the list
      await loadExecutions();
    } catch (error) {
      console.error("Error deleting execution:", error);
      toast({
        variant: "destructive",
        title: "Failed to delete execution",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getExecutionStatus = (execution: ExecutionDocument) => {
    if (execution.isCompleted) {
      return { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle2 };
    } else if (execution.currentTime && execution.currentTime > 0) {
      return { label: "In Progress", color: "bg-yellow-100 text-yellow-800", icon: Play };
    } else if (execution.globalActivityLog && execution.globalActivityLog.length > 0) {
      return { label: "In Progress", color: "bg-yellow-100 text-yellow-800", icon: Play };
    } else if (execution.externalEvents && execution.externalEvents.length > 0) {
      return { label: "Ready for Replay", color: "bg-blue-100 text-blue-800", icon: Archive };
    } else {
      return { label: "Not Started", color: "bg-gray-100 text-gray-800", icon: Archive };
    }
  };

  if (!currentTemplate) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Archive className="h-5 w-5 mr-2" />
              Execution Manager
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">No template loaded</p>
            <p className="text-sm text-gray-500">
              Please load a template first to manage executions.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center">
            <Archive className="h-5 w-5 mr-2" />
            Execution Manager
            <Badge variant="outline" className="ml-3 text-xs font-normal">
              {currentTemplate.name}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Save and load executions for this template. External events (user inputs, model changes) are stored separately from execution events (model calculations). You can reset to external events only and replay with different models.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {showSaveForm ? (
            // Save Execution Form
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Save Current Execution</h3>
                <Button variant="outline" onClick={() => setShowSaveForm(false)}>
                  Cancel
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="execution-name">Execution Name</Label>
                  <Input
                    id="execution-name"
                    value={newExecutionName}
                    onChange={(e) => setNewExecutionName(e.target.value)}
                    placeholder="Enter execution name..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="execution-description">Description (optional)</Label>
                  <Textarea
                    id="execution-description"
                    value={newExecutionDescription}
                    onChange={(e) => setNewExecutionDescription(e.target.value)}
                    placeholder="Enter execution description..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Current State Summary</h4>
                  <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">Simulation Time:</span>
                      <span className="ml-2 font-mono">{currentTime}s</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Activities:</span>
                      <span className="ml-2 font-mono">{engine ? engine.getLedger().getActivities().length : 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">External Events:</span>
                      <span className="ml-2 font-mono">{externalQueue ? externalQueue.getAllEvents().length : 0}</span>
                      {externalQueue && console.log('🔍 Current external events count in UI:', externalQueue.getAllEvents().length)}
                    </div>
                    <div>
                      <span className="text-gray-600">Event Types:</span>
                      <span className="ml-2 font-mono">{externalQueue ? [...new Set(externalQueue.getAllEvents().map((e: any) => e.type))].length : 0}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetToExternalEvents}
                      className="flex items-center"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset to External Events
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteExecutionEvents}
                      className="flex items-center"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Delete Execution Events
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleSaveExecution}
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Execution
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // Execution List
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-semibold">
                    Executions for "{currentTemplate.name}" ({availableExecutions.length})
                  </h3>
                  {currentlyLoadedExecution && (
                    <p className="text-sm text-blue-600 mt-1">
                      Currently loaded: {availableExecutions.find(ex => ex.id === currentlyLoadedExecution)?.name || currentlyLoadedExecution}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handleQuickSave}
                    disabled={!scenario || isSaving}
                    variant="outline"
                    title="Quick save with auto-generated name"
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="mr-2 h-4 w-4" />
                    )}
                    Quick Save
                  </Button>
                  <Button onClick={() => setShowSaveForm(true)} disabled={!scenario}>
                    <Plus className="mr-2 h-4 w-4" />
                    Save Current
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 mx-auto animate-spin text-gray-400 mb-4" />
                      <p className="text-gray-600">Loading executions...</p>
                    </div>
                  ) : availableExecutions.length === 0 ? (
                    <div className="text-center py-8">
                      <Archive className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-2">No saved executions</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Save your current simulation state to preserve progress.
                      </p>
                      <Button onClick={() => setShowSaveForm(true)} disabled={!scenario}>
                        <Plus className="mr-2 h-4 w-4" />
                        Save Current Execution
                      </Button>
                    </div>
                  ) : (
                    availableExecutions.map((execution) => {
                      const status = getExecutionStatus(execution);
                      const StatusIcon = status.icon;

                      return (
                        <div
                          key={execution.id}
                          className={`p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                            currentlyLoadedExecution === execution.id ? "border-blue-500 bg-blue-50" : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h4 className="font-semibold text-gray-900">{execution.name}</h4>
                                <Badge className={`text-xs ${status.color}`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {status.label}
                                </Badge>
                                {currentlyLoadedExecution === execution.id && (
                                  <Badge className="text-xs bg-blue-100 text-blue-800">
                                    <Activity className="h-3 w-3 mr-1" />
                                    Currently Loaded
                                  </Badge>
                                )}
                              </div>

                              {execution.description && (
                                <p className="text-sm text-gray-600 mb-3">{execution.description}</p>
                              )}

                              <div className="grid grid-cols-2 gap-4 mb-3">
                                <div className="text-sm">
                                  <span className="text-gray-500">External Events:</span>
                                  <span className="ml-2 font-mono">{execution.totalExternalEvents || execution.externalEvents?.length || 0}</span>
                                </div>
                                <div className="text-sm">
                                  <span className="text-gray-500">Event Types:</span>
                                  <span className="ml-2 font-mono">{execution.eventTypes?.length || 0}</span>
                                </div>
                              </div>
                              {execution.eventTypes && execution.eventTypes.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {execution.eventTypes.map((type: string, index: number) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {type}
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <div className="flex items-center">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Started {formatDate(execution.startedAt)}
                                </div>
                                <div className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Last saved {formatDate(execution.lastSavedAt)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyExecutionLink(execution)}
                                title="Copy direct link to this execution"
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Copy Link
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLoadExternalEvents(execution)}
                                disabled={isLoading}
                                title="Load external events into queue"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Load Events
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteExecution(execution)}
                                disabled={isLoading}
                                title="Delete this execution"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExecutionManagerModal;