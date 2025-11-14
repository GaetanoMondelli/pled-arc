"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useSimulationStore } from "@/stores/simulationStore";
import { useEventSourcing } from "@/stores/eventSourcingStore";
import type { Scenario } from "@/lib/simulation/types";
import {
  ArrowUp,
  GitBranch,
  ArrowLeftRight,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Zap,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ModelVersion {
  id: string;
  name: string;
  description: string;
  scenario: Scenario;
  createdAt: number;
  isActive: boolean;
}

export default function ModelUpgradeModal({ isOpen, onClose }: ModelUpgradeModalProps) {
  const { toast } = useToast();
  const simulationStore = useSimulationStore();
  const {
    isRecording,
    currentScenario,
    captureModelUpgrade,
    createSnapshot,
    availableScenarios
  } = useEventSourcing();

  // Local state
  const [modelVersions, setModelVersions] = useState<ModelVersion[]>([]);
  const [newVersionName, setNewVersionName] = useState("");
  const [newVersionDescription, setNewVersionDescription] = useState("");
  const [upgradeReason, setUpgradeReason] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<ModelVersion | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<any>(null);

  // Initialize model versions from current state
  useEffect(() => {
    if (isOpen && simulationStore.scenario) {
      const currentVersion: ModelVersion = {
        id: 'current',
        name: 'Current Model',
        description: 'Currently active simulation model',
        scenario: simulationStore.scenario,
        createdAt: Date.now(),
        isActive: true
      };

      // Add template versions if available
      const templateVersions: ModelVersion[] = simulationStore.availableTemplates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description || 'Template-based model',
        scenario: template.scenario,
        createdAt: new Date(template.createdAt).getTime(),
        isActive: false
      }));

      setModelVersions([currentVersion, ...templateVersions]);
    }
  }, [isOpen, simulationStore.scenario, simulationStore.availableTemplates]);

  // Event handlers
  const handleSaveCurrentAsVersion = () => {
    if (!newVersionName.trim() || !simulationStore.scenario) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "Please enter a version name and ensure a model is loaded."
      });
      return;
    }

    const newVersion: ModelVersion = {
      id: `version_${Date.now()}`,
      name: newVersionName.trim(),
      description: newVersionDescription.trim() || 'Saved model version',
      scenario: JSON.parse(JSON.stringify(simulationStore.scenario)),
      createdAt: Date.now(),
      isActive: false
    };

    setModelVersions(prev => [...prev, newVersion]);
    setNewVersionName("");
    setNewVersionDescription("");

    toast({
      title: "Version Saved",
      description: `Model version "${newVersion.name}" has been saved.`
    });
  };

  const handleUpgradeModel = async (version: ModelVersion) => {
    if (!isRecording) {
      toast({
        variant: "destructive",
        title: "Not Recording",
        description: "Start recording a scenario to capture model upgrades."
      });
      return;
    }

    if (!upgradeReason.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Reason",
        description: "Please provide a reason for the model upgrade."
      });
      return;
    }

    try {
      // Create snapshot before upgrade
      createSnapshot(`Before upgrade to: ${version.name}`);

      // Capture the model upgrade event
      captureModelUpgrade(version.scenario, upgradeReason.trim());

      // Apply the new model to the simulation
      await simulationStore.loadScenario(version.scenario);

      // Update active status
      setModelVersions(prev => prev.map(v => ({
        ...v,
        isActive: v.id === version.id
      })));

      setUpgradeReason("");

      toast({
        title: "Model Upgraded",
        description: `Successfully upgraded to "${version.name}". The upgrade has been captured in the scenario.`
      });

      onClose();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upgrade Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred."
      });
    }
  };

  const handleCompareModels = async (versionA: ModelVersion, versionB: ModelVersion) => {
    if (!currentScenario) {
      toast({
        variant: "destructive",
        title: "No Active Scenario",
        description: "Please start recording a scenario first to enable model comparison."
      });
      return;
    }

    setIsComparing(true);

    try {
      // This would use the enhanced replay engine to compare models
      // For now, we'll simulate the comparison
      const mockResults = {
        modelA: {
          name: versionA.name,
          finalTime: simulationStore.currentTime + Math.random() * 50,
          totalTokens: Math.floor(Math.random() * 100) + 50,
          nodeStates: Object.keys(simulationStore.nodeStates).length
        },
        modelB: {
          name: versionB.name,
          finalTime: simulationStore.currentTime + Math.random() * 50,
          totalTokens: Math.floor(Math.random() * 100) + 50,
          nodeStates: Object.keys(simulationStore.nodeStates).length
        },
        differences: [
          {
            timestamp: 45,
            metric: 'tokenThroughput',
            valueA: 23,
            valueB: 31,
            significance: 'major' as const
          },
          {
            timestamp: 78,
            metric: 'bufferSize',
            valueA: 5,
            valueB: 3,
            significance: 'minor' as const
          }
        ]
      };

      setComparisonResults(mockResults);

      toast({
        title: "Comparison Complete",
        description: `Found ${mockResults.differences.length} differences between model versions.`
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Comparison Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred."
      });
    } finally {
      setIsComparing(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUp className="h-5 w-5" />
            Model Upgrade & Comparison
          </DialogTitle>
          <DialogDescription>
            Upgrade simulation models during recording and compare how different models
            handle the same external events. Perfect for A/B testing model changes.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="versions" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="versions" className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Versions
            </TabsTrigger>
            <TabsTrigger value="upgrade" className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4" />
              Upgrade
            </TabsTrigger>
            <TabsTrigger value="compare" className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Compare
            </TabsTrigger>
          </TabsList>

          {/* Model Versions Tab */}
          <TabsContent value="versions" className="flex-1 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Model Versions</h3>
                <Badge variant={isRecording ? "default" : "secondary"}>
                  {isRecording ? "Recording Active" : "Not Recording"}
                </Badge>
              </div>

              {/* Save Current Version */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Save Current Model as Version</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="version-name">Version Name</Label>
                    <Input
                      id="version-name"
                      value={newVersionName}
                      onChange={(e) => setNewVersionName(e.target.value)}
                      placeholder="e.g., v1.2, optimized-queues"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="version-description">Description</Label>
                    <Input
                      id="version-description"
                      value={newVersionDescription}
                      onChange={(e) => setNewVersionDescription(e.target.value)}
                      placeholder="Brief description of changes"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveCurrentAsVersion} size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Save Current Version
                </Button>
              </div>

              <Separator />

              {/* Version List */}
              <ScrollArea className="max-h-96">
                <div className="space-y-3">
                  {modelVersions.map((version) => (
                    <div key={version.id} className={cn(
                      "border rounded-lg p-4 space-y-2",
                      version.isActive && "ring-2 ring-blue-500 bg-blue-50"
                    )}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{version.name}</h4>
                            {version.isActive && (
                              <Badge variant="default">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{version.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setSelectedVersion(version)}
                            variant="outline"
                            size="sm"
                          >
                            <Target className="h-4 w-4 mr-2" />
                            Select
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
                        <div>
                          <span className="font-medium">{version.scenario.nodes.length}</span> nodes
                        </div>
                        <div>
                          <span className="font-medium">{version.scenario.version}</span> schema
                        </div>
                        <div>
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatDate(version.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Model Upgrade Tab */}
          <TabsContent value="upgrade" className="flex-1 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-medium">Upgrade Active Model</h3>
                {!isRecording && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Recording Required
                  </Badge>
                )}
              </div>

              {!isRecording && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Recording Required</span>
                  </div>
                  <p className="text-sm text-amber-700 mt-1">
                    Model upgrades can only be performed during scenario recording.
                    Start recording a scenario to enable model upgrades.
                  </p>
                </div>
              )}

              {selectedVersion && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <ArrowUp className="h-5 w-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium">Upgrade to: {selectedVersion.name}</h4>
                      <p className="text-sm text-gray-600">{selectedVersion.description}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upgrade-reason">Upgrade Reason</Label>
                    <Textarea
                      id="upgrade-reason"
                      value={upgradeReason}
                      onChange={(e) => setUpgradeReason(e.target.value)}
                      placeholder="Why are you upgrading the model? (e.g., performance optimization, bug fix, feature addition)"
                      className="h-20"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      disabled={!isRecording}
                      className="flex-1"
                      onClick={() => {
                        if (confirm(`This will upgrade the active model to "${selectedVersion.name}" during the current simulation. A snapshot will be created before the upgrade. Continue?`)) {
                          handleUpgradeModel(selectedVersion);
                        }
                      }}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Upgrade Model
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedVersion(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!selectedVersion && (
                <div className="text-center py-8 text-gray-500">
                  <ArrowUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a model version from the Versions tab to upgrade</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Model Comparison Tab */}
          <TabsContent value="compare" className="flex-1 space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Compare Model Performance</h3>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => {
                    if (modelVersions.length >= 2) {
                      handleCompareModels(modelVersions[0], modelVersions[1]);
                    }
                  }}
                  disabled={isComparing || modelVersions.length < 2}
                  className="h-16"
                >
                  <ArrowLeftRight className="h-5 w-5 mr-2" />
                  {isComparing ? "Comparing..." : "Compare Latest Versions"}
                </Button>

                <Button variant="outline" className="h-16" disabled>
                  <Play className="h-5 w-5 mr-2" />
                  Custom Comparison
                  <span className="text-xs text-gray-500 block">Coming Soon</span>
                </Button>
              </div>

              {comparisonResults && (
                <div className="border rounded-lg p-4 space-y-4">
                  <h4 className="font-medium">Comparison Results</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h5 className="font-medium text-blue-600">{comparisonResults.modelA.name}</h5>
                      <div className="text-sm space-y-1">
                        <div>Final Time: {comparisonResults.modelA.finalTime.toFixed(1)}s</div>
                        <div>Total Tokens: {comparisonResults.modelA.totalTokens}</div>
                        <div>Node States: {comparisonResults.modelA.nodeStates}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="font-medium text-green-600">{comparisonResults.modelB.name}</h5>
                      <div className="text-sm space-y-1">
                        <div>Final Time: {comparisonResults.modelB.finalTime.toFixed(1)}s</div>
                        <div>Total Tokens: {comparisonResults.modelB.totalTokens}</div>
                        <div>Node States: {comparisonResults.modelB.nodeStates}</div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h5 className="font-medium">Key Differences</h5>
                    {comparisonResults.differences.map((diff: any, index: number) => (
                      <div key={index} className={cn(
                        "flex items-center justify-between p-2 rounded",
                        diff.significance === 'major' ? "bg-red-50 text-red-800" : "bg-yellow-50 text-yellow-800"
                      )}>
                        <span className="text-sm">
                          t={diff.timestamp}: {diff.metric}
                        </span>
                        <span className="text-sm font-mono">
                          {diff.valueA} → {diff.valueB}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}