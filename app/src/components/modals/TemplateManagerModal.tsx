"use client";

import React, { useEffect, useState } from "react";
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
import type { TemplateDocument } from "@/lib/firestore-service";
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  Download,
  Star,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Code,
  Eye
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [createFromDefault, setCreateFromDefault] = useState(true);
  const [viewingTemplate, setViewingTemplate] = useState<TemplateDocument | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<{id: string, name: string} | null>(null);

  // Store hooks
  const loadTemplates = useSimulationStore(state => state.loadTemplates);
  const loadTemplate = useSimulationStore(state => state.loadTemplate);
  const createNewTemplate = useSimulationStore(state => state.createNewTemplate);
  const saveCurrentAsTemplate = useSimulationStore(state => state.saveCurrentAsTemplate);
  const deleteTemplate = useSimulationStore(state => state.deleteTemplate);
  const availableTemplates = useSimulationStore(state => state.availableTemplates);
  const currentTemplate = useSimulationStore(state => state.currentTemplate);
  const scenario = useSimulationStore(state => state.scenario);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, loadTemplates]);

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast({
        variant: "destructive",
        title: "Template name required",
        description: "Please enter a name for the new template.",
      });
      return;
    }

    if (!scenario) {
      toast({
        variant: "destructive",
        title: "No scenario loaded",
        description: "Please load a scenario before creating a template.",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Always save current scenario as template (removed fromDefault option)
      await createNewTemplate(newTemplateName.trim(), newTemplateDescription.trim() || undefined, false);

      toast({
        title: "Template created successfully",
        description: `Template "${newTemplateName}" has been created.`,
      });

      // Reset form
      setNewTemplateName("");
      setNewTemplateDescription("");
      setIsCreating(false);

      // Reload templates to show the new one
      await loadTemplates();
    } catch (error) {
      console.error("Error creating template:", error);
      toast({
        variant: "destructive",
        title: "Failed to create template",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setIsLoading(false);
  };

  const handleLoadTemplate = async (templateId: string) => {
    setLoadingTemplateId(templateId);
    try {
      await loadTemplate(templateId);
      toast({
        title: "Template loaded successfully",
        description: "The template has been loaded into the editor.",
      });
      onClose();
    } catch (error) {
      console.error("Error loading template:", error);
      toast({
        variant: "destructive",
        title: "Failed to load template",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setLoadingTemplateId(null);
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    setDeletingTemplate({ id: templateId, name: templateName });
  };

  const confirmDeleteTemplate = async () => {
    if (!deletingTemplate) return;

    setLoadingTemplateId(deletingTemplate.id);
    try {
      await deleteTemplate(deletingTemplate.id);
      toast({
        title: "Template deleted",
        description: `Template "${deletingTemplate.name}" has been deleted successfully.`,
      });
      setDeletingTemplate(null);
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        variant: "destructive",
        title: "Failed to delete template",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setLoadingTemplateId(null);
  };

  const createBlankTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast({
        variant: "destructive",
        title: "Template name required",
        description: "Please enter a name for the new template.",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create a minimal default scenario
      const defaultScenario = {
        name: newTemplateName,
        description: newTemplateDescription || "A new blank template",
        version: "3.0",
        nodes: [],
        edges: [],
        groups: [],
        metadata: {
          createdAt: Date.now(),
          createdBy: "user"
        }
      };

      const template = await templateService.createTemplate({
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || undefined,
        scenario: defaultScenario,
        referenceDoc: "# Architecture Reference\n\nThis is a new template. Add your architecture documentation here.",
        resources: [],
      });

      toast({
        title: "Blank template created successfully",
        description: `Template "${newTemplateName}" has been created. You can now load it and start building.`,
      });

      // Reset form
      setNewTemplateName("");
      setNewTemplateDescription("");
      setIsCreating(false);

      // Reload templates to show the new one
      await loadTemplates();

      // Auto-load the new template
      if (template.id) {
        await handleLoadTemplate(template.id);
      }
    } catch (error) {
      console.error("Error creating blank template:", error);
      toast({
        variant: "destructive",
        title: "Failed to create template",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setIsLoading(false);
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

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            {availableTemplates.length === 0 ? "Template Manager" : "Load Template"}
          </DialogTitle>
          <DialogDescription>
            {availableTemplates.length === 0
              ? "Get started by creating your first template or loading an existing one."
              : "Select a template to load into the editor."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {isCreating ? (
            // Create Template Form
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Create New Template</h3>
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Enter template name..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="template-description">Description (optional)</Label>
                  <Textarea
                    id="template-description"
                    value={newTemplateDescription}
                    onChange={(e) => setNewTemplateDescription(e.target.value)}
                    placeholder="Enter template description..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Template Source</Label>
                  <div className="space-y-3">
                    {scenario && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Save current scenario as template</span>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          This will save your current scenario, architecture reference document, and resources as a new template.
                        </p>
                      </div>
                    )}
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Plus className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Create blank template</span>
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        Start fresh with an empty template that you can build from scratch.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {scenario && (
                    <Button
                      onClick={handleCreateTemplate}
                      disabled={isLoading}
                      className="w-full"
                      variant="default"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving Current...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Save Current as Template
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={createBlankTemplate}
                    disabled={isLoading}
                    className="w-full"
                    variant={scenario ? "outline" : "default"}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Blank...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Blank Template
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Template List
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-medium">Templates ({availableTemplates.length})</h3>
                <Button size="sm" onClick={() => setIsCreating(true)}>
                  <Plus className="mr-1 h-3 w-3" />
                  New
                </Button>
              </div>

              <ScrollArea className="flex-1 max-h-96">
                {availableTemplates.length === 0 && !isCreating ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg font-semibold text-gray-700 mb-2">No templates found</p>
                    <p className="text-sm text-gray-500 mb-6">
                      Get started by creating a new template from your current scenario.
                    </p>
                    <div className="space-y-3">
                      {scenario && (
                        <Button
                          onClick={() => setIsCreating(true)}
                          size="lg"
                          className="w-full max-w-xs"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Save Current as Template
                        </Button>
                      )}
                      <Button
                        onClick={() => setIsCreating(true)}
                        size="lg"
                        variant={scenario ? "outline" : "default"}
                        className="w-full max-w-xs"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Blank Template
                      </Button>
                      {!scenario && (
                        <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="font-medium">No scenario currently loaded</span>
                          </div>
                          <p className="mt-1">You can create a blank template to start fresh, or load a scenario first and then save it as a template.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 p-1">
                    {availableTemplates.map((template) => {
                      const isCurrentTemplate = currentTemplate?.id === template.id;
                      const isThisTemplateLoading = loadingTemplateId === template.id;
                      const isAnotherTemplateLoading = loadingTemplateId && loadingTemplateId !== template.id;

                      return (
                        <div
                          key={template.id}
                          className={`p-3 rounded-lg border transition-all cursor-pointer ${
                            isCurrentTemplate
                              ? "bg-blue-50 border-blue-200"
                              : isAnotherTemplateLoading
                                ? "bg-gray-100 opacity-60 pointer-events-none border-gray-200"
                                : "hover:bg-gray-50 border-gray-200"
                          }`}
                          onClick={() => !isThisTemplateLoading && !isAnotherTemplateLoading && !isCurrentTemplate && handleLoadTemplate(template.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="font-medium text-sm text-gray-900">
                                  {template.name}
                                </span>
                                {isCurrentTemplate && (
                                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                )}
                                <span className="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                  v{template.version}
                                </span>
                              </div>
                              {template.description && template.description.trim() && (
                                <div className="text-xs text-gray-500 mb-2 line-clamp-2">
                                  {template.description}
                                </div>
                              )}
                              <div className="flex items-center space-x-3 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(template.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                                {template.referenceDoc && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    Reference Doc
                                  </span>
                                )}
                                {template.resources && template.resources.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {template.resources.length} Resources
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 flex-shrink-0">
                              {isThisTemplateLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              ) : isCurrentTemplate ? (
                                <Badge variant="secondary" className="text-xs">Loaded</Badge>
                              ) : (
                                <div className="flex space-x-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingTemplate(template);
                                    }}
                                    disabled={isAnotherTemplateLoading}
                                    className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    title="View JSON"
                                  >
                                    <Code className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTemplate(template.id, template.name);
                                    }}
                                    disabled={isAnotherTemplateLoading}
                                    className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Delete template"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

      {/* JSON Viewer Modal */}
      {viewingTemplate && (
        <Dialog open={!!viewingTemplate} onOpenChange={() => setViewingTemplate(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Code className="h-5 w-5 mr-2" />
                Template JSON: {viewingTemplate.name}
              </DialogTitle>
              <DialogDescription>
                Raw JSON representation of the template. You can copy this to backup or share the template.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-96 w-full">
                <pre className="text-xs font-mono bg-gray-50 p-4 rounded border whitespace-pre-wrap">
                  {JSON.stringify(viewingTemplate, null, 2)}
                </pre>
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(viewingTemplate, null, 2));
                  toast({
                    title: "Copied to clipboard",
                    description: "Template JSON has been copied to your clipboard.",
                  });
                }}
              >
                Copy JSON
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(viewingTemplate, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${viewingTemplate.name.replace(/[^\w-]/g, '_')}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast({
                    title: "Downloaded",
                    description: "Template JSON has been downloaded.",
                  });
                }}
              >
                Download JSON
              </Button>
              <Button onClick={() => setViewingTemplate(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTemplate && (
        <Dialog open={!!deletingTemplate} onOpenChange={() => setDeletingTemplate(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center text-red-600">
                <AlertCircle className="h-5 w-5 mr-2" />
                Delete Template
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the template and all its associated data.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-red-800">Template to be deleted:</span>
                </div>
                <div className="text-sm text-red-700">
                  <strong>{deletingTemplate.name}</strong>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDeletingTemplate(null)}
                disabled={loadingTemplateId === deletingTemplate.id}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteTemplate}
                disabled={loadingTemplateId === deletingTemplate.id}
              >
                {loadingTemplateId === deletingTemplate.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Template
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};

export default TemplateManagerModal;