"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useEventSourcing } from "@/stores/eventSourcingStore";
import type { SimulationScenario } from "@/lib/simulation/eventSourcing";
import {
  Play,
  Pause,
  Square,
  Save,
  Trash2,
  Download,
  Upload,
  Copy,
  Camera,
  Clock,
  FileText,
  Activity,
  Zap,
  RotateCcw,
  FastForward
} from "lucide-react";

interface ScenarioManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScenarioManagerModal({ isOpen, onClose }: ScenarioManagerModalProps) {
  const { toast } = useToast();
  const {
    isRecording,
    currentScenario,
    availableScenarios,
    isReplaying,
    replayProgress,
    startRecording,
    stopRecording,
    createNewScenario,
    loadScenario,
    replayScenario,
    createSnapshot
  } = useEventSourcing();

  // Local state
  const [newScenarioName, setNewScenarioName] = useState("");
  const [newScenarioDescription, setNewScenarioDescription] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario | null>(null);
  const [replayTargetTime, setReplayTargetTime] = useState<number | undefined>();
  const [snapshotDescription, setSnapshotDescription] = useState("");

  // Load available scenarios when modal opens
  useEffect(() => {
    if (isOpen) {
      // Refresh scenario list
      // In a real implementation, this might trigger a refresh from storage
    }
  }, [isOpen]);

  // Event handlers
  const handleStartRecording = () => {
    if (!newScenarioName.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Name",
        description: "Please enter a scenario name before starting recording."
      });
      return;
    }

    try {
      startRecording(newScenarioName.trim(), newScenarioDescription.trim() || undefined);
      setNewScenarioName("");
      setNewScenarioDescription("");

      toast({
        title: "Recording Started",
        description: `Now recording scenario: "${newScenarioName}"`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Recording Failed",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const handleStopRecording = () => {
    stopRecording();
    toast({
      title: "Recording Stopped",
      description: "Scenario recording has been stopped and saved."
    });
  };

  const handleLoadScenario = async (scenario: SimulationScenario) => {
    try {
      await loadScenario(scenario.id);
      toast({
        title: "Scenario Loaded",
        description: `Loaded scenario: "${scenario.name}"`
      });
      onClose();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Load Failed",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const handleReplayScenario = async (scenario: SimulationScenario) => {
    try {
      await replayScenario(scenario.id, replayTargetTime);
      toast({
        title: "Replay Complete",
        description: `Successfully replayed scenario: "${scenario.name}"`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Replay Failed",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const handleCreateSnapshot = () => {
    if (!currentScenario) {
      toast({
        variant: "destructive",
        title: "No Active Scenario",
        description: "Start recording a scenario first to create snapshots."
      });
      return;
    }

    try {
      createSnapshot(snapshotDescription.trim() || undefined);
      setSnapshotDescription("");
      toast({
        title: "Snapshot Created",
        description: "Simulation state snapshot has been captured."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Snapshot Failed",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (events: any[]) => {
    if (events.length === 0) return "0s";
    const startTime = events[0]?.timestamp || 0;
    const endTime = events[events.length - 1]?.timestamp || 0;
    return `${endTime - startTime}s`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Simulation Scenario Manager
          </DialogTitle>
          <DialogDescription>
            Record, replay, and manage simulation scenarios using event sourcing.
            Compare different models with the same inputs for A/B testing.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="record" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="record" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Record
            </TabsTrigger>
            <TabsTrigger value="scenarios" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Scenarios
            </TabsTrigger>
            <TabsTrigger value="replay" className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Replay
            </TabsTrigger>
            <TabsTrigger value="snapshots" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Snapshots
            </TabsTrigger>
          </TabsList>

          {/* Recording Tab */}
          <TabsContent value="record" className="flex-1 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  {isRecording ? (
                    <>
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="font-medium text-red-700">
                        Recording: {currentScenario?.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 bg-gray-400 rounded-full" />
                      <span className="text-gray-600">Not recording</span>
                    </>
                  )}
                </div>

                {isRecording ? (
                  <Button onClick={handleStopRecording} variant="destructive" size="sm">
                    <Square className="h-4 w-4 mr-2" />
                    Stop Recording
                  </Button>
                ) : (
                  <Button onClick={handleStartRecording} size="sm">
                    <Play className="h-4 w-4 mr-2" />
                    Start Recording
                  </Button>
                )}
              </div>

              {!isRecording && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="scenario-name">Scenario Name</Label>
                    <Input
                      id="scenario-name"
                      value={newScenarioName}
                      onChange={(e) => setNewScenarioName(e.target.value)}
                      placeholder="Enter scenario name..."
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scenario-description">Description (Optional)</Label>
                    <Textarea
                      id="scenario-description"
                      value={newScenarioDescription}
                      onChange={(e) => setNewScenarioDescription(e.target.value)}
                      placeholder="Describe what this scenario tests..."
                      className="w-full h-20"
                    />
                  </div>
                </div>
              )}

              {currentScenario && (
                <div className="space-y-3">
                  <h4 className="font-medium">Current Scenario Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Events Captured:</span>
                      <span className="ml-2 font-mono">{currentScenario.coreEvents.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Duration:</span>
                      <span className="ml-2 font-mono">{formatDuration(currentScenario.coreEvents)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Snapshots:</span>
                      <span className="ml-2 font-mono">{currentScenario.snapshots.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Created:</span>
                      <span className="ml-2 font-mono">{formatDate(currentScenario.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Scenarios Tab */}
          <TabsContent value="scenarios" className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Available Scenarios</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-3">
                {availableScenarios.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No scenarios available</p>
                    <p className="text-sm">Record your first scenario to get started.</p>
                  </div>
                ) : (
                  availableScenarios.map((scenario) => (
                    <div key={scenario.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-medium">{scenario.name}</h4>
                          {scenario.description && (
                            <p className="text-sm text-gray-600">{scenario.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleLoadScenario(scenario)}
                            variant="outline"
                            size="sm"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Load
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${scenario.name}"? This action cannot be undone.`)) {
                                // Handle delete scenario
                                console.log('Delete scenario:', scenario.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-xs text-gray-600">
                        <div>
                          <span className="font-medium">{scenario.coreEvents.length}</span> events
                        </div>
                        <div>
                          <span className="font-medium">{scenario.snapshots.length}</span> snapshots
                        </div>
                        <div>
                          <span className="font-medium">{formatDuration(scenario.coreEvents)}</span> duration
                        </div>
                        <div>
                          <span className="font-medium">{formatDate(scenario.createdAt)}</span>
                        </div>
                      </div>

                      {scenario.tags && scenario.tags.length > 0 && (
                        <div className="flex gap-1">
                          {scenario.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Replay Tab */}
          <TabsContent value="replay" className="flex-1 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Replay Scenarios</h3>
                {isReplaying && (
                  <Badge variant="outline" className="text-blue-600">
                    <FastForward className="h-3 w-3 mr-1" />
                    Replaying...
                  </Badge>
                )}
              </div>

              {isReplaying && replayProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress: {replayProgress.processedEvents} / {replayProgress.totalEvents} events</span>
                    <span>Time: {replayProgress.currentTime}s</span>
                  </div>
                  <Progress
                    value={(replayProgress.processedEvents / replayProgress.totalEvents) * 100}
                    className="w-full"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="replay-target-time">Target Time (Optional)</Label>
                <Input
                  id="replay-target-time"
                  type="number"
                  value={replayTargetTime || ""}
                  onChange={(e) => setReplayTargetTime(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Leave empty to replay entire scenario"
                  className="w-full"
                />
                <p className="text-xs text-gray-600">
                  Replay up to a specific simulation time. Useful for debugging or partial analysis.
                </p>
              </div>

              <Separator />

              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {availableScenarios.map((scenario) => (
                    <div key={scenario.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <span className="font-medium">{scenario.name}</span>
                        <div className="text-xs text-gray-600">
                          {scenario.coreEvents.length} events • {formatDuration(scenario.coreEvents)} duration
                        </div>
                      </div>
                      <Button
                        onClick={() => handleReplayScenario(scenario)}
                        disabled={isReplaying}
                        size="sm"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Replay
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Snapshots Tab */}
          <TabsContent value="snapshots" className="flex-1 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Snapshots</h3>
                <Button onClick={handleCreateSnapshot} disabled={!currentScenario} size="sm">
                  <Camera className="h-4 w-4 mr-2" />
                  Create Snapshot
                </Button>
              </div>

              {currentScenario && (
                <div className="space-y-2">
                  <Label htmlFor="snapshot-description">Snapshot Description (Optional)</Label>
                  <Input
                    id="snapshot-description"
                    value={snapshotDescription}
                    onChange={(e) => setSnapshotDescription(e.target.value)}
                    placeholder="Describe this simulation state..."
                    className="w-full"
                  />
                </div>
              )}

              <ScrollArea className="max-h-96">
                {currentScenario?.snapshots && currentScenario.snapshots.length > 0 ? (
                  <div className="space-y-2">
                    {currentScenario.snapshots.map((snapshot) => (
                      <div key={snapshot.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Camera className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">
                              Snapshot at t={snapshot.timestamp}s
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDate(snapshot.realTimestamp)}
                          </span>
                        </div>
                        {snapshot.description && (
                          <p className="text-sm text-gray-600 mb-2">{snapshot.description}</p>
                        )}
                        <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
                          <div>
                            <span className="font-medium">{snapshot.eventCounter}</span> events
                          </div>
                          <div>
                            <span className="font-medium">{snapshot.coreEventIndex + 1}</span> core events
                          </div>
                          <div>
                            <span className="font-medium">{snapshot.globalActivityLog.length}</span> logs
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No snapshots available</p>
                    <p className="text-sm">Create snapshots to capture simulation states.</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}