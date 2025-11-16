"use client";

import React from "react";
import type { ProcessNode, RFNodeData } from "@/lib/simulation/types";
import { Cpu } from "lucide-react";
import type { NodeProps } from "reactflow";
import BaseNodeDisplay from "./BaseNodeDisplay";

const ProcessNodeDisplay: React.FC<NodeProps<RFNodeData>> = (props) => {
  const { data } = props;
  const config = data.config as ProcessNode;
  const numInputs = config.inputs?.length || 0;

  // Handle both formats: outputs array or data.outputs object
  let numOutputs = 0;
  let outputFormulas: string[] = [];

  if (config.outputs && Array.isArray(config.outputs)) {
    numOutputs = config.outputs.length;
    outputFormulas = config.outputs.map(out => out.transformation?.formula || 'No formula');
  } else if (config.data?.outputs && typeof config.data.outputs === 'object') {
    numOutputs = Object.keys(config.data.outputs).length;
    outputFormulas = Object.entries(config.data.outputs).map(([name, out]: [string, any]) =>
      out?.formula || 'No formula'
    );
  }

  return (
    <BaseNodeDisplay
      {...props}
      icon={Cpu}
      nodeType="Process"
      headerColor="bg-blue-600"
      activeBorderColor="border-blue-400"
      activeShadowColor="shadow-blue-400/50"
      showInputHandle={true}
      showOutputHandle={true}
      configSection={
        <>
          <p>Inputs: {numInputs}</p>
          <p>Outputs: {numOutputs}</p>
          {outputFormulas.map((formula, i) => (
            <p key={i} className="truncate font-mono text-[9px]" title={formula}>
              {formula}
            </p>
          ))}
        </>
      }
    />
  );
};

export default React.memo(ProcessNodeDisplay);
