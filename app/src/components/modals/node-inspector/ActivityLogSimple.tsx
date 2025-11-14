import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSimulationStore } from "@/stores/simulationStore";

interface ActivityLogSimpleProps {
  nodeId: string;
}

export const ActivityLogSimple: React.FC<ActivityLogSimpleProps> = ({ nodeId }) => {
  const nodeActivityLogs = useSimulationStore(state => state.nodeActivityLogs);
  const logs = nodeActivityLogs[nodeId] || [];

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground p-3 border rounded-md">No activity logged yet for this node.</p>;
  }

  return (
    <div className="border rounded-md">
      <div className="bg-muted/50 px-3 py-2 text-xs font-medium border-b">
        <div className="flex gap-4">
          <div className="w-16 flex-shrink-0">Time</div>
          <div className="w-40 flex-shrink-0">Action</div>
          <div className="w-16 flex-shrink-0">Value</div>
          <div className="flex-1 min-w-0">Details</div>
        </div>
      </div>
      <ScrollArea className="h-64 w-full">
        <div className="divide-y min-h-0">
          {logs
            .slice(-30)
            .reverse()
            .map((log, index) => (
              <div key={`${log.sequence}-${index}`} className="px-3 py-2 text-xs hover:bg-muted/30">
                <div className="flex gap-4 items-start">
                  <div className="w-16 flex-shrink-0 font-mono text-muted-foreground">{log.timestamp}s</div>
                  <div className="w-40 flex-shrink-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)} block truncate`}
                      title={log.action}
                    >
                      {log.action}
                    </span>
                  </div>
                  <div className="w-16 flex-shrink-0 font-mono text-right">
                    {log.value !== undefined ? String(log.value) : "-"}
                  </div>
                  <div className="flex-1 min-w-0 text-muted-foreground break-words">{log.details || "-"}</div>
                </div>
              </div>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
};

const getActionColor = (action: string): string => {
  // Simplified state-based event colors
  if (action === "accumulating") return "bg-orange-100 text-orange-800";
  if (action === "processing") return "bg-blue-100 text-blue-800";
  if (action === "emitting") return "bg-green-100 text-green-800";
  if (action === "token_received") return "bg-cyan-100 text-cyan-800";
  if (action === "firing") return "bg-purple-100 text-purple-800";
  if (action === "consuming") return "bg-pink-100 text-pink-800";
  if (action === "idle") return "bg-gray-100 text-gray-600";
  if (action === "error") return "bg-red-100 text-red-800";
  if (action === "token_dropped") return "bg-yellow-100 text-yellow-800";
  return "bg-slate-100 text-slate-700";
};
