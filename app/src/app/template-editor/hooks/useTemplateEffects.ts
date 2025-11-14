import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSimulationStore } from "@/stores/simulationStore";
import { setupEventSourcingIntegration } from "@/stores/legacy/eventSourcingStore";
import { useToast } from "@/hooks/use-toast";

interface UseTemplateEffectsProps {
  loadTemplates: () => Promise<void>;
  setIsLoading: (loading: boolean) => void;
  setIsTemplateManagerOpen: (open: boolean) => void;
  currentTemplate: any;
  errorMessages: string[];
  lastErrorCountRef: React.MutableRefObject<number>;
}

/**
 * Hook for managing all useEffect side effects in the template editor
 */
export function useTemplateEffects({
  loadTemplates,
  setIsLoading,
  setIsTemplateManagerOpen,
  currentTemplate,
  errorMessages,
  lastErrorCountRef,
}: UseTemplateEffectsProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Load available templates on mount
  useEffect(() => {
    const loadOnce = async () => {
      setIsLoading(true);
      try {
        console.log("Loading available templates...");
        await loadTemplates();

        const templates = useSimulationStore.getState().availableTemplates;
        console.log("Templates loaded:", templates.length);

        // Always open template manager modal if no template is currently loaded
        if (!useSimulationStore.getState().currentTemplate) {
          console.log(`Found ${templates.length} templates. Opening template manager for user selection.`);
          setIsTemplateManagerOpen(true);
        } else {
          console.log(`Template already loaded: ${useSimulationStore.getState().currentTemplate?.name}`);
        }
      } catch (error) {
        console.error("Error loading templates:", error);
        // If template loading fails, still allow user to work
      } finally {
        console.log("Setting loading to false");
        setIsLoading(false);
      }
    };

    loadOnce();
  }, [loadTemplates, setIsLoading, setIsTemplateManagerOpen]);

  // Reset simulation state on page mount
  useEffect(() => {
    // Ensure page starts at top on reload
    window.scrollTo(0, 0);
    
    // CRITICAL: Reset simulation state on page mount to clear any stale data from previous session
    const currentScenario = useSimulationStore.getState().scenario;

    // Debug the current scenario being checked (with safety checks)
    console.log("🔍 [PAGE MOUNT] Current scenario check:", {
      hasScenario: !!currentScenario,
      hasNodes: !!(currentScenario && currentScenario.nodes),
      nodesLength: currentScenario?.nodes?.length || 0,
      nodeDetails: currentScenario?.nodes?.map((n: any, i: number) => ({
        index: i,
        type: n?.type || 'undefined',
        id: n?.nodeId || 'undefined',
        isUndefined: n === undefined,
        isNull: n === null,
        isObject: typeof n === 'object'
      })) || []
    });

    if (currentScenario && currentScenario.nodes && currentScenario.nodes.length > 0) {
      // Check if nodes are actually valid before attempting reload
      const validNodes = currentScenario.nodes.filter((node: any) => node && typeof node === 'object' && node.nodeId);

      if (validNodes.length > 0) {
        // Only reload if we have valid scenario with valid nodes
        console.log("🔄 [PAGE MOUNT] Resetting simulation state to clear stale data");
        // Force reload the scenario to reset all node states, buffers, and counters
        useSimulationStore.getState().loadScenario(currentScenario).catch((err) => {
          console.error("Failed to reset scenario on mount:", err);
          // Clear the invalid scenario to prevent future validation errors
          useSimulationStore.getState().clearScenario();
        });
      } else {
        // Scenario has nodes but they are all invalid
        console.log("🧹 [PAGE MOUNT] Clearing scenario with invalid nodes");
        useSimulationStore.getState().clearScenario();
      }
    } else if (currentScenario) {
      // Clear invalid/incomplete scenario to prevent validation errors
      console.log("🧹 [PAGE MOUNT] Clearing incomplete scenario to prevent validation errors");
      useSimulationStore.getState().clearScenario();
    }
  }, []);

  // Set up event sourcing integration (currently disabled for debugging)
  useEffect(() => {
    // TEMPORARILY DISABLED FOR DEBUGGING
    // setupEventSourcingIntegration();
  }, []);

  // Navigate to template ID URL when template is loaded
  useEffect(() => {
    if (currentTemplate) {
      const expectedPath = `/template-editor/${currentTemplate.id}`;
      const currentPath = window.location.pathname;

      // Only navigate if we're not already on the correct template path
      if (currentPath !== expectedPath) {
        console.log(`Template loaded: "${currentTemplate.name}" (ID: ${currentTemplate.id})`);
        console.log(`Current path: ${currentPath}`);
        console.log(`Expected path: ${expectedPath}`);
        console.log(`Navigating to template URL...`);

        // Use replace to avoid creating browser history entries that could cause loops
        router.replace(expectedPath);
      } else {
        console.log(`Already on correct template path: ${expectedPath}`);
      }
    } else {
      console.log(`No current template loaded, staying on base path`);
    }
  }, [currentTemplate?.id, currentTemplate?.name, router]);

  // Show error toasts when new errors appear
  useEffect(() => {
    if (errorMessages.length > lastErrorCountRef.current) {
      // Only show new errors
      for (let i = lastErrorCountRef.current; i < errorMessages.length; i++) {
        const msg = errorMessages[i];
        toast({
          variant: "destructive",
          title: `Error ${i + 1}`,
          description: msg,
        });
      }
      lastErrorCountRef.current = errorMessages.length;
    } else if (errorMessages.length === 0) {
      // Reset counter when errors are cleared
      lastErrorCountRef.current = 0;
    }
  }, [errorMessages, toast, lastErrorCountRef]);
}
