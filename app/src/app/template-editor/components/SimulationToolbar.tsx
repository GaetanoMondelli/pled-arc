import React from 'react';
import { cn } from '@/lib/utils';
import { FileText, Archive, Undo2, Redo2, BookOpen, Eye, Library, Group, Code, ArrowUp, Loader2, RotateCw } from 'lucide-react';

interface SimulationToolbarProps {
  currentTemplate: any;
  currentExecution: any;
  currentScenario: any;
  currentTime: number;
  isSaving: boolean;
  canUndo: boolean | (() => boolean);
  canRedo: boolean | (() => boolean);

  isRunning: boolean;
  hasUnsavedChanges?: boolean;
  onTemplateManagerOpen: () => void;
  onExecutionManagerOpen: () => void;
  onSaveTemplate: () => void;
  onSaveVersion?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleGlobalLedger: () => void;
  onStateInspectorToggle: () => void;
  onSidePanelMode: (mode: 'library' | 'groups') => void;
  onJsonViewOpen: () => void;
  onModelUpgradeOpen: () => void;
  isStateInspectorOpen: boolean;
  // When true, toolbar menus and interactions should be visually and functionally disabled
  disabled?: boolean;
}

/**
 * Professional B2B-style menu bar toolbar for the template editor
 */
export function SimulationToolbar({
  currentTemplate,
  currentExecution,
  currentScenario,
  currentTime,
  isSaving,
  canUndo,
  canRedo,
  isRunning,
  hasUnsavedChanges = false,
  onTemplateManagerOpen,
  onExecutionManagerOpen,
  onSaveTemplate,
  onSaveVersion,
  onUndo,
  onRedo,
  onToggleGlobalLedger,
  onStateInspectorToggle,
  onSidePanelMode,
  onJsonViewOpen,
  onModelUpgradeOpen,
  isStateInspectorOpen,
  disabled = false,
}: SimulationToolbarProps) {
  return (
    <header className={cn("bg-white border-b border-gray-300 flex-shrink-0", disabled ? 'pointer-events-none opacity-60' : '')}>
      {/* Menu Bar Style Toolbar */}
      <div className="h-12 px-4 flex items-center justify-between bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-6">
          <h1 className="text-sm font-medium text-gray-700 select-none">Template Editor</h1>

          {/* Menu Items */}
          <div className={cn("flex items-center", disabled ? 'pointer-events-none' : '')}>
            {/* File Menu */}
            <div className={cn("relative group", disabled ? 'pointer-events-none' : '')}>
              <button className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors" disabled={disabled}>
                File
              </button>
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="py-1">
                  <button
                    onClick={onTemplateManagerOpen}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Templates...
                  </button>
                  <button
                    onClick={onExecutionManagerOpen}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Executions...
                  </button>
                  {currentTemplate && (
                    <>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={onSaveTemplate}
                        disabled={isSaving}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Save Template
                          </>
                        )}
                      </button>
                      {onSaveVersion && (
                        <button
                          onClick={onSaveVersion}
                          disabled={isSaving}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Save Version...
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Edit Menu */}
            <div className={cn("relative group", disabled ? 'pointer-events-none' : '')}>
              <button className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors" disabled={disabled}>
                Edit
              </button>
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="py-1">
                  <button
                    onClick={onUndo}
                    disabled={!canUndo || isRunning}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center">
                      <Undo2 className="w-4 h-4 mr-2" />
                      Undo
                    </span>
                    <span className="text-xs text-gray-400">Ctrl+Z</span>
                  </button>
                  <button
                    onClick={onRedo}
                    disabled={!canRedo || isRunning}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center">
                      <Redo2 className="w-4 h-4 mr-2" />
                      Redo
                    </span>
                    <span className="text-xs text-gray-400">Ctrl+Y</span>
                  </button>
                </div>
              </div>
            </div>

            {/* View Menu */}
            <div className={cn("relative group", disabled ? 'pointer-events-none' : '')}>
              <button className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors" disabled={disabled}>
                View
              </button>
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="py-1">
                  <button
                    onClick={onToggleGlobalLedger}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Activity Ledger
                  </button>
                  <button
                    onClick={onStateInspectorToggle}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    State Inspector
                  </button>
                  <button
                    onClick={() => onSidePanelMode('library')}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <Library className="w-4 h-4 mr-2" />
                    Node Library
                  </button>
                  <button
                    onClick={() => onSidePanelMode('groups')}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <Group className="w-4 h-4 mr-2" />
                    Groups & Tags
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={onJsonViewOpen}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <Code className="w-4 h-4 mr-2" />
                    View JSON Data
                  </button>
                </div>
              </div>
            </div>

            {/* Tools Menu */}
            <div className={cn("relative group", disabled ? 'pointer-events-none' : '')}>
              <button className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors" disabled={disabled}>
                Tools
              </button>
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="py-1">
                  <button
                    onClick={onModelUpgradeOpen}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <ArrowUp className="w-4 h-4 mr-2" />
                    Model Upgrade
                    {currentScenario && <div className="w-2 h-2 bg-green-500 rounded-full ml-auto" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side info */}
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          {currentTemplate && (
            <span className="flex items-center">
              <FileText className="w-4 h-4 mr-1" />
              {currentTemplate.name}
              {hasUnsavedChanges ? (
                <span className="ml-2 text-xs text-orange-600">● Unsaved Changes</span>
              ) : (
                <span className="ml-2 text-xs text-green-600">● Saved</span>
              )}
            </span>
          )}
          <span className="font-mono text-xs">
            Time: {currentTime}s
          </span>
        </div>
      </div>
    </header>
  );
}
