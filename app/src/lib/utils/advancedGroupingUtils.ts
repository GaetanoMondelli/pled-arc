import { AnyNode, GroupNode, Scenario, InputV3, OutputV3 } from "@/lib/simulation/types";

export interface GroupInfo {
  tagName: string;
  nodes: AnyNode[];
  externalInputs: Array<{
    name: string;
    sourceNodeId: string;
    sourceOutputName: string;
    targetNodeId: string;
    targetInputName: string;
    interface: any;
  }>;
  externalOutputs: Array<{
    name: string;
    sourceNodeId: string;
    sourceOutputName: string;
    targetNodeId: string;
    targetInputName: string;
    interface: any;
  }>;
  position: { x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
}

export interface BreadcrumbItem {
  type: 'template' | 'group' | 'fsm';
  name: string;
  displayName: string;
}

export interface GroupingViewState {
  breadcrumbs: BreadcrumbItem[];
  currentView: 'template' | 'group' | 'fsm';
  currentContext?: string; // group tag name or FSM node ID
  filteredNodeIds: string[];
}

/**
 * Analyzes nodes and creates automatic groups based on tags
 */
export function createAutomaticGroups(scenario: Scenario): GroupInfo[] {
  if (!scenario.nodes) return [];

  // Group nodes by their tags
  const tagGroups = new Map<string, AnyNode[]>();

  scenario.nodes.forEach(node => {
    if (node.tags && node.tags.length > 0) {
      node.tags.forEach(tag => {
        if (!tagGroups.has(tag)) {
          tagGroups.set(tag, []);
        }
        tagGroups.get(tag)!.push(node);
      });
    }
  });

  // Only create groups for tags that have more than 1 node
  const groups: GroupInfo[] = [];

  tagGroups.forEach((nodes, tagName) => {
    if (nodes.length > 1) {
      const groupInfo = analyzeGroupConnections(tagName, nodes, scenario);
      groups.push(groupInfo);
    }
  });

  return groups;
}

/**
 * Analyzes external connections for a group of nodes
 */
function analyzeGroupConnections(tagName: string, groupNodes: AnyNode[], scenario: Scenario): GroupInfo {
  const groupNodeIds = new Set(groupNodes.map(n => n.nodeId));
  const externalInputs: GroupInfo['externalInputs'] = [];
  const externalOutputs: GroupInfo['externalOutputs'] = [];

  // Find all external inputs (connections from outside the group to inside)
  groupNodes.forEach(node => {
    if ('inputs' in node && node.inputs) {
      node.inputs.forEach(input => {
        // Find the source of this input
        const sourceConnection = findInputSource(node.nodeId, input.name, scenario);
        if (sourceConnection && !groupNodeIds.has(sourceConnection.sourceNodeId)) {
          // This is an external input
          externalInputs.push({
            name: `${node.displayName}.${input.name}`,
            sourceNodeId: sourceConnection.sourceNodeId,
            sourceOutputName: sourceConnection.sourceOutputName,
            targetNodeId: node.nodeId,
            targetInputName: input.name,
            interface: input.interface,
          });
        }
      });
    }
  });

  // Find all external outputs (connections from inside the group to outside)
  groupNodes.forEach(node => {
    if ('outputs' in node && node.outputs) {
      node.outputs.forEach(output => {
        if (output.destinationNodeId && !groupNodeIds.has(output.destinationNodeId)) {
          // This is an external output
          externalOutputs.push({
            name: `${node.displayName}.${output.name}`,
            sourceNodeId: node.nodeId,
            sourceOutputName: output.name,
            targetNodeId: output.destinationNodeId,
            targetInputName: output.destinationInputName,
            interface: output.interface,
          });
        }
      });
    }
  });

  // Calculate group bounds
  const bounds = calculateGroupBounds(groupNodes);

  return {
    tagName,
    nodes: groupNodes,
    externalInputs,
    externalOutputs,
    position: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    bounds,
  };
}

/**
 * Finds the source node and output for a given input
 */
function findInputSource(nodeId: string, inputName: string, scenario: Scenario) {
  for (const node of scenario.nodes) {
    if ('outputs' in node && node.outputs) {
      for (const output of node.outputs) {
        if (output.destinationNodeId === nodeId && output.destinationInputName === inputName) {
          return {
            sourceNodeId: node.nodeId,
            sourceOutputName: output.name,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Calculates the bounding box for a group of nodes
 */
function calculateGroupBounds(nodes: AnyNode[]) {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 200, height: 100 };
  }

  const positions = nodes.map(n => n.position);
  const minX = Math.min(...positions.map(p => p.x)) - 50; // Add padding
  const maxX = Math.max(...positions.map(p => p.x)) + 250; // Add node width + padding
  const minY = Math.min(...positions.map(p => p.y)) - 50;
  const maxY = Math.max(...positions.map(p => p.y)) + 150; // Add node height + padding

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Creates a GroupNode from GroupInfo
 */
export function createGroupNodeFromInfo(groupInfo: GroupInfo, storedPositions?: Record<string, { x: number; y: number }>): GroupNode {
  // Use stored position if available, otherwise use calculated position
  const position = storedPositions?.[groupInfo.tagName] || groupInfo.position;

  return {
    nodeId: `group_${groupInfo.tagName}`,
    type: "Group",
    displayName: groupInfo.tagName,
    position,
    tags: ["_system_group"],
    groupName: groupInfo.tagName,
    groupColor: getTagColor(groupInfo.tagName),
    groupDescription: `${groupInfo.nodes.length} nodes with "${groupInfo.tagName}" tag`,
    containedNodes: groupInfo.nodes.map(n => n.nodeId),
    isCollapsed: true,
    inputs: groupInfo.externalInputs.map(input => ({
      name: input.name,
      interface: input.interface,
      required: false,
    })),
    outputs: groupInfo.externalOutputs.map(output => ({
      name: output.name,
      destinationNodeId: output.targetNodeId,
      destinationInputName: output.targetInputName,
      interface: output.interface,
    })),
    bounds: groupInfo.bounds,
  };
}

/**
 * Gets a consistent color for a tag
 */
function getTagColor(tagName: string): string {
  const colors = [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#06b6d4", // cyan
    "#84cc16", // lime
    "#f97316", // orange
  ];

  // Simple hash function to get consistent color for tag
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = ((hash << 5) - hash + tagName.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Generates a scenario with groups based on tags
 */
export function generateGroupedScenario(originalScenario: Scenario): Scenario {
  const allGroups = createAutomaticGroups(originalScenario);

  // Filter groups based on activeFilters if specified
  const enabledTags = originalScenario.groups?.activeFilters || [];
  const groups = enabledTags.length > 0
    ? allGroups.filter(g => enabledTags.includes(g.tagName))
    : allGroups;

  if (groups.length === 0) {
    return originalScenario; // No groups to create
  }

  // Get stored group positions from scenario
  const storedGroupPositions = originalScenario.groups?.groupPositions || {};

  // Create group nodes with stored positions
  const groupNodes = groups.map(group => createGroupNodeFromInfo(group, storedGroupPositions));

  // Filter out grouped nodes from the original nodes (when in grouped view)
  const groupedNodeIds = new Set<string>();
  const nodeToGroupMap = new Map<string, string>(); // Maps original nodeId to group nodeId
  groups.forEach(group => {
    const groupNodeId = `group_${group.tagName}`;
    group.nodes.forEach(node => {
      groupedNodeIds.add(node.nodeId);
      nodeToGroupMap.set(node.nodeId, groupNodeId);
    });
  });


  // Keep ALL original nodes and redirect connections to grouped nodes to point to the group instead
  const allNodesWithRedirectedConnections = originalScenario.nodes.map(node => {
    if (groupedNodeIds.has(node.nodeId)) {
      // Mark grouped nodes as hidden but keep them intact
      return {
        ...node,
        _isGrouped: true, // Internal flag to indicate this node is grouped (for rendering)
      };
    } else {
      // For ungrouped nodes, check if any of their outputs connect to grouped nodes
      if ('outputs' in node && node.outputs) {
        const updatedOutputs = node.outputs.map(output => {
          if (output.destinationNodeId && nodeToGroupMap.has(output.destinationNodeId)) {
            // This node is connecting TO a grouped node, redirect to group instead
            const originalTargetNodeId = output.destinationNodeId;
            const targetGroupId = nodeToGroupMap.get(originalTargetNodeId)!;
            const targetGroup = groups.find(g => `group_${g.tagName}` === targetGroupId);

            if (targetGroup) {
              // Find the external input that matches this connection
              const externalInput = targetGroup.externalInputs.find(ei =>
                ei.targetNodeId === originalTargetNodeId && ei.targetInputName === output.destinationInputName
              );

              if (externalInput) {
                console.log(`Redirecting connection from ${node.nodeId} to group ${targetGroupId} instead of ${originalTargetNodeId}`);
                return {
                  ...output,
                  destinationNodeId: targetGroupId,
                  destinationInputName: `input-${externalInput.name}`,
                };
              }
            }
          }
          return output;
        });

        return {
          ...node,
          outputs: updatedOutputs,
        };
      }
    }
    return node;
  });

  return {
    ...originalScenario,
    nodes: [...allNodesWithRedirectedConnections, ...groupNodes],
    groups: {
      ...originalScenario.groups,
      visualMode: "grouped",
      groupedNodeIds: Array.from(groupedNodeIds), // Track which nodes are grouped
    },
  };
}

/**
 * Navigation utilities for breadcrumb system
 */
export class GroupNavigationManager {
  private viewState: GroupingViewState;

  constructor(templateName: string) {
    this.viewState = {
      breadcrumbs: [{ type: 'template', name: templateName, displayName: templateName }],
      currentView: 'template',
      filteredNodeIds: [],
    };
  }

  navigateToGroup(groupTag: string, groupNodes: AnyNode[]): GroupingViewState {
    this.viewState = {
      breadcrumbs: [
        ...this.viewState.breadcrumbs,
        { type: 'group', name: groupTag, displayName: groupTag }
      ],
      currentView: 'group',
      currentContext: groupTag,
      filteredNodeIds: groupNodes.map(n => n.nodeId),
    };
    return { ...this.viewState };
  }

  navigateToFSM(fsmNodeId: string, fsmDisplayName: string): GroupingViewState {
    this.viewState = {
      breadcrumbs: [
        ...this.viewState.breadcrumbs,
        { type: 'fsm', name: fsmNodeId, displayName: fsmDisplayName }
      ],
      currentView: 'fsm',
      currentContext: fsmNodeId,
      filteredNodeIds: [fsmNodeId],
    };
    return { ...this.viewState };
  }

  navigateBack(): GroupingViewState {
    if (this.viewState.breadcrumbs.length > 1) {
      this.viewState.breadcrumbs.pop();
      const current = this.viewState.breadcrumbs[this.viewState.breadcrumbs.length - 1];

      this.viewState = {
        ...this.viewState,
        currentView: current.type,
        currentContext: current.type === 'template' ? undefined : current.name,
        filteredNodeIds: current.type === 'template' ? [] : this.viewState.filteredNodeIds,
      };
    }
    return { ...this.viewState };
  }

  navigateTo(breadcrumbIndex: number): GroupingViewState {
    if (breadcrumbIndex >= 0 && breadcrumbIndex < this.viewState.breadcrumbs.length) {
      this.viewState.breadcrumbs = this.viewState.breadcrumbs.slice(0, breadcrumbIndex + 1);
      const current = this.viewState.breadcrumbs[breadcrumbIndex];

      this.viewState = {
        ...this.viewState,
        currentView: current.type,
        currentContext: current.type === 'template' ? undefined : current.name,
        filteredNodeIds: current.type === 'template' ? [] : this.viewState.filteredNodeIds,
      };
    }
    return { ...this.viewState };
  }

  getCurrentState(): GroupingViewState {
    return { ...this.viewState };
  }
}

/**
 * Gets nodes to display based on current navigation state
 */
export function getNodesForCurrentView(
  scenario: Scenario,
  navigationState: GroupingViewState
): AnyNode[] {
  if (!scenario.nodes) return [];

  switch (navigationState.currentView) {
    case 'template':
      // Show all nodes or grouped view
      return generateGroupedScenario(scenario).nodes;

    case 'group':
      // Show only nodes in the current group + external connection nodes (semi-transparent)
      if (navigationState.currentContext) {
        const groupNodes = scenario.nodes.filter(node =>
          node.tags?.includes(navigationState.currentContext!)
        );

        // Also include external nodes that connect to this group (for context)
        const groupNodeIds = new Set(groupNodes.map(n => n.nodeId));
        const externalNodes = scenario.nodes.filter(node => {
          if (groupNodeIds.has(node.nodeId)) return false;

          // Check if this node connects to any node in the group
          if ('outputs' in node && node.outputs) {
            return node.outputs.some(output =>
              output.destinationNodeId && groupNodeIds.has(output.destinationNodeId)
            );
          }
          return false;
        });

        return [...groupNodes, ...externalNodes];
      }
      return [];

    case 'fsm':
      // Show FSM internal state view (for future FSM state exploration)
      if (navigationState.currentContext) {
        return scenario.nodes.filter(node => node.nodeId === navigationState.currentContext);
      }
      return [];

    default:
      return scenario.nodes;
  }
}