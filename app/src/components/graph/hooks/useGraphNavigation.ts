import { useState, useEffect, useCallback } from "react";
import { GroupNavigationManager } from "@/lib/utils/advancedGroupingUtils";
import type { Scenario } from "@/lib/simulation/types";

export const useGraphNavigation = (scenario: Scenario | null) => {
  const [navigationManager] = useState(() => new GroupNavigationManager("Template"));
  const [navigationState, setNavigationState] = useState(() => navigationManager.getCurrentState());
  const [urlChangeCounter, setUrlChangeCounter] = useState(0);

  // Listen for URL changes from external sources
  useEffect(() => {
    const handleUrlChange = () => {
      setUrlChangeCounter(prev => prev + 1);
    };
    window.addEventListener('urlchange', handleUrlChange);
    return () => window.removeEventListener('urlchange', handleUrlChange);
  }, []);

  // Handle group navigation from URL parameter (both initial and changes)
  useEffect(() => {
    if (!scenario) return;

    const params = new URLSearchParams(window.location.search);
    const groupParam = params.get('group');

    if (groupParam && groupParam !== navigationState.currentContext) {
      // Check if breadcrumb already exists to prevent duplicates
      const alreadyExists = navigationState.breadcrumbs.some(
        bc => bc.type === 'group' && bc.name === groupParam
      );
      
      if (!alreadyExists) {
        // Navigate to group if URL parameter is set and different from current state
        const groupNodes = scenario.nodes.filter(n => n.tags?.includes(groupParam));
        if (groupNodes.length > 0) {
          const newState = navigationManager.navigateToGroup(groupParam, groupNodes);
          setNavigationState(newState);
        }
      }
    } else if (!groupParam && navigationState.currentView === 'group') {
      // Navigate back to template if URL parameter is removed
      const newState = navigationManager.navigateBack();
      setNavigationState(newState);
    }
  }, [urlChangeCounter, scenario, navigationManager, navigationState]);

  // Breadcrumb navigation handlers
  const handleNavigateBack = useCallback(() => {
    const newState = navigationManager.navigateBack();
    setNavigationState(newState);

    // Update URL to reflect navigation state
    const url = new URL(window.location.href);
    if (newState.currentView === 'template') {
      url.searchParams.delete('group');
    } else if (newState.currentView === 'group' && newState.currentContext) {
      url.searchParams.set('group', newState.currentContext);
    }
    window.history.pushState({}, '', url.toString());
  }, [navigationManager]);

  const handleNavigateTo = useCallback((breadcrumbIndex: number) => {
    const newState = navigationManager.navigateTo(breadcrumbIndex);
    setNavigationState(newState);

    // Update URL to reflect navigation state
    const url = new URL(window.location.href);
    if (newState.currentView === 'template') {
      url.searchParams.delete('group');
    } else if (newState.currentView === 'group' && newState.currentContext) {
      url.searchParams.set('group', newState.currentContext);
    }
    window.history.pushState({}, '', url.toString());
  }, [navigationManager]);

  const handleToggleGroupMode = useCallback(() => {
    // This can toggle between all view and current group view
    if (navigationState.currentView === 'group') {
      // Go back to template view
      handleNavigateBack();
    }
  }, [navigationState, handleNavigateBack]);

  return {
    navigationState,
    navigationManager,
    handleNavigateBack,
    handleNavigateTo,
    handleToggleGroupMode
  };
};
