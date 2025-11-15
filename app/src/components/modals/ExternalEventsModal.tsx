"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Database, Clock, Hash, Plus, Play, Trash2, Copy, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExternalEventCreator } from "@/app/template-editor/components/ExternalEventCreator";

// Component for expandable external event display
function ExpandableExternalEvent({ event, onDelete, onReplay }: { event: any; onDelete: (id: string) => void; onReplay: (event: any) => void; }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Unwrap event if it's wrapped in simulation format {timestamp, value}
  const actualEvent = event.value || event;

  return (
    <div className="border border-gray-200 bg-white rounded">
      <div className="flex items-center justify-between text-sm px-3 py-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
            title={isExpanded ? "Collapse event" : "Expand event"}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          <span className="font-mono text-gray-600 text-xs font-medium">{actualEvent.id}</span>
          <Badge variant="outline" className="text-xs">{actualEvent.type}</Badge>
          <span className="text-gray-600 text-xs">{actualEvent.source}</span>
          {actualEvent.targetDataSourceId && (
            <span className="text-blue-600 text-xs font-mono">→ {actualEvent.targetDataSourceId}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span className="font-mono">{new Date(event.timestamp || actualEvent.timestamp).toLocaleTimeString()}</span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onReplay(actualEvent)}
            className="h-6 px-2 text-blue-600 hover:text-blue-700"
            title="Replay this event"
          >
            <Play className="w-3 h-3" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(actualEvent.id)}
            className="h-6 px-2 text-red-600 hover:text-red-700"
            title="Delete this event"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Expanded view with full event details */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-3 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Event Details</h4>
              <div className="space-y-1">
                <div><span className="font-medium">ID:</span> <span className="font-mono">{actualEvent.id}</span></div>
                <div><span className="font-medium">Type:</span> <span className="font-mono">{actualEvent.type}</span></div>
                <div><span className="font-medium">Source:</span> <span className="font-mono">{actualEvent.source}</span></div>
                <div><span className="font-medium">Timestamp:</span> <span className="font-mono">{new Date(event.timestamp || actualEvent.timestamp).toISOString()}</span></div>
                {actualEvent.targetDataSourceId && (
                  <div><span className="font-medium">Target:</span> <span className="font-mono">{actualEvent.targetDataSourceId}</span></div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Event Data</h4>
              <div className="p-2 bg-white rounded border font-mono text-xs overflow-x-auto max-h-32">
                <pre>{JSON.stringify(actualEvent.data, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExternalEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  externalQueue?: any; // ExternalEventQueue instance
  engine?: any; // SimulationEngine instance
}

export function ExternalEventsModal({ isOpen, onClose, externalQueue, engine }: ExternalEventsModalProps) {
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { toast } = useToast();

  // Force refresh of events list
  const refreshEvents = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Get external events from queue
  const externalEvents = useMemo(() => {
    if (!externalQueue) return [];
    return externalQueue.getAllEvents() || [];
  }, [externalQueue, isOpen, refreshTrigger]); // Re-fetch when modal opens OR refreshTrigger changes

  // Get available data sources for smart suggestions
  const dataSources = useMemo(() => {
    if (!engine?.scenario) return [];

    try {
      const scenarioInfo = engine.scenario.getScenarioInfo();
      if (scenarioInfo?.nodes) {
        return scenarioInfo.nodes
          .filter((node: any) => node.type === 'DataSource' || node.type === 'DataSourceNode')
          .map((node: any) => ({
            id: node.id || node.nodeId,
            name: node.displayName || node.name || node.id || node.nodeId,
            type: node.type
          }));
      }
    } catch (error) {
      console.warn('Failed to get data sources:', error);
    }

    return [];
  }, [engine]);

  // Smart event suggestions based on data sources
  const smartSuggestions = useMemo(() => {
    // If we have data sources, create suggestions for each
    if (dataSources.length > 0) {
      return dataSources.map(ds => ({
        dataSourceId: ds.id,
        dataSourceName: ds.name,
        suggestions: [
          {
            id: `approve_${ds.id}_${Date.now()}`,
            type: 'user_action',
            label: 'Approval Action',
            description: `User approves document/order for ${ds.name}`,
            data: {
              action: 'approve',
              userId: 'user123',
              documentId: `doc_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString()
            }
          },
          {
            id: `reject_${ds.id}_${Date.now()}`,
            type: 'user_action',
            label: 'Rejection Action',
            description: `User rejects document/order for ${ds.name}`,
            data: {
              action: 'reject',
              userId: 'user123',
              documentId: `doc_${Math.random().toString(36).substr(2, 9)}`,
              reason: 'Invalid information',
              timestamp: new Date().toISOString()
            }
          },
          {
            id: `api_${ds.id}_${Date.now()}`,
            type: 'api_call',
            label: 'API Event',
            description: `External API call for ${ds.name}`,
            data: {
              endpoint: '/api/process',
              method: 'POST',
              payload: {
                id: `item_${Math.random().toString(36).substr(2, 9)}`,
                status: 'pending'
              },
              timestamp: new Date().toISOString()
            }
          }
        ]
      }));
    }

    // If no data sources detected, provide generic suggestions
    return [{
      dataSourceId: 'default',
      dataSourceName: 'Generic Data Source',
      suggestions: [
        {
          id: `user_action_${Date.now()}`,
          type: 'user_action',
          label: 'User Action',
          description: 'Generic user interaction event',
          data: {
            action: 'approve',
            userId: 'user123',
            documentId: `doc_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
          }
        },
        {
          id: `api_call_${Date.now()}`,
          type: 'api_call',
          label: 'API Call',
          description: 'External system API call',
          data: {
            endpoint: '/api/process',
            method: 'POST',
            payload: {
              id: `item_${Math.random().toString(36).substr(2, 9)}`,
              status: 'pending'
            },
            timestamp: new Date().toISOString()
          }
        },
        {
          id: `webhook_${Date.now()}`,
          type: 'webhook',
          label: 'Webhook Event',
          description: 'External webhook notification',
          data: {
            event: 'payment_received',
            amount: 100.50,
            orderId: `order_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
          }
        }
      ]
    }];
  }, [dataSources]);

  const handleCreateSuggestedEvent = (suggestion: any, dataSourceId: string) => {
    if (!externalQueue) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'External queue not available'
      });
      return;
    }

    try {
      const externalEvent = {
        id: suggestion.id,
        timestamp: Date.now(),
        type: suggestion.type,
        source: 'smart_suggestion',
        data: suggestion.data,
        targetDataSourceId: dataSourceId
      };

      externalQueue.addEvent(externalEvent);

      toast({
        title: 'Event Created',
        description: `${suggestion.label} added to external queue`
      });

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Create Event',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    // Note: We'd need to add a delete method to ExternalEventQueue
    toast({
      title: 'Delete Event',
      description: 'Delete functionality would be implemented here'
    });
  };

  const handleReplayEvent = (event: any) => {
    if (!externalQueue) return;

    try {
      // Create a new event with current timestamp for replay
      const replayEvent = {
        ...event,
        id: `replay_${event.id}_${Date.now()}`,
        timestamp: Date.now()
      };

      externalQueue.addEvent(replayEvent);

      toast({
        title: 'Event Replayed',
        description: `Event "${event.id}" added for replay`
      });

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Replay Event',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="font-headline flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-500" />
            External Events Queue
          </DialogTitle>
          <DialogDescription>
            Manage external events that trigger simulation processing
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              <span className="font-mono font-medium">{externalEvents.length}</span> external events
            </div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              <span className="font-mono font-medium">{dataSources.length}</span> data sources
            </div>
          </div>

          {/* Create New Event Button */}
          <ExternalEventCreator
            externalQueue={externalQueue}
            engine={engine}
            onEventCreated={refreshEvents}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
          {/* Existing External Events */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              External Events ({externalEvents.length})
            </h3>

            {externalEvents.length > 0 ? (
              <div className="space-y-2">
                {externalEvents.map((event: any, idx: number) => (
                  <ExpandableExternalEvent
                    key={event.id || `event-${idx}-${event.timestamp || Date.now()}`}
                    event={event}
                    onDelete={handleDeleteEvent}
                    onReplay={handleReplayEvent}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Database className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No external events yet</p>
                <p className="text-xs">Click "Add External Event" above to create your first event</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t mt-auto flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}