import { useState, useCallback, useEffect } from 'react';
import { useEventStore } from '@/stores/eventStore';
import { useEventQueue } from '@/stores/eventQueue';
import { useReplayEngine } from '@/stores/replayEngine';
import { useEventProcessor } from '@/lib/executionEngines/EventProcessor';
import { enableAutoLogging } from '@/stores/activityLogger';

/**
 * Hook for managing the new event-driven simulation system
 */
export function useEventDrivenSimulation() {
  const [isRunning, setIsRunning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [simulationMode, setSimulationMode] = useState<'step' | 'continuous'>('step');

  // Event-driven stores
  const eventStore = useEventStore();
  const eventQueue = useEventQueue();
  const replayEngine = useReplayEngine();
  const processor = useEventProcessor();

  // Get processor state (moved to top to avoid reference before initialization)
  const processorState = useEventProcessor();

  // Initialize the event-driven system
  useEffect(() => {
    if (!isInitialized) {
      console.log('🚀 Initializing event-driven system...');
      
      // DON'T enable auto-logging - it creates logs for ALL events including pre-generated ones!
      // Activity logs are created ONLY in ReplayEngine._processEvent() when events are actually processed
      // enableAutoLogging();
      
      setIsInitialized(true);
      console.log('✅ Event-driven system initialized (without auto-logging)');
    }
  }, [isInitialized]);

  // Start Simulation - different behavior for step vs continuous mode
  const handleStartSimulation = useCallback(async () => {
    if (processorState.isRunning) {
      processor.stop();
      setIsRunning(false);
      console.log('⏸️ Simulation stopped');
    } else {
      setIsRunning(true);
      console.log(`🚀 Starting simulation in ${simulationMode} mode...`);

      try {
        if (simulationMode === 'continuous') {
          // Continuous mode: run until completion
          await processor.start();
          console.log('✅ Continuous simulation completed');
        } else {
          // Step mode: Force re-initialization to generate fresh timeline
          console.log('🚀 Generating fresh timeline for step mode...');

          // Get the current scenario
          const currentProcessor = useEventProcessor.getState();
          if (currentProcessor.context && currentProcessor.context.scenario) {
            console.log('📊 Current scenario:', {
              nodes: currentProcessor.context.scenario.nodes?.length,
              edges: currentProcessor.context.scenario.edges?.length,
              hasEdges: !!currentProcessor.context.scenario.edges
            });

            // FUCK IT - Just add events directly to the queue!
            const eventStore = useEventStore.getState();
            const eventQueue = useEventQueue.getState();

            eventStore.clearEvents();
            eventQueue.clear();

            // Find DataSource nodes and add DataEmit events directly
            const dataSourceNodes = currentProcessor.context.scenario.nodes?.filter((node: any) =>
              node.type === 'DataSource' || node.type === 'DataSourceNode'
            ) || [];

            console.log(`🔥 Found ${dataSourceNodes.length} DataSource nodes, adding events directly to queue`);

            for (const node of dataSourceNodes) {
              const nodeId = node.id || node.nodeId;
              const config = node.data || {};
              const maxEvents = config.maxEvents || 10;
              const rate = config.rate || 1;

              for (let i = 1; i <= maxEvents; i++) {
                const tick = Math.round(i * (1000 / rate));
                const value = Math.random() * 100; // Simple random value
                const cId = `c${Date.now()}-${i}`;

                const dataEmitEvent = {
                  type: 'DataEmit',
                  sourceNodeId: nodeId,
                  tick,
                  realTimestamp: Date.now(),
                  simulationTimestamp: tick,
                  data: {
                    token: {
                      id: `token-${Date.now()}-${i}`,
                      value,
                      correlationIds: [cId],
                      createdAtTick: tick,
                      originNodeId: nodeId,
                    },
                    cId,
                    targetNodeIds: [],
                  },
                  correlationIds: [cId],
                };

                const storedEvent = eventStore.appendEvent(dataEmitEvent);
                eventQueue.enqueue(storedEvent);
              }
            }

            const newQueueSize = eventQueue.getSize();
            console.log(`✅ DONE! Added ${newQueueSize} DataEmit events directly to queue`);

            if (newQueueSize === 0) {
              console.log('⚠️ No DataSource nodes found in scenario');
            }
          } else {
            console.log('⚠️ No scenario loaded - cannot generate timeline');
          }
        }
      } catch (error) {
        console.error('❌ Simulation failed:', error);
      } finally {
        setIsRunning(false);
      }
    }
  }, [processor, processorState.isRunning, simulationMode]);

  // Time-travel: Step backward (not implemented in new system yet)
  const handleStepBackward = useCallback(async () => {
    console.log('⏮️ Step backward not implemented in new event-driven system yet');
  }, []);

  // Time-travel: Step forward (using NEW EventProcessor)
  const handleStepForward = useCallback(async () => {
    if (processorState.isRunning && simulationMode === 'continuous') {
      console.log('⚠️ Cannot step while continuous simulation is running');
      return;
    }

    console.log('🔄 Starting step forward...');

    // Check queue before stepping
    const eventQueue = useEventQueue.getState();
    const queueSize = eventQueue.getSize();

    console.log(`📊 Queue status: ${queueSize} events pending`);

    if (queueSize === 0) {
      console.log('⚠️ Queue is empty - nothing to process');
      return;
    }

    try {
      console.log('🎯 Calling processor.step()...');

      // Process the next event
      const event = await processor.step();

      if (event) {
        console.log(`⏭️ PROCESSED: ${event.type} at tick ${event.tick} from ${event.sourceNodeId}`);

        // Check queue after processing
        const newQueueSize = eventQueue.getSize();
        console.log(`📊 Queue after processing: ${newQueueSize} events remaining`);

        // Check if new events were generated
        const eventStore = useEventStore.getState();
        const totalEvents = eventStore.getAllEvents().length;
        console.log(`📈 Total events in store: ${totalEvents}`);

      } else {
        console.log('✅ No more events to process');
      }
    } catch (error) {
      console.error('❌ Failed to step forward:', error);
    }
  }, [processor, processorState.isRunning, simulationMode]);

  // Jump to start
  const handleSeekToStart = useCallback(async () => {
    const replay = useReplayEngine.getState();
    await replay.seekToIndex(0);
    console.log('⏮️⏮️ Jumped to start');
  }, []);

  // Jump to end (not implemented yet)
  const handleSeekToEnd = useCallback(async () => {
    console.log('⏭️ Jump to end not implemented in new event-driven system yet');
  }, []);

  // Reset simulation
  const handleReset = useCallback(() => {
    if (confirm('Reset simulation? This will clear all events and restart.')) {
      // Stop processor
      processor.stop();

      // Clear event queue and store
      const queue = useEventQueue.getState();
      queue.clear();

      const store = useEventStore.getState();
      store.clearEvents();

      // Reset processor state
      processor.reset();

      setIsRunning(false);
      console.log('🔄 Simulation reset');
    }
  }, [processor]);

  // Load scenario into event-driven system
  const loadScenario = useCallback(async (scenario: any) => {
    console.log('📥 Loading scenario into event-driven system...', scenario);
    
    try {
      // Get fresh processor reference to avoid stale closures
      const currentProcessor = useEventProcessor.getState();
      
      // Initialize processor with scenario
      if (currentProcessor.initialize) {
        await currentProcessor.initialize(scenario);
        console.log('✅ Scenario loaded into event processor');
        
        // For data source nodes: Pre-generate events
        // In event-driven mode, source nodes calculate all their future events
        // upfront based on their distribution (Poisson, exponential, etc.)
        // You'll see these events appear in the queue before they execute!
        console.log('📊 Data source nodes will pre-generate events based on their distributions');
      }
    } catch (error) {
      console.error('❌ Failed to load scenario:', error);
    }
  }, []); // No dependencies - always use fresh store state

  // Get current state - use queue-based counting
  const queueStats = useEventQueue(state => state.stats);
  const eventQueueSize = useEventQueue(state => state.getSize());
  const currentTick = processorState.currentTick;
  const currentTime = processorState.currentTime;
  const canStepForward = eventQueueSize > 0 && !(processorState.isRunning && simulationMode === 'continuous');
  const canStepBackward = false; // Step backward not implemented in new system yet
  const eventStoreHash = useEventStore(state => state.getEventsHash());

  // Calculate correct counts based on queue statistics
  const processedEvents = queueStats.totalProcessed;
  const totalEvents = processedEvents + eventQueueSize;

  return {
    // State
    isRunning: processorState.isRunning || isRunning,
    isInitialized,
    simulationMode,
    currentEventIndex: processedEvents, // Number of events processed (zero-based would be processedEvents - 1)
    totalEvents: totalEvents,
    currentTime,
    currentTick,
    eventQueueSize,
    canStepBackward,
    canStepForward,
    eventStoreHash,

    // Controls
    handleStartSimulation,
    handleStepBackward,
    handleStepForward,
    handleSeekToStart,
    handleSeekToEnd,
    handleReset,
    loadScenario,
    setSimulationMode,
    
    // Stores (for advanced usage)
    eventStore,
    eventQueue,
    replayEngine,
    processor,
  };
}
