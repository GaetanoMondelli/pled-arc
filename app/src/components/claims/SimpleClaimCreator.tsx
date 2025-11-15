"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  HelpCircle,
  Database,
  Activity,
  Zap,
  X,
  TrendingUp,
  Clock,
  List,
  Code
} from "lucide-react";
import { Claim, ClaimStatus, ClaimFormulaType } from "@/core/types/claims";
import { templateService } from "@/lib/template-service";
import type { TemplateDocument, ExecutionDocument } from '@/lib/firestore-types';

interface SimpleClaimCreatorProps {
  onClaimCreated: (claimData: Partial<Claim>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SinkInfo {
  id: string;
  name: string;
  type: string;
}

export function SimpleClaimCreator({
  onClaimCreated,
  open,
  onOpenChange
}: SimpleClaimCreatorProps) {
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedExecutionId, setSelectedExecutionId] = useState("");
  const [selectedSinks, setSelectedSinks] = useState<string[]>([]);
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<ClaimStatus>("pending");
  const [formulaType, setFormulaType] = useState<ClaimFormulaType>("AND");
  const [customExpression, setCustomExpression] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  const [references, setReferences] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [newResource, setNewResource] = useState("");
  const [newReference, setNewReference] = useState("");

  // Data from API
  const [templates, setTemplates] = useState<TemplateDocument[]>([]);
  const [executions, setExecutions] = useState<ExecutionDocument[]>([]);
  const [availableSinks, setAvailableSinks] = useState<SinkInfo[]>([]);

  // Loading states
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [loadingSinks, setLoadingSinks] = useState(false);

  // Load templates on mount
  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  // Load executions when template changes
  useEffect(() => {
    if (selectedTemplateId) {
      loadExecutions();
      loadSinksFromTemplate();
    } else {
      setExecutions([]);
      setAvailableSinks([]);
      setSelectedExecutionId("");
      setSelectedSinks([]);
    }
  }, [selectedTemplateId]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const templateList = await templateService.getTemplates();
      setTemplates(templateList);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadExecutions = async () => {
    setLoadingExecutions(true);
    try {
      const executionList = await templateService.getExecutions(selectedTemplateId);
      setExecutions(executionList);
    } catch (error) {
      console.error('Failed to load executions:', error);
    } finally {
      setLoadingExecutions(false);
    }
  };

  const loadSinksFromTemplate = async () => {
    setLoadingSinks(true);
    try {
      const template = await templateService.getTemplate(selectedTemplateId);

      // Extract sinks from template scenario
      if (template.scenario && template.scenario.nodes) {
        const sinks: SinkInfo[] = [];

        Object.entries(template.scenario.nodes).forEach(([nodeKey, nodeData]: [string, any]) => {
          if (nodeData.type === 'Sink') {
            // Use the actual nodeId field from nodeData, fallback to nodeKey if not present
            const actualNodeId = nodeData.nodeId || nodeData.id || nodeKey;
            sinks.push({
              id: actualNodeId,
              name: nodeData.name || actualNodeId,
              type: nodeData.type
            });
          }
        });

        setAvailableSinks(sinks);
      }
    } catch (error) {
      console.error('Failed to load sinks from template:', error);
    } finally {
      setLoadingSinks(false);
    }
  };

  const handleSinkToggle = (sinkId: string) => {
    setSelectedSinks(prev =>
      prev.includes(sinkId)
        ? prev.filter(id => id !== sinkId)
        : [...prev, sinkId]
    );
  };

  const handleArrayAdd = (field: 'tags' | 'resources' | 'references', value: string) => {
    if (value.trim()) {
      if (field === 'tags' && !tags.includes(value.trim())) {
        setTags(prev => [...prev, value.trim()]);
      } else if (field === 'resources' && !resources.includes(value.trim())) {
        setResources(prev => [...prev, value.trim()]);
      } else if (field === 'references' && !references.includes(value.trim())) {
        setReferences(prev => [...prev, value.trim()]);
      }
    }
  };

  const handleArrayRemove = (field: 'tags' | 'resources' | 'references', index: number) => {
    if (field === 'tags') {
      setTags(prev => prev.filter((_, i) => i !== index));
    } else if (field === 'resources') {
      setResources(prev => prev.filter((_, i) => i !== index));
    } else if (field === 'references') {
      setReferences(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleCreate = () => {
    if (!name.trim() || !selectedTemplateId || !selectedExecutionId || selectedSinks.length === 0) {
      return;
    }

    const allTags = [
      ...tags,
      `template-${selectedTemplateId}`,
      `execution-${selectedExecutionId}`
    ];

    // Determine aggregation formula type based on the expression
    let aggregationType: string = 'sum'; // default
    let aggregationExpression: string | undefined = customExpression || undefined;

    if (customExpression && customExpression.trim()) {
      // Detect preset formulas and set appropriate type
      if (customExpression.includes('ledgerEntries[ledgerEntries.length - 1]')) {
        aggregationType = 'latest';
      } else if (customExpression.includes('ledgerEntries[0]')) {
        aggregationType = 'earliest';
      } else if (customExpression.includes('Math.max')) {
        aggregationType = 'max';
      } else if (customExpression.includes('Math.min')) {
        aggregationType = 'min';
      } else if (customExpression.includes('/ ledgerEntries.length') && customExpression.includes('reduce')) {
        aggregationType = 'average';
      } else if (customExpression.includes('reduce((sum, e) => sum + e.value') && !customExpression.includes('/ ledgerEntries.length')) {
        aggregationType = 'sum';
      } else if (customExpression.includes('ledgerEntries.length') && !customExpression.includes('reduce')) {
        aggregationType = 'count';
      } else {
        // It's a truly custom formula
        aggregationType = 'custom';
      }
    }

    const claimData: Partial<Claim> = {
      title: name.trim(),
      description: description.trim(),
      owner: owner.trim() || undefined,
      status,
      formula: {
        type: formulaType,
        sinks: selectedSinks,
        ...(formulaType === "CUSTOM" && customExpression ? { expression: customExpression } : {})
      },
      aggregationFormula: {
        type: aggregationType,
        customExpression: aggregationType === 'custom' ? aggregationExpression : undefined,
      },
      resources,
      references,
      tags: allTags,
      // Store template and execution references for sink state monitoring
      templateId: selectedTemplateId,
      executionId: selectedExecutionId
    };

    onClaimCreated(claimData);
    handleReset();
    onOpenChange(false);
  };

  const handleReset = () => {
    setName("");
    setDescription("");
    setSelectedTemplateId("");
    setSelectedExecutionId("");
    setSelectedSinks([]);
    setAvailableSinks([]);
    setOwner("");
    setStatus("pending");
    setFormulaType("AND");
    setCustomExpression("");
    setTags([]);
    setResources([]);
    setReferences([]);
    setNewTag("");
    setNewResource("");
    setNewReference("");
  };

  const canCreate = () => {
    return name.trim() && selectedTemplateId && selectedExecutionId && selectedSinks.length > 0;
  };

  // Helper to determine which aggregation strategy button should be highlighted
  const getActiveStrategy = () => {
    if (!customExpression || customExpression.trim() === "") return 'custom';

    // Check in order of specificity (most specific first)
    if (customExpression.includes('ledgerEntries[ledgerEntries.length - 1]')) return 'latest';
    if (customExpression.includes('ledgerEntries[0]')) return 'first';
    if (customExpression.includes('Math.max')) return 'max';
    if (customExpression.includes('Math.min')) return 'min';
    if (customExpression.includes('/ ledgerEntries.length') && customExpression.includes('reduce')) return 'average';
    if (customExpression.includes('reduce((sum, e) => sum + e.value') && !customExpression.includes('/ ledgerEntries.length')) return 'sum';
    if (customExpression.includes('ledgerEntries.length') && !customExpression.includes('reduce')) return 'count';

    return 'custom';
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Claim
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 px-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 pb-6">

              {/* Claim Name */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="claim-name">Claim Name</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-4 h-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Use hierarchical naming like:<br/>
                        <code>phase1/article1.2.3</code><br/>
                        This creates a path structure for organization
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="claim-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., phase1/article1.2.3"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="claim-description">Description</Label>
                <Textarea
                  id="claim-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this claim validates... (supports markdown)"
                  rows={3}
                />
              </div>

              {/* Owner and Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner">Owner</Label>
                  <Input
                    id="owner"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="Claim owner"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as ClaimStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="passed">Passed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Formula Type */}
              <div className="space-y-2">
                <Label htmlFor="formula-type">Formula Type</Label>
                <Select value={formulaType} onValueChange={(value) => setFormulaType(value as ClaimFormulaType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND - All sinks must be satisfied</SelectItem>
                    <SelectItem value="OR">OR - Any sink must be satisfied</SelectItem>
                    <SelectItem value="MAJORITY">MAJORITY - More than half must be satisfied</SelectItem>
                    <SelectItem value="THRESHOLD">THRESHOLD - Minimum number must be satisfied</SelectItem>
                    <SelectItem value="WEIGHTED">WEIGHTED - Weighted evaluation</SelectItem>
                    <SelectItem value="CUSTOM">CUSTOM - Custom JavaScript expression</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Aggregation Strategy Selector */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label>Aggregation Strategy</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-4 h-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Select a common strategy to auto-fill the formula, then customize as needed
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Strategy Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    type="button"
                    variant={getActiveStrategy() === 'latest' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCustomExpression("ledgerEntries[ledgerEntries.length - 1] || null // Latest entry")}
                    className="text-left justify-start"
                  >
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Latest
                  </Button>
                  <Button
                    type="button"
                    variant={getActiveStrategy() === 'sum' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCustomExpression("ledgerEntries.reduce((sum, e) => sum + e.value, 0) // Sum all values")}
                    className="text-left justify-start"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Sum
                  </Button>
                  <Button
                    type="button"
                    variant={getActiveStrategy() === 'average' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCustomExpression("ledgerEntries.reduce((sum, e) => sum + e.value, 0) / ledgerEntries.length // Average")}
                    className="text-left justify-start"
                  >
                    <Activity className="w-3 h-3 mr-1" />
                    Average
                  </Button>
                  <Button
                    type="button"
                    variant={getActiveStrategy() === 'max' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCustomExpression("Math.max(...ledgerEntries.map(e => e.value)) // Maximum value")}
                    className="text-left justify-start"
                  >
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Max
                  </Button>
                  <Button
                    type="button"
                    variant={getActiveStrategy() === 'first' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCustomExpression("ledgerEntries[0] || null // First entry")}
                    className="text-left justify-start"
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    First
                  </Button>
                  <Button
                    type="button"
                    variant={getActiveStrategy() === 'min' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCustomExpression("Math.min(...ledgerEntries.map(e => e.value)) // Minimum value")}
                    className="text-left justify-start"
                  >
                    <TrendingUp className="w-3 h-3 mr-1 rotate-180" />
                    Min
                  </Button>
                  <Button
                    type="button"
                    variant={getActiveStrategy() === 'count' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCustomExpression("ledgerEntries.length // Count entries")}
                    className="text-left justify-start"
                  >
                    <List className="w-3 h-3 mr-1" />
                    Count
                  </Button>
                  <Button
                    type="button"
                    variant={getActiveStrategy() === 'custom' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCustomExpression("")}
                    className="text-left justify-start"
                  >
                    <Code className="w-3 h-3 mr-1" />
                    Custom
                  </Button>
                </div>

                {/* Formula Editor */}
                <div className="space-y-2">
                  <Label htmlFor="custom-expression">JavaScript Formula</Label>
                  <Textarea
                    id="custom-expression"
                    value={customExpression}
                    onChange={(e) => setCustomExpression(e.target.value)}
                    placeholder="Write custom JavaScript formula using ledgerEntries array..."
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <div className="text-xs text-gray-500 space-y-1">
                    <p><strong>Available data:</strong> <code>ledgerEntries</code> array with <code>{`{id, value, timestamp, action, nodeId}`}</code> objects</p>
                    <p><strong>Examples:</strong> Click strategy buttons above to auto-fill common patterns</p>
                  </div>
                </div>
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <Label htmlFor="template-select" className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Template
                </Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger id="template-select">
                    <SelectValue placeholder={loadingTemplates ? "Loading templates..." : "Select a template"}>
                      {selectedTemplateId && templates.find(t => t.id === selectedTemplateId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4" />
                          <span>{template.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Execution Selection */}
              {selectedTemplateId && (
                <div className="space-y-2">
                  <Label>Execution</Label>
                  <Select value={selectedExecutionId} onValueChange={setSelectedExecutionId}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingExecutions ? "Loading executions..." : "Select an execution"} />
                    </SelectTrigger>
                    <SelectContent>
                      {executions.map(execution => (
                        <SelectItem key={execution.id} value={execution.id}>
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            <div>
                              <span>{execution.name}</span>
                              {execution.scenarioName && (
                                <span className="text-xs text-gray-500 ml-1">({execution.scenarioName})</span>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sink Selection */}
              {availableSinks.length > 0 && (
                <div className="space-y-3">
                  <Label>Sink to Monitor (select one)</Label>
                  <Card>
                    <CardContent className="p-3">
                      <ScrollArea className="max-h-[200px]">
                        <div className="space-y-2">
                          {availableSinks.map(sink => (
                            <div key={sink.id} className="flex items-start gap-3 p-2 border rounded hover:bg-gray-50">
                              <Checkbox
                                checked={selectedSinks.includes(sink.id)}
                                onCheckedChange={() => handleSinkToggle(sink.id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                  <span className="font-medium text-sm">{sink.name}</span>
                                  <Badge variant="outline" className="text-xs">{sink.type}</Badge>
                                </div>
                                <p className="text-xs text-gray-600 mt-1">ID: {sink.id}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="flex items-center gap-1">
                      {tag}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-600"
                        onClick={() => handleArrayRemove('tags', index)}
                      />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleArrayAdd('tags', newTag);
                        setNewTag("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleArrayAdd('tags', newTag);
                      setNewTag("");
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Resources */}
              <div className="space-y-2">
                <Label>Resources</Label>
                <div className="space-y-1 mb-2">
                  {resources.map((resource, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{resource}</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-600"
                        onClick={() => handleArrayRemove('resources', index)}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newResource}
                    onChange={(e) => setNewResource(e.target.value)}
                    placeholder="Add resource URL"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleArrayAdd('resources', newResource);
                        setNewResource("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleArrayAdd('resources', newResource);
                      setNewResource("");
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* References */}
              <div className="space-y-2">
                <Label>References</Label>
                <div className="space-y-1 mb-2">
                  {references.map((reference, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{reference}</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-600"
                        onClick={() => handleArrayRemove('references', index)}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newReference}
                    onChange={(e) => setNewReference(e.target.value)}
                    placeholder="Add reference"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleArrayAdd('references', newReference);
                        setNewReference("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleArrayAdd('references', newReference);
                      setNewReference("");
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Loading States */}
              {loadingSinks && (
                <div className="text-center text-sm text-gray-500">
                  Loading sinks from template...
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!canCreate()}
            >
              Create Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}