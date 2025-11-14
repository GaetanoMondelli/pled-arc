"use client";

import React from "react";
import type { DataSourceNode, RFNodeData } from "@/lib/simulation/types";
import { DatabaseZap } from "lucide-react";
import type { NodeProps } from "reactflow";
import BaseNodeDisplay from "./BaseNodeDisplay";

const DataSourceNodeDisplay: React.FC<NodeProps<RFNodeData>> = (props) => {
  const { data, selected, id } = props;
  const config = data.config as DataSourceNode | undefined;

  return (
    <BaseNodeDisplay
      {...props}
      icon={DatabaseZap}
      nodeType="DataSource"
      headerColor="bg-teal-600"
      activeBorderColor="border-green-400"
      activeShadowColor="shadow-green-400/50"
      showOutputHandle={true}
      configSection={
        <>
          <p>Int: {config?.interval ? `${config.interval}s` : '—'}</p>
          <p>
            Range: [
            {config?.generation?.valueMin ?? '—'}-
            {config?.generation?.valueMax ?? '—'}]
          </p>
          <p>To: {config?.outputs?.[0]?.destinationNodeId || 'None'}</p>
        </>
      }
    />
  );
};

export default React.memo(DataSourceNodeDisplay);
