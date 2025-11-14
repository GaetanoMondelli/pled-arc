"use client";

import React from "react";
import type { QueueNode, RFNodeData } from "@/lib/simulation/types";
import { Archive } from "lucide-react";
import type { NodeProps } from "reactflow";
import BaseNodeDisplay from "./BaseNodeDisplay";

const QueueNodeDisplay: React.FC<NodeProps<RFNodeData>> = (props) => {
  const { data } = props;
  const config = data.config as QueueNode;

  return (
    <BaseNodeDisplay
      {...props}
      icon={Archive}
      nodeType="Queue"
      headerColor="bg-slate-600"
      activeBorderColor="border-blue-400"
      activeShadowColor="shadow-blue-400/50"
      showInputHandle={true}
      showOutputHandle={true}
      configSection={
        <>
          <p>Win: {config.aggregation.trigger.window}s</p>
          <p>{config.aggregation.method}</p>
          {config.capacity && <p>Cap: {config.capacity}</p>}
        </>
      }
    />
  );
};

export default React.memo(QueueNodeDisplay);
