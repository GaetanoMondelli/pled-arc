"use client";

import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from "reactflow";

/**
 * Custom edge that draws a smooth step path and always renders a centered label.
 * Useful when built-in label rendering is inconsistent due to styling.
 */
const LabeledSmoothStepEdge: React.FC<EdgeProps> = (props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    label,
    selected,
    data,
  } = props;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
    centerX: (sourceX + targetX) / 2,
    centerY: (sourceY + targetY) / 2,
  });

  const stroke = (style as React.CSSProperties | undefined)?.stroke || "#94a3b8"; // slate-400
  const strokeWidth = (style as React.CSSProperties | undefined)?.strokeWidth || 1.5;

  // Dynamic vertical offset to reduce overlap with nodes/edges based on label length
  const labelStr = label != null ? String(label) : "";
  const len = labelStr.length;
  const yDirection = targetY >= sourceY ? -1 : 1; // favor offset away from the general direction
  const dyn = Math.min(18, Math.max(6, Math.floor(len * 0.6)));
  const labelYOffset = yDirection * (10 + Math.floor(dyn / 2));

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke, strokeWidth, ...(style as React.CSSProperties) }}
        markerEnd={markerEnd}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + labelYOffset}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <span
              className="text-[11px] font-medium"
              style={{
                color: data?.active ? "#334155" : "#475569", // slate-700 : slate-600
                background: "#ffffff",
                border: "1px solid #e2e8f0", // slate-200
                borderRadius: 6,
                padding: "2px 6px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 160,
              }}
              title={labelStr}
            >
              {labelStr}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default LabeledSmoothStepEdge;
