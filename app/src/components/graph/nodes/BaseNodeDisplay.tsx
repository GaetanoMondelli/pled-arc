import React, { ReactNode, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Circle, Trash2, LucideIcon, Edit3, ChevronDown, ChevronUp } from "lucide-react";
import type { NodeProps } from "reactflow";
import { Handle, Position, useReactFlow } from "reactflow";
import type { RFNodeData } from "@/lib/simulation/types";
import { useSimulationStore } from "@/stores/simulationStore";

// Common state machine state colors
const STATE_COLORS: Record<string, { color: string; displayName: string }> = {
  // DataSource states
  source_idle: { color: "text-gray-500", displayName: "idle" },
  source_generating: { color: "text-blue-500", displayName: "generating" },
  source_emitting: { color: "text-green-500", displayName: "emitting" },
  source_waiting: { color: "text-yellow-500", displayName: "waiting" },
  
  // Process states
  process_idle: { color: "text-gray-500", displayName: "idle" },
  process_collecting: { color: "text-blue-500", displayName: "collecting" },
  process_calculating: { color: "text-yellow-500", displayName: "calculating" },
  process_emitting: { color: "text-green-500", displayName: "emitting" },
  
  // Queue states
  queue_idle: { color: "text-gray-500", displayName: "idle" },
  queue_accumulating: { color: "text-blue-500", displayName: "accumulating" },
  queue_processing: { color: "text-yellow-500", displayName: "processing" },
  queue_emitting: { color: "text-green-500", displayName: "emitting" },
  
  // Sink states
  sink_idle: { color: "text-gray-500", displayName: "idle" },
  sink_processing: { color: "text-orange-500", displayName: "processing" },
};

// Helper function to get state machine display info
export const getStateMachineDisplay = (currentState?: string) => {
  if (!currentState) return null;
  return STATE_COLORS[currentState] || { color: "text-gray-400", displayName: "unknown" };
};

interface BaseNodeDisplayConfig {
  // Visual customization
  icon: LucideIcon;
  nodeType: string; // e.g., "DataSource", "FSM Process", "State Router"
  headerColor: string; // e.g., "bg-teal-600"
  activeBorderColor: string; // e.g., "border-green-400"
  activeShadowColor: string; // e.g., "shadow-green-400/50"
  width?: string; // default "w-40"
  
  // Content sections (standard structure)
  configSection: ReactNode;
  runtimeSection?: ReactNode;
  
  // Optional custom sections (e.g., ROUTES for Multiplexer)
  customSections?: Array<{
    title: string;
    content: ReactNode;
    defaultExpanded?: boolean;
  }>;
  
  // Handles
  showInputHandle?: boolean;
  showOutputHandle?: boolean;
  inputHandleId?: string;
  outputHandleId?: string;
  // For nodes with multiple handles (e.g., Group nodes)
  customHandles?: ReactNode;
  
  // Optional features
  showEditButton?: boolean;
  onEditClick?: () => void;
  editButtonIcon?: LucideIcon; // Custom icon for edit button (default: Edit3)
  editButtonTitle?: string; // Custom tooltip for edit button (default: "Edit configuration")
  expandable?: boolean; // If true, runtime section can be collapsed
  defaultExpanded?: boolean;
}

type BaseNodeProps = NodeProps<RFNodeData> & BaseNodeDisplayConfig;

/**
 * Base component for all node displays with common structure and behavior.
 * 
 * Standard structure for ALL nodes:
 * 1. HEADER: Icon + Name + Type + Pulse dot + Edit button (optional) + Expand/collapse (optional)
 * 2. CONFIG: Configuration info (always visible)
 * 3. CUSTOM SECTIONS: Optional sections like ROUTES (e.g., for Multiplexer)
 * 4. RUNTIME: Current state/activity (collapsible if expandable=true)
 */
export const BaseNodeDisplay: React.FC<BaseNodeProps> = ({
  data,
  selected,
  id,
  icon: Icon,
  nodeType,
  headerColor,
  activeBorderColor,
  activeShadowColor,
  width = "w-40",
  configSection,
  runtimeSection,
  customSections,
  showInputHandle = false,
  showOutputHandle = false,
  editButtonIcon: EditButtonIcon = Edit3,
  editButtonTitle = "Edit configuration",
  inputHandleId = "input",
  outputHandleId = "output",
  customHandles,
  showEditButton = false,
  onEditClick,
  expandable = false,
  defaultExpanded = false,
  ...rest
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const stateMachineInfo = getStateMachineDisplay(data.stateMachine?.currentState);
  const { deleteElements } = useReactFlow();

  // Get node activity status from the simulation store
  const getNodeActivityStatus = useSimulationStore(state => state.getNodeActivityStatus);
  const activityStatus = getNodeActivityStatus(id);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick?.();
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="relative group">
      {/* Delete Button */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 w-5 h-5 bg-gray-400 hover:bg-gray-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center shadow-sm"
        title="Delete node"
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>
      
      <Card
        className={cn(
          width,
          "shadow-md transition-all duration-500",
          selected && "ring-2 ring-primary",
          // Active node highlighting - blue glow with pulse animation
          data.isActive && "!border-4 !border-blue-500 !shadow-xl !shadow-blue-500/50 animate-pulse",
          // Activity states with animations
          activityStatus.isActive && cn("shadow-lg border-2 animate-pulse", activeBorderColor, activeShadowColor),
          activityStatus.isRecentlyActive && "animate-bounce border-2 border-blue-400 shadow-blue-400/50",
          activityStatus.wasInLastStep && "bg-gradient-to-r from-green-50 to-transparent",
          data.error && "border-destructive shadow-destructive/50",
        )}
      >
        {/* Header - CONSISTENT across all nodes */}
        <CardHeader
          className={cn(
            "p-2.5 rounded-t-lg transition-colors duration-300 text-white",
            headerColor?.startsWith('#') ? '' : headerColor || ''
          )}
          style={headerColor?.startsWith('#') ? { backgroundColor: headerColor } : undefined}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {/* Icon */}
              {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
              
              {/* Name + Type */}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold truncate">{data.label}</span>
                <span className="text-[9px] opacity-80">{nodeType}</span>
              </div>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Activity Pulse Dot */}
              {data.isActive && (
                <Circle className="h-2 w-2 fill-white animate-pulse" />
              )}
              
              {/* Edit Button (optional) */}
              {showEditButton && onEditClick && (
                <button
                  onClick={handleEdit}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title={editButtonTitle}
                >
                  <EditButtonIcon className="h-4 w-4" />
                </button>
              )}
              
              {/* Expand/Collapse Button (optional) */}
              {expandable && (
                <button
                  onClick={toggleExpand}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-2 text-[10px] space-y-1">
          {/* CONFIG Section - Always visible */}
          <div className="space-y-0.5">
            <p className="font-semibold text-muted-foreground text-[10px]">CONFIG:</p>
            <div className="pl-1">{configSection}</div>
          </div>
          
          {/* Custom Sections (e.g., ROUTES for Multiplexer) */}
          {customSections?.map((section, index) => (
            <React.Fragment key={index}>
              <div className="border-t border-muted-foreground/20 my-1"></div>
              <div className="space-y-0.5">
                <p className="font-semibold text-muted-foreground text-[10px]">{section.title}:</p>
                <div className="pl-1">{section.content}</div>
              </div>
            </React.Fragment>
          ))}
          
          {/* RUNTIME Section - Collapsible if expandable=true */}
          {runtimeSection && (
            <>
              <div className="border-t border-muted-foreground/20 my-1"></div>
              {(!expandable || isExpanded) && (
                <div className="space-y-0.5">
                  <p className="font-semibold text-muted-foreground text-[10px]">RUNTIME:</p>
                  <div className="pl-1">
                    {stateMachineInfo && (
                      <p className={cn("font-mono text-[10px]", stateMachineInfo.color)}>
                        State: {stateMachineInfo.displayName}
                      </p>
                    )}
                    {runtimeSection}
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Error Display */}
          {data.error && (
            <div className="mt-1 p-1 bg-destructive/10 border border-destructive/20 rounded">
              <p className="text-destructive text-[9px] leading-tight">{data.error}</p>
            </div>
          )}
        </CardContent>

        {/* Handles */}
        {customHandles ? (
          // Custom handles (e.g., for Group nodes with multiple I/O)
          customHandles
        ) : (
          // Default single handles
          <>
            {showInputHandle && (
              <Handle 
                type="target" 
                position={Position.Left}
                id={inputHandleId}
                isConnectable={true}
                className="w-5 h-5 !bg-blue-500 hover:!bg-blue-400 !border-2 !border-white transition-all"
                title="Input"
              />
            )}
            {showOutputHandle && (
              <Handle 
                type="source" 
                position={Position.Right}
                id={outputHandleId}
                isConnectable={true}
                className="w-5 h-5 !bg-green-500 hover:!bg-green-400 !border-2 !border-white transition-all"
                title="Output"
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default React.memo(BaseNodeDisplay);
