"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Play,
  ChevronDown,
  ChevronRight,
  Activity,
  Database,
  Clock,
  Zap,
  RefreshCw,
  SkipBack,
  SkipForward,
  FastForward,
  StepForward
} from "lucide-react";
import { Claim } from "@/core/types/claims";
import { engineAPIService } from "@/lib/engine-api-service";
import { engineStateService, type EngineState } from "@/lib/engine-state-service";
import type { ExecutionDocument, TemplateDocument } from '@/lib/firestore-types';

interface SinkStateData {
  sinkId: string;
  nodeState: any;
  activityLog: any[];
  tokenCount: number;
  lastActivity: any;
  ledgerEntries: any[];
}

interface EnhancedSinkStateViewerProps {
  claim: Claim;
  onClose: () => void;
}

export function EnhancedSinkStateViewer({
  claim,
  onClose
}: EnhancedSinkStateViewerProps) {
  const [execution, setExecution] = useState<ExecutionDocument | null>(null);
  const [sinkStates, setSinkStates] = useState<SinkStateData[]>([]);
  const [engineStates, setEngineStates] = useState<EngineState[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedSinks, setExpandedSinks] = useState<Set<string>>(new Set());
  const [refreshingStates, setRefreshingStates] = useState<Set<string>>(new Set());

  // Load execution data and run REAL simulation with core engine
  const loadSinkStates = async () => {
    if (!claim.templateId || !claim.executionId) return;

    setLoading(true);
    try {
      console.log('🚀 Initializing real engine simulation...');

      // Step 1: Load basic execution data for reference
      const [executionData, templateData] = await Promise.all([
        engineAPIService.getExecution(claim.executionId),
        engineAPIService.getTemplate(claim.templateId)
      ]);

      setExecution(executionData);
      console.log(`📋 External events: ${executionData.externalEvents?.length || 0}`);
      console.log(`🏗️ Template loaded: ${templateData.name}`);

      // Step 2: Try to initialize real simulation engine session
      let simulationStates: EngineState[] = [];
      let newSessionId: string | null = null;

      try {
        console.log('🚀 Attempting to initialize simulation engine...');
        const initResult = await engineStateService.initializeSession(
          claim.templateId,
          claim.executionId,
          200 // Batch size for states
        );

        newSessionId = initResult.sessionId;
        setSessionId(newSessionId);
        console.log(`✅ Engine session initialized: ${newSessionId}`);
        console.log(`📊 External events to process: ${initResult.externalEventsCount}`);

        // Get initial simulation states (first 100 steps)
        const statesResult = await engineStateService.getStatesForViewer(
          claim.templateId,
          claim.executionId,
          100 // Max initial states
        );

        simulationStates = statesResult.states;
        setEngineStates(statesResult.states);
        console.log(`🎯 Generated ${statesResult.states.length} simulation states`);

      } catch (simulationError) {
        console.error('❌ Simulation engine initialization FAILED - NO FALLBACK!');
        console.error('   Error:', simulationError instanceof Error ? simulationError.message : simulationError);

        // NO FALLBACK! Let it fail!
        setEngineStates([]);
        throw simulationError;
      }

      // Step 4: Extract sink states from the simulation
      const states: SinkStateData[] = [];

      if (!claim.formula?.sinks || claim.formula.sinks.length === 0) {
        console.warn('⚠️ No sinks found in claim.formula, showing all sink nodes from simulation');

        // If no specific sinks in claim, find sink nodes from the simulation
        const lastState = simulationStates[simulationStates.length - 1];
        const sinkNodes = lastState ? Object.keys(lastState.nodeStates || {}).filter(nodeId =>
          nodeId.toLowerCase().includes('sink') ||
          nodeId.toLowerCase().includes('result')
        ) : ['default_sink']; // Fallback if no sink nodes found

        sinkNodes.forEach(sinkId => {
          states.push(createSinkStateFromEngine(sinkId, simulationStates, executionData));
        });
      } else {
        // Use sinks specified in the claim
        claim.formula.sinks.forEach(sinkId => {
          states.push(createSinkStateFromEngine(sinkId, simulationStates, executionData));
        });
      }

      setSinkStates(states);
      console.log(`✅ Generated ${states.length} sink state summaries`);

    } catch (error) {
      console.error('❌ Error running real simulation:', error);

      // NO FALLBACK! Show the real error
      setSinkStates([]);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // NO FALLBACK MODE - DELETED FAKE DATA GENERATION FUNCTION

  // Helper function to create sink state from engine simulation
  const createSinkStateFromEngine = (sinkId: string, states: EngineState[], executionData: any): SinkStateData => {
    const lastState = states[states.length - 1];
    const sinkNodeState = lastState?.nodeStates?.[sinkId] || {};

    // Extract activity log for this sink from all states
    const sinkActivities: any[] = [];
    states.forEach((state, stepIndex) => {
      state.activityLog?.forEach((activity: any) => {
        if (activity.nodeId === sinkId || !activity.nodeId) {
          sinkActivities.push({
            ...activity,
            step: stepIndex,
            timestamp: state.timestamp
          });
        }
      });
    });

    // Add external events that target this sink or related data sources
    const externalEvents = (executionData.externalEvents || []).map((event: any, index: number) => ({
      seq: `ext_${index + 1}`,
      timestamp: event.timestamp || Date.now(),
      nodeId: event.targetDataSourceId || 'external',
      action: 'external_event',
      value: event.data,
      metadata: {
        external: true,
        externalEventType: event.type,
        eventId: event.id
      }
    }));

    // Combine and sort all activities by timestamp
    const allLedgerEntries = [...sinkActivities, ...externalEvents]
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .map((entry, index) => ({ ...entry, seq: index + 1 }));

    // Count actual tokens in sink
    const tokens = sinkNodeState.tokens || sinkNodeState.currentState?.tokens || [];
    const tokenCount = Array.isArray(tokens) ? tokens.length : 0;

    console.log(`🔍 Sink ${sinkId}: ${tokenCount} tokens, ${allLedgerEntries.length} ledger entries`);

    return {
      sinkId,
      nodeState: {
        ...sinkNodeState,
        queueSize: lastState?.queues?.processing || 0,
        currentTime: lastState?.timestamp || 0,
        totalSteps: states.length,
        isRunning: !lastState?.isComplete,
        totalActivities: sinkActivities.length,
        totalEvents: externalEvents.length,
        totalNodes: Object.keys(lastState?.nodeStates || {}).length,
        status: tokenCount > 0 ? 'tokens_received' : 'processing'
      },
      activityLog: sinkActivities.slice(-20), // Last 20 activities
      tokenCount,
      lastActivity: allLedgerEntries[allLedgerEntries.length - 1] || null,
      ledgerEntries: allLedgerEntries
    };
  };

  // Step navigation functions
  const stepForward = async (steps: number = 10) => {
    if (!sessionId) return;

    setLoading(true);
    try {
      console.log(`⏭️ Stepping forward ${steps} steps...`);

      // Real engine mode only - NO FALLBACK!
      const currentPage = Math.floor(currentStep / 100);
      const nextPage = Math.floor((currentStep + steps) / 100);

      if (nextPage > currentPage) {
        // Need to load next page
        const batch = await engineStateService.getBatchStates(sessionId, nextPage, 100);
        setEngineStates(prev => [...prev, ...batch.states]);
      }

      setCurrentStep(prev => Math.min(prev + steps, engineStates.length + steps));
      console.log(`✅ Advanced to step ${currentStep + steps} (real engine)`);

      // Update sink states with new current state
      refreshSinkStatesFromEngine();

    } catch (error) {
      console.error('❌ Error stepping forward:', error);
    } finally {
      setLoading(false);
    }
  };

  const runToCompletion = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      console.log('🏁 Running simulation to completion...');

      // Real engine mode only - NO FALLBACK!
      const allStates = await engineStateService.getAllStates(sessionId);
      setEngineStates(allStates);
      setCurrentStep(allStates.length);
      refreshSinkStatesFromEngine();
      console.log(`✅ Completed real simulation with ${allStates.length} total steps`);

    } catch (error) {
      console.error('❌ Error running to completion:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSinkStatesFromEngine = () => {
    if (!execution || engineStates.length === 0) return;

    const states: SinkStateData[] = [];

    if (!claim.formula?.sinks || claim.formula.sinks.length === 0) {
      // Auto-detect sink nodes from simulation
      const lastState = engineStates[Math.min(currentStep, engineStates.length - 1)];
      const sinkNodes = lastState ? Object.keys(lastState.nodeStates || {}).filter(nodeId =>
        nodeId.toLowerCase().includes('sink') ||
        nodeId.toLowerCase().includes('result')
      ) : [];

      sinkNodes.forEach(sinkId => {
        states.push(createSinkStateFromEngine(sinkId, engineStates.slice(0, currentStep + 1), execution));
      });
    } else {
      // Use sinks specified in the claim
      claim.formula.sinks.forEach(sinkId => {
        states.push(createSinkStateFromEngine(sinkId, engineStates.slice(0, currentStep + 1), execution));
      });
    }

    setSinkStates(states);
  };

  // Refresh state for a specific sink using Engine API
  const refreshSinkState = async (sinkId: string) => {
    setRefreshingStates(prev => new Set(prev).add(sinkId));

    try {
      console.log(`🔄 Refreshing state for sink: ${sinkId}`);

      if (sessionId) {
        // If we have a session, step forward a bit
        await stepForward(1);
      } else {
        // Trigger full reload
        await loadSinkStates();
      }

      console.log(`✅ Refreshed state for sink: ${sinkId}`);
    } catch (error) {
      console.error(`❌ Error refreshing sink ${sinkId}:`, error);
    } finally {
      setRefreshingStates(prev => {
        const newSet = new Set(prev);
        newSet.delete(sinkId);
        return newSet;
      });
    }
  };

  // Toggle sink expansion
  const toggleSinkExpansion = (sinkId: string) => {
    setExpandedSinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sinkId)) {
        newSet.delete(sinkId);
      } else {
        newSet.add(sinkId);
      }
      return newSet;
    });
  };

  // Load data on mount
  useEffect(() => {
    loadSinkStates();
  }, [claim.templateId, claim.executionId]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'token_arrival':
      case 'emit':
        return 'bg-green-100 text-green-800';
      case 'process':
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'complete':
      case 'finished':
        return 'bg-purple-100 text-purple-800';
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl max-h-[90vh] overflow-hidden w-full mx-4">
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6 text-blue-500" />
                Enhanced Sink State Monitor
              </h2>
              <p className="text-gray-600 mt-1">{claim.title}</p>
              <div className="flex gap-4 mt-2 text-sm text-gray-500">
                <span><strong>Template:</strong> {claim.templateId}</span>
                <span><strong>Execution:</strong> {claim.executionId}</span>
                <span><strong>Sinks:</strong> {claim.formula?.sinks?.join(', ') || 'None'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadSinkStates}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh All
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>

        {/* Step Navigation Controls */}
        <div className="border-b bg-gray-50 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Step:</span> {currentStep} / {engineStates.length}
                {sessionId && (
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                    Live Session: {sessionId.slice(-8)}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {engineStates.length > 0 && (
                  <span>Total simulation time: {engineStates[Math.min(currentStep, engineStates.length - 1)]?.timestamp || 0}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => stepForward(1)}
                disabled={loading || !sessionId}
                title="Step forward 1"
              >
                <StepForward className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stepForward(10)}
                disabled={loading || !sessionId}
                title="Step forward 10"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                10
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stepForward(100)}
                disabled={loading || !sessionId}
                title="Step forward 100"
              >
                <FastForward className="w-4 h-4 mr-1" />
                100
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={runToCompletion}
                disabled={loading || !sessionId}
                title="Run to completion"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Play className="w-4 h-4 mr-1" />
                Complete
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="h-[60vh]">
          <div className="p-6 space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-gray-600">Loading sink states...</p>
              </div>
            ) : (
              sinkStates.map(sinkState => (
                <Collapsible
                  key={sinkState.sinkId}
                  open={expandedSinks.has(sinkState.sinkId)}
                  onOpenChange={() => toggleSinkExpansion(sinkState.sinkId)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    {/* Sink Header */}
                    <CollapsibleTrigger asChild>
                      <div className="p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {expandedSinks.has(sinkState.sinkId) ? (
                              <ChevronDown className="w-5 h-5 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-500" />
                            )}
                            <Database className="w-5 h-5 text-blue-500" />
                            <div>
                              <h3 className="font-medium">{sinkState.sinkId}</h3>
                              <p className="text-sm text-gray-600">
                                {sinkState.tokenCount} tokens •
                                {sinkState.ledgerEntries.length} events
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className={getActionBadgeColor(sinkState.nodeState?.status || 'unknown')}>
                              {sinkState.nodeState?.status || 'Unknown'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                refreshSinkState(sinkState.sinkId);
                              }}
                              disabled={refreshingStates.has(sinkState.sinkId)}
                              className="h-8 w-8 p-0"
                              title="Calculate/refresh sink state"
                            >
                              {refreshingStates.has(sinkState.sinkId) ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    {/* Sink Details */}
                    <CollapsibleContent>
                      <div className="p-4 space-y-4">
                        {/* Token State */}
                        {sinkState.tokenCount > 0 && (
                          <div>
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <Zap className="w-4 h-4" />
                              Current Tokens ({sinkState.tokenCount})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {sinkState.nodeState.tokens?.slice(0, 6).map((token: any, index: number) => (
                                <div key={index} className="p-2 bg-blue-50 rounded text-sm">
                                  <div className="font-medium">Token {index + 1}</div>
                                  <div className="text-gray-600">
                                    State: <span className="font-medium">{token.state || 'pending'}</span>
                                  </div>
                                  {token.value && (
                                    <div className="text-gray-600">
                                      Value: <span className="font-medium">{JSON.stringify(token.value).slice(0, 30)}...</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {sinkState.tokenCount > 6 && (
                                <div className="p-2 bg-gray-50 rounded text-sm text-gray-500 flex items-center justify-center">
                                  +{sinkState.tokenCount - 6} more tokens...
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* External Events Debug Section */}
                        {execution?.externalEvents && (
                          <div className="mb-4">
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <Database className="w-4 h-4" />
                              Raw External Events ({execution.externalEvents.length})
                            </h4>
                            <ScrollArea className="h-32 border rounded bg-yellow-50">
                              <div className="p-2 space-y-1">
                                {execution.externalEvents.slice(-5).map((event, index) => (
                                  <div key={index} className="p-2 bg-white rounded text-xs border">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge className="bg-yellow-100 text-yellow-800" variant="outline">
                                        {event.type}
                                      </Badge>
                                      <span className="text-gray-500">#{event.id}</span>
                                    </div>
                                    <div className="text-gray-600">
                                      Target: <span className="font-medium">{event.targetDataSourceId || 'none'}</span>
                                    </div>
                                    <div className="text-gray-600">
                                      Data: {JSON.stringify(event.data).slice(0, 100)}...
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}

                        {/* Core Engine Debug View */}
                        <div className="mb-4">
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Engine State Debug
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            {/* Queue State */}
                            <div className="p-3 border rounded bg-blue-50">
                              <h5 className="font-medium mb-2">Queue</h5>
                              <div className="space-y-1">
                                <div>Size: <span className="font-mono">{sinkState.nodeState?.queueSize || 'Unknown'}</span></div>
                                <div>Next Event: <span className="font-mono">{sinkState.nodeState?.nextEventTime || 'None'}</span></div>
                              </div>
                            </div>

                            {/* Engine State */}
                            <div className="p-3 border rounded bg-green-50">
                              <h5 className="font-medium mb-2">Engine</h5>
                              <div className="space-y-1">
                                <div>Time: <span className="font-mono">{sinkState.nodeState?.currentTime || 0}</span></div>
                                <div>Steps: <span className="font-mono">{sinkState.nodeState?.totalSteps || 0}</span></div>
                                <div>Running: <span className="font-mono">{sinkState.nodeState?.isRunning ? 'Yes' : 'No'}</span></div>
                              </div>
                            </div>

                            {/* Activities */}
                            <div className="p-3 border rounded bg-purple-50">
                              <h5 className="font-medium mb-2">Activities</h5>
                              <div className="space-y-1">
                                <div>Total: <span className="font-mono">{sinkState.nodeState?.totalActivities || 0}</span></div>
                                <div>Events: <span className="font-mono">{sinkState.nodeState?.totalEvents || 0}</span></div>
                                <div>Nodes: <span className="font-mono">{sinkState.nodeState?.totalNodes || 0}</span></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Ledger Events */}
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Execution Flow ({sinkState.ledgerEntries.length})
                          </h4>
                          <p className="text-xs text-gray-500 mb-2">
                            Shows external events, processing activities, and sink-specific events
                          </p>
                          {sinkState.ledgerEntries.length > 0 ? (
                            <ScrollArea className="h-40 border rounded">
                              <div className="p-2 space-y-1">
                                {sinkState.ledgerEntries.slice(-10).reverse().map((entry, index) => (
                                  <div key={index} className="p-2 bg-gray-50 rounded text-sm flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge className={getActionBadgeColor(entry.action)} variant="outline">
                                          {entry.action}
                                        </Badge>
                                        <span className="text-gray-500 text-xs">#{entry.seq}</span>
                                        {entry.nodeId !== sinkState.sinkId && (
                                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                            {entry.nodeId}
                                          </span>
                                        )}
                                      </div>
                                      {entry.value && (
                                        <div className="text-gray-600">
                                          {JSON.stringify(entry.value).length > 50
                                            ? JSON.stringify(entry.value).slice(0, 50) + '...'
                                            : JSON.stringify(entry.value)
                                          }
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                                      {formatTimestamp(entry.timestamp)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          ) : (
                            <div className="p-4 text-center text-gray-500 border rounded">
                              No ledger events recorded yet
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))
            )}

            {sinkStates.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No sink data available</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}