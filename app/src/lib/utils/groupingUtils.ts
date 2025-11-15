import { type AnyNode, type Scenario, type GroupNode } from "@/lib/simulation/types";

export interface GroupingUtils {
  createGroupFromNodes: (
    scenario: Scenario,
    nodeIds: string[],
    groupName: string,
    groupColor: string,
    groupDescription?: string
  ) => Scenario;
  
  expandGroup: (scenario: Scenario, groupId: string) => Scenario;
  collapseGroup: (scenario: Scenario, groupId: string) => Scenario;
  
  getGroupInputsOutputs: (
    scenario: Scenario,
    containedNodes: string[]
  ) => { 
    inputs: Array<{ name: string; nodeId?: string; sourceOutputName?: string }>;
    outputs: Array<{ name: string; destinationNodeId: string; destinationInputName: string }>;
  };
  
  applyTagFilter: (scenario: Scenario, activeTags: string[]) => Scenario;
  getNodesWithTags: (scenario: Scenario, tags: string[]) => AnyNode[];
}

// Utility functions for managing node grouping and filtering
export const groupingUtils: GroupingUtils = {
  
  createGroupFromNodes: (
    scenario: Scenario,
    nodeIds: string[],
    groupName: string,
    groupColor: string,
    groupDescription?: string
  ): Scenario => {
    const nodesToGroup = scenario.nodes.filter(node => nodeIds.includes(node.nodeId));
    
    if (nodesToGroup.length === 0) return scenario;
    
    // Calculate group position (center of contained nodes)
    const avgX = nodesToGroup.reduce((sum, node) => sum + (node.position?.x || 0), 0) / nodesToGroup.length;
    const avgY = nodesToGroup.reduce((sum, node) => sum + (node.position?.y || 0), 0) / nodesToGroup.length;
    
    // Calculate group inputs and outputs
    const { inputs, outputs } = groupingUtils.getGroupInputsOutputs(scenario, nodeIds);
    
    // Create group node
    const groupNode: GroupNode = {
      nodeId: `group_${Date.now()}`,
      type: "Group",
      displayName: groupName,
      position: { x: avgX - 100, y: avgY - 50 },
      groupName,
      groupColor,
      groupDescription,
      containedNodes: nodeIds,
      isCollapsed: false,
      inputs: inputs.map(input => ({
        name: input.name,
        nodeId: input.nodeId,
        sourceOutputName: input.sourceOutputName,
        interface: { type: "any", requiredFields: [] },
        required: false,
      })),
      outputs: outputs.map(output => ({
        name: output.name,
        destinationNodeId: output.destinationNodeId,
        destinationInputName: output.destinationInputName,
        interface: { type: "any", requiredFields: [] },
      })),
    };
    
    return {
      ...scenario,
      nodes: [...scenario.nodes, groupNode],
    };
  },
  
  expandGroup: (scenario: Scenario, groupId: string): Scenario => {
    const updatedNodes = scenario.nodes.map(node => {
      if (node.nodeId === groupId && node.type === "Group") {
        return { ...node, isCollapsed: false };
      }
      return node;
    });
    
    return { ...scenario, nodes: updatedNodes };
  },
  
  collapseGroup: (scenario: Scenario, groupId: string): Scenario => {
    const updatedNodes = scenario.nodes.map(node => {
      if (node.nodeId === groupId && node.type === "Group") {
        return { ...node, isCollapsed: true };
      }
      return node;
    });
    
    return { ...scenario, nodes: updatedNodes };
  },
  
  getGroupInputsOutputs: (scenario: Scenario, containedNodes: string[]) => {
    const inputs: Array<{ name: string; nodeId?: string; sourceOutputName?: string }> = [];
    const outputs: Array<{ name: string; destinationNodeId: string; destinationInputName: string }> = [];
    const containedSet = new Set(containedNodes);
    
    // Find inputs (connections from outside nodes to contained nodes)
    scenario.nodes.forEach(node => {
      if (node.outputs && !containedSet.has(node.nodeId)) {
        node.outputs.forEach(output => {
          if (containedSet.has(output.destinationNodeId)) {
            // This is an external input to the group
            const targetNode = scenario.nodes.find(n => n.nodeId === output.destinationNodeId);
            const inputName = targetNode?.inputs?.find(inp => inp.nodeId === node.nodeId)?.name || 'input';
            
            inputs.push({
              name: `${targetNode?.displayName || output.destinationNodeId}_${inputName}`,
              nodeId: node.nodeId,
              sourceOutputName: output.name,
            });
          }
        });
      }
    });
    
    // Find outputs (connections from contained nodes to outside nodes)
    scenario.nodes.forEach(node => {
      if (node.outputs && containedSet.has(node.nodeId)) {
        node.outputs.forEach(output => {
          if (!containedSet.has(output.destinationNodeId)) {
            // This is an output from the group to external nodes
            outputs.push({
              name: `${node.displayName}_${output.name}`,
              destinationNodeId: output.destinationNodeId,
              destinationInputName: output.destinationInputName,
            });
          }
        });
      }
    });
    
    return { inputs, outputs };
  },
  
  applyTagFilter: (scenario: Scenario, activeTags: string[]): Scenario => {
    if (activeTags.length === 0) {
      return {
        ...scenario,
        groups: {
          ...scenario.groups,
          visualMode: "all",
          activeFilters: [],
        },
      };
    }
    
    return {
      ...scenario,
      groups: {
        ...scenario.groups,
        visualMode: "filtered",
        activeFilters: activeTags,
      },
    };
  },
  
  getNodesWithTags: (scenario: Scenario, tags: string[]): AnyNode[] => {
    if (tags.length === 0) return [];
    
    return scenario.nodes.filter(node => {
      if (node.type === "Group") return true; // Always include groups
      if (!node.tags || node.tags.length === 0) return false;
      return node.tags.some(tag => tags.includes(tag));
    });
  },
};

// Enhanced type guards for group-related operations
export const isGroupNode = (node: AnyNode): node is GroupNode => {
  return node.type === "Group";
};

export const hasTag = (node: AnyNode, tag: string): boolean => {
  return node.tags?.includes(tag) || false;
};

export const hasTags = (node: AnyNode, tags: string[]): boolean => {
  if (!node.tags || node.tags.length === 0) return false;
  return tags.some(tag => node.tags!.includes(tag));
};

// Utility to get all tags from a scenario
export const getAllTags = (scenario: Scenario): string[] => {
  const tags = new Set<string>();
  
  // Add configured tags
  scenario.groups?.tags?.forEach(tag => tags.add(tag.name));
  
  // Add tags from nodes
  scenario.nodes.forEach(node => {
    node.tags?.forEach(tag => tags.add(tag));
  });
  
  return Array.from(tags).sort();
};

// Utility to calculate group bounds for positioning
export const calculateGroupBounds = (nodes: AnyNode[]) => {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 200, height: 100 };
  }
  
  const positions = nodes.map(node => ({
    x: node.position?.x || 0,
    y: node.position?.y || 0,
  }));
  
  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));
  const maxY = Math.max(...positions.map(p => p.y));
  
  const padding = 50;
  
  return {
    x: minX - padding,
    y: minY - padding,
    width: (maxX - minX) + (padding * 2) + 200, // Add extra width for node size
    height: (maxY - minY) + (padding * 2) + 100, // Add extra height for node size
  };
};