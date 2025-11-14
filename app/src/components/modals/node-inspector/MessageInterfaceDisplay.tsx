import React, { useState } from "react";
import { MessageSquare, ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InterfaceContractDisplay } from "./InterfaceContractDisplay";
import { getNodeMessageInterfaces } from "./JsonViewer";

interface MessageInterfaceDisplayProps {
  nodeConfig: any;
}

export const MessageInterfaceDisplay: React.FC<MessageInterfaceDisplayProps> = ({ nodeConfig }) => {
  const interfaces = getNodeMessageInterfaces(nodeConfig);
  const [expandedContracts, setExpandedContracts] = useState(new Set<string>());
  const [showDetailed, setShowDetailed] = useState(false);

  const toggleContract = (contractId: string) => {
    const newExpanded = new Set(expandedContracts);
    if (newExpanded.has(contractId)) {
      newExpanded.delete(contractId);
    } else {
      newExpanded.add(contractId);
    }
    setExpandedContracts(newExpanded);
  };

  const hasEnhancedInterfaces = nodeConfig && ((nodeConfig as any).inputInterface || (nodeConfig as any).outputInterface ||
    (nodeConfig as any).inputs || (nodeConfig as any).outputs || (nodeConfig as any).routes);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-slate-700 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Message Interfaces
          {hasEnhancedInterfaces && (
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
              Enhanced
            </Badge>
          )}
        </h4>
        {hasEnhancedInterfaces && (
          <button
            onClick={() => setShowDetailed(!showDetailed)}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            {showDetailed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showDetailed ? 'Simple' : 'Detailed'}
          </button>
        )}
      </div>

      {showDetailed && hasEnhancedInterfaces ? (
        <div className="space-y-3">
          {/* Enhanced Input Interface Details */}
          {nodeConfig.inputInterface && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="h-3 w-3 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Input Interface</span>
              </div>
              <InterfaceContractDisplay
                contract={nodeConfig.inputInterface}
                direction="input"
                isExpanded={expandedContracts.has('input')}
                onToggle={() => toggleContract('input')}
              />
            </div>
          )}

          {/* Multiple Inputs (ProcessNode) */}
          {nodeConfig.inputs && Array.isArray(nodeConfig.inputs) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="h-3 w-3 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Input Interfaces ({nodeConfig.inputs.length})</span>
              </div>
              <div className="space-y-2">
                {nodeConfig.inputs.map((input: any, index: number) => (
                  <div key={index} className="ml-3">
                    <div className="text-xs text-slate-600 mb-1">
                      <code className="font-mono">{input.alias || input.nodeId}</code>
                      {input.required === false && <span className="text-slate-400 ml-1">(optional)</span>}
                    </div>
                    <InterfaceContractDisplay
                      contract={input.interface}
                      direction="input"
                      isExpanded={expandedContracts.has(`input-${index}`)}
                      onToggle={() => toggleContract(`input-${index}`)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Output Interface Details */}
          {nodeConfig.outputInterface && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowLeft className="h-3 w-3 text-slate-500 rotate-180" />
                <span className="text-xs font-medium text-slate-600">Output Interface</span>
              </div>
              <InterfaceContractDisplay
                contract={nodeConfig.outputInterface}
                direction="output"
                isExpanded={expandedContracts.has('output')}
                onToggle={() => toggleContract('output')}
              />
            </div>
          )}

          {/* Multiple Outputs (ProcessNode) */}
          {nodeConfig.outputs && Array.isArray(nodeConfig.outputs) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowLeft className="h-3 w-3 text-slate-500 rotate-180" />
                <span className="text-xs font-medium text-slate-600">Output Interfaces ({nodeConfig.outputs.length})</span>
              </div>
              <div className="space-y-2">
                {nodeConfig.outputs.map((output: any, index: number) => (
                  <div key={index} className="ml-3">
                    <div className="text-xs text-slate-600 mb-1">
                      <span className="font-mono">→ {output.destinationNodeId}</span>
                      {output.name && <span className="text-slate-400 ml-1">({output.name})</span>}
                    </div>
                    <InterfaceContractDisplay
                      contract={output.interface}
                      direction="output"
                      isExpanded={expandedContracts.has(`output-${index}`)}
                      onToggle={() => toggleContract(`output-${index}`)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Routes (Splitter) */}
          {nodeConfig.routes && Array.isArray(nodeConfig.routes) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowLeft className="h-3 w-3 text-slate-500 rotate-180" />
                <span className="text-xs font-medium text-slate-600">Route Interfaces ({nodeConfig.routes.length})</span>
              </div>
              <div className="space-y-2">
                {nodeConfig.routes.map((route: any, index: number) => (
                  <div key={index} className="ml-3">
                    <div className="text-xs text-slate-600 mb-1">
                      <span className="font-mono">→ {route.destinationNodeId}</span>
                      <span className="text-slate-400 ml-1">(priority: {route.priority || 'default'})</span>
                    </div>
                    {route.condition && (
                      <div className="text-xs text-slate-500 mb-1">
                        <code className="bg-yellow-50 px-1 py-0.5 rounded text-yellow-700">{route.condition}</code>
                      </div>
                    )}
                    <InterfaceContractDisplay
                      contract={route.outputInterface}
                      direction="output"
                      isExpanded={expandedContracts.has(`route-${index}`)}
                      onToggle={() => toggleContract(`route-${index}`)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Simple Interface Display */
        <div className="space-y-3">
          {/* Input Interfaces */}
          {interfaces.inputs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="h-3 w-3 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Accepts</span>
              </div>
              <div className="flex flex-wrap gap-1 ml-5">
              </div>
            </div>
          )}

          {/* Output Interfaces */}
          {interfaces.outputs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowLeft className="h-3 w-3 text-slate-500 rotate-180" />
                <span className="text-xs font-medium text-slate-600">Produces</span>
              </div>
              <div className="flex flex-wrap gap-1 ml-5">
              </div>
            </div>
          )}

          {interfaces.inputs.length === 0 && interfaces.outputs.length === 0 && (
            <div className="text-xs text-slate-500 italic">
              No message interfaces defined for this node type
            </div>
          )}
        </div>
      )}
    </div>
  );
};
