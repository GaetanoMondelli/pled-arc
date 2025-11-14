"use client";

import React from "react";
import type { ProcessNode, RFNodeData } from "@/lib/simulation/types";
import { Cpu } from "lucide-react";
import type { NodeProps } from "reactflow";
import BaseNodeDisplay from "./BaseNodeDisplay";

const ProcessNodeDisplay: React.FC<NodeProps<RFNodeData>> = (props) => {
  const { data } = props;
  const config = data.config as ProcessNode;
  const numInputs = config.inputs.length;
  const numOutputs = config.outputs.length;

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
          {config.outputs.map((out, i) => (
            <p key={i} className="truncate font-mono text-[9px]" title={out.transformation?.formula || 'No formula'}>
              {out.transformation?.formula || 'No formula'}
            </p>
          ))}
        </>
      }
    />
  );
};

export default React.memo(ProcessNodeDisplay);
