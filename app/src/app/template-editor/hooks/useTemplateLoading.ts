import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSimulationStore } from "@/stores/simulationStore";
import { setupEventSourcingIntegration } from "@/stores/legacy/eventSourcingStore";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook for managing template loading, initialization, and URL synchronization
 */
export function useTemplateLoading() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [defaultScenarioContent, setDefaultScenarioContent] = useState<string>("");
  const [scenarioEditText, setScenarioEditText] = useState<string>("");
  const lastErrorCountRef = useRef(0);

  const loadScenario = useSimulationStore(state => state.loadScenario);
  const loadTemplates = useSimulationStore(state => state.loadTemplates);
  const updateCurrentTemplate = useSimulationStore(state => state.updateCurrentTemplate);
  const currentTemplate = useSimulationStore(state => state.currentTemplate);
  const scenario = useSimulationStore(state => state.scenario);
  const errorMessages = useSimulationStore(state => state.errorMessages);

  // Fetch default scenario content from public folder
  const fetchDefaultScenarioContent = useCallback(async () => {
    try {
      console.log("Fetching scenario.json...");

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch("/scenario.json", {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Successfully fetched scenario.json");
      return data;
    } catch (err) {
      console.error("Error fetching default scenario content:", err);

      if (err instanceof Error && err.name === 'AbortError') {
        toast({
          variant: "destructive",
          title: "Timeout Error",
          description: "Loading scenario.json timed out. Please refresh the page.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Fetch Error",
          description: `Could not fetch default scenario.json: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      setDefaultScenarioContent("");
      return null;
    }
  }, [toast]);

  // Initial scenario load
  const initialLoadScenario = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log("Starting initial scenario load...");
      const defaultData = await fetchDefaultScenarioContent();
      if (defaultData) {
        console.log("Fetched scenario data, setting content...");
        setDefaultScenarioContent(JSON.stringify(defaultData, null, 2));
        console.log("Loading scenario into store...");
        await loadScenario(defaultData);
        console.log("Scenario loaded successfully");
      } else {
        console.warn("No default scenario data found, creating minimal scenario");
        // Create a minimal fallback scenario
        const fallbackScenario = {
          version: "3.0",
          nodes: [
            {
              nodeId: "source1",
              type: "DataSource",
              displayName: "Token Source",
              position: { x: 100, y: 100 },
              interval: 5,
              generation: { type: "random", valueMin: 1, valueMax: 10 },
              outputs: [{ destinationNodeId: "sink1" }],
            },
            {
              nodeId: "sink1",
              type: "Sink",
              displayName: "Token Sink",
              position: { x: 400, y: 100 },
              inputs: [{ nodeId: "source1" }],
            },
          ],
        };
        setDefaultScenarioContent(JSON.stringify(fallbackScenario, null, 2));
        await loadScenario(fallbackScenario);
        console.log("Fallback scenario loaded");
      }
    } catch (error) {
      console.error("Error in initial scenario load:", error);
    }
    console.log("Setting loading to false");
    setIsLoading(false);
  }, [fetchDefaultScenarioContent, loadScenario]);

  // Reload default scenario handler
  const handleReloadDefaultScenario = useCallback(() => {
    initialLoadScenario();
    toast({ title: "Default Scenario Reloaded", description: "The default scenario has been reloaded." });
  }, [initialLoadScenario, toast]);

  // Open scenario editor with current scenario
  const handleOpenScenarioEditor = useCallback(() => {
    const currentScenarioText = scenario ? JSON.stringify(scenario, null, 2) : defaultScenarioContent;
    setScenarioEditText(currentScenarioText);
    return currentScenarioText;
  }, [scenario, defaultScenarioContent]);

  // Load scenario from editor
  const handleLoadScenarioFromEditor = useCallback(async (editText: string) => {
    try {
      const parsedScenario = JSON.parse(editText);
      await loadScenario(parsedScenario);
      const storeErrors = errorMessages;
      if (storeErrors.length === 0) {
        toast({ title: "Success", description: "Scenario loaded from editor." });
        setDefaultScenarioContent(editText);

        // Auto-save the changes to the current template if one is loaded
        if (currentTemplate) {
          try {
            await updateCurrentTemplate();
            toast({ title: "Template Saved", description: `Changes saved to "${currentTemplate.name}"` });
          } catch (saveError) {
            console.error("Error auto-saving template:", saveError);
            toast({
              variant: "destructive",
              title: "Save Warning",
              description: "Scenario loaded but failed to save to template. Use File > Save Template to save manually."
            });
          }
        }
        return true;
      }
      return false;
    } catch (e: any) {
      toast({ variant: "destructive", title: "JSON Parse Error", description: `Invalid JSON: ${e.message}` });
      return false;
    }
  }, [loadScenario, errorMessages, currentTemplate, updateCurrentTemplate, toast]);

  // Reset editor to default
  const handleResetEditorToDefault = useCallback(async () => {
    const defaultData = await fetchDefaultScenarioContent();
    if (defaultData) {
      const newText = JSON.stringify(defaultData, null, 2);
      setScenarioEditText(newText);
      toast({ title: "Editor Reset", description: "Scenario editor reset to default content." });
      return newText;
    } else {
      toast({
        variant: "destructive",
        title: "Reset Error",
        description: "Could not re-fetch default scenario for reset.",
      });
      return null;
    }
  }, [fetchDefaultScenarioContent, toast]);

  return {
    isLoading,
    setIsLoading,
    defaultScenarioContent,
    setDefaultScenarioContent,
    scenarioEditText,
    setScenarioEditText,
    lastErrorCountRef,
    fetchDefaultScenarioContent,
    initialLoadScenario,
    handleReloadDefaultScenario,
    handleOpenScenarioEditor,
    handleLoadScenarioFromEditor,
    handleResetEditorToDefault,
  };
}
