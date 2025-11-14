import { useMemo } from "react";
import type { Edge, Node } from "reactflow";
import { MarkerType } from "reactflow";
import type { Scenario } from "@/lib/simulation/types";

/**
 * Hook to generate ReactFlow edges from scenario node connections
 */
export const useEdgeGenerationFromScenario = (
  scenario: Scenario | null,
  nodes: Node[]
) => {
    const edges = useMemo(() => {
    if (!scenario || !nodes.length) return [];

    const edgeMap = new Map<string, Edge>();

    // Get visible node IDs + ALL their connection targets (even if target is filtered out)
    // This ensures output edges to external nodes are shown
    const visibleNodeIds = new Set(nodes.map(n => n.id));
    
    // Also include nodes that are targets of visible nodes (for external outputs)
    const allTargetNodeIds = new Set<string>();
    scenario.nodes.forEach(node => {
      if (visibleNodeIds.has(node.nodeId) && node.outputs) {
        node.outputs.forEach(output => {
          if (output.destinationNodeId) {
            allTargetNodeIds.add(output.destinationNodeId);
          }
        });
      }
    });    scenario.nodes.forEach(node => {
      // Handle Group nodes specially - create virtual edges from group to external targets
      if (node.type === 'Group' && visibleNodeIds.has(node.nodeId) && node.containedNodes) {
        console.log('🔍 Processing Group node:', node.nodeId, 'with contained nodes:', node.containedNodes);
        
        // Find all outputs from nodes inside this group that go to nodes outside
        const externalOutputs = new Map<string, { targetId: string; sourceNodeId: string }>();
        
        node.containedNodes.forEach((containedNodeId: string) => {
          const containedNode = scenario.nodes.find(n => n.nodeId === containedNodeId);
          if (containedNode?.outputs) {
            console.log(`  📤 Checking outputs of ${containedNodeId}:`, containedNode.outputs);
            containedNode.outputs.forEach(output => {
              if (output.destinationNodeId && 
                  !node.containedNodes?.includes(output.destinationNodeId)) {
                // This output goes outside the group
                console.log(`    ✅ External output found: ${containedNodeId} → ${output.destinationNodeId}`);
                externalOutputs.set(
                  `${node.nodeId}-${output.destinationNodeId}`,
                  { targetId: output.destinationNodeId, sourceNodeId: containedNodeId }
                );
              }
            });
          }
        });
        
        console.log('🎯 Creating', externalOutputs.size, 'virtual edges from group', node.nodeId);
        
        // Create virtual edges from group to external targets
        externalOutputs.forEach(({ targetId }, key) => {
          const edgeId = `e-group-${key}`;
          console.log(`  🔗 Creating virtual edge: ${edgeId} (${node.nodeId} → ${targetId})`);
          edgeMap.set(edgeId, {
            id: edgeId,
            source: node.nodeId,
            sourceHandle: 'output',
            target: targetId,
            targetHandle: 'input',
            type: 'default',
            deletable: false,
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--foreground))' },
            data: { animated: false, virtual: true },
          });
        });
      }
      
      // Handle outputs array (V3 format) for regular nodes
      if (node.outputs && node.outputs.length > 0) {
        node.outputs.forEach(output => {
          const hasDestination = output.destinationNodeId && output.destinationNodeId.trim() !== "";
          // Show edge if source is visible (even if target is not - external outputs)
          const sourceVisible = visibleNodeIds.has(node.nodeId);
          const isVisible = hasDestination && sourceVisible;
          
          if (hasDestination && isVisible) {
            const targetNode = scenario.nodes.find(n => n.nodeId === output.destinationNodeId);
            
            // Determine source handle based on node type
            // IMPORTANT: Handle IDs must match what's defined in the node display components
            let sourceHandle: string | undefined;
            if (node.type === 'ProcessNode') {
              sourceHandle = `output-${output.name}`;
            } else if (node.type === 'FSMProcessNode') {
              // FSMProcessNode uses the output name directly
              sourceHandle = output.name;
            } else if (node.type === 'StateMultiplexer') {
              sourceHandle = output.name;
            } else if (node.type === 'DataSource') {
              sourceHandle = 'output';
            } else {
              sourceHandle = output.name;
            }
            
            // Get target handle - look up the input definition
            let targetHandle: string | undefined;
            if (targetNode && targetNode.inputs && targetNode.inputs.length > 0) {
              // Find matching input by checking nodeId and sourceOutputName
              const targetInput = targetNode.inputs.find(input =>
                input.nodeId === node.nodeId && input.sourceOutputName === output.name
              );
              if (targetInput) {
                targetHandle = targetInput.name;
              } else {
                // Fallback: use destinationInputName from output
                targetHandle = output.destinationInputName || 'input';
              }
            } else {
              // No inputs defined, use destinationInputName or default
              targetHandle = output.destinationInputName || 'input';
            }
            
            const edgeId = `e-${node.nodeId}-${output.name}-${output.destinationNodeId}`;
            
            edgeMap.set(edgeId, {
              id: edgeId,
              source: node.nodeId,
              sourceHandle,
              target: output.destinationNodeId,
              targetHandle,
              type: 'default',
              deletable: true,
              animated: false,
              markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--foreground))' },
              data: { animated: false },
            });
          }
        });
      }
    });

    return Array.from(edgeMap.values());
  }, [scenario, nodes]);

  return edges;
};
