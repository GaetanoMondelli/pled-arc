"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GitBranch } from "lucide-react";
import type { NodeProps } from "reactflow";
import type { RFNodeData } from "@/lib/simulation/types";
import BaseNodeDisplay from "./BaseNodeDisplay";
import MultiplexerConfigurationModal from "./MultiplexerConfigurationModal";

const MultiplexerDisplay: React.FC<NodeProps<RFNodeData>> = (props) => {
  const { data, id } = props;
  const config = data.config;
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Get configuration for Multiplexer
  const conditions = config.multiplexing?.conditions || [];
  const strategy = config.multiplexing?.strategy || 'round_robin';
  const outputs = config.outputs || [];

  return (
    <>
      <BaseNodeDisplay
        {...props}
        icon={GitBranch}
        nodeType="Multiplexer"
        headerColor="bg-purple-600"
        activeBorderColor="border-purple-400"
        activeShadowColor="shadow-purple-400/50"
        showInputHandle={true}
        showOutputHandle={true}
        expandable={true}
        defaultExpanded={false}
        configSection={
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Strategy:</span>
              <span className="font-mono font-semibold">{strategy}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outputs:</span>
              <span className="font-mono font-semibold">{outputs.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conditions:</span>
              <span className="font-mono font-semibold">{conditions.length}</span>
            </div>
          </div>
        }
        runtimeSection={
          <div className="space-y-1.5 text-[10px]">
            {/* Strategy info - always visible when runtime section is shown */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Strategy:</span>
              <Badge variant="outline" className="text-[8px] h-4 px-1">
                {strategy.toUpperCase()}
              </Badge>
            </div>

            {/* Display conditions - only when expanded */}
            <div className="pt-1 border-t border-muted-foreground/20">
              <p className="font-semibold text-muted-foreground mb-1">
                CONDITIONS ({conditions.length}):
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {conditions.slice(0, 5).map((condition: string, index: number) => (
                  <div key={index} className="p-1.5 bg-muted-foreground/5 rounded-sm border border-muted-foreground/10">
                    <div className="font-mono text-[9px] text-slate-700 leading-tight break-words">
                      {condition}
                    </div>
                  </div>
                ))}
                {conditions.length > 5 && (
                  <div className="text-[9px] text-muted-foreground text-center py-1">
                    +{conditions.length - 5} more conditions...
                  </div>
                )}
              </div>
            </div>

            {/* Configuration button - only when expanded */}
            <div className="pt-1 border-t border-muted-foreground/20">
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-1 text-[9px] w-full"
                onClick={() => setIsConfigModalOpen(true)}
              >
                <GitBranch className="w-3 h-3 mr-1" />
                Configure
              </Button>
            </div>
          </div>
        }
      />

      {/* Configuration Modal */}
      {isConfigModalOpen && (
        <MultiplexerConfigurationModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          nodeId={id}
          config={config}
        />
      )}
    </>
  );
};

export default MultiplexerDisplay;