"use client";

import React, { useMemo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Minimize2, Maximize2, Folder, FolderOpen, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { type RFNodeData } from "@/lib/simulation/types";
import { BaseNodeDisplay } from "./BaseNodeDisplay";

type GroupNodeDisplayProps = NodeProps<RFNodeData & {
  config: {
    type: "Group";
    groupName: string;
    groupColor: string;
    groupDescription?: string;
    containedNodes: string[];
    isCollapsed: boolean;
    inputs?: Array<{ name: string }>;
    outputs?: Array<{ name: string }>;
  };
  nodeCount?: number;
}>;

const GroupNodeDisplay: React.FC<GroupNodeDisplayProps> = (props) => {
  const { data, selected = false, id } = props;
  const { config } = data;
  let { groupName, groupColor, groupDescription, containedNodes, isCollapsed, inputs = [], outputs = [] } = config;
  
  // FALLBACK: If outputs not provided, always create at least one output handle for virtual edges
  if (outputs.length === 0) {
    outputs = [{ name: 'output' }];
  }

  const inputCount = inputs.length;
  const outputCount = outputs.length;

  // Calculate dynamic width
  const baseWidth = 200;
  const nameWidth = groupName.length * 8;
  const minWidth = Math.max(baseWidth, nameWidth + 60);

  // Handle navigate into group
  const handleNavigateIntoGroup = () => {
    // Dispatch double-click event to trigger navigation (handled by useNodeInteractions)
    const container = document.querySelector(`[data-id="${id}"]`);
    if (container) {
      const event = new MouseEvent('dblclick', { bubbles: true });
      container.dispatchEvent(event);
    }
  };

  // CONFIG section: Group info
  const configSection = (
    <div className="space-y-1.5">
      {groupDescription && (
        <p className="text-xs text-gray-600 line-clamp-2">{groupDescription}</p>
      )}
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="font-medium">{containedNodes.length}</span> nodes
        </span>
        <span className="flex items-center gap-2">
          <span>{inputCount} in</span>
          <span>{outputCount} out</span>
        </span>
      </div>
    </div>
  );

  // RUNTIME section: Contained nodes list (only when expanded)
  const runtimeSection = !isCollapsed && containedNodes.length > 0 ? (
    <div>
      <div className="text-xs font-medium text-gray-700 mb-1.5">Contained Nodes:</div>
      <div className="text-xs text-gray-600 space-y-0.5 max-h-28 overflow-y-auto bg-gray-50 rounded p-2">
        {containedNodes.slice(0, 8).map((nodeId) => (
          <div key={nodeId} className="truncate flex items-center justify-between">
            <span>• {nodeId.split('_')[0]}</span>
            <span className="text-gray-400 text-[10px]">{nodeId.split('_')[1] || ''}</span>
          </div>
        ))}
        {containedNodes.length > 8 && (
          <div className="text-gray-400 text-center italic text-[10px] pt-1">
            +{containedNodes.length - 8} more nodes
          </div>
        )}
      </div>
      
      {/* I/O details when expanded */}
      {(inputCount > 0 || outputCount > 0) && (
        <div className="mt-2 space-y-1 border-t pt-2">
          {inputCount > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-700">Inputs ({inputCount}):</span>
              <div className="text-[10px] text-gray-500 ml-2">
                {inputs.slice(0, 3).map(input => input.name.split('.')[1] || input.name).join(', ')}
                {inputCount > 3 && ` +${inputCount - 3} more`}
              </div>
            </div>
          )}
          {outputCount > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-700">Outputs ({outputCount}):</span>
              <div className="text-[10px] text-gray-500 ml-2">
                {outputs.slice(0, 3).map(output => output.name.split('.')[1] || output.name).join(', ')}
                {outputCount > 3 && ` +${outputCount - 3} more`}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  ) : null;

  // Render custom handles for Group (multiple I/O distributed vertically)
  const customHandles = (
    <>
      {/* Input Handles - distributed vertically */}
      {inputs.map((input, index) => (
        <Handle
          key={`input-${input.name}`}
          type="target"
          position={Position.Left}
          id={`input-${input.name}`}
          isConnectable={true}
          style={{
            top: `${20 + (index * 60) / Math.max(1, inputCount - 1)}%`,
          }}
          className="w-5 h-5 !bg-blue-500 hover:!bg-blue-400 !border-2 !border-white transition-all"
          title={input.name}
        />
      ))}

      {/* Output Handles - distributed vertically */}
      {outputs.map((output, index) => (
        <Handle
          key={`output-${output.name}`}
          type="source"
          position={Position.Right}
          id={output.name}
          isConnectable={true}
          style={{
            top: `${20 + (index * 60) / Math.max(1, outputCount - 1)}%`,
          }}
          className="w-5 h-5 !bg-green-500 hover:!bg-green-400 !border-2 !border-white transition-all"
          title={output.name}
        />
      ))}
    </>
  );

  return (
    <BaseNodeDisplay
      {...props}
      icon={isCollapsed ? Folder : FolderOpen}
      nodeType="Group Node"
      headerColor={groupColor}
      activeBorderColor="border-blue-400"
      activeShadowColor="shadow-blue-400/50"
      width={`w-[${minWidth}px]`}
      configSection={configSection}
      runtimeSection={runtimeSection}
      expandable={!isCollapsed}
      defaultExpanded={!isCollapsed}
      customHandles={customHandles}
      showEditButton={true}
      onEditClick={handleNavigateIntoGroup}
      editButtonIcon={Maximize2}
      editButtonTitle="Open group view"
    />
  );
};

export default GroupNodeDisplay;