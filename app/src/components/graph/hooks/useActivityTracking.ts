import { useMemo } from "react";
import type { Node } from "reactflow";

export const useActivityTracking = (
  nodes: Node[],
  currentTime: number,
  activityLog: any,
  isRunning: boolean
) => {
  // Track which nodes have recent activity
  const nodesWithActivity = useMemo(() => {
    if (!activityLog) {
      return new Set<string>();
    }

    const activeNodes = new Set<string>();
    const recentWindowSeconds = 2; // Show activity for 2 seconds after each step

    Object.entries(activityLog).forEach(([nodeId, events]: [string, any]) => {
      if (!events || events.length === 0) return;

      // Check if there's any activity within the recent window
      // NOTE: currentTime and timestamps are in SECONDS, not milliseconds
      const hasRecentActivity = events.some((event: any) => {
        const eventTime = event.timestamp || 0;
        const timeDiff = currentTime - eventTime;
        return timeDiff < recentWindowSeconds;
      });

      if (hasRecentActivity) {
        activeNodes.add(nodeId);
      }
    });

    return activeNodes;
  }, [activityLog, currentTime]);

  return { nodesWithActivity };
};
