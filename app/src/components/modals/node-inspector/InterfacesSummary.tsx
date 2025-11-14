import React, { useMemo } from "react";

interface InterfacesSummaryProps {
  nodeConfig: any;
}

export const InterfacesSummary: React.FC<InterfacesSummaryProps> = ({ nodeConfig }) => {
  const interfaces = useMemo(() => {
    const inputInterfaces: string[] = [];
    const outputInterfaces: string[] = [];

    // Collect input interfaces
    if (nodeConfig.inputInterface?.type) {
      inputInterfaces.push(nodeConfig.inputInterface.type);
    }
    if (nodeConfig.inputs && Array.isArray(nodeConfig.inputs)) {
      nodeConfig.inputs.forEach((input: any) => {
        if (input.interface?.type) {
          inputInterfaces.push(input.interface.type);
        }
      });
    }

    // Collect output interfaces
    if (nodeConfig.outputInterface?.type) {
      outputInterfaces.push(nodeConfig.outputInterface.type);
    }
    if (nodeConfig.outputs && Array.isArray(nodeConfig.outputs)) {
      nodeConfig.outputs.forEach((output: any) => {
        if (output.interface?.type) {
          outputInterfaces.push(output.interface.type);
        }
      });
    }

    return {
      inputs: [...new Set(inputInterfaces)],
      outputs: [...new Set(outputInterfaces)]
    };
  }, [nodeConfig]);

  if (interfaces.inputs.length === 0 && interfaces.outputs.length === 0) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg">
        <h3 className="text-sm font-medium text-slate-700 mb-2">Message Interfaces</h3>
        <div className="text-xs text-slate-500 italic">
          No message interfaces defined for this node type
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-50 rounded-lg">
      <h3 className="text-sm font-medium text-slate-700 mb-3">Message Interfaces</h3>

      {interfaces.inputs.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-slate-600">Consumes</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {interfaces.inputs.map((interfaceType: string) => (
              <div
                key={interfaceType}
                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"
                title={`Input interface: ${interfaceType}`}
              >
                {interfaceType}
              </div>
            ))}
          </div>
        </div>
      )}

      {interfaces.outputs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-slate-600">Produces</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {interfaces.outputs.map((interfaceType: string) => (
              <div
                key={interfaceType}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                title={`Output interface: ${interfaceType}`}
              >
                {interfaceType}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
