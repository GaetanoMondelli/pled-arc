import React from "react";

/**
 * SimpleJsonView - Display JSON data in a formatted code block
 */
export const JsonViewer: React.FC<{ value: any }> = ({ value }) => {
  return (
    <pre className="text-xs font-mono whitespace-pre-wrap bg-slate-50 p-3 rounded border overflow-auto max-h-64">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
};

/**
 * Helper Functions for Message Interface Analysis
 */

// Helper function to determine message interfaces for a node
export const getNodeMessageInterfaces = (nodeConfig: any) => {
  // Check if node has enhanced interface definitions
  if (nodeConfig.inputInterface || nodeConfig.outputInterface || nodeConfig.inputs || nodeConfig.outputs) {
    return {
      inputs: getNodeInputInterfaces(nodeConfig),
      outputs: getNodeOutputInterfaces(nodeConfig)
    };
  }

  // Fallback to defaults for legacy nodes
  const defaults = {
    DataSource: {
      inputs: [],
      outputs: ["SimpleValue"]
    },
    Queue: {
      inputs: ["SimpleValue"],
      outputs: ["AggregationResult"]
    },
    ProcessNode: {
      inputs: ["SimpleValue", "AggregationResult"],
      outputs: ["TransformationResult"]
    },
    Sink: {
      inputs: ["SimpleValue", "AggregationResult", "TransformationResult", "ValidationResult"],
      outputs: []
    }
  };

  return defaults[nodeConfig.type as keyof typeof defaults] || { inputs: [], outputs: [] };
};

// Extract input interfaces from enhanced node config
export const getNodeInputInterfaces = (nodeConfig: any): string[] => {
  const interfaces: string[] = [];

  // Single input interface
  if (nodeConfig.inputInterface?.type) {
    interfaces.push(nodeConfig.inputInterface.type);
  }

  // Multiple inputs (ProcessNode style)
  if (nodeConfig.inputs && Array.isArray(nodeConfig.inputs)) {
    nodeConfig.inputs.forEach((input: any) => {
      if (input.interface?.type) {
        interfaces.push(input.interface.type);
      }
    });
  }

  return [...new Set(interfaces)];
};

// Extract output interfaces from enhanced node config
export const getNodeOutputInterfaces = (nodeConfig: any): string[] => {
  const interfaces: string[] = [];

  // Single output interface
  if (nodeConfig.outputInterface?.type) {
    interfaces.push(nodeConfig.outputInterface.type);
  }

  // Multiple outputs (ProcessNode style)
  if (nodeConfig.outputs && Array.isArray(nodeConfig.outputs)) {
    nodeConfig.outputs.forEach((output: any) => {
      if (output.interface?.type) {
        interfaces.push(output.interface.type);
      }
    });
  }

  // Routes (Splitter style)
  if (nodeConfig.routes && Array.isArray(nodeConfig.routes)) {
    nodeConfig.routes.forEach((route: any) => {
      if (route.outputInterface?.type) {
        interfaces.push(route.outputInterface.type);
      }
    });
  }

  // Default route (Splitter style)
  if (nodeConfig.defaultRoute?.outputInterface?.type) {
    interfaces.push(nodeConfig.defaultRoute.outputInterface.type);
  }

  return [...new Set(interfaces)];
};
