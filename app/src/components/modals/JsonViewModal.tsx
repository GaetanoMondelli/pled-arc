"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSimulationStore } from "@/stores/simulationStore";
import {
  Code,
  Copy,
  Download,
  Edit
} from "lucide-react";

interface JsonViewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JsonViewModal({ isOpen, onClose }: JsonViewModalProps) {
  const { toast } = useToast();

  // Get current template data and simulation state
  const currentTemplate = useSimulationStore(state => state.currentTemplate);
  const updateCurrentTemplate = useSimulationStore(state => state.updateCurrentTemplate);
  const loadScenario = useSimulationStore(state => state.loadScenario);

  // Get current scenario from simulation state (includes AI changes)
  const currentScenario = useSimulationStore(state => state.scenario);

  // State for editing template scenario
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [editedTemplateScenario, setEditedTemplateScenario] = useState("");

  // Use current scenario from simulation state (reflects AI changes) instead of template
  const rawTemplateScenario = currentScenario || currentTemplate?.scenario || null;

  // Initialize editing when template changes
  useEffect(() => {
    if (rawTemplateScenario && !isEditingTemplate) {
      setEditedTemplateScenario(JSON.stringify(rawTemplateScenario, null, 2));
    }
  }, [rawTemplateScenario, isEditingTemplate]);

  const handleEditTemplate = () => {
    setIsEditingTemplate(true);
    setEditedTemplateScenario(JSON.stringify(rawTemplateScenario, null, 2));
  };

  const handleSaveTemplate = async () => {
    try {
      // Parse the edited JSON
      const parsedScenario = JSON.parse(editedTemplateScenario);

      // Always try to load the scenario, even if it doesn't validate perfectly
      // This allows editing broken models to fix them
      try {
        await loadScenario(parsedScenario);

        // If load succeeds, update the simulation state and save to template
        const simulationStore = useSimulationStore.getState();
        simulationStore._restoreScenarioState(parsedScenario);
        await updateCurrentTemplate();

        setIsEditingTemplate(false);
        toast({
          title: "Template Saved",
          description: "Template scenario has been updated and saved to Firebase Storage",
        });
      } catch (loadError) {
        // If load fails, still show validation errors but allow editing to continue
        const { validateScenario } = await import("@/lib/simulation/validation");
        const { errors } = validateScenario(parsedScenario);

        if (errors.length > 0) {
          const errorList = errors.slice(0, 5).join('\n');
          const moreErrorsText = errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : '';

          toast({
            variant: "destructive",
            title: "Validation Errors Found",
            description: `Schema validation errors:\n${errorList}${moreErrorsText}\n\nYou can continue editing to fix these issues.`,
          });
          // Don't return - stay in edit mode to allow fixing
        } else {
          // Some other load error
          const errorMessage = loadError instanceof Error ? loadError.message : String(loadError);
          toast({
            variant: "destructive",
            title: "Load Failed",
            description: `${errorMessage}\n\nYou can continue editing to fix this issue.`,
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      toast({
        variant: "destructive",
        title: "Parse Error",
        description: `JSON parsing failed: ${errorMessage}\n\nPlease check your JSON syntax.`,
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditingTemplate(false);
    setEditedTemplateScenario(JSON.stringify(rawTemplateScenario, null, 2));
  };

  const copyToClipboard = (data: any) => {
    const jsonString = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonString);
    toast({
      title: "Copied to clipboard",
      description: "JSON data has been copied to your clipboard."
    });
  };

  const downloadJson = (data: any, filename: string) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Live Model State
          </DialogTitle>
          <DialogDescription>
            View and edit the current scenario JSON (includes AI changes).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                {currentTemplate && (
                  <div className="space-y-1">
                    <p className="text-sm text-blue-600">
                      Template: "{currentTemplate.name}" (ID: {currentTemplate.id})
                    </p>
                    {currentScenario && currentTemplate.scenario && (
                      <p className="text-xs text-gray-500">
                        {JSON.stringify(currentScenario) === JSON.stringify(currentTemplate.scenario)
                          ? "✅ Matches saved template"
                          : "⚠️ Contains unsaved changes (AI modifications)"}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {isEditingTemplate ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveTemplate}
                    >
                      Save to Firebase
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditTemplate}
                      disabled={!currentTemplate}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(rawTemplateScenario)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadJson(rawTemplateScenario, 'template-scenario')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isEditingTemplate ? (
              <div className="flex-1 flex flex-col min-h-0">
                <Textarea
                  value={editedTemplateScenario}
                  onChange={(e) => setEditedTemplateScenario(e.target.value)}
                  className="flex-1 min-h-[500px] font-mono text-sm resize-none"
                  placeholder="Edit template scenario JSON here..."
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 border rounded-lg overflow-auto bg-gray-50">
                <div className="p-4">
                  <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                    {rawTemplateScenario ? JSON.stringify(rawTemplateScenario, null, 2) : 'No scenario loaded'}
                  </pre>
                </div>
                {rawTemplateScenario && (
                  <div className="px-4 pb-2 text-xs text-gray-600 border-t border-gray-200 bg-gray-100">
                    💡 This shows the live scenario state including any AI modifications. Changes are reflected immediately.
                  </div>
                )}
              </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}