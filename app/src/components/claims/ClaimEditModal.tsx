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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus, Save, Loader2, Zap } from "lucide-react";
import { Claim, ClaimStatus, ClaimFormulaType } from "@/core/types/claims";
import { templateService } from "@/lib/template-service";

interface ClaimEditModalProps {
  claim: Claim;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedClaim: Partial<Claim>) => Promise<void>;
}

interface FormData {
  title: string;
  description: string;
  owner: string;
  status: ClaimStatus;
  formulaType: ClaimFormulaType;
  aggregationFormulaType: string;
  customExpression: string;
  sinks: string[];
  tags: string[];
  resources: string[];
  references: string[];
}

export function ClaimEditModal({ claim, isOpen, onClose, onSave }: ClaimEditModalProps) {
  const [formData, setFormData] = useState<FormData>({
    title: claim.title,
    description: claim.description,
    owner: claim.owner || "",
    status: claim.status,
    formulaType: claim.formula?.type || 'sum',
    aggregationFormulaType: claim.aggregationFormula?.type || 'sum',
    customExpression: claim.aggregationFormula?.customExpression || "",
    sinks: claim.formula?.sinks || [],
    tags: claim.tags || [],
    resources: claim.resources || [],
    references: claim.references || [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const [newResource, setNewResource] = useState("");
  const [newReference, setNewReference] = useState("");
  const [newSink, setNewSink] = useState("");
  const [availableSinks, setAvailableSinks] = useState<Array<{id: string, name: string, type: string}>>([]);
  const [loadingSinks, setLoadingSinks] = useState(false);

  // Reset form when claim changes
  useEffect(() => {
    setFormData({
      title: claim.title,
      description: claim.description,
      owner: claim.owner || "",
      status: claim.status,
      formulaType: claim.formula?.type || 'sum',
      aggregationFormulaType: claim.aggregationFormula?.type || 'sum',
      customExpression: claim.aggregationFormula?.customExpression || "",
      sinks: claim.formula?.sinks || [],
      tags: claim.tags || [],
      resources: claim.resources || [],
      references: claim.references || [],
    });
    setError(null);
  }, [claim]);

  // Load available sinks from template when modal opens
  useEffect(() => {
    const loadSinksFromTemplate = async () => {
      if (!claim.templateId || !isOpen) return;

      setLoadingSinks(true);
      try {
        const template = await templateService.getTemplate(claim.templateId);

        // Extract sinks from template scenario
        if (template.scenario && template.scenario.nodes) {
          const sinks: Array<{id: string, name: string, type: string}> = [];

          Object.entries(template.scenario.nodes).forEach(([nodeKey, nodeData]: [string, any]) => {
            if (nodeData.type === 'Sink') {
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
        setError('Failed to load available sinks');
      } finally {
        setLoadingSinks(false);
      }
    };

    loadSinksFromTemplate();
  }, [claim.templateId, isOpen]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayAdd = (field: 'tags' | 'resources' | 'references' | 'sinks', value: string) => {
    if (value.trim() && !formData[field].includes(value.trim())) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }));
    }
  };

  const handleArrayRemove = (field: 'tags' | 'resources' | 'references' | 'sinks', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleSinkToggle = (sinkId: string) => {
    setFormData(prev => ({
      ...prev,
      sinks: prev.sinks.includes(sinkId)
        ? prev.sinks.filter(id => id !== sinkId)
        : [...prev.sinks, sinkId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const updatedClaim: Partial<Claim> = {
        title: formData.title,
        description: formData.description,
        owner: formData.owner || undefined,
        status: formData.status,
        formula: {
          ...claim.formula,
          type: formData.formulaType,
          sinks: formData.sinks
        },
        aggregationFormula: {
          type: formData.aggregationFormulaType,
          customExpression: formData.customExpression || undefined,
        },
        tags: formData.tags,
        resources: formData.resources,
        references: formData.references,
        lastUpdated: new Date(),
        modifiedBy: claim.owner || claim.createdBy,
      };

      await onSave(updatedClaim);
      onClose();
    } catch (error) {
      console.error('Error saving claim:', error);
      setError(error instanceof Error ? error.message : 'Failed to save claim');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Claim
            <Badge variant="outline">{claim.id}</Badge>
          </DialogTitle>
          <DialogDescription>
            Update claim details, aggregation settings, and metadata
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Claim title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Claim description"
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner</Label>
                <Input
                  id="owner"
                  value={formData.owner}
                  onChange={(e) => handleInputChange('owner', e.target.value)}
                  placeholder="Claim owner"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange('status', value)}
                >
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
          </div>

          {/* Sink Nodes */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sink Nodes (select one)</Label>
              {loadingSinks ? (
                <div className="text-center text-sm text-gray-500 py-4">
                  Loading available sinks...
                </div>
              ) : availableSinks.length > 0 ? (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-2">
                      {availableSinks.map(sink => (
                        <div key={sink.id} className="flex items-start gap-3 p-2 border rounded bg-white hover:bg-gray-50">
                          <Checkbox
                            checked={formData.sinks.includes(sink.id)}
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
                </div>
              ) : (
                <div className="text-center text-sm text-gray-500 py-4 border rounded-lg bg-gray-50">
                  {claim.templateId ? 'No sinks found in template' : 'No template associated with this claim'}
                </div>
              )}

              {/* Show currently selected sinks */}
              {formData.sinks.length > 0 && (
                <div className="mt-2">
                  <Label className="text-xs text-gray-500">Selected:</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {formData.sinks.map((sink, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {sink}
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-red-600"
                          onClick={() => handleArrayRemove('sinks', index)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Aggregation Formula */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Aggregation Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aggregationFormulaType">Formula Type</Label>
                <Select
                  value={formData.aggregationFormulaType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, aggregationFormulaType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select formula type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="latest">Latest</SelectItem>
                    <SelectItem value="average">Average</SelectItem>
                    <SelectItem value="min">Minimum</SelectItem>
                    <SelectItem value="max">Maximum</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="custom">Custom Expression</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.aggregationFormulaType === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="customExpression">Custom Expression</Label>
                  <Textarea
                    id="customExpression"
                    value={formData.customExpression}
                    onChange={(e) => setFormData(prev => ({ ...prev, customExpression: e.target.value }))}
                    placeholder="Enter custom JavaScript expression..."
                    className="min-h-[80px]"
                  />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}