"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Trash2 } from "lucide-react";
import { ClaimsService } from "@/lib/services/claimsService";
import {
  ClaimFormulaType,
  ClaimStatus,
  Claim,
} from "@/core/types/claims";

interface CreateClaimModalProps {
  onClose: () => void;
  onClaimCreated: () => void;
  claimsService: ClaimsService;
}

interface ClaimFormData {
  title: string;
  description: string;
  owner: string;
  formulaType: ClaimFormulaType;
  sinks: string[];
  threshold?: number;
  expression?: string;
  resources: string[];
  references: string[];
  tags: string[];
  parentClaimId?: string;
}

export function CreateClaimModal({ onClose, onClaimCreated, claimsService }: CreateClaimModalProps) {
  const [formData, setFormData] = useState<ClaimFormData>({
    title: "",
    description: "",
    owner: "",
    formulaType: "AND",
    sinks: [""],
    resources: [],
    references: [],
    tags: [],
    parentClaimId: "",
  });

  const [newResource, setNewResource] = useState("");
  const [newReference, setNewReference] = useState("");
  const [newTag, setNewTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handle input changes
  const handleInputChange = (field: keyof ClaimFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  // Handle sink modifications
  const addSink = () => {
    setFormData(prev => ({
      ...prev,
      sinks: [...prev.sinks, ""],
    }));
  };

  const updateSink = (index: number, value: string) => {
    const newSinks = [...formData.sinks];
    newSinks[index] = value;
    setFormData(prev => ({ ...prev, sinks: newSinks }));
  };

  const removeSink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sinks: prev.sinks.filter((_, i) => i !== index),
    }));
  };

  // Handle array field additions
  const addResource = () => {
    if (newResource.trim()) {
      setFormData(prev => ({
        ...prev,
        resources: [...prev.resources, newResource.trim()],
      }));
      setNewResource("");
    }
  };

  const removeResource = (index: number) => {
    setFormData(prev => ({
      ...prev,
      resources: prev.resources.filter((_, i) => i !== index),
    }));
  };

  const addReference = () => {
    if (newReference.trim()) {
      setFormData(prev => ({
        ...prev,
        references: [...prev.references, newReference.trim()],
      }));
      setNewReference("");
    }
  };

  const removeReference = (index: number) => {
    setFormData(prev => ({
      ...prev,
      references: prev.references.filter((_, i) => i !== index),
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag("");
    }
  };

  const removeTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (formData.sinks.filter(s => s.trim()).length === 0) {
      newErrors.sinks = "At least one sink is required";
    }

    if (formData.formulaType === "THRESHOLD" && (!formData.threshold || formData.threshold <= 0)) {
      newErrors.threshold = "Threshold must be a positive number for THRESHOLD type";
    }

    if (formData.formulaType === "CUSTOM" && !formData.expression?.trim()) {
      newErrors.expression = "Custom expression is required for CUSTOM type";
    }

    if (formData.parentClaimId?.trim() && !/^\d+(\.\d+)*$/.test(formData.parentClaimId.trim())) {
      newErrors.parentClaimId = "Parent claim ID must be in hierarchical format (e.g., '1.3.2')";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const claimData: Omit<Claim, 'id' | 'createdAt' | 'lastUpdated' | 'createdBy'> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        owner: formData.owner.trim() || undefined,
        resources: formData.resources,
        references: formData.references,
        formula: {
          type: formData.formulaType,
          sinks: formData.sinks.filter(s => s.trim()),
          threshold: formData.formulaType === "THRESHOLD" ? formData.threshold : undefined,
          expression: formData.formulaType === "CUSTOM" ? formData.expression?.trim() : undefined,
        },
        childClaimIds: [],
        parentClaimId: formData.parentClaimId?.trim() || undefined,
        status: "pending" as ClaimStatus,
        tags: formData.tags,
      };

      await claimsService.createClaim(claimData);
      onClaimCreated();
    } catch (error) {
      console.error("Error creating claim:", error);
      setErrors({
        submit: error instanceof Error ? error.message : "Failed to create claim",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Create New Claim</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Enter claim title"
                  className={errors.title ? "border-red-500" : ""}
                />
                {errors.title && (
                  <p className="text-sm text-red-600 mt-1">{errors.title}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Enter detailed description of the claim"
                  rows={3}
                  className={errors.description ? "border-red-500" : ""}
                />
                {errors.description && (
                  <p className="text-sm text-red-600 mt-1">{errors.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="owner">Owner</Label>
                  <Input
                    id="owner"
                    value={formData.owner}
                    onChange={(e) => handleInputChange("owner", e.target.value)}
                    placeholder="Enter owner email or username"
                  />
                </div>

                <div>
                  <Label htmlFor="parentClaimId">Parent Claim ID</Label>
                  <Input
                    id="parentClaimId"
                    value={formData.parentClaimId}
                    onChange={(e) => handleInputChange("parentClaimId", e.target.value)}
                    placeholder="e.g., 1.3.2 (optional)"
                    className={errors.parentClaimId ? "border-red-500" : ""}
                  />
                  {errors.parentClaimId && (
                    <p className="text-sm text-red-600 mt-1">{errors.parentClaimId}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Formula Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Formula Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="formulaType">Formula Type *</Label>
                <Select value={formData.formulaType} onValueChange={(value) => handleInputChange("formulaType", value as ClaimFormulaType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND - All sinks must pass</SelectItem>
                    <SelectItem value="OR">OR - Any sink must pass</SelectItem>
                    <SelectItem value="THRESHOLD">THRESHOLD - N out of M sinks must pass</SelectItem>
                    <SelectItem value="MAJORITY">MAJORITY - &gt;50% of sinks must pass</SelectItem>
                    <SelectItem value="WEIGHTED">WEIGHTED - Weighted sum evaluation</SelectItem>
                    <SelectItem value="TEMPORAL">TEMPORAL - Time-based sequencing</SelectItem>
                    <SelectItem value="CUSTOM">CUSTOM - Custom JavaScript expression</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.formulaType === "THRESHOLD" && (
                <div>
                  <Label htmlFor="threshold">Threshold *</Label>
                  <Input
                    id="threshold"
                    type="number"
                    min="1"
                    value={formData.threshold || ""}
                    onChange={(e) => handleInputChange("threshold", parseInt(e.target.value) || undefined)}
                    placeholder="Enter threshold value"
                    className={errors.threshold ? "border-red-500" : ""}
                  />
                  {errors.threshold && (
                    <p className="text-sm text-red-600 mt-1">{errors.threshold}</p>
                  )}
                </div>
              )}

              {formData.formulaType === "CUSTOM" && (
                <div>
                  <Label htmlFor="expression">Custom Expression *</Label>
                  <Textarea
                    id="expression"
                    value={formData.expression || ""}
                    onChange={(e) => handleInputChange("expression", e.target.value)}
                    placeholder="Enter JavaScript expression (e.g., sink_A && (sink_B || sink_C))"
                    rows={3}
                    className={errors.expression ? "border-red-500" : ""}
                  />
                  {errors.expression && (
                    <p className="text-sm text-red-600 mt-1">{errors.expression}</p>
                  )}
                </div>
              )}

              {/* Required Sinks */}
              <div>
                <Label>Required Sinks *</Label>
                <div className="space-y-2 mt-2">
                  {formData.sinks.map((sink, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={sink}
                        onChange={(e) => updateSink(index, e.target.value)}
                        placeholder="Enter sink ID (e.g., workflow.instance.sink_name)"
                        className="flex-1"
                      />
                      {formData.sinks.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeSink(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addSink}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Sink
                  </Button>
                  {errors.sinks && (
                    <p className="text-sm text-red-600">{errors.sinks}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resources and References */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resources & References</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Resources */}
              <div>
                <Label>Resources</Label>
                <div className="space-y-2 mt-2">
                  {formData.resources.map((resource, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm flex-1 font-mono bg-gray-50 px-2 py-1 rounded">
                        {resource}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeResource(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newResource}
                      onChange={(e) => setNewResource(e.target.value)}
                      placeholder="Enter resource URL or path"
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addResource())}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addResource}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* References */}
              <div>
                <Label>External References</Label>
                <div className="space-y-2 mt-2">
                  {formData.references.map((reference, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm flex-1 font-mono bg-gray-50 px-2 py-1 rounded">
                        {reference}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeReference(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newReference}
                      onChange={(e) => setNewReference(e.target.value)}
                      placeholder="Enter external reference URL"
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addReference())}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addReference}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <Label>Tags</Label>
                <div className="space-y-2 mt-2">
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(index)}
                            className="ml-1 hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Enter tag name"
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addTag}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {errors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Claim"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}