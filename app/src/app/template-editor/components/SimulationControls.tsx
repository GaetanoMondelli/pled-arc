import React from 'react';
import { cn } from '@/lib/utils';
import { Pause, Play, StepForward, Archive, ChevronDown, RotateCcw, RefreshCw } from 'lucide-react';

interface SimulationControlsProps {
  isRunning: boolean;
  isEditMode: boolean;
  currentExecution: any;
  currentScenario: any;
  onPlayPause: () => void;
  onStepForward: () => void;
  onExecutionManagerOpen: () => void;
  onResetAllEvents: () => void;
  onReloadFromExternalEvents: () => void;
  onReloadDefaultScenario: () => void;
}

/**
 * Simulation playback controls toolbar
 */
export function SimulationControls({
  isRunning,
  isEditMode,
  currentExecution,
  currentScenario,
  onPlayPause,
  onStepForward,
  onExecutionManagerOpen,
  onResetAllEvents,
  onReloadFromExternalEvents,
  onReloadDefaultScenario,
}: SimulationControlsProps) {
  if (isEditMode) {
    return null;
  }

  return (
    <div className="h-10 px-4 flex items-center justify-between bg-white border-b border-gray-200">
      <div className="flex items-center space-x-1">
        {/* Play/Pause Button */}
        <button
          onClick={onPlayPause}
          className={cn(
            "px-4 py-1.5 text-xs font-medium rounded transition-colors flex items-center",
            isRunning
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          )}
        >
          {isRunning ? (
            <>
              <Pause className="w-3 h-3 mr-1" /> Pause
            </>
          ) : (
            <>
              <Play className="w-3 h-3 mr-1" /> Play
            </>
          )}
        </button>

        {/* Step Button */}
        <button
          onClick={onStepForward}
          disabled={isRunning}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors flex items-center disabled:opacity-50"
        >
          <StepForward className="w-3 h-3 mr-1" /> Step
        </button>

        <div className="w-px h-4 bg-gray-300 mx-2"></div>

        {/* Debugging Controls */}
        <div className="relative group">
          <button className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors flex items-center">
            <Archive className="w-3 h-3 mr-1" />
            {currentExecution ? currentExecution.name : currentScenario ? currentScenario.name : 'No execution'}
            <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="py-1">
              <button
                onClick={onExecutionManagerOpen}
                className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Archive className="w-3 h-3 mr-2" />
                Manage Executions...
              </button>
              <div className="border-t border-gray-200 my-1"></div>
              <button
                onClick={onResetAllEvents}
                className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center"
              >
                <RotateCcw className="w-3 h-3 mr-2" />
                Reset (Delete All)
              </button>
              <button
                onClick={onReloadFromExternalEvents}
                className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 flex items-center"
              >
                <RefreshCw className="w-3 h-3 mr-2" />
                Reload from External Events
              </button>
            </div>
          </div>
        </div>

        <div className="w-px h-4 bg-gray-300 mx-2"></div>

        {/* Reload Button */}
        <button
          onClick={onReloadDefaultScenario}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors flex items-center"
        >
          <RefreshCw className="w-3 h-3 mr-1" /> Reload
        </button>
      </div>

      <div className="flex items-center space-x-2 text-xs text-gray-500">
        {!isEditMode && <span className="animate-pulse text-green-600">● Live</span>}
        {isEditMode && <span className="text-blue-600">● Edit Mode</span>}
      </div>
    </div>
  );
}
