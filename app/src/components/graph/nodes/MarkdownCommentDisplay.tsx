"use client";

import React, { useState, useCallback } from "react";
import { Edit3, Trash2 } from "lucide-react";
import type { NodeProps } from "reactflow";
import { NodeResizer, useReactFlow } from "reactflow";
import type { RFNodeData } from "@/lib/simulation/types";
import ReactMarkdown from "react-markdown";
import { useSimulationStore } from "@/stores/simulationStore";
import { cn } from "@/lib/utils";
import { nodeNavigationService } from "@/lib/services/claims/nodeNavigationService";

interface MarkdownCommentData extends RFNodeData {
  config?: {
    type: "MarkdownComment";
    content?: string;
    backgroundColor?: string;
    fontSize?: string;
  };
  content?: string;
}

type MarkdownCommentNodeProps = NodeProps<MarkdownCommentData>;

// Constants for styling and configuration
const DEFAULT_CONTENT = "Click to edit...\n\n\nAdd your markdown content here\nResize vertically to see more lines";
const DEFAULT_BACKGROUND = "yellow";
const DEFAULT_FONT_SIZE = "11";

const BACKGROUND_OPTIONS = [
  { value: "yellow", className: "bg-yellow-50", title: "Yellow" },
  { value: "white", className: "bg-white", title: "White" },
  { value: "gray", className: "bg-gray-100", title: "Gray" },
  { value: "blue", className: "bg-blue-50", title: "Blue" },
  { value: "transparent", className: "bg-transparent", title: "Transparent" }
];

const FONT_SIZE_OPTIONS = [
  { value: "9", label: "9" },
  { value: "10", label: "10" },
  { value: "11", label: "11" },
  { value: "12", label: "12" },
  { value: "13", label: "13" },
  { value: "14", label: "14" }
];

/**
 * MarkdownComment Text Annotation
 *
 * A pure text annotation that floats on the canvas - no traditional node container.
 * Just resizable markdown content that can be edited in place.
 *
 * Features:
 * - Resizable text area with drag handles
 * - Click-to-edit markdown content
 * - Transparent/minimal styling
 * - No input/output handles (pure annotation)
 * - Floating text box aesthetic
 */
export default function MarkdownCommentDisplay({ data, selected, id }: MarkdownCommentNodeProps) {
  const { deleteElements, getNode } = useReactFlow();

  // Get current node dimensions from ReactFlow or saved config
  const currentNode = getNode(id);
  const nodeWidth = currentNode?.width || currentNode?.style?.width || data.config?.width || 200;
  const nodeHeight = currentNode?.height || currentNode?.style?.height || data.config?.height || 120;

  // Component state
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState(data.config?.backgroundColor || DEFAULT_BACKGROUND);
  const [fontSize, setFontSize] = useState(data.config?.fontSize || DEFAULT_FONT_SIZE);

  // Content management
  const nodeContent = data.config?.content || data.content || DEFAULT_CONTENT;
  const [editContent, setEditContent] = useState(nodeContent);

  // Initialize state from saved node data
  React.useEffect(() => {
    setBackgroundColor(data.config?.backgroundColor || DEFAULT_BACKGROUND);
    setFontSize(data.config?.fontSize || DEFAULT_FONT_SIZE);
  }, [data.config]);

  // Handle resize events to save dimensions automatically
  const handleResize = useCallback(async (newWidth: number, newHeight: number) => {
    try {
      const simulationStore = useSimulationStore.getState();
      const currentScenario = simulationStore.scenario;

      if (!currentScenario) {
        console.error("No current scenario to update");
        return;
      }

      // Update the node's dimensions in the scenario
      const updatedNodes = currentScenario.nodes.map(node => {
        if (node.nodeId === id) {
          return {
            ...node,
            config: {
              ...node.config,
              width: newWidth,
              height: newHeight,
            },
          };
        }
        return node;
      });

      const updatedScenario = { ...currentScenario, nodes: updatedNodes };

      // Load the updated scenario to persist dimensions
      await simulationStore.loadScenario(updatedScenario);

      // Mark as having unsaved changes
      simulationStore.markAsUnsavedChanges();

      console.log(`✅ Comment node dimensions saved: ${newWidth}x${newHeight}`);
    } catch (error) {
      console.error("❌ Failed to save comment node dimensions:", error);
    }
  }, [id]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditContent(nodeContent);
  }, [nodeContent]);

  const handleSave = useCallback(async () => {
    try {
      // Get current scenario from the store
      const simulationStore = useSimulationStore.getState();
      const currentScenario = simulationStore.scenario;

      if (!currentScenario) {
        console.error("No current scenario to update");
        return;
      }

      // Update the node's content, styling, and dimensions in the scenario
      const updatedNodes = currentScenario.nodes.map(node => {
        if (node.nodeId === id) {
          return {
            ...node,
            content: editContent,
            config: {
              ...node.config,
              content: editContent,
              backgroundColor,
              fontSize,
              width: nodeWidth,
              height: nodeHeight,
            },
          };
        }
        return node;
      });

      const updatedScenario = { ...currentScenario, nodes: updatedNodes };

      // Load the updated scenario
      await simulationStore.loadScenario(updatedScenario);

      // Mark as having unsaved changes
      simulationStore.markAsUnsavedChanges();

      setIsEditing(false);
      console.log("✅ Markdown content saved successfully");
    } catch (error) {
      console.error("❌ Failed to save markdown content:", error);
    }
  }, [editContent, id]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditContent(nodeContent);
  }, [nodeContent]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  }, [deleteElements, id]);

  const handleTextClick = useCallback((e: React.MouseEvent) => {
    if (!isEditing) {
      e.stopPropagation();
      handleEdit();
    }
  }, [isEditing, handleEdit]);

  // Utility functions for styling
  const getBackgroundClass = useCallback(() => {
    const option = BACKGROUND_OPTIONS.find(opt => opt.value === backgroundColor);
    return option?.className || BACKGROUND_OPTIONS[0].className;
  }, [backgroundColor]);

  const getFontSizeClass = useCallback(() => {
    return `text-[${fontSize}px]`;
  }, [fontSize]);

  return (
    <div className="relative group">
      {/* Custom CSS for resize handles and text wrapping */}
      <style jsx>{`
        .node-resize-handle {
          cursor: nwse-resize !important;
        }
        .node-resize-handle[data-position="top"] {
          cursor: ns-resize !important;
        }
        .node-resize-handle[data-position="bottom"] {
          cursor: ns-resize !important;
        }
        .node-resize-handle[data-position="left"] {
          cursor: ew-resize !important;
        }
        .node-resize-handle[data-position="right"] {
          cursor: ew-resize !important;
        }
        .markdown-content {
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          word-break: break-word !important;
          hyphens: auto !important;
          white-space: normal !important;
        }
        .markdown-content p {
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
        }
      `}</style>
      {/* NodeResizer for drag-to-resize functionality - show when selected */}
      <NodeResizer
        color="#eab308"
        isVisible={selected}
        minWidth={280}
        minHeight={120}
        maxWidth={600}
        maxHeight={800}
        keepAspectRatio={false}
        shouldResize={() => true}
        onResize={(event, data) => {
          // Automatically save dimensions when resizing
          if (data.width && data.height) {
            handleResize(data.width, data.height);
          }
        }}
        handleStyle={{
          backgroundColor: '#eab308',
          border: '3px solid white',
          borderRadius: '6px',
          width: '22px',
          height: '22px',
          zIndex: 1000,
          opacity: 1,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
        lineStyle={{
          display: 'none'  // Hide the dotted lines completely
        }}
        handleClassName="node-resize-handle"
      />

      {/* Delete Button - shown on hover */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 w-5 h-5 bg-gray-400 hover:bg-gray-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center shadow-sm"
        title="Delete annotation"
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>

      {/* Edit Button - shown on hover when not editing */}
      {!isEditing && (
        <button
          onClick={handleEdit}
          className="absolute -top-2 -left-2 w-5 h-5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center shadow-sm"
          title="Edit text"
        >
          <Edit3 className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Main Content Area with Drag Padding */}
      <div
        className={cn(
          "rounded-lg transition-all duration-200 flex flex-col relative",
          selected && "ring-2 ring-yellow-400 ring-opacity-50",
          isEditing
            ? `${getBackgroundClass()} border-2 border-yellow-400 shadow-lg`
            : `${getBackgroundClass()} border border-yellow-200 shadow-sm hover:shadow-md hover:border-yellow-300`
        )}
        style={{
          height: nodeHeight,
          minHeight: '120px',
          width: nodeWidth,
          minWidth: '280px',
          maxWidth: nodeWidth > 600 ? nodeWidth : '600px'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Drag Padding Area - Top */}
        <div
          className="absolute top-0 left-0 right-0 h-3 cursor-move"
          style={{ zIndex: 5 }}
          title="Drag to move"
        />

        {/* Drag Padding Area - Bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-3 cursor-move"
          style={{ zIndex: 5 }}
          title="Drag to move"
        />

        {/* Drag Padding Area - Left */}
        <div
          className="absolute top-0 bottom-0 left-0 w-3 cursor-move"
          style={{ zIndex: 5 }}
          title="Drag to move"
        />

        {/* Drag Padding Area - Right */}
        <div
          className="absolute top-0 bottom-0 right-0 w-3 cursor-move"
          style={{ zIndex: 5 }}
          title="Drag to move"
        />

        {/* Content Area with Inner Padding */}
        <div className="p-3 h-full w-full relative" style={{ zIndex: 1 }}>
        {isEditing ? (
          // Edit Mode - MAXIMIZE TEXT AREA SPACE
          <div
            className="flex flex-col"
            style={{
              width: nodeWidth - 24, // Account for padding
              height: nodeHeight - 24 // Account for padding
            }}
          >
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onWheel={(e) => {
                // Allow wheel scrolling only within the textarea
                e.stopPropagation();
              }}
              className={`p-2 border-none resize-none focus:outline-none font-mono bg-transparent leading-relaxed ${getFontSizeClass()}`}
              placeholder="Enter markdown content..."
              autoFocus
              style={{
                width: nodeWidth - 24, // Account for padding
                height: nodeHeight - 60, // Account for padding and controls
                minHeight: '80px',
                flex: '1 1 auto',
                overflowY: 'auto'
              }}
            />
            {/* MINIMAL CONTROLS - ONE COMPACT LINE */}
            <div className="flex-shrink-0 border-t border-yellow-300 pt-1 mt-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-gray-600">Size:</span>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                    className="text-[8px] border border-gray-300 rounded px-1 py-0 bg-white h-5"
                  >
                    {FONT_SIZE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[8px] text-gray-600 ml-2">BG:</span>
                  {BACKGROUND_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setBackgroundColor(option.value)}
                      className={`w-3 h-3 rounded border ${backgroundColor === option.value ? "border-gray-600" : "border-gray-300"} ${option.className}`}
                      style={option.value === "transparent" ? {
                        background: 'repeating-conic-gradient(#ddd 0% 25%, transparent 0% 50%) 50% / 6px 6px'
                      } : undefined}
                      title={option.title}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <button onClick={handleSave} className="px-2 py-0.5 text-[8px] bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors h-5">Save</button>
                  <button onClick={handleCancel} className="px-2 py-0.5 text-[8px] bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors h-5">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // View Mode - easier click target with scroll handling
          <div
            className="overflow-auto flex items-start cursor-pointer"
            onClick={handleTextClick}
            onWheel={(e) => {
              // Allow wheel scrolling only within the content area
              e.stopPropagation();
            }}
            style={{
              width: nodeWidth - 24, // Account for padding
              height: nodeHeight - 24, // Account for padding
              minHeight: '80px',
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}
          >
            <div className={`markdown-content prose prose-sm max-w-full prose-headings:text-yellow-800 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-yellow-700 leading-relaxed w-full overflow-wrap-anywhere break-words ${getFontSizeClass()}`}>
              <ReactMarkdown
                components={{
                  // Handle clickable @node_id links
                  a: ({ href, children, ...props }) => {
                    if (href?.startsWith('#node-') || href?.startsWith('@')) {
                      const nodeId = href.replace('#node-', '').replace('@', '');
                      return (
                        <button
                          className="text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer inline bg-transparent border-none p-0"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            nodeNavigationService.navigateToNode({
                              nodeId,
                              highlight: true,
                              zoom: 1.5
                            });
                          }}
                          {...props}
                        >
                          {children}
                        </button>
                      );
                    }
                    return <a href={href} {...props}>{children}</a>;
                  },
                  // Handle @node_id text patterns (not just links)
                  text: ({ children, ...props }) => {
                    if (typeof children === 'string' && children.includes('@')) {
                      // Split text by @nodeId patterns and make them clickable
                      const parts = children.split(/(@[a-zA-Z_][a-zA-Z0-9_]*)/g);
                      return (
                        <>
                          {parts.map((part, index) => {
                            if (part.startsWith('@') && part.length > 1) {
                              const nodeId = part.substring(1);
                              return (
                                <button
                                  key={index}
                                  className="text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer inline bg-transparent border-none p-0"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    nodeNavigationService.navigateToNode({
                                      nodeId,
                                      highlight: true,
                                      zoom: 1.5
                                    });
                                  }}
                                >
                                  {part}
                                </button>
                              );
                            }
                            return part;
                          })}
                        </>
                      );
                    }
                    return children;
                  }
                }}
              >
                {nodeContent || "\n\n\n"}
              </ReactMarkdown>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}