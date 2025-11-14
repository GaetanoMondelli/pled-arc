"use client";

console.log(`💥💥💥 SLUG PAGE FILE LOADED`);

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import TemplateEditorPage from "../page";
import { useSimulationStore } from "@/stores/simulationStore";
import { templateService } from "@/lib/services/template-service";
import { useToast } from "@/hooks/use-toast";

// Tell Next.js to render this dynamically, not statically
export const dynamic = 'force-dynamic';

interface TemplatePageProps {
  params: Promise<{ slug: string }> | { slug: string }; // Next.js 15 compatibility
}

export default function TemplateByIdPage({ params }: TemplatePageProps) {
  // Handle both sync and async params for Next.js 15
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await Promise.resolve(params);
      setSlug(resolvedParams.slug);
    };
    resolveParams();
  }, [params]);

  if (!slug) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <TemplateByIdPageContent slug={slug} />;
}

function TemplateByIdPageContent({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadTemplate = useSimulationStore(state => state.loadTemplate);
  const currentTemplate = useSimulationStore(state => state.currentTemplate);

  // Function to load execution from URL - simplified to match modal logic exactly
  const loadExecutionFromUrl = async (executionId: string) => {
    try {
      console.log(`🔗 Starting URL load for execution "${executionId}"`);

      // Get the execution data first
      const execution = await templateService.getExecution(executionId);
      console.log(`🔗 Got execution data:`, execution);

      // Support both 'externalEvents' and 'events' fields for compatibility
      const externalEvents = execution.externalEvents || execution.events || [];
      console.log(`🔗 Execution.externalEvents:`, execution.externalEvents);
      console.log(`🔗 Execution.events:`, execution.events);
      console.log(`🔗 Type of externalEvents:`, typeof externalEvents);
      console.log(`🔗 Is array:`, Array.isArray(externalEvents));
      console.log(`🔗 Length:`, externalEvents.length);

      if (!externalEvents || externalEvents.length === 0) {
        console.log(`🔗 No external events in execution "${executionId}"`);
        console.log(`🔗 Available fields:`, Object.keys(execution));
        toast({
          title: "No external events found",
          description: `Execution "${execution.name}" contains no external events to load.`,
        });
        return;
      }

      // Wait for external queue to be available with retries
      let attempts = 0;
      let externalQueue = null;

      while (attempts < 20 && !externalQueue) {
        externalQueue = useSimulationStore.getState().externalQueue;
        if (externalQueue) {
          console.log(`🔗 External queue found on attempt ${attempts + 1}`);
          console.log(`🔗 Queue instance ID:`, externalQueue.constructor.name, externalQueue);
          break;
        }
        attempts++;
        console.log(`🔗 Waiting for external queue... attempt ${attempts}`);
        await new Promise(resolve => setTimeout(resolve, 250));
      }

      if (!externalQueue) {
        console.error('🔗 External queue never became available');
        toast({
          variant: "destructive",
          title: "External queue not available",
          description: "Could not load external events - queue not initialized.",
        });
        return;
      }

      // Clear and load events (exact same logic as modal)
      console.log('🔗 Clearing external queue and loading events...');
      externalQueue.clear();

      for (const event of externalEvents) {
        // Support both 'targetDataSourceId' and 'nodeId' for compatibility
        await externalQueue.addEvent({
          id: event.id,
          timestamp: event.timestamp,
          type: event.type,
          source: event.source || 'EXTERNAL',
          data: event.data,
          targetDataSourceId: event.targetDataSourceId || event.nodeId
        });
      }

      console.log(`🔗 Successfully loaded ${externalEvents.length} events into queue`);
      console.log(`🔗 Queue now contains:`, externalQueue.getAllEvents().length, 'events');

      // Debug the queue state
      const allEvents = externalQueue.getAllEvents();
      console.log(`🔗 All events in queue:`, allEvents);
      console.log(`🔗 Queue methods available:`, Object.getOwnPropertyNames(Object.getPrototypeOf(externalQueue)));

      // Wait a bit and check again
      setTimeout(() => {
        const afterEvents = externalQueue.getAllEvents();
        console.log(`🔗 Queue after 1 second:`, afterEvents.length, 'events');
        console.log(`🔗 Events detail:`, afterEvents);
      }, 1000);

      // Trigger any external events UI refresh by updating the global state
      // This forces re-renders of components that depend on external events
      const currentStore = useSimulationStore.getState();
      useSimulationStore.setState({
        ...currentStore,
        externalQueue: externalQueue // Trigger subscribers
      });

      toast({
        title: "Execution loaded",
        description: `Loaded ${externalEvents.length} external events from "${execution.name}".`,
      });

    } catch (error) {
      console.error(`🔗 Error loading execution "${executionId}":`, error);
      toast({
        variant: "destructive",
        title: "Failed to load execution",
        description: `Could not load execution "${executionId}".`,
      });
    }
  };

  useEffect(() => {
    const loadTemplateBySlug = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`Dynamic template page: Loading template ID "${slug}"`);
        console.log(`Current template:`, currentTemplate ? `"${currentTemplate.name}" (ID: ${currentTemplate.id})` : 'none');

        // Check if the current template already matches the ID
        if (currentTemplate && currentTemplate.id === slug) {
          // Template is already loaded and matches the ID
          console.log(`Template "${slug}" is already loaded, skipping reload`);
          setIsLoading(false);
          return;
        }

        // Try to load template directly by ID
        try {
          console.log(`Loading template "${slug}" from storage...`);
          await loadTemplate(slug);
          console.log(`Successfully loaded template "${slug}"`);
        } catch (templateError) {
          console.error(`Template "${slug}" not found:`, templateError);
          setError(`Template "${slug}" not found`);
          // Redirect to base template editor after showing error briefly
          setTimeout(() => router.push('/template-editor'), 2000);
          return;
        }

        // Check if there's an execution ID in the query params
        const executionId = searchParams.get('execution');
        console.log(`🔗 URL LOADING CHECK - ExecutionId from searchParams:`, executionId);
        if (executionId) {
          console.log(`🔗 Found execution ID in URL: ${executionId}, will load after template editor initializes`);

          // Load execution after a delay to ensure template editor is fully initialized
          setTimeout(() => {
            loadExecutionFromUrl(executionId);
          }, 2000);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading template by slug:', error);
        setError('Failed to load template');
        setTimeout(() => router.push('/template-editor'), 2000);
      }
    };

    loadTemplateBySlug();
  }, [slug, loadTemplate, router, searchParams, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading template ID "{slug}"...</p>
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
          <h2 className="text-xl font-semibold mb-2">Template Not Found</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to template editor...</p>
        </div>
      </div>
    );
  }

  return <TemplateEditorPage />;
}