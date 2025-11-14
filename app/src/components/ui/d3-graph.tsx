import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./button";
import * as d3 from "d3";
import * as dagreD3 from "dagre-d3";
import { CrosshairIcon, FileText, MoveIcon, Play, RotateCcwIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";

interface Node {
  id: string;
  isActive?: boolean;
  isInitial?: boolean;
  isFinal?: boolean;
  highlight?: boolean;
  metadata?: {
    description?: string;
    actions?: string[];
  };
  isWarning?: boolean;
}

interface Link {
  source: string;
  target: string;
  label?: string;
}

interface D3GraphProps {
  nodes: Node[];
  links: Link[];
  width?: number;
  height?: number;
  direction?: "LR" | "TB";
  onNodeClick?: (node: any) => void;
  documents?: {
    contracts?: Array<{
      id: string;
      linkedStates?: string[];
    }>;
  };
}

export const D3Graph = React.forwardRef<any, D3GraphProps>(
  ({ nodes, links, width = 800, height = 400, direction = "LR", onNodeClick, documents }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const graphRef = useRef<any>(null);
    const zoomRef = useRef<any>(null);
    const [isDraggingEnabled, setIsDraggingEnabled] = useState(false);
    const NODE_WIDTH = 150;
    const NODE_HEIGHT = 50;

    // Define focusOnState function at component level
    const focusOnState = useCallback(
      (stateId: string) => {
        if (!svgRef.current || !graphRef.current) return;

        const g = graphRef.current;
        const nodeData = g.node(stateId);
        if (!nodeData) return;

        const svg = d3.select(svgRef.current);
        const scale = 1;
        const x = width / 2 - nodeData.x * scale;
        const y = height / 2 - nodeData.y * scale;

        svg.transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity.translate(x, y).scale(scale));
      },
      [width],
    );

    // Expose the focusOnState method through ref
    React.useImperativeHandle(
      ref,
      () => ({
        focusOnState,
      }),
      [focusOnState],
    );

    const resetLayout = useCallback(() => {
      if (!svgRef.current || !graphRef.current || !zoomRef.current) return;

      const svg = d3.select(svgRef.current);
      const initialScale = 0.75;
      const xCenterOffset = (width - graphRef.current.graph().width * initialScale) / 2;
      const yCenterOffset = 20;

      svg.call(zoomRef.current.transform, d3.zoomIdentity.translate(xCenterOffset, yCenterOffset).scale(initialScale));
    }, [width]);

    const focusOnCurrentState = useCallback(() => {
      if (!svgRef.current || !graphRef.current || !zoomRef.current) return;

      const currentNode = nodes.find(n => n.isActive);
      if (!currentNode) return;

      const nodeData = graphRef.current.node(currentNode.id);
      if (!nodeData) return;

      const svg = d3.select(svgRef.current);
      const scale = 1;
      const x = width / 2 - nodeData.x * scale;
      const y = height / 2 - nodeData.y * scale;

      svg.call(zoomRef.current.transform, d3.zoomIdentity.translate(x, y).scale(scale));
    }, [nodes, width, height]);

    const handleZoom = useCallback((factor: number) => {
      if (!svgRef.current || !zoomRef.current) return;

      const svg = d3.select(svgRef.current);
      const currentTransform = d3.zoomTransform(svg.node()!);
      const newScale = currentTransform.k * factor;

      if (newScale >= 0.1 && newScale <= 2) {
        svg.call(zoomRef.current.scaleBy, factor);
      }
    }, []);

    const getStatesWithMetadata = (nodes: Node[], documents?: D3GraphProps["documents"]) => {
      const statesWithActions = nodes
        .filter(n => n.metadata?.actions && n.metadata.actions.length > 0)
        .map(n => ({ id: n.id, actions: n.metadata?.actions }));

      const statesWithDocs = nodes
        .filter(n => documents?.contracts?.some(doc => doc.linkedStates?.includes(n.id)))
        .map(n => ({
          id: n.id,
          docs: documents?.contracts?.filter(doc => doc.linkedStates?.includes(n.id)).map(doc => doc.id),
        }));

      return { statesWithActions, statesWithDocs };
    };

    useEffect(() => {
      if (!svgRef.current) return;
      if (nodes.length === 0) return;

      const svg = d3.select(svgRef.current).attr("width", width).attr("height", height);

      svg.selectAll("*").remove();

      // Function to check if a state has linked documents
      const hasLinkedDocuments = (stateId: string) => {
        return documents?.contracts?.some(doc => doc.linkedStates?.includes(stateId)) || false;
      };

      const g = new dagreD3.graphlib.Graph().setGraph({
        rankdir: direction,
        nodesep: 40,
        ranksep: 60,
        marginx: 20,
        marginy: 20,
        edgesep: 15,
        ranker: "tight-tree",
      });

      // Create svgGroup early
      const svgGroup = svg.append("g");

      // Calculate final states
      const finalStates = new Set(nodes.map(n => n.id));
      links.forEach(link => {
        finalStates.delete(link.source);
      });

      // Set up nodes with proper metadata
      nodes.forEach(node => {
        const isInitial = node.id === "idle";
        const isFinal = finalStates.has(node.id);
        const isWarning = node.id.startsWith("warning_");

        let nodeStyle = "";
        if (node.highlight) {
          nodeStyle = "fill: #fef08a; stroke: #facc15;"; // Yellow highlight
        } else if (node.isActive) {
          nodeStyle = "fill: #22c55e; stroke: #16a34a;";
        } else if (isInitial) {
          nodeStyle = "fill: #3b82f6; stroke: #2563eb;";
        } else if (isFinal) {
          nodeStyle = "fill: #ef4444; stroke: #dc2626;";
        } else if (isWarning) {
          nodeStyle = "fill: #f3f4f6; stroke: #9ca3af;"; // Grey for warning states
        } else {
          nodeStyle = "fill: #fff; stroke: #333;";
        }

        g.setNode(node.id, {
          label: node.id,
          class: `${node.isActive ? "active" : ""} ${isInitial ? "initial" : ""} ${isFinal ? "final" : ""} ${isWarning ? "warning" : ""}`,
          shape: "rect",
          rx: 4,
          ry: 4,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          style: nodeStyle,
          metadata: node.metadata,
          hasDocuments: hasLinkedDocuments(node.id),
          isWarning,
        });
      });

      // Set up edges
      links.forEach(link => {
        g.setEdge(link.source, link.target, {
          label: link.label,
          labelStyle: "font-size: 11px;",
          curve: d3.curveBasis,
          arrowheadStyle: "fill: #333;",
          style: "stroke: #333; stroke-width: 1.5px;",
        });
      });

      const render = new dagreD3.render();

      // Override the default node shape
      render.shapes().rect = function (parent, bbox, nodeData) {
        const shapeSvg = parent
          .insert("rect", ":first-child")
          .attr("rx", 5)
          .attr("ry", 5)
          .attr("x", -bbox.width / 2)
          .attr("y", -bbox.height / 2)
          .attr("width", bbox.width)
          .attr("height", bbox.height);

        // Add icons if needed
        const hasActions = (nodeData as any).metadata?.actions?.length > 0;
        const hasDocuments = (nodeData as any).hasDocuments;
        const isWarning = (nodeData as any).isWarning;

        const iconSize = 14;
        const iconPadding = 5;
        const iconY = -bbox.height / 2 + iconPadding;

        // Add warning icon for warning states
        if (isWarning) {
          // Add exclamation mark icon
          parent
            .append("text")
            .attr("class", "warning-icon")
            .attr("y", iconY + iconSize)
            .attr("x", -bbox.width / 2 + iconPadding)
            .attr("font-family", "sans-serif")
            .attr("font-size", "14px")
            .attr("fill", "#9ca3af") // Grey color
            .text("⚠️");

          // Make the node text grey
          parent.select("text.label").attr("fill", "#6b7280"); // Grey text
        }

        // Add existing action and document icons
        if (hasActions) {
          parent
            .append("path")
            .attr("d", "M8 5v14l11-7z")
            .attr("transform", `translate(${bbox.width / 2 - iconSize - iconPadding}, ${iconY})`)
            .attr("class", "action-icon")
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("fill", "none")
            .attr("stroke", "currentColor")
            .attr("stroke-width", "1.5");
        }

        if (hasDocuments) {
          parent
            .append("path")
            .attr("d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z")
            .attr(
              "transform",
              `translate(${bbox.width / 2 - (hasActions ? 2 * (iconSize + iconPadding) : iconSize + iconPadding)}, ${iconY})`,
            )
            .attr("class", "document-icon")
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("fill", "none")
            .attr("stroke", "currentColor")
            .attr("stroke-width", "1.5");
        }

        return shapeSvg;
      };

      // Add intersection function to the node data
      g.nodes().forEach(v => {
        const node = g.node(v);
        node.intersect = function (point: { x: number; y: number }) {
          const bbox = this.elem.getBBox();
          const w = bbox.width / 2;
          const h = bbox.height / 2;

          const dx = point.x - node.x;
          const dy = point.y - node.y;

          let sx, sy;
          if (Math.abs(dy) * w > Math.abs(dx) * h) {
            // Intersection is at top or bottom
            sx = dy < 0 ? (-h * dx) / dy : (h * dx) / dy;
            sy = dy < 0 ? -h : h;
          } else {
            // Intersection is at left or right
            sx = dx < 0 ? -w : w;
            sy = dx < 0 ? (-w * dy) / dx : (w * dy) / dx;
          }

          return {
            x: node.x + sx,
            y: node.y + sy,
          };
        };
      });

      const zoom = d3
        .zoom()
        .scaleExtent([0.1, 2])
        .on("zoom", event => {
          svgGroup.attr("transform", event.transform);
        });

      svg.call(zoom as any);

      let draggedNode: any = null;

      let isPanning = false;
      document.addEventListener("keydown", e => {
        if (e.code === "Space") {
          isPanning = true;
          if (svgRef.current) {
            svgRef.current.style.cursor = "grab";
          }
        }
      });

      document.addEventListener("keyup", e => {
        if (e.code === "Space") {
          isPanning = false;
          if (svgRef.current) {
            svgRef.current.style.cursor = "default";
          }
        }
      });

      // Define drag behavior before using it
      const dragBehavior = d3.drag().on("start", dragStart).on("drag", dragMove).on("end", dragEnd);

      function dragStart(event: any, d: any) {
        if (isPanning || !isDraggingEnabled) return;
        event.sourceEvent.stopPropagation();
        draggedNode = d;
      }

      function updateAllEdgeLabels() {
        // Remove all existing edge labels first
        svgGroup.selectAll(".edgeLabel").remove();

        // Re-create all edge labels
        g.edges().forEach(e => {
          const sourceNode = g.node(e.v);
          const targetNode = g.node(e.w);
          const edge = g.edge(e);

          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;

          const midX = (sourceNode.x + targetNode.x) / 2;
          const midY = (sourceNode.y + targetNode.y) / 2;

          const curvature = 0.3;
          const offset = Math.min(Math.abs(dx), Math.abs(dy)) * curvature;

          // Position label above or below the edge based on the edge direction
          const labelOffset = 15; // Increased offset from edge
          const labelY = midY + (dy > 0 ? -labelOffset : labelOffset);

          const labelGroup = svgGroup
            .append("g")
            .attr("class", "edgeLabel")
            .attr("data-source", e.v)
            .attr("data-target", e.w)
            .attr("transform", `translate(${midX},${labelY})`);

          labelGroup
            .append("rect")
            .attr("x", -20)
            .attr("y", -10)
            .attr("width", 40)
            .attr("height", 20)
            .attr("fill", "white");

          labelGroup
            .append("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-size", "11px")
            .text(edge.label || "");
        });
      }

      function updateAllEdgePaths() {
        // First, calculate the center of all nodes
        const centerX = nodes.reduce((sum, n) => sum + g.node(n.id).x, 0) / nodes.length;
        const centerY = nodes.reduce((sum, n) => sum + g.node(n.id).y, 0) / nodes.length;

        g.edges().forEach(e => {
          const sourceNode = g.node(e.v);
          const targetNode = g.node(e.w);

          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;

          const midX = (sourceNode.x + targetNode.x) / 2;
          const midY = (sourceNode.y + targetNode.y) / 2;

          const distance = Math.sqrt(dx * dx + dy * dy);
          const curvature = distance > NODE_WIDTH * 2 ? 0.5 : 0.3;

          // Determine if the edge midpoint is above or below the canvas center
          const isMidpointAboveCenter = midY < centerY;
          // Determine if the edge midpoint is left or right of the canvas center
          const isMidpointLeftOfCenter = midX < centerX;

          // Calculate offset direction based on position relative to center
          const offsetDirection =
            Math.abs(dx) > Math.abs(dy)
              ? isMidpointAboveCenter
                ? 1
                : -1 // For horizontal edges
              : isMidpointLeftOfCenter
                ? 1
                : -1; // For vertical edges

          const offset = Math.min(Math.abs(dx), Math.abs(dy)) * curvature * offsetDirection;

          const controlPoint = {
            x: midX,
            y: midY + offset, // Note: positive offset curves downward, negative curves upward
          };

          const points = [{ x: sourceNode.x, y: sourceNode.y }, controlPoint, { x: targetNode.x, y: targetNode.y }];

          const edgePath = svgGroup.select(`path[data-source="${e.v}"][data-target="${e.w}"]`);
          edgePath
            .attr(
              "d",
              d3
                .line()
                .x(d => d[0])
                .y(d => d[1])
                .curve(d3.curveBasis)(points.map(p => [p.x, p.y])),
            )
            .attr("stroke", "#333")
            .attr("stroke-width", 1.5)
            .attr("fill", "none")
            .attr("marker-end", "url(#arrowhead)");
        });
      }

      function dragMove(this: any, event: any, d: any) {
        if (isPanning || !draggedNode) return;

        const node = g.node(draggedNode);
        node.x += event.dx;
        node.y += event.dy;

        d3.select(this as SVGGElement).attr("transform", `translate(${node.x},${node.y})`);

        // Update all edges and labels
        updateAllEdgePaths();
        updateAllEdgeLabels();
      }

      function dragEnd(event: any, d: any) {
        if (!draggedNode) return;

        // Final update of all edges and labels
        updateAllEdgePaths();
        updateAllEdgeLabels();
        draggedNode = null;
      }

      // Add styles for the icons
      const style = document.createElement("style");
      style.textContent = `
      .node rect {
        stroke-width: 2px;
        cursor: move;
      }
      .node.active rect {
        fill: #22c55e;
        stroke: #16a34a;
      }
      .node.initial rect {
        fill: #3b82f6;
        stroke: #2563eb;
      }
      .node.final rect {
        fill: #ef4444;
        stroke: #dc2626;
      }
      .edgePath path {
        stroke: #333;
        stroke-width: 1.5px;
        fill: none;
        pointer-events: none;
        marker-end: url(#arrowhead);
      }
      .edgePath:hover path {
        stroke-width: 2px;
      }
      .edgeLabel {
        font-size: 12px;
        fill: #333;
        background: white;
      }
      .edgeLabel rect {
        fill: white;
      }
      .node text {
        font-size: 14px;
        font-weight: 500;
        fill: white;
      }
      .node:not(.active):not(.initial):not(.final) text {
        fill: #333;
      }
      marker#arrowhead path {
        fill: #333;
        stroke: none;
      }
      .action-icon {
        fill: currentColor;
        opacity: 0.5;
        cursor: pointer;
        font-size: 14px;
      }
      .document-icon {
        fill: currentColor;
        opacity: 0.5;
        cursor: pointer;
        font-size: 14px;
      }
      .action-icon:hover, .document-icon:hover {
        opacity: 1;
      }
    `;
      document.head.appendChild(style);
      // Create the renderer with proper typing
      (render as any)(svgGroup, g);

      // Move these to after all function definitions
      graphRef.current = g;
      zoomRef.current = zoom;

      // Update cursor style based on dragging state
      svgGroup.selectAll("g.node").style("cursor", isDraggingEnabled ? "move" : "pointer");

      // Add click handler to nodes
      svgGroup.selectAll("g.node").on("click", (event, d: any) => {
        event.stopPropagation(); // Prevent any parent handlers from firing
        if (onNodeClick) {
          const nodeData = g.node(d);
          onNodeClick({
            id: d,
            metadata: nodeData.metadata,
          });
        }
      });

      // In the debug section, add console logs
      const metadata = getStatesWithMetadata(nodes, documents);

      return () => {
        document.head.removeChild(style);
      };
    }, [nodes, links, width, height, direction, isDraggingEnabled, onNodeClick, documents]);

    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center px-2">
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => handleZoom(1.2)} title="Zoom In">
              <ZoomInIcon className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => handleZoom(0.8)} title="Zoom Out">
              <ZoomOutIcon className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={resetLayout} title="Reset Layout">
              <RotateCcwIcon className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={focusOnCurrentState} title="Focus on Current State">
              <CrosshairIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={isDraggingEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setIsDraggingEnabled(!isDraggingEnabled)}
              className="flex items-center gap-2"
            >
              <MoveIcon className="h-4 w-4" />
              <span>{isDraggingEnabled ? "Disable Dragging" : "Enable Dragging"}</span>
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {isDraggingEnabled ? (
              <span className="font-medium text-blue-600">Node dragging enabled</span>
            ) : (
              <>
                <MoveIcon className="h-4 w-4" />
                <span>Hold Space + Drag to Pan</span>
              </>
            )}
          </div>
        </div>
        <div
          className="w-full border rounded-lg overflow-hidden bg-white"
          style={{ height: height }}
          onClick={e => {
            // Only clear if clicking the background, not a node
            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "svg") {
              onNodeClick?.(null);
            }
          }}
        >
          <svg ref={svgRef} className="w-full h-full" />
        </div>

        {/* <div className="p-4 border rounded-lg bg-gray-50 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">States with Actions:</h3>
            <ul className="space-y-1">
              {getStatesWithMetadata(nodes, documents).statesWithActions.map(state => (
                <li key={state.id} className="text-gray-600">
                  {state.id}: [{state.actions?.join(', ')}]
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">States with Documents:</h3>
            <ul className="space-y-1">
              {getStatesWithMetadata(nodes, documents).statesWithDocs.map(state => (
                <li key={state.id} className="text-gray-600">
                  {state.id}: [{state.docs?.join(', ')}]
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div> */}
      </div>
    );
  },
);

D3Graph.displayName = "D3Graph";
