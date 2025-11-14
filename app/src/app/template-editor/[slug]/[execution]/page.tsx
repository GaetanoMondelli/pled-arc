"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";
import TemplateEditorPage from "../../page";
import { useSimulationStore } from "@/stores/simulationStore";
import { templateService } from "@/lib/services/template-service";
import { useToast } from "@/hooks/use-toast";

interface TemplateExecutionPageProps {
  params: Promise<{ slug: string; execution: string }>; // In Next.js 15, params is a Promise
}

export default function TemplateExecutionPage({ params }: TemplateExecutionPageProps) {
  const resolvedParams = use(params); // Unwrap the params Promise
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplate = useSimulationStore(state => state.loadTemplate);
  const loadExecution = useSimulationStore(state => state.loadExecution);
  const currentTemplate = useSimulationStore(state => state.currentTemplate);
  const currentExecution = useSimulationStore(state => state.currentExecution);

  useEffect(() => {
    const loadTemplateAndExecution = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`Dynamic execution page: Loading template ID "${resolvedParams.slug}" and execution ID "${resolvedParams.execution}"`);

        // First, load the template if needed
        if (!currentTemplate || currentTemplate.id !== resolvedParams.slug) {
          console.log(`Loading template "${resolvedParams.slug}" from storage...`);
          try {
            await loadTemplate(resolvedParams.slug);
            console.log(`Successfully loaded template "${resolvedParams.slug}"`);
          } catch (templateError) {
            console.error(`Template "${resolvedParams.slug}" not found:`, templateError);
            setError(`Template "${resolvedParams.slug}" not found`);
            setTimeout(() => router.push('/template-editor'), 2000);
            return;
          }
        }

        // Then, load the execution's external events
        console.log(`Loading execution "${resolvedParams.execution}" for external events...`);
        try {
          // Get the execution data
          const execution = await templateService.getExecution(resolvedParams.execution);
          console.log(`Successfully loaded execution "${resolvedParams.execution}"`, execution);

          // Load the external events into the queue (like our Load Events button)
          // Check both 'externalEvents' and 'events' fields for compatibility
          const eventsToLoad = execution.externalEvents || execution.events || [];
          if (eventsToLoad.length > 0) {
            console.log('🔄 Found external events to load:', eventsToLoad.length);

            // Get external queue from global state or create if needed
            const simulationStore = useSimulationStore.getState();
            console.log('🔄 SimulationStore state:', simulationStore);

            // Wait for the template editor to be initialized
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Try to get the external queue after initialization
            const externalQueue = simulationStore.externalQueue;
            console.log('🔄 External queue available:', !!externalQueue);

            if (externalQueue) {
              externalQueue.clear();
              for (const event of eventsToLoad) {
                await externalQueue.addEvent({
                  id: event.id,
                  timestamp: event.timestamp,
                  type: event.type,
                  source: event.source || 'EXTERNAL',
                  data: event.data,
                  targetDataSourceId: event.targetDataSourceId || event.nodeId
                });
              }

              console.log('✅ Loaded external events into queue, now running simulation...');

              // CRITICAL: Run the simulation after loading events!
              // This processes all the external events through the engine
              const play = simulationStore.play;
              if (play) {
                play(); // This triggers the simulation to process all external events
                console.log('✅ Simulation started - events will be processed');
              } else {
                console.error('❌ play() function not available in simulation store');
              }

              toast({
                title: "Execution loaded and running",
                description: `Loaded ${eventsToLoad.length} external events from "${execution.name}" and started simulation.`,
              });
            } else {
              toast({
                variant: "destructive",
                title: "External queue not available",
                description: "Could not load external events - queue not initialized.",
              });
            }
          } else {
            toast({
              title: "Execution loaded",
              description: `Loaded execution "${execution.name}" (no external events).`,
            });
          }
        } catch (executionError) {
          console.error(`Execution "${resolvedParams.execution}" not found:`, executionError);
          setError(`Execution "${resolvedParams.execution}" not found`);
          // Redirect to template editor with just the template ID
          setTimeout(() => router.push(`/template-editor/${resolvedParams.slug}`), 2000);
          return;
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading template and execution:', error);
        setError('Failed to load template and execution');
        setTimeout(() => router.push('/template-editor'), 2000);
      }
    };

    loadTemplateAndExecution();
  }, [resolvedParams.slug, resolvedParams.execution, loadTemplate, loadExecution, router, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading template "{resolvedParams.slug}" and execution "{resolvedParams.execution}"...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Template or Execution Not Found</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return <TemplateEditorPage />;
}
