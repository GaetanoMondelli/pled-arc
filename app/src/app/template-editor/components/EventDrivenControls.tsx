import React from 'react';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  RotateCcw,
  Clock,
  Database,
  GitBranch,
  Hash,
  BookOpen,
  FileText,
  Hand,
  MousePointer
} from 'lucide-react';

interface EventDrivenControlsProps {
  isRunning: boolean;
  currentEventIndex: number;
  totalEvents: number;
  currentTime: number;
  canStepBackward: boolean;
  canStepForward: boolean;
  eventStoreHash?: string;
  simulationMode: 'step' | 'continuous';
  onStartSimulation: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onSeekToStart: () => void;
  onSeekToEnd: () => void;
  onReset: () => void;
  onModeChange: (mode: 'step' | 'continuous') => void;
  onViewEvents?: () => void;
  onViewExternalEvents?: () => void;
  onViewLedger?: () => void;
  onViewModel?: () => void;
  externalEventsCount?: number;
  ledgerCount?: number;
  disabled?: boolean;
  hasScenario?: boolean;
  // Hand tool props
  isPanMode?: boolean;
  onPanModeToggle?: () => void;
}

/**
 * Elegant event-driven simulation controls (based on UnifiedSimulationControls design)
 */
export function EventDrivenControls({
  isRunning,
  currentEventIndex,
  totalEvents,
  currentTime,
  canStepBackward,
  canStepForward,
  eventStoreHash,
  simulationMode,
  onStartSimulation,
  onStepBackward,
  onStepForward,
  onSeekToStart,
  onSeekToEnd,
  onReset,
  onModeChange,
  onViewEvents,
  onViewExternalEvents,
  onViewLedger,
  onViewModel,
  externalEventsCount = 0,
  ledgerCount = 0,
  disabled = false,
  hasScenario = true,
  isPanMode = false,
  onPanModeToggle,
}: EventDrivenControlsProps) {
  return (
    <div className={cn("h-10 px-4 flex items-center justify-between bg-white border-b border-gray-200", disabled ? 'pointer-events-none opacity-60' : '')}>
      <div className="flex items-center space-x-3">
        {/* Mode Selection - Elegant flat design */}
        <div className="flex items-center bg-gray-100 rounded-md p-0.5">
          <button
            onClick={() => onModeChange('step')}
            className={cn(
              "px-2 py-0.5 text-xs font-medium rounded transition-all",
              simulationMode === 'step'
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Step
          </button>
          <button
            onClick={() => onModeChange('continuous')}
            className={cn(
              "px-2 py-0.5 text-xs font-medium rounded transition-all",
              simulationMode === 'continuous'
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Auto
          </button>
        </div>

        {/* Hand Tool Button */}
        {onPanModeToggle && (
          <button
            onClick={onPanModeToggle}
            className={cn(
              "p-1.5 rounded transition-colors flex items-center justify-center",
              isPanMode
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
            )}
            title={isPanMode ? "Switch to Selection Mode" : "Switch to Hand Tool"}
          >
            {isPanMode ? (
              <Hand className="w-3.5 h-3.5" />
            ) : (
              <MousePointer className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        <div className="h-5 w-px bg-gray-300"></div>

        {/* Navigation Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onSeekToStart}
            disabled={!hasScenario || currentEventIndex === 0}
            className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={!hasScenario ? "No scenario loaded" : "First event"}
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onStepBackward}
            disabled={!hasScenario || !canStepBackward || isRunning}
            className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={!hasScenario ? "No scenario loaded" : "Step back"}
          >
            <StepBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onStartSimulation}
            disabled={!hasScenario || (externalEventsCount === 0 && !isRunning)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-colors flex items-center space-x-1",
              !hasScenario || (externalEventsCount === 0 && !isRunning)
                ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                : isRunning
                ? "bg-red-50 text-red-600 hover:bg-red-100"
                : "bg-green-50 text-green-600 hover:bg-green-100"
            )}
            title={!hasScenario ? "No scenario loaded" : (externalEventsCount === 0 && !isRunning ? "Add external events first" : "")}
          >
            {isRunning ? (
              <>
                <Pause className="w-3 h-3" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                <span>Start</span>
              </>
            )}
          </button>

          <button
            onClick={onStepForward}
            disabled={!hasScenario || !canStepForward || (isRunning && simulationMode === 'continuous')}
            className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={!hasScenario ? "No scenario loaded" : "Step forward"}
          >
            <StepForward className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onSeekToEnd}
            disabled={!hasScenario || currentEventIndex >= totalEvents - 1}
            className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={!hasScenario ? "No scenario loaded" : "Last event"}
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-5 w-px bg-gray-300"></div>

        {/* Additional Controls */}
        <button
          onClick={onReset}
          disabled={!hasScenario}
          className={cn(
            "px-2 py-1 text-xs font-medium rounded transition-colors flex items-center space-x-1",
            !hasScenario
              ? "text-gray-400 cursor-not-allowed"
              : "text-red-600 hover:bg-red-50"
          )}
          title={!hasScenario ? "No scenario loaded" : "Reset simulation"}
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>

        {/* Model JSON Button */}
        {onViewModel && (
          <button
            onClick={onViewModel}
            className={cn(
              "px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded transition-colors flex items-center space-x-1",
              disabled ? "opacity-100 pointer-events-auto" : ""
            )}
            title="View JSON model (always available for editing)"
          >
            <FileText className="w-3 h-3" />
            <span>Model</span>
          </button>
        )}


        {/* External Events Button */}
        {onViewExternalEvents && (
          <button
            onClick={onViewExternalEvents}
            className="px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded transition-colors flex items-center space-x-1"
            title="View external events"
          >
            <GitBranch className="w-3 h-3" />
            <span className={isRunning ? 'blur-[2px] animate-pulse' : ''}>
              External ({externalEventsCount})
            </span>
          </button>
        )}

        {/* Task Queue Button */}
        {onViewEvents && (
          <button
            onClick={onViewEvents}
            className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center space-x-1"
            title="View task queue"
          >
            <Database className="w-3 h-3" />
            <span className={isRunning ? 'blur-[2px] animate-pulse' : ''}>
              Tasks ({currentEventIndex}/{totalEvents})
            </span>
          </button>
        )}

        {/* Global Ledger Button */}
        {onViewLedger && (
          <button
            onClick={onViewLedger}
            className="px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded transition-colors flex items-center space-x-1"
            title="View global ledger"
          >
            <BookOpen className="w-3 h-3" />
            <span className={isRunning ? 'blur-[2px] animate-pulse' : ''}>
              Ledger ({ledgerCount})
            </span>
          </button>
        )}
      </div>

    </div>
  );
}