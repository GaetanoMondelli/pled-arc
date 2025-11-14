import { useCallback } from "react";

/**
 * Hook for managing group navigation in the template editor
 */
export function useGroupNavigation() {
  // Handler for navigating to a group (used by ImprovedGroupManagementPanel)
  const handleNavigateToGroup = useCallback((groupTag: string, groupNodes: any[]) => {
    // Update URL - GraphVisualization will react to this change
    const url = new URL(window.location.href);
    url.searchParams.set('group', groupTag);
    window.history.pushState({}, '', url.toString());
    // Trigger a custom event so GraphVisualization can react
    window.dispatchEvent(new CustomEvent('urlchange'));
  }, []);

  // Handler for navigating back to template view
  const handleNavigateBackToTemplate = useCallback(() => {
    // Remove group param from URL - GraphVisualization will react to this change
    const url = new URL(window.location.href);
    url.searchParams.delete('group');
    window.history.pushState({}, '', url.toString());
    // Trigger a custom event so GraphVisualization can react
    window.dispatchEvent(new CustomEvent('urlchange'));
  }, []);

  return {
    handleNavigateToGroup,
    handleNavigateBackToTemplate,
  };
}
