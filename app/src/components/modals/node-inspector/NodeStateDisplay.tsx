import React from "react";
import { Activity, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JsonViewer } from "./JsonViewer";

interface NodeStateDisplayProps {
  nodeState: any;
  showJson: boolean;
  onToggleJson: () => void;
}

export const NodeStateDisplay: React.FC<NodeStateDisplayProps> = ({ 
  nodeState, 
  showJson, 
  onToggleJson 
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Runtime State
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onToggleJson}
        >
          <Code className="h-3 w-3 mr-1" />
          {showJson ? 'Hide' : 'JSON'}
        </Button>
      </div>
      
      {showJson ? (
        <JsonViewer value={nodeState} />
      ) : (
        <div className="bg-slate-50 p-3 rounded-md space-y-2 text-sm min-h-[calc(15rem_+_2.5rem)]">
          {nodeState?.stateMachine && (
            <>
              <div><span className="font-medium text-slate-600">Current State:</span> <span className="font-mono text-slate-800">{nodeState.stateMachine.currentState}</span></div>
              <div><span className="font-medium text-slate-600">Transitions:</span> {nodeState.stateMachine.transitionHistory?.length || 0}</div>
              {nodeState.stateMachine.stateChangedAt && (
                <div><span className="font-medium text-slate-600">Changed At:</span> {nodeState.stateMachine.stateChangedAt}s</div>
              )}
              <hr className="border-slate-200 my-2" />
            </>
          )}
          {nodeState?.lastProcessedTime !== undefined && (
            <div><span className="font-medium text-slate-600">Last Processed:</span> {nodeState.lastProcessedTime}s</div>
          )}
          {nodeState?.consumedTokenCount !== undefined && (
            <div><span className="font-medium text-slate-600">Tokens Consumed:</span> {nodeState.consumedTokenCount}</div>
          )}
          {nodeState?.inputBuffer && (
            <div><span className="font-medium text-slate-600">Input Buffer:</span> {nodeState.inputBuffer.length} tokens</div>
          )}
          {nodeState?.outputBuffer && (
            <div><span className="font-medium text-slate-600">Output Buffer:</span> {nodeState.outputBuffer.length} tokens</div>
          )}
        </div>
      )}
    </div>
  );
};
