"use client";

import React from "react";
import type { RFNodeData, SinkNode } from "@/lib/simulation/types";
import { Trash } from "lucide-react";
import type { NodeProps } from "reactflow";
import BaseNodeDisplay from "./BaseNodeDisplay";

const SinkNodeDisplay: React.FC<NodeProps<RFNodeData>> = (props) => {
  const { data } = props;
  const config = data.config as SinkNode;

  return (
    <BaseNodeDisplay
      {...props}
      icon={Trash}
      nodeType="Terminal"
      headerColor="bg-orange-600"
      activeBorderColor="border-orange-400"
      activeShadowColor="shadow-orange-400/50"
      showInputHandle={true}
      configSection={
        <>
          <p>Type: Terminal</p>
        </>
      }
    />
  );
};

export default React.memo(SinkNodeDisplay);
