"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPONENT_LIBRARY,
  ComponentCategory,
  ComponentComposer,
  ComponentConnection,
  StateMachineComponent,
  getComponentsByCategory,
  searchComponents,
} from "@/lib/StateMachineComponents";
import {
  ArrowRight,
  Copy,
  Cpu,
  Download,
  Eye,
  GitBranch,
  Play,
  Plus,
  Search,
  Settings,
  Settings2,
  Trash2,
  Zap,
} from "lucide-react";

interface SelectedComponent {
  component: StateMachineComponent;
  instanceId: string;
  configuration: Record<string, any>;
  position: { x: number; y: number };
}

export function ComponentLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory | "all">("all");
  const [selectedComponent, setSelectedComponent] = useState<StateMachineComponent | null>(null);
  const [workflowComponents, setWorkflowComponents] = useState<SelectedComponent[]>([]);
  const [connections, setConnections] = useState<ComponentConnection[]>([]);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configuringComponent, setConfiguringComponent] = useState<SelectedComponent | null>(null);

  const categories: Array<{ value: ComponentCategory | "all"; label: string; icon: any }> = [
    { value: "all", label: "All Categories", icon: Cpu },
    { value: "data-processing", label: "Data Processing", icon: Cpu },
    { value: "aggregation", label: "Aggregation", icon: GitBranch },
    { value: "splitting", label: "Splitting", icon: GitBranch },
    { value: "transformation", label: "Transformation", icon: Zap },
    { value: "validation", label: "Validation", icon: Settings2 },
    { value: "carbon-credits", label: "Carbon Credits", icon: Zap },
    { value: "external-integration", label: "External Integration", icon: Download },
    { value: "storage", label: "Storage", icon: Settings },
    { value: "notification", label: "Notification", icon: Settings },
    { value: "timing", label: "Timing", icon: Settings },
  ];

  const filteredComponents = useMemo(() => {
    let components =
      selectedCategory === "all" ? Object.values(COMPONENT_LIBRARY) : getComponentsByCategory(selectedCategory);

    if (searchQuery) {
      components = searchComponents(searchQuery);
      if (selectedCategory !== "all") {
        components = components.filter(c => c.category === selectedCategory);
      }
    }

    return components;
  }, [searchQuery, selectedCategory]);

  const addComponentToWorkflow = useCallback((component: StateMachineComponent) => {
    const instanceId = `${component.id}_${Date.now()}`;
    const newComponent: SelectedComponent = {
      component,
      instanceId,
      configuration: Object.fromEntries(
        Object.entries(component.config.parameters).map(([key, param]) => [key, param.defaultValue]),
      ),
      position: {
        x: Math.random() * 400 + 50,
        y: Math.random() * 300 + 50,
      },
    };

    setWorkflowComponents(prev => [...prev, newComponent]);
  }, []);

  const removeComponentFromWorkflow = useCallback((instanceId: string) => {
    setWorkflowComponents(prev => prev.filter(c => c.instanceId !== instanceId));
    setConnections(prev => prev.filter(c => c.from.componentId !== instanceId && c.to.componentId !== instanceId));
  }, []);

  const configureComponent = useCallback((component: SelectedComponent) => {
    setConfiguringComponent(component);
    setConfigDialogOpen(true);
  }, []);

  const saveComponentConfiguration = useCallback(
    (configuration: Record<string, any>) => {
      if (configuringComponent) {
        setWorkflowComponents(prev =>
          prev.map(c => (c.instanceId === configuringComponent.instanceId ? { ...c, configuration } : c)),
        );
      }
      setConfigDialogOpen(false);
      setConfiguringComponent(null);
    },
    [configuringComponent],
  );

  const compileWorkflow = useCallback(() => {
    if (workflowComponents.length === 0) return null;

    const components = workflowComponents.map(wc => wc.component);
    return ComponentComposer.compileComponents(components, connections);
  }, [workflowComponents, connections]);

  return (
    <div className="flex h-screen bg-background">
      {/* Left sidebar - Component Library */}
      <div className="w-80 border-r bg-muted/30">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold mb-3">Component Library</h2>
          <div className="space-y-3">
            <Input
              placeholder="Search components..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full"
            />
            <Select
              value={selectedCategory}
              onValueChange={value => setSelectedCategory(value as ComponentCategory | "all")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {cat.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {filteredComponents.map(component => (
              <ComponentCard
                key={component.id}
                component={component}
                onAdd={() => addComponentToWorkflow(component)}
                onPreview={() => setSelectedComponent(component)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Center - Workflow Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Workflow Canvas</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={workflowComponents.length === 0}>
                <Eye className="h-4 w-4 mr-1" />
                Preview FSL
              </Button>
              <Button variant="outline" size="sm" disabled={workflowComponents.length === 0}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button size="sm" disabled={workflowComponents.length === 0}>
                <Play className="h-4 w-4 mr-1" />
                Compile & Deploy
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 relative bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
          {workflowComponents.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Components Added</h3>
                <p className="text-sm">Drag components from the library to start building your workflow</p>
              </div>
            </div>
          ) : (
            <WorkflowCanvas
              components={workflowComponents}
              connections={connections}
              onComponentConfigure={configureComponent}
              onComponentRemove={removeComponentFromWorkflow}
            />
          )}
        </div>
      </div>

      {/* Right sidebar - Component Details */}
      <div className="w-80 border-l bg-muted/30">
        <Tabs defaultValue="details" className="h-full flex flex-col">
          <TabsList className="m-4 mb-0">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1">
            {selectedComponent ? (
              <ComponentDetails component={selectedComponent} />
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a component to view details</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="workflow" className="flex-1">
            <WorkflowSummary components={workflowComponents} onCompile={compileWorkflow} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Configuration Dialog */}
      {configuringComponent && (
        <ComponentConfigDialog
          component={configuringComponent}
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          onSave={saveComponentConfiguration}
        />
      )}
    </div>
  );
}

interface ComponentCardProps {
  component: StateMachineComponent;
  onAdd: () => void;
  onPreview: () => void;
}

function ComponentCard({ component, onAdd, onPreview }: ComponentCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate">{component.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {component.category.replace("-", " ")}
              </Badge>
              <span className="text-xs text-muted-foreground">v{component.version}</span>
            </div>
          </div>
        </div>
        <CardDescription className="text-xs line-clamp-2 mt-2">{component.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>{component.inputs.length} inputs</span>
          <span>{component.outputs.length} outputs</span>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={onPreview} className="flex-1">
            <Eye className="h-3 w-3 mr-1" />
            Preview
          </Button>
          <Button size="sm" onClick={onAdd} className="flex-1">
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface WorkflowCanvasProps {
  components: SelectedComponent[];
  connections: ComponentConnection[];
  onComponentConfigure: (component: SelectedComponent) => void;
  onComponentRemove: (instanceId: string) => void;
}

function WorkflowCanvas({ components, connections, onComponentConfigure, onComponentRemove }: WorkflowCanvasProps) {
  return (
    <div className="relative w-full h-full p-4">
      {components.map(component => (
        <WorkflowComponentNode
          key={component.instanceId}
          component={component}
          onConfigure={() => onComponentConfigure(component)}
          onRemove={() => onComponentRemove(component.instanceId)}
        />
      ))}

      {/* Connection lines would be rendered here using SVG */}
      <svg className="absolute inset-0 pointer-events-none">
        {connections.map((connection, index) => {
          // This would calculate the actual positions and draw lines
          // For now, just a placeholder
          return <line key={index} x1={100} y1={100} x2={300} y2={200} stroke="rgb(99 102 241)" strokeWidth={2} />;
        })}
      </svg>
    </div>
  );
}

interface WorkflowComponentNodeProps {
  component: SelectedComponent;
  onConfigure: () => void;
  onRemove: () => void;
}

function WorkflowComponentNode({ component, onConfigure, onRemove }: WorkflowComponentNodeProps) {
  return (
    <div
      className="absolute bg-white border-2 border-blue-200 rounded-lg shadow-lg group"
      style={{
        left: component.position.x,
        top: component.position.y,
        width: 200,
        minHeight: 120,
      }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium truncate">{component.component.name}</h4>
            <Badge variant="outline" className="text-xs mt-1">
              {component.component.category.replace("-", " ")}
            </Badge>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" onClick={onConfigure} className="h-6 w-6 p-0">
              <Settings className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onRemove} className="h-6 w-6 p-0 hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Inputs ({component.component.inputs.length})</span>
              <span>Outputs ({component.component.outputs.length})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComponentDetails({ component }: { component: StateMachineComponent }) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold mb-2">{component.name}</h3>
          <p className="text-sm text-muted-foreground mb-3">{component.description}</p>

          <div className="flex flex-wrap gap-1 mb-3">
            {component.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>v{component.version}</span>
            {component.author && <span>by {component.author}</span>}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium mb-2">Inputs</h4>
          <div className="space-y-2">
            {component.inputs.map(input => (
              <div key={input.id} className="p-2 bg-muted/50 rounded text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{input.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {input.type}
                  </Badge>
                </div>
                {input.description && <p className="text-xs text-muted-foreground mt-1">{input.description}</p>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Outputs</h4>
          <div className="space-y-2">
            {component.outputs.map(output => (
              <div key={output.id} className="p-2 bg-muted/50 rounded text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{output.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {output.type}
                  </Badge>
                </div>
                {output.description && <p className="text-xs text-muted-foreground mt-1">{output.description}</p>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Configuration</h4>
          <div className="space-y-2">
            {Object.entries(component.config.parameters).map(([key, param]) => (
              <div key={key} className="p-2 bg-muted/50 rounded text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{key}</span>
                  <Badge variant="outline" className="text-xs">
                    {param.type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{param.description}</p>
                {param.defaultValue !== undefined && (
                  <p className="text-xs text-blue-600 mt-1">Default: {String(param.defaultValue)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function WorkflowSummary({ components, onCompile }: { components: SelectedComponent[]; onCompile: () => any }) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Current Workflow</h3>
          <p className="text-sm text-muted-foreground mb-3">
            {components.length} component{components.length !== 1 ? "s" : ""} in workflow
          </p>
        </div>

        {components.length > 0 && (
          <>
            <div className="space-y-2">
              {components.map((component, index) => (
                <div key={component.instanceId} className="p-2 bg-muted/50 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">{component.component.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {component.component.category.replace("-", " ")}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <Button onClick={onCompile} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Compile Workflow
            </Button>
          </>
        )}
      </div>
    </ScrollArea>
  );
}

interface ComponentConfigDialogProps {
  component: SelectedComponent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (configuration: Record<string, any>) => void;
}

function ComponentConfigDialog({ component, open, onOpenChange, onSave }: ComponentConfigDialogProps) {
  const [configuration, setConfiguration] = useState(component.configuration);

  const handleSave = () => {
    onSave(configuration);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure {component.component.name}</DialogTitle>
          <DialogDescription>Adjust the parameters for this component instance</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-96">
          <div className="space-y-4 pr-4">
            {Object.entries(component.component.config.parameters).map(([key, param]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{key}</Label>
                <div className="text-xs text-muted-foreground mb-2">{param.description}</div>

                {param.type === "string" && (
                  <Input
                    id={key}
                    value={configuration[key] || ""}
                    onChange={e => setConfiguration(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={param.defaultValue}
                  />
                )}

                {param.type === "number" && (
                  <Input
                    id={key}
                    type="number"
                    value={configuration[key] || ""}
                    onChange={e => setConfiguration(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    placeholder={String(param.defaultValue)}
                  />
                )}

                {param.type === "boolean" && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={key}
                      checked={configuration[key] || false}
                      onCheckedChange={checked => setConfiguration(prev => ({ ...prev, [key]: checked }))}
                    />
                    <Label htmlFor={key} className="text-sm">
                      {configuration[key] ? "Enabled" : "Disabled"}
                    </Label>
                  </div>
                )}

                {param.type === "select" && param.options && (
                  <Select
                    value={configuration[key] || param.defaultValue}
                    onValueChange={value => setConfiguration(prev => ({ ...prev, [key]: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {param.options.map(option => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
