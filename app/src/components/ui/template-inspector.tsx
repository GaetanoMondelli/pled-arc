"use client";

import { useState } from "react";
import Link from "next/link";
import { D3Graph } from "./d3-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  CheckCircle,
  Clock,
  Code,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  GitBranch,
  Play,
  Settings,
  Zap,
} from "lucide-react";

interface TemplateInspectorProps {
  template: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateInspector({ template, open, onOpenChange }: TemplateInspectorProps) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!template) return null;

  // Use the same parsing functions as template detail page
  const states = parseStateMachine(template.stateMachine?.fsl || "");
  const transitions = parseTransitions(template.stateMachine?.fsl || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {template.name}
          </DialogTitle>
          <DialogDescription>Template inspection and playground</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="state-machine">State Machine</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="playground">Playground</TabsTrigger>
          </TabsList>

          <div className="flex-1 mt-4">
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Template Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-sm font-medium">Description:</span>
                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                    </div>

                    <div>
                      <span className="text-sm font-medium">Category:</span>
                      <Badge variant="outline" className="ml-2">
                        {template.category || "general"}
                      </Badge>
                    </div>

                    <div>
                      <span className="text-sm font-medium">Variables:</span>
                      <div className="mt-1 space-y-1">
                        {Object.keys(template.variables || {}).map(varGroup => (
                          <div key={varGroup} className="text-xs">
                            <span className="font-medium">{varGroup}:</span>{" "}
                            {Object.keys(template.variables[varGroup]).join(", ")}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-sm font-medium">Event Types:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(template.eventTypes || []).map((eventType: any, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {eventType.type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{states.length}</div>
                        <div className="text-xs text-muted-foreground">States</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{transitions.length}</div>
                        <div className="text-xs text-muted-foreground">Transitions</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{(template.messageRules || []).length}</div>
                        <div className="text-xs text-muted-foreground">Rules</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{Object.keys(template.actions || {}).length}</div>
                        <div className="text-xs text-muted-foreground">Actions</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex gap-2">
                      <Link href={`/procedures?template=${template.templateId}`} className="flex-1">
                        <Button size="sm" className="w-full">
                          <Play className="h-3 w-3 mr-1" />
                          Create Instance
                        </Button>
                      </Link>
                      <Link href={`/components-lab?template=${template.templateId}`} className="flex-1">
                        <Button size="sm" variant="outline" className="w-full">
                          <Settings className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="state-machine" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    State Machine Visualization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {states.length > 0 ? (
                    <div className="border rounded-lg p-4 bg-muted/20">
                      <div className="text-center text-muted-foreground py-8">
                        <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>
                          {states.length} states with {transitions.length} transitions
                        </p>
                        <p className="text-xs mt-1">View detailed transitions in the sections below</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No state machine defined</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Show Component Boundaries if available */}
              {template.stateMachine?.components && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Component Boundaries
                    </CardTitle>
                    <CardDescription>This template is built from composable state machine components</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(template.stateMachine.components).map(
                        ([componentId, component]: [string, any]) => (
                          <div key={componentId} className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{componentId}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">{component.purpose}</div>
                            <div className="flex flex-wrap gap-1">
                              {component.states.map((state: string) => (
                                <Badge key={state} variant="secondary" className="text-xs">
                                  {state}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>State Machine Definition</CardTitle>
                  <CardDescription>
                    The workflow state transitions defined in FSL (Finite State Language)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {template.stateMachine ? (
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-medium mb-2">FSL Definition:</h4>
                        <div className="bg-gray-50 rounded p-4 font-mono text-xs border">
                          <pre className="whitespace-pre-wrap">{formatFslForDisplay(template.stateMachine.fsl)}</pre>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              Initial State
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Badge variant="outline" className="font-mono">
                              {template.stateMachine.initial || "idle"}
                            </Badge>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Clock className="h-4 w-4 text-blue-600" />
                              All States
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-1">
                              {parseStateMachine(template.stateMachine.fsl).map(state => (
                                <Badge key={state} variant="secondary" className="text-xs font-mono">
                                  {state}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-red-600" />
                              Final States
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-1">
                              {template.stateMachine.final?.length > 0 ? (
                                template.stateMachine.final.map((state: string) => (
                                  <Badge key={state} variant="destructive" className="text-xs font-mono">
                                    {state}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-gray-600">None defined</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">State Transitions:</h4>
                        <div className="space-y-2">
                          {parseTransitions(template.stateMachine.fsl).map((transition, index) => (
                            <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                              <Badge variant="outline" className="font-mono">
                                {transition.from}
                              </Badge>
                              <span className="text-gray-500">on</span>
                              <Badge variant="secondary" className="font-mono">
                                {transition.trigger}
                              </Badge>
                              <span className="text-gray-500">→</span>
                              <Badge variant="outline" className="font-mono">
                                {transition.to}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No state machine defined for this template</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rules" className="space-y-4">
              <div className="space-y-4">
                {(template.messageRules || []).map((rule: any, index: number) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Rule {index + 1}: {rule.id || `rule_${index}`}
                      </CardTitle>
                      {rule.priority && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Priority: {rule.priority}</Badge>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {rule.matches && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Matches</h4>
                          <div className="bg-muted p-2 rounded text-xs">
                            <div>
                              <span className="font-medium">Type:</span> {rule.matches.type}
                            </div>
                            {rule.matches.conditions &&
                              Object.entries(rule.matches.conditions).map(([key, value]) => (
                                <div key={key} className="ml-2">
                                  <span className="font-medium">{key}:</span> {String(value)}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {rule.generates && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Generates</h4>
                          <div className="bg-muted p-2 rounded text-xs">
                            <div>
                              <span className="font-medium">Type:</span> {rule.generates.type}
                            </div>
                            {rule.generates.template && (
                              <div className="ml-2 mt-1">
                                {rule.generates.template.title && (
                                  <div>
                                    <span className="font-medium">Title:</span> {rule.generates.template.title}
                                  </div>
                                )}
                                {rule.generates.template.content && (
                                  <div>
                                    <span className="font-medium">Content:</span> {rule.generates.template.content}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {rule.transition && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Transition</h4>
                          <div className="bg-muted p-2 rounded text-xs">
                            <div>
                              <span className="font-medium">To:</span> {rule.transition.to}
                            </div>
                            {rule.transition.conditions && (
                              <div className="ml-2 mt-1">
                                {Object.entries(rule.transition.conditions).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="font-medium">{key}:</span> {String(value)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {(template.messageRules || []).length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No message rules defined</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <div className="space-y-4">
                {Object.entries(template.actions || {}).map(([state, actions]: [string, any]) => (
                  <Card key={state}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        {state}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Array.isArray(actions) ? (
                          actions.map((action: any, index: number) => (
                            <div key={index} className="bg-muted p-3 rounded text-sm">
                              <div className="font-medium mb-1">{action.type}</div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                {Object.entries(action.config || {}).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="font-medium">{key}:</span> {String(value)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-muted-foreground text-sm">No actions configured</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {Object.keys(template.actions || {}).length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No actions defined</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="playground" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Template Playground
                  </CardTitle>
                  <CardDescription>Test this template with sample data and see how it behaves</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border">
                      <h4 className="font-medium mb-2">Quick Actions</h4>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/procedures?template=${template.templateId}`}>
                          <Button size="sm">
                            <Play className="h-3 w-3 mr-1" />
                            Create Live Instance
                          </Button>
                        </Link>
                        <Link href={`/components-lab?template=${template.templateId}`}>
                          <Button size="sm" variant="outline">
                            <Settings className="h-3 w-3 mr-1" />
                            Edit in Component Lab
                          </Button>
                        </Link>
                        <Button size="sm" variant="outline">
                          <Copy className="h-3 w-3 mr-1" />
                          Duplicate Template
                        </Button>
                      </div>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Sample Variables</h4>
                      <div className="space-y-2 text-sm">
                        {Object.entries(template.variables || {}).map(([groupKey, group]: [string, any]) => (
                          <div key={groupKey} className="space-y-1">
                            <div className="font-medium text-xs uppercase tracking-wide">{groupKey}</div>
                            {Object.entries(group).map(([key, variable]: [string, any]) => (
                              <div key={key} className="ml-2 flex items-center justify-between">
                                <span>{key}</span>
                                <Badge variant="outline" className="text-xs">
                                  {variable.type}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Expected Event Types</h4>
                      <div className="space-y-1">
                        {(template.eventTypes || []).map((eventType: any, index: number) => (
                          <div key={index} className="text-sm flex items-center justify-between">
                            <span>{eventType.type}</span>
                            <div className="text-xs text-muted-foreground">
                              {Object.keys(eventType.schema).length} fields
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function parseStateMachine(fsl: string): string[] {
  const states = new Set<string>();

  // Remove comments and normalize newlines to spaces
  const cleanedFsl = fsl
    .replace(/\/\*.*?\*\//g, "") // Remove /* comment */ blocks
    .replace(/\n/g, " ") // Convert newlines to spaces
    .replace(/\s+/g, " "); // Normalize multiple spaces

  const transitions = cleanedFsl.split(";").filter(Boolean);

  transitions.forEach(transition => {
    const match = transition.trim().match(/(\w+)\s+['"]([^'"]+)['"]?\s*->\s*(\w+)/);
    if (match) {
      states.add(match[1]); // from state
      states.add(match[3]); // to state
    }
  });

  return Array.from(states);
}

function parseTransitions(fsl: string): Array<{ from: string; trigger: string; to: string }> {
  const transitions: Array<{ from: string; trigger: string; to: string }> = [];

  // Remove comments and normalize newlines to spaces
  const cleanedFsl = fsl
    .replace(/\/\*.*?\*\//g, "") // Remove /* comment */ blocks
    .replace(/\n/g, " ") // Convert newlines to spaces
    .replace(/\s+/g, " "); // Normalize multiple spaces

  const transitionStrings = cleanedFsl.split(";").filter(Boolean);

  transitionStrings.forEach(transition => {
    const match = transition.trim().match(/(\w+)\s+['"]([^'"]+)['"]?\s*->\s*(\w+)/);
    if (match) {
      transitions.push({
        from: match[1],
        trigger: match[2],
        to: match[3],
      });
    }
  });

  return transitions;
}

function formatFslForDisplay(fsl: string): string {
  return (
    fsl
      // Add line breaks after each transition
      .replace(/;\s*/g, ";\n")
      // Format component comments with proper spacing
      .replace(/\/\*\s*(.*?)\s*\*\//g, "\n\n/* $1 */\n")
      // Clean up extra whitespace but preserve intentional line breaks
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
