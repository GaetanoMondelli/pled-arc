import { useState, useCallback, useEffect } from "react";

/**
 * Hook for managing resizable side panel functionality
 */
export function useResizablePanel(initialWidth: number = 320) {
  const [panelWidth, setPanelWidth] = useState(initialWidth);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [sidePanelMode, setSidePanelMode] = useState<'ai' | 'library' | 'groups' | 'reference'>('ai');

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 250 && newWidth <= 600) {
      setPanelWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    panelWidth,
    setPanelWidth,
    isPanelVisible,
    setIsPanelVisible,
    togglePanelVisibility: () => setIsPanelVisible(prev => !prev),
    isResizing,
    handleMouseDown,
    sidePanelMode,
    setSidePanelMode,
  };
}
