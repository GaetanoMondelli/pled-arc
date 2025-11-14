"use client";

import { useEffect, useState } from "react";
import { TabPosition } from "./playground-view";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { TemplateVariable } from "./template-variable";
import { Textarea } from "./textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Activity, Bell, Calendar, ChevronRight, FileSignature, Mail, Plus, Trash2 } from "lucide-react";
import { fetchFromDb } from "@/utils/api";

// Define action type icons mapping
const actionIcons: Record<string, any> = {
  SEND_EMAIL: Mail,
  CREATE_CALENDAR_EVENT: Calendar,
  SEND_REMINDER: Bell,
  DOCUSIGN_SEND: FileSignature,
  CUSTOM_EVENT: Activity,
};

const defaultActionIcon = ChevronRight;

// Update the DocuSign action type
type DocuSignAction = {
  type: "DOCUSIGN_SEND";
  template: {
    source: "action";
    data: {
      type: "DOCUSIGN_SEND";
      file: {
        name: string;
        content: string; // base64 encoded file content
      };
      recipients: string[];
      tabPositions: TabPosition[];
    };
  };
};

interface ActionListProps {
  procedureId: string;
}

const ACTION_TYPES = [
  { value: "DOCUSIGN_SEND", label: "Send via DocuSign" },
  { value: "DOCUSIGN_CLICK_SEND", label: "Send via DocuSign Click" },
  { value: "CUSTOM_EVENT", label: "Custom Event" },
  { value: "SEND_EMAIL", label: "Send Email" },
  { value: "CREATE_CALENDAR_EVENT", label: "Create Calendar Event" },
  { value: "SEND_REMINDER", label: "Send Reminder" },
];

export const ActionList = ({ procedureId }: ActionListProps) => {
  const [instance, setInstance] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [showAddAction, setShowAddAction] = useState(false);
  const [newAction, setNewAction] = useState({ state: "", eventData: "{}" });
  const [expandedActions, setExpandedActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState<"raw" | "docusign" | "docusign_click">("raw");
  const [docuSignData, setDocuSignData] = useState({
    file: null as File | null,
    recipients: "",
    tabPositions: [] as TabPosition[],
  });
  const [clickData, setClickData] = useState({
    clickwrapName: "",
    documents: [] as File[],
  });

  // Single data fetch on mount or procedureId change
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const data = await fetchFromDb();
        if (!mounted) return;

        const instance = data.procedureInstances?.find((p: any) => p.instanceId === procedureId);
        const template = data.procedureTemplates?.find((t: any) => t.templateId === instance?.templateId);

        setInstance(instance);
        setTemplate(template);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [procedureId]); // Only re-fetch when procedureId changes

  // For actions that modify data, use a refresh function
  const refreshData = async () => {
    const data = await fetchFromDb();
    const instance = data.procedureInstances?.find((p: any) => p.instanceId === procedureId);
    const template = data.procedureTemplates?.find((t: any) => t.templateId === instance?.templateId);

    setInstance(instance);
    setTemplate(template);
  };

  const handleDeleteAction = async (state: string, actionId: string) => {
    try {
      const response = await fetch("/api/actions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedureId,
          state,
          actionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete action");
      }

      await refreshData(); // Refresh only after modification
    } catch (error) {
      console.error("Error deleting action:", error);
    }
  };

  const handleSaveAction = async () => {
    try {
      let actionTemplate;

      if (actionType === "docusign_click") {
        if (clickData.documents.length === 0) {
          throw new Error("Please select at least one document");
        }

        // Convert files to base64
        const documentPromises = clickData.documents.map(async (file, index) => {
          const fileBuffer = await file.arrayBuffer();
          const base64File = Buffer.from(fileBuffer).toString("base64");
          return {
            documentBase64: base64File,
            documentName: file.name,
            fileExtension: file.name.split(".").pop(),
            order: index,
          };
        });

        const documents = await Promise.all(documentPromises);

        actionTemplate = {
          id: `action_${Date.now()}`,
          type: "DOCUSIGN_CLICK_SEND",
          enabled: true,
          template: {
            source: "action",
            data: {
              clickwrapName: clickData.clickwrapName,
              documents,
            },
          },
        };
      } else if (actionType === "docusign") {
        if (!docuSignData.file) {
          throw new Error("Please select a document");
        }

        // Convert file to base64
        const fileBuffer = await docuSignData.file.arrayBuffer();
        const base64File = Buffer.from(fileBuffer).toString("base64");

        // Create DocuSign action template
        actionTemplate = {
          id: `action_${Date.now()}`,
          type: "DOCUSIGN_SEND",
          enabled: true,
          template: {
            source: "action",
            data: {
              type: "DOCUSIGN_SEND",
              file: {
                name: docuSignData.file.name,
                content: base64File,
              },
              recipients: docuSignData.recipients.split("\n").filter(r => r.trim()),
              tabPositions: docuSignData.tabPositions,
            },
          },
        };
      } else {
        // Existing raw action handling
        let eventData;
        try {
          eventData = JSON.parse(newAction.eventData);
        } catch (e) {
          console.error("Invalid JSON");
          return;
        }
        actionTemplate = {
          id: `action_${Date.now()}`,
          type: eventData.type || "CUSTOM_EVENT",
          enabled: true,
          template: {
            source: "action",
            data: eventData,
          },
        };
      }

      const response = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          procedureId,
          triggerState: newAction.state,
          event: actionTemplate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save action");
      }

      await refreshData(); // Refresh only after modification
      setShowAddAction(false);
      setNewAction({ state: "", eventData: "{}" });
    } catch (error) {
      console.error("Error saving action:", error);
    }
  };

  if (!instance || !template) return null;

  const toggleActions = (state: string) => {
    setExpandedActions(prev => (prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]));
  };

  const actionEntries = Object.entries(template.actions || {}).map(([state, actions]) => {
    console.log(`Actions for state ${state}:`, actions);
    return {
      state,
      actions: Array.isArray(actions) ? actions : [actions],
    };
  });

  const renderTemplateValue = (key: string, value: string) => {
    // Special handling for arrays (like attendees)
    if (Array.isArray(value)) {
      return value
        .map((v, i) => <TemplateVariable key={i} text={v} variables={instance.variables} />)
        .reduce((prev, curr) => (
          <>
            {prev}, {curr}
          </>
        ));
    }

    // Handle multiline text (like email body)
    if (key === "body" || key === "message") {
      return (
        <div className="whitespace-pre-line">
          <TemplateVariable text={value} variables={instance.variables} />
        </div>
      );
    }

    // Default handling
    return <TemplateVariable text={value.toString()} variables={instance.variables} />;
  };

  // Get unique states from the FSM
  const getUniqueStates = () => {
    const fsl = template?.stateMachine?.fsl;
    if (!fsl) return [];

    // Get all states from FSM definition
    const stateMatches = fsl.match(/[a-zA-Z_]+/g) || [];

    // Filter out transitions and get unique states
    const states = new Set(
      stateMatches.filter(
        (word: string) => !["to", "wait_for", "check", "send", "complete", "->", "retry"].includes(word),
      ),
    );

    // Convert to array and sort for consistent ordering
    return Array.from(states).sort();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Actions</h2>
        <Button onClick={() => setShowAddAction(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Action
        </Button>
      </div>

      <Dialog open={showAddAction} onOpenChange={setShowAddAction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Action</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Action Type</Label>
              <Select
                value={actionType}
                onValueChange={(value: "raw" | "docusign" | "docusign_click") => setActionType(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">Raw Action</SelectItem>
                  <SelectItem value="docusign">DocuSign Send</SelectItem>
                  <SelectItem value="docusign_click">DocuSign Click Send</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Trigger State</Label>
              <Select
                value={newAction.state}
                onValueChange={value => setNewAction(prev => ({ ...prev, state: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {(getUniqueStates() as string[]).map((state: string) => (
                    <SelectItem key={`state-${state}`} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {actionType === "docusign" ? (
              <div className="space-y-4">
                <div>
                  <Label>Document</Label>
                  <Input
                    type="file"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setDocuSignData(prev => ({
                          ...prev,
                          file: e.target.files![0],
                        }));
                      }
                    }}
                    accept=".pdf,.doc,.docx"
                  />
                </div>

                <div>
                  <Label>Recipients (one per line)</Label>
                  <Textarea
                    value={docuSignData.recipients}
                    onChange={e =>
                      setDocuSignData(prev => ({
                        ...prev,
                        recipients: e.target.value,
                      }))
                    }
                    placeholder="Enter recipient emails"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Signature Positions</Label>
                  <div className="space-y-2">
                    {docuSignData.tabPositions.map((pos, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Page"
                          value={pos.pageNumber}
                          onChange={e => {
                            const newPositions = [...docuSignData.tabPositions];
                            newPositions[index].pageNumber = e.target.value;
                            setDocuSignData(prev => ({
                              ...prev,
                              tabPositions: newPositions,
                            }));
                          }}
                          className="w-20"
                        />
                        <Input
                          placeholder="X"
                          value={pos.xPosition}
                          onChange={e => {
                            const newPositions = [...docuSignData.tabPositions];
                            newPositions[index].xPosition = e.target.value;
                            setDocuSignData(prev => ({
                              ...prev,
                              tabPositions: newPositions,
                            }));
                          }}
                          className="w-20"
                        />
                        <Input
                          placeholder="Y"
                          value={pos.yPosition}
                          onChange={e => {
                            const newPositions = [...docuSignData.tabPositions];
                            newPositions[index].yPosition = e.target.value;
                            setDocuSignData(prev => ({
                              ...prev,
                              tabPositions: newPositions,
                            }));
                          }}
                          className="w-20"
                        />
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setDocuSignData(prev => ({
                              ...prev,
                              tabPositions: prev.tabPositions.filter((_, i) => i !== index),
                            }));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDocuSignData(prev => ({
                          ...prev,
                          tabPositions: [
                            ...prev.tabPositions,
                            {
                              pageNumber: "1",
                              xPosition: "100",
                              yPosition: "100",
                              name: `SignHere_${prev.tabPositions.length + 1}`,
                              tabLabel: `SignHere_${prev.tabPositions.length + 1}`,
                            },
                          ],
                        }));
                      }}
                    >
                      Add Signature Position
                    </Button>
                  </div>
                </div>
              </div>
            ) : actionType === "docusign_click" ? (
              <div className="space-y-4">
                <div>
                  <Label>Clickwrap Name</Label>
                  <Input
                    value={clickData.clickwrapName}
                    onChange={e =>
                      setClickData(prev => ({
                        ...prev,
                        clickwrapName: e.target.value,
                      }))
                    }
                    placeholder="Enter clickwrap name"
                  />
                </div>

                <div>
                  <Label>Documents</Label>
                  <Input
                    type="file"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setClickData(prev => ({
                          ...prev,
                          documents: [...prev.documents, e.target.files![0]],
                        }));
                      }
                    }}
                    accept=".pdf,.doc,.docx"
                  />
                </div>

                {clickData.documents.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Documents</Label>
                    {clickData.documents.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span>{doc.name}</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setClickData(prev => ({
                              ...prev,
                              documents: prev.documents.filter((_, i) => i !== index),
                            }));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <Label>Event Data (JSON)</Label>
                <Textarea
                  value={newAction.eventData}
                  onChange={e =>
                    setNewAction(prev => ({
                      ...prev,
                      eventData: e.target.value,
                    }))
                  }
                  placeholder="{ 'type': 'CUSTOM_EVENT', ... }"
                  rows={10}
                />
              </div>
            )}

            <Button onClick={handleSaveAction}>Save Action</Button>
          </div>
        </DialogContent>
      </Dialog>

      {actionEntries.map(({ state, actions }) => {
        console.log(`Rendering actions for state ${state}:`, actions);
        return (
          <div key={state} className="border rounded-lg">
            <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleActions(state)}>
              <h3 className="font-medium">{state}</h3>
              <span>{actions.length} actions</span>
            </div>

            {expandedActions.includes(state) && (
              <div className="p-4 space-y-6 bg-accent/50">
                {actions.map((action, index) => {
                  const ActionIcon = actionIcons[action.type] || defaultActionIcon;
                  return (
                    <div key={index} className="bg-background rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <ActionIcon className="h-5 w-5 text-primary" />
                          <h3 className="font-medium text-primary">{action.type}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={action.enabled}
                            onCheckedChange={async checked => {
                              // Update action enabled state
                              const response = await fetch("/api/actions", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  procedureId,
                                  state,
                                  actionId: action.id,
                                  updates: { enabled: checked },
                                }),
                              });
                              if (response.ok) {
                                // Refresh data
                                await refreshData();
                              }
                            }}
                          />
                          <Button onClick={() => handleDeleteAction(state, action.id)} variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <pre className="text-sm bg-accent/50 p-2 rounded">{JSON.stringify(action.template, null, 2)}</pre>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ActionList;
