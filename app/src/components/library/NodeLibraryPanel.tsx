"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Database,
  Cpu,
  Layers,
  Target,
  Plus,
  Info,
  ChevronRight,
  Sparkles,
  X,
  Settings,
  FileText
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NodeTemplate {
  type: "DataSource" | "Queue" | "ProcessNode" | "FSMProcessNode" | "Multiplexer" | "Sink" | "Module" | "MarkdownComment";
  displayName: string;
  description: string;
  icon: React.ReactNode;
  defaultConfig: any;
  category: "input" | "processing" | "output" | "grouping" | "documentation";
  color: string;
}

interface NodeLibraryPanelProps {
  className?: string;
  onNodeDrop?: (nodeType: string, position: { x: number; y: number }) => void;
}

const NODE_TEMPLATES: NodeTemplate[] = [
  {
    type: "DataSource",
    displayName: "Data Source",
    description: "Generates tokens at regular intervals with configurable values",
    icon: <Database className="h-4 w-4" />,
    category: "input",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    defaultConfig: {
      type: "DataSource",
      displayName: "New Source",
      interval: 3,
      outputs: [
        {
          name: "output",
          destinationNodeId: "",
          destinationInputName: "input",
          interface: { type: "SimpleValue", requiredFields: ["data.value"] },
        },
      ],
      generation: { type: "random", valueMin: 1, valueMax: 10 },
    }
  },
  {
    type: "Queue",
    displayName: "Queue",
    description: "Accumulates and aggregates tokens over a time window",
    icon: <Layers className="h-4 w-4" />,
    category: "processing",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    defaultConfig: {
      type: "Queue",
      displayName: "New Queue",
      inputs: [
        {
          name: "input",
          interface: { type: "SimpleValue", requiredFields: ["data.value"] },
          required: true,
        },
      ],
      outputs: [
        {
          name: "output",
          destinationNodeId: "",
          destinationInputName: "input",
          interface: { type: "AggregationResult", requiredFields: ["data.aggregatedValue"] },
        },
      ],
      aggregation: {
        method: "sum",
        formula: "sum(input.data.value)",
        trigger: { type: "time", window: 10 },
      },
      capacity: 10,
    }
  },
  {
    type: "ProcessNode",
    displayName: "Processor",
    description: "Applies formulas to inputs and generates multiple outputs",
    icon: <Cpu className="h-4 w-4" />,
    category: "processing",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    defaultConfig: {
      type: "ProcessNode",
      displayName: "New Processor",
      inputs: [
        {
          name: "inputA",
          interface: { type: "Any", requiredFields: ["metadata.timestamp"] },
          required: true,
        },
      ],
      outputs: [
        {
          name: "output",
          destinationNodeId: "",
          destinationInputName: "input",
          interface: { type: "TransformationResult", requiredFields: ["data.transformedValue"] },
          transformation: {
            formula: "inputA.data.value",
            fieldMapping: { "data.transformedValue": "inputA.data.value" },
          },
        },
      ],
    }
  },
  {
    type: "FSMProcessNode",
    displayName: "FSM",
    description: "Finite State Machine that emits state changes to output",
    icon: <Sparkles className="h-4 w-4" />,
    category: "processing",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    defaultConfig: {
      type: "FSMProcessNode",
      displayName: "FSM",
      inputs: [
        {
          name: "input",
          interface: { type: "SimpleValue", requiredFields: ["data.value"] },
          required: true
        }
      ],
      outputs: [
        {
          name: "state",
          destinationNodeId: "",
          destinationInputName: "",
          interface: { type: "SimpleValue", requiredFields: ["data.value"] }
        }
      ],
      fsm: {
        states: ["idle", "processing", "complete"],
        initialState: "idle",
        transitions: [
          {
            from: "idle",
            to: "processing",
            trigger: "token_received"
          },
          {
            from: "processing",
            to: "complete",
            trigger: "processing_complete"
          },
          {
            from: "complete",
            to: "idle",
            trigger: "reset"
          }
        ],
        variables: {},
        stateActions: {}
      },
      fsl: "state idle {\n  on token_received -> processing\n}\nstate processing {\n  on processing_complete -> complete\n}\nstate complete {\n  on reset -> idle\n}"
    }
  },
  {
    type: "Multiplexer",
    displayName: "Multiplexer",
    description: "Routes inputs to different outputs based on conditions (works with any input type)",
    icon: <Target className="h-4 w-4" />,
    category: "processing",
    color: "bg-green-100 text-green-700 border-green-200",
    defaultConfig: {
      type: "Multiplexer",
      displayName: "Multiplexer",
      inputs: [
        {
          name: "input",
          interface: { type: "Any", requiredFields: [] },
          required: true
        }
      ],
      outputs: [
        {
          name: "output1",
          destinationNodeId: "",
          destinationInputName: "input",
          interface: { type: "Any", requiredFields: [] }
        },
        {
          name: "output2",
          destinationNodeId: "",
          destinationInputName: "input",
          interface: { type: "Any", requiredFields: [] }
        }
      ],
      multiplexing: {
        strategy: "conditional",
        conditions: [
          "token.value === 'idle'",
          "token.value === 'processing'"
        ]
      }
    }
  },
  {
    type: "Sink",
    displayName: "Sink",
    description: "Consumes and logs tokens (terminal node)",
    icon: <Target className="h-4 w-4" />,
    category: "output",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    defaultConfig: {
      type: "Sink",
      displayName: "New Sink",
      inputs: [
        {
          name: "input",
          interface: { type: "Any", requiredFields: ["metadata.timestamp"] },
          required: true,
        },
      ],
    }
  },
  {
    type: "Module",
    displayName: "Module",
    description: "Container for grouping nodes into reusable sub-graphs with collapse/expand",
    icon: <Layers className="h-4 w-4" />,
    category: "grouping",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    defaultConfig: {
      type: "Module",
      displayName: "New Module",
      inputs: [
        {
          name: "input",
          interface: { type: "Any", requiredFields: [] },
          required: false,
        },
      ],
      outputs: [
        {
          name: "output",
          destinationNodeId: "",
          destinationInputName: "input",
          interface: { type: "Any", requiredFields: [] },
        },
      ],
      subGraph: {
        nodes: [],
        version: "3.0",
      },
      isExpanded: false,
      moduleDescription: "A reusable module containing sub-components",
      moduleVersion: "1.0",
      isLibraryModule: false,
    }
  },
  {
    type: "MarkdownComment",
    displayName: "Comment",
    description: "Resizable markdown comment node for documentation and annotations in the flow diagram",
    icon: <FileText className="h-4 w-4" />,
    category: "documentation",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    defaultConfig: {
      type: "MarkdownComment",
      content: "Click to edit..."
    }
  }
];

const NodeTemplateCard: React.FC<{
  template: NodeTemplate;
  onDragStart: (template: NodeTemplate) => void;
  onShowDetails: (template: NodeTemplate) => void;
}> = ({ template, onDragStart, onShowDetails }) => {
  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart(template);
        // Set drag data for drop handling
        e.dataTransfer.setData('application/node-template', JSON.stringify(template));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className="group relative border border-slate-200 rounded-lg p-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing bg-white hover:border-slate-300 aspect-square flex flex-col items-center justify-center text-center min-h-[90px] max-h-[90px]"
    >
      {/* Info button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onShowDetails(template);
        }}
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <Info className="h-2.5 w-2.5 text-slate-500" />
      </button>
      
      {/* Icon */}
      <div className={cn(
        "w-8 h-8 rounded flex items-center justify-center mb-1.5 flex-shrink-0",
        template.color
      )}>
        {React.cloneElement(template.icon as React.ReactElement, { className: "h-4 w-4" })}
      </div>
      
      {/* Name */}
      <h3 className="font-medium text-xs text-slate-800 leading-tight line-clamp-2 px-1">
        {template.displayName}
      </h3>
      
      {/* Drag indicator dots */}
      <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="grid grid-cols-2 gap-0.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-0.5 h-0.5 bg-slate-400 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
};

const CategorySection: React.FC<{
  category: "input" | "processing" | "output" | "grouping" | "documentation";
  templates: NodeTemplate[];
  onNodeDragStart: (template: NodeTemplate) => void;
  onShowDetails: (template: NodeTemplate) => void;
}> = ({ category, templates, onNodeDragStart, onShowDetails }) => {
  const categoryInfo = {
    input: { label: "Input Nodes", icon: <Database className="h-4 w-4" />, color: "text-emerald-600" },
    processing: { label: "Processing Nodes", icon: <Cpu className="h-4 w-4" />, color: "text-blue-600" },
    output: { label: "Output Nodes", icon: <Target className="h-4 w-4" />, color: "text-slate-600" },
    grouping: { label: "Grouping Nodes", icon: <Layers className="h-4 w-4" />, color: "text-purple-600" },
    documentation: { label: "Documentation", icon: <FileText className="h-4 w-4" />, color: "text-yellow-600" }
  }[category];

  const categoryTemplates = templates.filter(t => t.category === category);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className={categoryInfo.color}>
          {categoryInfo.icon}
        </div>
        <h2 className="font-semibold text-xs text-slate-800">{categoryInfo.label}</h2>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
          {categoryTemplates.length}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {categoryTemplates.map((template) => (
          <NodeTemplateCard
            key={template.type}
            template={template}
            onDragStart={onNodeDragStart}
            onShowDetails={onShowDetails}
          />
        ))}
      </div>
    </div>
  );
};

export default function NodeLibraryPanel({ className, onNodeDrop }: NodeLibraryPanelProps) {
  const [draggedTemplate, setDraggedTemplate] = useState<NodeTemplate | null>(null);
  const [detailsTemplate, setDetailsTemplate] = useState<NodeTemplate | null>(null);

  const handleNodeDragStart = (template: NodeTemplate) => {
    setDraggedTemplate(template);
  };

  const handleDragEnd = () => {
    setDraggedTemplate(null);
  };

  const handleShowDetails = (template: NodeTemplate) => {
    setDetailsTemplate(template);
  };

  const handleCloseDetails = () => {
    setDetailsTemplate(null);
  };

  return (
    <div className={cn("flex flex-col h-full bg-slate-50", className)} onDragEnd={handleDragEnd}>
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-full flex items-center justify-center shadow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 flex-shrink-0">
        <div className="text-[11px] text-indigo-700 text-center">
          <span className="font-medium">Drag & Drop</span> to canvas
        </div>
      </div>

      {/* Node Library */}
      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-1">
          <CategorySection 
            category="input" 
            templates={NODE_TEMPLATES} 
            onNodeDragStart={handleNodeDragStart}
            onShowDetails={handleShowDetails}
          />
          <CategorySection 
            category="processing" 
            templates={NODE_TEMPLATES} 
            onNodeDragStart={handleNodeDragStart}
            onShowDetails={handleShowDetails}
          />
          <CategorySection
            category="output"
            templates={NODE_TEMPLATES}
            onNodeDragStart={handleNodeDragStart}
            onShowDetails={handleShowDetails}
          />
          <CategorySection
            category="grouping"
            templates={NODE_TEMPLATES}
            onNodeDragStart={handleNodeDragStart}
            onShowDetails={handleShowDetails}
          />
          <CategorySection
            category="documentation"
            templates={NODE_TEMPLATES}
            onNodeDragStart={handleNodeDragStart}
            onShowDetails={handleShowDetails}
          />
        </div>
      </ScrollArea>

      {/* Drag Status */}
      {draggedTemplate && (
        <div className="px-3 py-2 bg-emerald-50 border-t border-emerald-200 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-emerald-700">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>Dragging <strong>{draggedTemplate.displayName}</strong></span>
          </div>
        </div>
      )}

      {/* Add Custom Node Button */}
      <div className="p-2 border-t border-slate-200 bg-white flex-shrink-0">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-[11px] py-1.5 border-dashed border-slate-300 text-slate-600 hover:text-slate-800 hover:border-slate-400"
        >
          <Plus className="h-3 w-3 mr-1" />
          Custom
        </Button>
      </div>

      {/* Node Details Modal */}
      <Dialog open={!!detailsTemplate} onOpenChange={() => handleCloseDetails()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                detailsTemplate?.color
              )}>
                {detailsTemplate?.icon}
              </div>
              <div>
                <DialogTitle>{detailsTemplate?.displayName}</DialogTitle>
                <DialogDescription>
                  <Badge variant="outline" className="text-xs mt-1">
                    {detailsTemplate?.category}
                  </Badge>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Description</h4>
              <p className="text-sm text-slate-600">
                {detailsTemplate?.description}
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Default Configuration</h4>
              <pre className="text-xs bg-slate-50 p-3 rounded border font-mono overflow-x-auto max-h-48">
                {detailsTemplate && JSON.stringify(detailsTemplate.defaultConfig, null, 2)}
              </pre>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (detailsTemplate) {
                    handleNodeDragStart(detailsTemplate);
                  }
                  handleCloseDetails();
                }}
              >
                Add to Canvas
              </Button>
              <Button variant="outline" size="sm" onClick={handleCloseDetails}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}