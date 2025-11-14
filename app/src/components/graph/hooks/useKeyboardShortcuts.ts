import { useEffect } from "react";

export const useKeyboardShortcuts = (
  undo: () => void,
  redo: () => void,
  canUndo: () => boolean,
  canRedo: () => boolean
) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (canUndo()) {
          undo();
        }
      } else if (((event.ctrlKey || event.metaKey) && event.key === 'y') || 
                 ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z')) {
        event.preventDefault();
        if (canRedo()) {
          redo();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);
};
