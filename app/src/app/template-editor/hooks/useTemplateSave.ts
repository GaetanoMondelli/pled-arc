import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface UseTemplateSaveProps {
  currentTemplate: any;
  updateCurrentTemplate: () => Promise<void>;
}

/**
 * Hook for managing template save operations
 */
export function useTemplateSave({ currentTemplate, updateCurrentTemplate }: UseTemplateSaveProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveTemplate = useCallback(async () => {
    if (!currentTemplate) {
      toast({
        variant: "destructive",
        title: "No template loaded",
        description: "Please load a template before trying to save changes.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateCurrentTemplate();
      toast({
        title: "Template saved",
        description: `Changes to "${currentTemplate.name}" have been saved successfully.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: `Failed to save template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentTemplate, updateCurrentTemplate, toast]);

  return {
    isSaving,
    handleSaveTemplate,
  };
}
