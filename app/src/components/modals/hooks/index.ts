/**
 * NodeInspectorModal Hooks
 * 
 * Custom hooks for managing NodeInspectorModal logic.
 * Each hook handles a specific concern following the single responsibility principle.
 */

// Store access hook
export { useNodeInspectorStore } from "./useNodeInspectorStore";

// Configuration editor hook - handles config JSON editing, save, reset
export { useNodeConfigEditor } from "./useNodeConfigEditor";

// Tags editor hook - handles node tags updates
export { useNodeTagsEditor } from "./useNodeTagsEditor";

// State actions hook - handles FSM state actions updates
export { useNodeStateActions } from "./useNodeStateActions";

// UI state hook - manages local UI state (toggles, selected items, derived values)
export { useNodeInspectorUIState } from "./useNodeInspectorUIState";
