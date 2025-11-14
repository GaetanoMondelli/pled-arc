import { useMemo } from "react";
import type { Edge } from "reactflow";

export const useEdgeAnimations = (
  edges: Edge[],
  nodesWithActivity: Set<string>,
  isRunning: boolean
) => {
  // DISABLED: Edge animations disabled until we have proper edge-level activity tracking
  // Current implementation would show ALL edges from active nodes, which is misleading
  // for Multiplexer (shows all outputs) and FSM (shows outputs even without messages)
  const animatedEdges = useMemo(() => {
    return edges.map(edge => ({
      ...edge,
      animated: false,
      style: {
        stroke: '#cbd5e1',
        strokeWidth: 1,
      }
    }));
  }, [edges]);

  return { animatedEdges };
};
