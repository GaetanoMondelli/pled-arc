"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Activity,
  Clock,
  Database,
  List,
  X,
  StepForward,
  Play,
  TrendingUp,
  Code,
  ChevronDown,
  ChevronUp,
  Bug,
  ExternalLink
} from "lucide-react";
import { Claim } from "@/core/types/claims";
import { engineAPIService } from "@/lib/engine-api-service";

interface CompactSinkViewerProps {
  claim: Claim;
  onClose: () => void;
}

export function CompactSinkViewer({ claim, onClose }: CompactSinkViewerProps) {
  const [sinkNodeEvents, setSinkNodeEvents] = useState<any[]>([]);
  const [externalQueue, setExternalQueue] = useState<any[]>([]);
  const [taskQueue, setTaskQueue] = useState<any[]>([]);
  const [ledgerList, setLedgerList] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [loading, setLoading] = useState(false);

  // Aggregation state
  const [sinkAggregations, setSinkAggregations] = useState<Record<string, any>>({});
  const [selectedFormula, setSelectedFormula] = useState('default');
  const [showAggregationJSON, setShowAggregationJSON] = useState<Record<string, boolean>>({});

  // Expansion state for sink node events
  const [expandedSinkEvents, setExpandedSinkEvents] = useState<Record<string, boolean>>({});

  // Debug section collapsed by default
  const [debugCollapsed, setDebugCollapsed] = useState(true);

  // Clear sink aggregations when claim changes to prevent showing data from previous claims
  useEffect(() => {
    console.log('🔄 Claim changed, clearing ALL state. New claim ID:', claim.id);
    console.log('🔄 Clearing localStorage and sessionStorage to remove cached fake data...');

    // Clear any cached sink data from browser storage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('sinkAggregations');
        sessionStorage.removeItem('sinkAggregations');
        localStorage.removeItem('claimsData');
        sessionStorage.removeItem('claimsData');
      } catch (e) {
        console.warn('Failed to clear storage:', e);
      }
    }

    setSinkAggregations({});
    setShowAggregationJSON({});
    setExpandedSinkEvents({});
    setSinkNodeEvents([]);
    setExternalQueue([]);
    setTaskQueue([]);
    setLedgerList([]);
    setCurrentStep(0);
    setTotalSteps(1);
  }, [claim.id]);

  const loadData = async () => {
    if (!claim.templateId || !claim.executionId) return;

    setLoading(true);
    try {
      console.log('🔄 Loading compact sink data...');

      // Load execution data
      const executionData = await engineAPIService.getExecution(claim.executionId);
      const externalEvents = executionData.externalEvents || [];

      console.log(`📊 Loaded ${externalEvents.length} external events`);

      // Load sink-specific events using template-first API
      const allSinkEvents = [];
      const sinkNodes = claim.formula?.sinks || [];
      console.log('🔍 DEBUGGING: sinkNodes from claim.formula.sinks:', sinkNodes);
      console.log('🔍 DEBUGGING: claim.formula:', claim.formula);

      // Load events for each sink node using the new template-first API
      for (const sinkNode of sinkNodes) {
        try {
          console.log(`🔍 DEBUGGING: Loading events for sinkNode: ${sinkNode}`);
          const sinkNodeData = await engineAPIService.getNodeEvents(
            claim.templateId,
            claim.executionId,
            sinkNode,
            currentStep === totalSteps ? 'last' : currentStep
          );

          console.log(`🔍 DEBUGGING: sinkNodeData for ${sinkNode}:`, sinkNodeData);
          console.log(`🔍 DEBUGGING: sinkNodeData.events:`, sinkNodeData.events);
          console.log(`🔍 DEBUGGING: sinkNodeData.events.length:`, sinkNodeData.events?.length);

          // Transform ledger events to display format
          const events = sinkNodeData.events || [];
          const nodeEvents = events.map(event => ({
            id: `${sinkNode}_${event.seq}`,
            type: event.action, // token_arrival, token_consumed, etc.
            sink: sinkNode,
            sourceEvent: event.sourceEvent || 'unknown',
            value: event.value,
            timestamp: event.timestamp,
            status: 'completed',
            bufOut: '0/0', // Buffer/Output state like template editor
            seq: event.seq,
            sequence: event.seq,
            correlationIds: event.correlationIds || [],
            rawEventData: event // Include full raw event data for expansion
          }));

          allSinkEvents.push(...nodeEvents);
          console.log(`📊 Loaded ${nodeEvents.length} events for sink ${sinkNode}`);
        } catch (error) {
          console.error(`❌ Failed to load events for sink ${sinkNode}:`, error);
        }
      }

      // Sort by sequence number
      allSinkEvents.sort((a, b) => (a.seq || 0) - (b.seq || 0));
      setSinkNodeEvents(allSinkEvents);

      // Load sink aggregations for each sink node
      const aggregations: Record<string, any> = {};
      for (const sinkNode of sinkNodes) {
        try {
          console.log(`🔍 AGGRESSIVE DEBUG: About to call getSinkAggregation for sink=${sinkNode}, formula=${selectedFormula}`);
          console.log(`🔍 AGGRESSIVE DEBUG: templateId=${claim.templateId}, executionId=${claim.executionId}`);

          // Determine which formula to use: user's manual selection or claim's formula
          let formulaToUse: string;
          let customExpressionToUse: string | undefined;

          // If user selected "default", use the claim's aggregation formula
          if (selectedFormula === 'default') {
            // Use claim's formula
            formulaToUse = claim.aggregationFormula?.type || 'sum';
            customExpressionToUse = claim.aggregationFormula?.customExpression;
          } else {
            // User has manually overridden with a specific formula
            formulaToUse = selectedFormula;
            customExpressionToUse = undefined; // Clear custom expression when using preset
          }

          console.log(`🔍 USING FORMULA: selectedFormula=${selectedFormula}, claimFormula=${claim.aggregationFormula?.type}, using=${formulaToUse}`);
          console.log(`🔍 CUSTOM EXPRESSION: ${customExpressionToUse}`);

          // Convert formula type to proper JavaScript expression if no custom expression
          // Also ignore invalid custom expressions like "s => s"
          let expressionToUse = customExpressionToUse;
          if (!expressionToUse || expressionToUse.trim() === '' || expressionToUse.trim() === 's => s' || expressionToUse.length < 5) {
            switch (formulaToUse) {
              case 'latest':
                expressionToUse = 'ledgerEntries[ledgerEntries.length - 1] || null';
                break;
              case 'earliest':
                expressionToUse = 'ledgerEntries[0] || null';
                break;
              case 'sum':
                expressionToUse = 'ledgerEntries.reduce((sum, e) => sum + e.value, 0)';
                break;
              case 'count':
                expressionToUse = 'ledgerEntries.length';
                break;
              case 'average':
                expressionToUse = 'ledgerEntries.length > 0 ? ledgerEntries.reduce((sum, e) => sum + e.value, 0) / ledgerEntries.length : 0';
                break;
              case 'min':
                expressionToUse = 'Math.min(...ledgerEntries.map(e => e.value).filter(v => typeof v === "number"))';
                break;
              case 'max':
                expressionToUse = 'Math.max(...ledgerEntries.map(e => e.value).filter(v => typeof v === "number"))';
                break;
              case 'custom':
                // If type is 'custom' but no expression, default to sum
                console.warn(`⚠️ Claim has type 'custom' but no valid customExpression! Defaulting to sum.`);
                expressionToUse = 'ledgerEntries.reduce((sum, e) => sum + e.value, 0)';
                break;
              default:
                expressionToUse = 'ledgerEntries.reduce((sum, e) => sum + e.value, 0)'; // Default to sum
            }
          }

          console.log(`🔍 FINAL EXPRESSION TO USE: ${expressionToUse}`);

          // Always send as 'custom' with the proper JavaScript expression
          const aggregationData = await engineAPIService.getSinkAggregation(
            claim.templateId!,
            claim.executionId!,
            sinkNode,
            'custom', // Always use custom for unified processing
            expressionToUse
          );

          console.log(`🔍 AGGRESSIVE DEBUG: API SUCCESS for sink ${sinkNode}:`, JSON.stringify(aggregationData, null, 2));
          console.log(`🔍 AGGRESSIVE DEBUG: aggregatedValue type=${typeof aggregationData.aggregatedValue}, value=${aggregationData.aggregatedValue}`);
          console.log(`🔍 FORMULA CHECK: formula=${aggregationData.formula}, customExpression=${aggregationData.customExpression}`);
          console.log(`🔍 EVENTS CHECK: totalEvents=${aggregationData.totalEvents}, events=`, aggregationData.events);

          // CHECK: Is this value 29? Show the calculation details!
          if (aggregationData.aggregatedValue === 29 || aggregationData.aggregatedValue === 29.0 || aggregationData.aggregatedValue === 29.2) {
            console.warn(`⚠️ FOUND 29 VALUE - NEED TO VERIFY IF LEGITIMATE!`);
            console.warn(`📊 Formula used: ${aggregationData.formula}`);
            console.warn(`📊 Custom expression: ${aggregationData.customExpression || 'none'}`);
            console.warn(`📊 Total events: ${aggregationData.totalEvents}`);
            console.warn(`📊 Event values:`, aggregationData.events?.map(e => e.value));
            console.warn(`📊 Data source: ${aggregationData.dataSource}`);

            // Show the calculation manually
            if (aggregationData.events && aggregationData.events.length > 0) {
              const eventValues = aggregationData.events.map(e => {
                if (typeof e.value === 'number') return e.value;
                if (e.value && typeof e.value.amount === 'number') return e.value.amount;
                if (e.value && typeof e.value.value === 'number') return e.value.value;
                return e.value;
              }).filter(v => v != null);

              const numericValues = eventValues.filter(v => typeof v === 'number');
              console.warn(`📊 Extracted values: ${JSON.stringify(eventValues)}`);
              console.warn(`📊 Numeric values: ${JSON.stringify(numericValues)}`);

              if (aggregationData.formula === 'sum') {
                const calculatedSum = numericValues.reduce((sum, val) => sum + val, 0);
                console.warn(`📊 MANUAL SUM CALCULATION: ${numericValues.join(' + ')} = ${calculatedSum}`);
                console.warn(`📊 API returned: ${aggregationData.aggregatedValue}, Manual calc: ${calculatedSum}`);
              }
              if (aggregationData.formula === 'latest') {
                const latestValue = aggregationData.events[aggregationData.events.length - 1]?.value;
                console.warn(`📊 MANUAL LATEST CALCULATION: ${latestValue}`);
                console.warn(`📊 API returned: ${aggregationData.aggregatedValue}, Manual calc: ${latestValue}`);
              }
            }

            // Add verification info to the display
            aggregations[sinkNode] = {
              ...aggregationData,
              _verificationInfo: {
                formula: aggregationData.formula,
                customExpression: aggregationData.customExpression,
                totalEvents: aggregationData.totalEvents,
                eventValues: aggregationData.events?.map(e => e.value),
                dataSource: aggregationData.dataSource
              }
            };
          } else {
            aggregations[sinkNode] = aggregationData;
          }

          console.log(`📊 Final aggregation for sink ${sinkNode}:`, aggregations[sinkNode]);
        } catch (error) {
          console.error(`❌ API FAILED for sink ${sinkNode}:`, error);
          console.log(`✅ This is CORRECT - API should fail and show errors!`);
          aggregations[sinkNode] = {
            aggregatedValue: 'API_ERROR',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
      setSinkAggregations(aggregations);

      // Set external queue (events not yet processed)
      setExternalQueue(externalEvents.map((event, i) => ({
        id: event.id,
        type: event.type,
        target: event.targetDataSourceId,
        value: event.data?.value,
        timestamp: event.timestamp,
        status: i < currentStep ? 'processed' : 'waiting'
      })));

      // Task queue (current processing tasks)
      const tasks = externalEvents.slice(Math.max(0, currentStep - 2), currentStep + 1).map((event, i) => ({
        id: `task_${currentStep + i}`,
        type: 'process',
        node: event.targetDataSourceId,
        data: event.data,
        status: i === 0 ? 'processing' : 'queued'
      }));
      setTaskQueue(tasks);

      // Ledger (completed activities)
      const ledgerEntries = [];
      for (let i = 0; i < Math.min(currentStep, externalEvents.length); i++) {
        const event = externalEvents[i];
        ledgerEntries.push({
          seq: i * 3 + 1,
          action: 'external_event',
          node: event.targetDataSourceId,
          value: event.data,
          timestamp: event.timestamp
        });

        if (i > 0) {
          ledgerEntries.push({
            seq: i * 3 + 2,
            action: 'process',
            node: event.targetDataSourceId,
            value: { processed: event.data?.value },
            timestamp: event.timestamp + 500
          });
        }

        // Real token arrival events would be loaded from actual sink data
        // No fake ledger entries generated here
      }

      setLedgerList(ledgerEntries);
      setTotalSteps(externalEvents.length * 3);

      console.log(`✅ Updated: ${allSinkEvents.length} sink events, ${externalEvents.length} external, ${tasks.length} tasks, ${ledgerEntries.length} ledger entries`);

    } catch (error) {
      console.error('❌ Error loading compact sink data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stepForward = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const runComplete = () => {
    setCurrentStep(totalSteps);
  };

  useEffect(() => {
    loadData();
  }, [claim.templateId, claim.executionId, currentStep, selectedFormula]);

  const formatValue = (value: any) => {
    if (!value) return 'null';
    if (typeof value === 'object') {
      return JSON.stringify(value).slice(0, 30) + (JSON.stringify(value).length > 30 ? '...' : '');
    }
    return String(value);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'external_event': return 'bg-blue-100 text-blue-700';
      case 'process': return 'bg-yellow-100 text-yellow-700';
      case 'token_arrival': return 'bg-green-100 text-green-700';
      case 'emit': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl max-h-[90vh] w-full mx-4 flex flex-col overflow-hidden">

        {/* Compact Header */}
        <div className="border-b bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-blue-500" />
              <div>
                <h3 className="font-medium">Sink Monitor</h3>
                <div className="text-xs text-gray-600">
                  {claim.title}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {claim.templateId && claim.executionId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(`/template-editor/${claim.templateId}?execution=${claim.executionId}`, '_blank');
                  }}
                  className="flex items-center gap-2"
                >
                  <Bug className="w-4 h-4" />
                  Open in Debugger
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Aggregated Sink Values Section */}
        <div className="border-b bg-blue-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <h4 className="font-medium text-sm">Aggregated Sink Values</h4>
            <select
              value={selectedFormula}
              onChange={(e) => setSelectedFormula(e.target.value)}
              className="text-xs border rounded px-2 py-1 ml-auto"
            >
              <option value="default">Default (Claim)</option>
              <option value="latest">Latest</option>
              <option value="sum">Sum</option>
              <option value="count">Count</option>
              <option value="average">Average</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(sinkAggregations).map(([sinkId, data]) => (
              <div key={sinkId} className="bg-white rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 uppercase">Node ID</span>
                    <span className="font-mono text-sm font-medium">{sinkId}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <Badge
                      variant={selectedFormula === 'default' ? 'default' : 'outline'}
                      className="text-xs mb-1"
                    >
                      {selectedFormula === 'default' ? (
                        (() => {
                          const claimType = claim.aggregationFormula?.type || 'sum';
                          const hasValidExpression = claim.aggregationFormula?.customExpression &&
                                                     claim.aggregationFormula.customExpression.trim().length > 5;
                          // If type is custom but no valid expression, show warning
                          if (claimType === 'custom' && !hasValidExpression) {
                            return 'sum (claim fallback)';
                          }
                          return `${claimType} (claim)`;
                        })()
                      ) : (
                        `${selectedFormula} (override)`
                      )}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAggregationJSON(prev => ({
                        ...prev,
                        [`${sinkId}_formula`]: !prev[`${sinkId}_formula`]
                      }))}
                      className="h-4 text-xs text-gray-500 hover:text-gray-700 p-0"
                    >
                      view formula
                    </Button>
                  </div>
                </div>
                {data.error ? (
                  <div className="text-red-600 text-xs">{data.error}</div>
                ) : (
                  <>
                    <div className="text-lg font-semibold text-blue-600 mb-2">
                      {typeof data.aggregatedValue === 'object' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Complex Value</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAggregationJSON(prev => ({
                              ...prev,
                              [sinkId]: !prev[sinkId]
                            }))}
                            className="h-6 w-6 p-0"
                          >
                            {showAggregationJSON[sinkId] ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        data.aggregatedValue
                      )}
                    </div>
                    {showAggregationJSON[sinkId] && typeof data.aggregatedValue === 'object' && (
                      <div className="bg-gray-50 rounded border p-2 text-xs font-mono">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(data.aggregatedValue, null, 2)}
                        </pre>
                      </div>
                    )}
                    {showAggregationJSON[`${sinkId}_formula`] && (
                      <div className="bg-blue-50 rounded border p-2 mt-2">
                        <div className="text-xs text-blue-700 font-medium mb-1">Formula Used:</div>
                        <pre className="text-xs font-mono text-blue-900 whitespace-pre-wrap">
                          {(() => {
                            if (selectedFormula === 'default') {
                              const claimType = claim.aggregationFormula?.type || 'sum';
                              const claimExpr = claim.aggregationFormula?.customExpression;

                              // If claim has valid custom expression, show it
                              if (claimExpr && claimExpr.trim().length > 5) {
                                return claimExpr;
                              }

                              // Otherwise show the built-in formula based on type
                              const builtInFormulas = {
                                'sum': 'ledgerEntries.reduce((sum, e) => sum + e.value, 0)',
                                'latest': 'ledgerEntries[ledgerEntries.length - 1] || null',
                                'earliest': 'ledgerEntries[0] || null',
                                'count': 'ledgerEntries.length',
                                'average': 'ledgerEntries.reduce((sum, e) => sum + e.value, 0) / ledgerEntries.length',
                                'min': 'Math.min(...ledgerEntries.map(e => e.value))',
                                'max': 'Math.max(...ledgerEntries.map(e => e.value))',
                              };

                              return builtInFormulas[claimType] || builtInFormulas['sum'];
                            } else {
                              // Manual override
                              return data.customExpression || `Built-in ${selectedFormula} aggregation`;
                            }
                          })()}
                        </pre>
                        <div className="text-xs text-gray-600 mt-2">
                          <strong>Source:</strong> {selectedFormula === 'default' ? (
                            (() => {
                              const claimType = claim.aggregationFormula?.type || 'sum';
                              const hasValidExpr = claim.aggregationFormula?.customExpression &&
                                                   claim.aggregationFormula.customExpression.trim().length > 5;

                              if (claimType === 'custom' && !hasValidExpr) {
                                return 'Claim definition (fallback to sum - claim had invalid custom expression)';
                              }
                              return hasValidExpr ? 'Claim definition (custom)' : `Claim definition (${claimType})`;
                            })()
                          ) : 'Manual override'}
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {data.totalEvents} events • Updated {new Date(data.timestamp).toLocaleTimeString()}
                    </div>
                  </>
                )}
              </div>
            ))}
            {Object.keys(sinkAggregations).length === 0 && (
              <div className="col-span-full text-center py-4 text-gray-500 text-xs">
                Loading aggregated values...
              </div>
            )}
          </div>
        </div>

        {/* Sink Node Events Section - EXPANDED */}
        <div className="border-b bg-gray-50/50 p-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-purple-500" />
            <h4 className="font-medium">Sink Node Events</h4>
            <Badge variant="outline" className="text-xs">{sinkNodeEvents.length}</Badge>
          </div>
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sinkNodeEvents.map((sinkEvent, i) => (
                <div key={sinkEvent.id} className="p-4 rounded-lg border bg-purple-50 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 uppercase">Node</span>
                      <span className="font-mono text-sm font-medium">{sinkEvent.sink}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${sinkEvent.type === 'token_arrival' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`} variant="outline">
                        {sinkEvent.type.replace('_', ' ')}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedSinkEvents(prev => ({
                          ...prev,
                          [sinkEvent.id]: !prev[sinkEvent.id]
                        }))}
                        className="h-6 w-6 p-0"
                      >
                        {expandedSinkEvents[sinkEvent.id] ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="text-gray-600 space-y-1">
                    <div className="text-sm"><strong>Value:</strong> {typeof sinkEvent.value === 'number' ? sinkEvent.value : formatValue(sinkEvent.value)}</div>
                    <div className="text-sm">Buf/Out: {sinkEvent.bufOut || '0/0'}</div>
                    <div className="text-sm">Status: {sinkEvent.status}</div>
                  </div>

                  {/* Expanded details */}
                  {expandedSinkEvents[sinkEvent.id] && (
                    <div className="mt-4 pt-4 border-t border-purple-200 space-y-3">
                      <div className="bg-purple-100 rounded-lg p-3 text-sm font-mono">
                        <div className="text-purple-800 font-medium mb-2">Event Details:</div>
                        <div className="space-y-1">
                          <div><span className="text-purple-600 font-medium">Type:</span> {sinkEvent.type}</div>
                          <div><span className="text-purple-600 font-medium">Sink:</span> {sinkEvent.sink}</div>
                          <div><span className="text-purple-600 font-medium">Sequence:</span> {sinkEvent.sequence || 'N/A'}</div>
                          <div><span className="text-purple-600 font-medium">Timestamp:</span> {sinkEvent.timestamp ? new Date(sinkEvent.timestamp).toLocaleString() : 'N/A'}</div>
                          <div><span className="text-purple-600 font-medium">Correlation IDs:</span> {sinkEvent.correlationIds?.join(', ') || 'N/A'}</div>
                        </div>
                      </div>
                      {sinkEvent.rawEventData && (
                        <div className="bg-gray-100 rounded-lg p-3 text-sm font-mono">
                          <div className="text-gray-700 font-medium mb-2">Raw Event Data:</div>
                          <ScrollArea className="max-h-48">
                            <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(sinkEvent.rawEventData, null, 2)}</pre>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {sinkNodeEvents.length === 0 && (
                <div className="col-span-full text-center py-4 text-gray-500 text-xs">
                  No sink events yet
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Collapsible Debug Section */}
        <Collapsible open={!debugCollapsed} onOpenChange={(open) => setDebugCollapsed(!open)}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-4 border-t bg-gray-100 hover:bg-gray-200"
            >
              <div className="flex items-center gap-2">
                <Bug className="w-4 h-4 text-gray-500" />
                <span className="font-medium">Debug Changes</span>
                <Badge variant="outline" className="text-xs">
                  {externalQueue.length + taskQueue.length + ledgerList.length}
                </Badge>
              </div>
              {debugCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            {/* Debug Controls */}
            <div className="border-t bg-gray-50/50 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Step {currentStep}/{totalSteps}</span>
                <span>•</span>
                <span>{claim.templateId}</span>
                <span>•</span>
                <span>{claim.executionId}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={stepForward} disabled={loading || currentStep >= totalSteps}>
                  <StepForward className="w-3 h-3 mr-1" />
                  Step
                </Button>
                <Button variant="outline" size="sm" onClick={runComplete} disabled={loading}>
                  <Play className="w-3 h-3 mr-1" />
                  Complete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/workflow-editor/${claim.templateId}?executionId=${claim.executionId}`, '_blank')}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Template Editor
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x border-t">

          {/* 1. External Queue */}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-blue-500" />
              <h5 className="font-medium text-sm">External Queue</h5>
              <Badge variant="outline" className="text-xs">{externalQueue.filter(e => e.status === 'waiting').length}</Badge>
            </div>
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {externalQueue.map((event, i) => (
                  <div key={event.id} className={`p-2 rounded text-xs border ${event.status === 'processed' ? 'bg-gray-50 opacity-60' : 'bg-blue-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs">#{event.id.slice(-6)}</span>
                      <Badge className={event.status === 'processed' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-600'} variant="outline">
                        {event.status}
                      </Badge>
                    </div>
                    <div className="text-gray-600">
                      <div>→ {event.target}</div>
                      <div>Value: {event.value}</div>
                    </div>
                  </div>
                ))}
                {externalQueue.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-xs">
                    No external events
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* 2. Task Queue */}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <h5 className="font-medium text-sm">Task Queue</h5>
              <Badge variant="outline" className="text-xs">{taskQueue.filter(t => t.status === 'processing').length}</Badge>
            </div>
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {taskQueue.map((task, i) => (
                  <div key={task.id} className={`p-2 rounded text-xs border ${task.status === 'processing' ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs">{task.type}</span>
                      <Badge className={task.status === 'processing' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'} variant="outline">
                        {task.status}
                      </Badge>
                    </div>
                    <div className="text-gray-600">
                      <div>Node: {task.node}</div>
                      <div>Data: {formatValue(task.data)}</div>
                    </div>
                  </div>
                ))}
                {taskQueue.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-xs">
                    No active tasks
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* 3. Ledger List */}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <List className="w-4 h-4 text-green-500" />
              <h5 className="font-medium text-sm">Ledger List</h5>
              <Badge variant="outline" className="text-xs">{ledgerList.length}</Badge>
            </div>
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {ledgerList.slice(-20).reverse().map((entry, i) => (
                  <div key={i} className="p-2 rounded text-xs border bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs">#{entry.seq}</span>
                      <Badge className={getActionColor(entry.action)} variant="outline">
                        {entry.action}
                      </Badge>
                    </div>
                    <div className="text-gray-600">
                      <div>{entry.node}</div>
                      <div>{formatValue(entry.value)}</div>
                    </div>
                  </div>
                ))}
                {ledgerList.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-xs">
                    No ledger entries
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}