/**
 * Graph Visualization Hooks
 * 
 * This directory contains custom hooks extracted from GraphVisualization.tsx
 * to modularize the component and improve maintainability.
 * 
 * Each hook focuses on a specific concern:
 * - useNodeFiltering: Node filtering based on navigation state
 * - useGraphNavigation: URL-based navigation and breadcrumbs
 * - useNodeChanges: Node CRUD operations
 * - useEdgeChanges: Edge CRUD operations
 * - useEdgeGeneration: Connection logic and FSM handling
 * - useNodeInteractions: Click, double-click, and drag handlers
 * - useDragDrop: Palette drag-and-drop functionality
 * - useKeyboardShortcuts: Undo/redo keyboard shortcuts
 * - useActivityTracking: Track node activity for animations
 * - useEdgeAnimations: Animated edge rendering
 * - useNodeDataUpdates: Sync node data with scenario changes
 * - useEdgeGenerationFromScenario: Generate edges from scenario
 * - useReactFlowNodes: Convert scenario nodes to ReactFlow nodes
 */

export { useNodeFiltering } from './useNodeFiltering';
export { useGraphNavigation } from './useGraphNavigation';
export { useNodeChanges } from './useNodeChanges';
export { useEdgeChanges } from './useEdgeChanges';
export { useEdgeGeneration } from './useEdgeGeneration';
export { useNodeInteractions } from './useNodeInteractions';
export { useDragDrop } from './useDragDrop';
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export { useActivityTracking } from './useActivityTracking';
export { useEdgeAnimations } from './useEdgeAnimations';
export { useNodeDataUpdates } from './useNodeDataUpdates';
export { useEdgeGenerationFromScenario } from './useEdgeGenerationFromScenario';
export { useReactFlowNodes } from './useReactFlowNodes';
