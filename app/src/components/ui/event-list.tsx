"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Event } from "../../types/events";
import { fetchFromDb, updateDb } from "../../utils/api";
import { matchEventToRule } from "../../utils/eventMatching";
import { getValueByPath } from "../../utils/eventMatching";
import { CreateEventModal } from "../events/CreateEventModal";
import { Button } from "./button";
import { Card } from "./card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, MoveHorizontal, Plus, Trash2 } from "lucide-react";

interface EventListProps {
  procedureId: string;
}

export default function EventList({ procedureId }: EventListProps) {
  const [pledData, setPledData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableEvents, setAvailableEvents] = useState<Record<string, any>>({});
  const [processedEvents, setProcessedEvents] = useState<Event[]>([]);
  const [selectedAvailable, setSelectedAvailable] = useState<string[]>([]);
  const [selectedProcessed, setSelectedProcessed] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [history, setHistory] = useState<{
    events: any[];
    messages: any[];
    stateTransitions: any[];
  }>();
  const searchParams = useSearchParams();
  const highlightedEvent = searchParams?.get("highlight");
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Load data through DB API
  useEffect(() => {
    const loadPledData = async () => {
      try {
        setIsLoading(true);
        const data = await fetchFromDb();
        setPledData(data);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPledData();
  }, []);

  // Get the instance with null check
  const instance = pledData?.procedureInstances?.find((p: any) => p.instanceId === procedureId);

  useEffect(() => {
    if (pledData && !isLoading) {
      fetchEvents();
    }
  }, [pledData, isLoading]);

  const fetchEvents = async () => {
    if (!pledData?.eventTemplates) return;

    try {
      const availableEvts = Object.entries(pledData.eventTemplates).reduce(
        (acc, [key, event]: [any, any]) => {
          if (!event.received) {
            acc[key] = event;
          }
          return acc;
        },
        {} as Record<string, any>,
      );

      const processedEvts = instance?.history?.events || [];

      setAvailableEvents(availableEvts);
      setProcessedEvents(processedEvts);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  };

  const toggleEventExpand = (id: string) => {
    setExpandedEvents(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
  };

  const handleTransfer = async (direction: "receive" | "revert") => {
    if (!pledData) return;

    setIsProcessing(true);
    try {
      const updatedPledData = JSON.parse(JSON.stringify(pledData));

      const instanceIndex = updatedPledData.procedureInstances.findIndex((p: any) => p.instanceId === procedureId);

      if (instanceIndex === -1) {
        throw new Error("Instance not found");
      }

      if (direction === "receive") {
        // Process selected events
        const eventsToProcess = selectedAvailable.map(key => {
          const event = availableEvents[key];
          return {
            id: `${event.id}-${Date.now()}`,
            type: event.type,
            timestamp: new Date().toISOString(),
            data: event.template.data,
          };
        });

        // Update instance history
        if (!updatedPledData.procedureInstances[instanceIndex].history) {
          updatedPledData.procedureInstances[instanceIndex].history = { events: [], messages: [] };
        }

        updatedPledData.procedureInstances[instanceIndex].history.events = [
          ...(updatedPledData.procedureInstances[instanceIndex].history.events || []),
          ...eventsToProcess,
        ];

        // Mark events as received in eventTemplates
        selectedAvailable.forEach(key => {
          if (updatedPledData.eventTemplates[key]) {
            updatedPledData.eventTemplates[key].received = true;
          }
        });
      } else {
        // Revert: Remove events from processed and their associated messages
        const updatedProcessedEvents = processedEvents.filter(event => !selectedProcessed.includes(event.id));

        updatedPledData.procedureInstances[instanceIndex].history.events = updatedProcessedEvents;

        const existingMessages = updatedPledData.procedureInstances[instanceIndex].history.messages || [];
        const updatedMessages = existingMessages.filter(
          (message: any) => !selectedProcessed.includes(message.fromEvent),
        );

        updatedPledData.procedureInstances[instanceIndex].history.messages = updatedMessages;

        // Mark events as not received in eventTemplates
        selectedProcessed.forEach(eventId => {
          const templateKey = Object.keys(updatedPledData.eventTemplates).find(key =>
            eventId.startsWith(`${updatedPledData.eventTemplates[key].id}-`),
          );
          if (templateKey) {
            updatedPledData.eventTemplates[templateKey].received = false;
          }
        });
      }

      // Update data through DB API
      await updateDb(updatedPledData);

      // Refresh data
      const refreshedData = await fetchFromDb();
      setPledData(refreshedData);

      // Update available events
      const availableEvts = Object.entries(refreshedData.eventTemplates).reduce(
        (acc, [key, event]: [any, any]) => {
          if (!event.received) {
            acc[key] = event;
          }
          return acc;
        },
        {} as Record<string, any>,
      );

      const processedEvts = refreshedData.procedureInstances[instanceIndex].history.events || [];

      setAvailableEvents(availableEvts);
      setProcessedEvents(processedEvts);

      // Clear selections
      if (direction === "receive") {
        setSelectedAvailable([]);
      } else {
        setSelectedProcessed([]);
      }
    } catch (error) {
      console.error(`Error ${direction}ing events:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getMatchingRules = (event: any) => {
    const template = pledData.procedureTemplates.find((t: any) => t.templateId === "hiring_process");

    if (!template) return [];

    // Get the instance variables
    const instance = pledData.procedureInstances.find((p: any) => p.instanceId === procedureId);

    const variables = instance?.variables || {};

    // For available events, we need to convert the template to match event format
    const eventToMatch = event.template
      ? {
          type: event.type,
          data: event.template.data,
        }
      : event;

    return template.messageRules.filter((rule: any) =>
      matchEventToRule(
        eventToMatch,
        {
          type: rule.matches.type,
          conditions: rule.matches.conditions,
        },
        variables,
      ),
    );
  };

  const renderTransition = (transition: any) => {
    if (typeof transition === "string") {
      return <span className="text-xs bg-blue-100 px-2 py-0.5 rounded">{transition}</span>;
    }

    // If it's an object with 'to' and 'conditions'
    if (transition.to) {
      return (
        <span className="text-xs bg-blue-100 px-2 py-0.5 rounded flex gap-1 items-center">
          <span>{transition.to}</span>
          {transition.conditions && <span className="text-xs bg-blue-200 px-1 rounded">with conditions</span>}
        </span>
      );
    }

    return null;
  };

  const getCapturedOutputs = () => {
    const instance = pledData.procedureInstances.find((p: any) => p.instanceId === procedureId);

    const outputs: Record<string, Record<string, any>> = {};

    // Get all rules with captures
    const template = pledData.procedureTemplates.find((t: any) => t.templateId === "hiring_process");

    instance?.messages?.forEach((message: any) => {
      const rule = template?.messageRules.find((r: any) => r.id === message.rule);
      if (rule?.captures) {
        // Group by message type
        if (!outputs[message.type]) {
          outputs[message.type] = {};
        }

        Object.entries(rule.captures).forEach(([key, pathTemplate]: [any, any]) => {
          const event = processedEvents.find(e => e.id === message.fromEvent);
          if (event) {
            const pathMatch = pathTemplate.toString().match(/{{event\.data\.(.+)}}/);
            if (pathMatch && pathMatch[1]) {
              const path = pathMatch[1];
              const value = getValueByPath(event.data, path);
              if (value !== undefined) {
                outputs[message.type][key] = value;
              }
            }
          }
        });
      }
    });

    return outputs;
  };

  // First, let's combine the instance variables with captured outputs
  const getAllVariables = () => {
    const baseVars = instance?.variables || {};
    const capturedVars = getCapturedOutputs();

    // Convert captured vars to match instance variables format
    const capturedFormatted = Object.entries(capturedVars).reduce(
      (acc, [messageType, captures]) => {
        const sectionName = messageType.replace(/_/g, " ");
        acc[sectionName] = captures;
        return acc;
      },
      {} as Record<string, any>,
    );

    return {
      ...baseVars,
      ...capturedFormatted,
    };
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!pledData) return;

    try {
      const updatedPledData = JSON.parse(JSON.stringify(pledData));

      if (updatedPledData.eventTemplates[eventId]) {
        delete updatedPledData.eventTemplates[eventId];
      }

      // Update data through DB API
      await updateDb(updatedPledData);

      // Refresh data
      const refreshedData = await fetchFromDb();
      setPledData(refreshedData);
      setAvailableEvents(prev => {
        const updated = { ...prev };
        delete updated[eventId];
        return updated;
      });
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  const toggleEvent = (eventId: string) => {
    setExpandedEvents(prev => (prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]));
  };

  // Auto-expand and scroll to highlighted event
  useEffect(() => {
    if (highlightedEvent && !expandedEvents.includes(highlightedEvent)) {
      setExpandedEvents(prev => [...prev, highlightedEvent]);
      // Scroll into view
      setTimeout(() => {
        const element = document.getElementById(highlightedEvent);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }, [highlightedEvent]);

  // Add helper functions at top
  const getSourceBadgeStyle = (source: string) => {
    switch (source) {
      case "manual":
        return "bg-blue-100 text-blue-800";
      case "action":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSourceLabel = (event: any) => {
    // For events in event templates/list
    if (event.template?.source) return event.template.source;

    // For history events from actions
    if (event.type === "CUSTOM_EVENT") return "action";

    // For manually added events in history
    if (event.id?.startsWith("email_received_")) return "manual";

    // Default case
    return "received";
  };

  if (isLoading) {
    return <div className="flex justify-center items-center p-4">Loading...</div>;
  }

  if (!pledData) {
    return <div className="flex justify-center items-center p-4">Error loading data</div>;
  }

  return (
    <div className="space-y-8">
      {/* Events Table Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Events</h2>
          <Button onClick={() => setShowTransferModal(true)}>
            <MoveHorizontal className="h-4 w-4 mr-2" />
            Manage Events
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Matching Rules</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedEvents?.map((event: any) => (
                <TableRow
                  key={event.id}
                  className={`${highlightedEvent === event.id ? "bg-yellow-50" : ""}`}
                  id={event.id}
                >
                  <TableCell>
                    <div className="font-medium">{event.type}</div>
                  </TableCell>
                  <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toggleEvent(event.id)}>
                      {expandedEvents.includes(event.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    {expandedEvents.includes(event.id) && (
                      <div className="mt-2 space-y-3">
                        {/* Source Badge */}
                        <div className="flex items-center">
                          <span className="text-xs font-medium mr-2">Source:</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getSourceBadgeStyle(getSourceLabel(event))}`}
                          >
                            {getSourceLabel(event)}
                          </span>
                        </div>

                        {/* Event Data */}
                        <div>
                          <span className="text-xs font-medium">Data:</span>
                          <pre className="text-xs whitespace-pre-wrap bg-gray-50 p-2 rounded mt-1">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                        </div>

                        {/* History for action events */}
                        {event.template?.source === "action" && event.template.history && (
                          <div>
                            <span className="text-xs font-medium">Event History:</span>
                            <div className="mt-1 overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-2 py-1 text-left">Time</th>
                                    <th className="px-2 py-1 text-left">Type</th>
                                    <th className="px-2 py-1 text-left">Details</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {event.template.history.events.map((historyEvent: any) => (
                                    <tr key={historyEvent.id}>
                                      <td className="px-2 py-1">{new Date(historyEvent.timestamp).toLocaleString()}</td>
                                      <td className="px-2 py-1">{historyEvent.type}</td>
                                      <td className="px-2 py-1">{JSON.stringify(historyEvent.data)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getMatchingRules(event).map((rule: any) => (
                        <span key={rule.id} className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          {rule.id}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Event Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage Events</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4">
            {/* Available Events */}
            <Card className="flex-1 p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Available Events</h3>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-gray-500">
                    {selectedAvailable.length}/{Object.keys(availableEvents || {})?.length || 0} selected
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-auto">
                {Object.entries(availableEvents || {})
                  .filter(([_, event]) => !event.received)
                  .map(([key, event]: [string, any]) => (
                    <div key={key} className="border rounded">
                      <div
                        className={`p-2 ${
                          selectedAvailable.includes(key) ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => {
                              setSelectedAvailable(prev =>
                                prev.includes(key) ? prev.filter(id => id !== key) : [...prev, key],
                              );
                            }}
                          >
                            <span className="font-medium text-sm">{event.type}</span>
                          </div>
                          <div className="flex gap-2 items-center">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteEvent(key);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={e => {
                                e.stopPropagation();
                                toggleEventExpand(key);
                              }}
                            >
                              {expandedEvents.includes(key) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        {getMatchingRules(event).length > 0 && (
                          <div className="flex gap-1 mt-1">
                            <p className="text-xs font-medium">Matches:</p>
                            <div className="flex flex-wrap gap-1">
                              {getMatchingRules(event).map((rule: any) => (
                                <span
                                  key={rule.id}
                                  className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded"
                                >
                                  {rule.id}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {expandedEvents.includes(key) && (
                        <div className="p-2 border-t bg-gray-50">
                          <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[300px]">
                            {JSON.stringify(event.template.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </Card>

            {/* Transfer Controls */}
            <div className="flex flex-col gap-2 py-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTransfer("receive")}
                disabled={isProcessing || selectedAvailable.length === 0}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTransfer("revert")}
                disabled={isProcessing || selectedProcessed.length === 0}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* Processed Events */}
            <Card className="flex-1 p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Processed Events</h3>
                <span className="text-sm text-gray-500">
                  {selectedProcessed.length}/{processedEvents?.length || 0} selected
                </span>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-auto">
                {processedEvents?.map((event: any) => (
                  <div key={event.id} className="border rounded">
                    <div
                      className={`p-2 cursor-pointer ${
                        selectedProcessed.includes(event.id) ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                      }`}
                      onClick={() => {
                        setSelectedProcessed(prev =>
                          prev.includes(event.id) ? prev.filter(id => id !== event.id) : [...prev, event.id],
                        );
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{event.type}</span>
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={e => {
                              e.stopPropagation();
                              toggleEventExpand(event.id);
                            }}
                          >
                            {expandedEvents.includes(event.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      {event.triggeredTransitions?.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {event.triggeredTransitions.map((transition: any, i: any) => (
                            <div key={i} className="flex gap-1 mt-1">
                              {renderTransition(transition)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {expandedEvents.includes(event.id) && (
                      <div className="p-2 border-t bg-gray-50">
                        {getMatchingRules(event).length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium mb-1">Matching Rules:</p>
                            <div className="flex flex-wrap gap-1">
                              {getMatchingRules(event).map((rule: any) => (
                                <span
                                  key={rule.id}
                                  className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded"
                                >
                                  {rule.id}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[300px]">
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instance Variables Card */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Instance Variables</h3>
        <div className="space-y-4">
          {Object.entries(getAllVariables()).map(([section, vars]: [any, any]) => (
            <div key={section} className="space-y-1">
              <h4 className="text-sm font-medium capitalize">{section}</h4>
              <div className="pl-2 space-y-1">
                {Object.entries(vars).map(([key, value]: [any, any]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">{key}:</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Create Event Modal */}
      <CreateEventModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={async template => {
          try {
            const response = await fetch("/api/events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: template,
                action: "add_template",
                procedureId,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error("Error response:", errorData);
              throw new Error(errorData.error || "Failed to create event");
            }

            // Refresh the events list
            const refreshedData = await fetchFromDb();
            setPledData(refreshedData);
            await fetchEvents();
            setShowCreateModal(false);
          } catch (error) {
            console.error("Error creating event:", error);
          }
        }}
      />
    </div>
  );
}
