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
  Hash,
  Zap
} from 'lucide-react';

interface UnifiedSimulationControlsProps {
  // Mode
  isEventDrivenMode: boolean;
  onModeToggle: (isEventDriven: boolean) => void;
  
  // Legacy mode props
  legacyIsRunning?: boolean;
  legacyCurrentExecution?: any;
  legacyCurrentScenario?: any;
  legacyCurrentTime?: number;
  onLegacyPlayPause?: () => void;
  onLegacyStepForward?: () => void;
  onLegacyReset?: () => void;
  onLegacyReload?: () => void;
  
  // Event-driven mode props
  eventDrivenIsRunning?: boolean;
  currentEventIndex?: number;
  totalEvents?: number;
  currentTime?: number;
  canStepBackward?: boolean;
  canStepForward?: boolean;
  eventStoreHash?: string;
  simulationMode?: 'step' | 'continuous';
  onEventDrivenStartSimulation?: () => void;
  onStepBackward?: () => void;
  onStepForward?: () => void;
  onSeekToStart?: () => void;
  onSeekToEnd?: () => void;
  onEventDrivenReset?: () => void;
  onModeChange?: (mode: 'step' | 'continuous') => void;
  onViewEvents?: () => void;
  onViewExternalEvents?: () => void;
  externalEventsCount?: number;
  // When true, controls should be disabled (no interaction allowed)
  disabled?: boolean;
}

/**
 * Unified simulation controls with mode toggle
 * Flat, compact, elegant design
 */
export function UnifiedSimulationControls({
  isEventDrivenMode,
  onModeToggle,
  legacyIsRunning,
  legacyCurrentExecution,
  legacyCurrentScenario,
  legacyCurrentTime = 0,
  onLegacyPlayPause,
  onLegacyStepForward,
  onLegacyReset,
  onLegacyReload,
  eventDrivenIsRunning,
  currentEventIndex = 0,
  totalEvents = 0,
  currentTime = 0,
  canStepBackward = false,
  canStepForward = false,
  eventStoreHash,
  simulationMode = 'step',
  onEventDrivenStartSimulation,
  onStepBackward,
  onStepForward,
  onSeekToStart,
  onSeekToEnd,
  onEventDrivenReset,
  onModeChange,
  onViewEvents,
  onViewExternalEvents,
  externalEventsCount = 0,
  disabled = false,
}: UnifiedSimulationControlsProps) {
  
  return (
    <div className={cn("h-10 px-4 flex items-center justify-between bg-white border-b border-gray-200", disabled ? 'pointer-events-none opacity-60' : '')}>
      <div className="flex items-center space-x-3">
        {/* Mode Toggle - Flat Design */}
          <div className={cn("flex items-center bg-gray-100 rounded-md p-0.5", disabled ? 'pointer-events-none' : '')}>
          <button
            onClick={() => onModeToggle(false)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-all flex items-center space-x-1.5",
              !isEventDrivenMode
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Play className="w-3 h-3" />
            <span>Legacy</span>
          </button>
          <button
            onClick={() => onModeToggle(true)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-all flex items-center space-x-1.5",
              isEventDrivenMode
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Zap className="w-3 h-3" />
            <span>Event-Driven</span>
          </button>
        </div>

          <div className="h-5 w-px bg-gray-300"></div>

        {/* Controls - Different based on mode */}
        {isEventDrivenMode ? (
          // Event-Driven Controls
          <>
            {/* Mode Selection for Event-Driven */}
            {onModeChange && (
              <>
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
                <div className="h-5 w-px bg-gray-300"></div>
              </>
            )}

            <div className="flex items-center space-x-1">
              <button
                onClick={onSeekToStart}
                disabled={currentEventIndex === 0}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="First event"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={onStepBackward}
                disabled={!canStepBackward || eventDrivenIsRunning}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Step back"
              >
                <StepBack className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onEventDrivenStartSimulation}
                disabled={externalEventsCount === 0 && !eventDrivenIsRunning}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-colors flex items-center space-x-1",
                  externalEventsCount === 0 && !eventDrivenIsRunning
                    ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                    : eventDrivenIsRunning
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "bg-green-50 text-green-600 hover:bg-green-100"
                )}
                title={externalEventsCount === 0 && !eventDrivenIsRunning ? "Add external events first" : ""}
              >
                {eventDrivenIsRunning ? (
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
                disabled={!canStepForward || (eventDrivenIsRunning && simulationMode === 'continuous')}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Step forward"
              >
                <StepForward className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onSeekToEnd}
                disabled={currentEventIndex >= totalEvents - 1}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Last event"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onEventDrivenReset}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors flex items-center space-x-1"
              title="Reset"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>

            {/* Event Progress */}
            <div className="flex items-center space-x-2 ml-2">
              {/* External Events Counter */}
              <button
                onClick={onViewExternalEvents}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                title="View external events queue"
              >
                <div className="relative">
                  <Database className="w-3 h-3" />
                  {externalEventsCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
                <span className="font-mono text-blue-600">{externalEventsCount}</span>
              </button>

              {/* Simulation Events Counter */}
              <button
                onClick={onViewEvents}
                className="flex items-center space-x-1 text-xs text-purple-600 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
                title="View event queue"
              >
                <Database className="w-3 h-3" />
                <span className="font-mono">{currentEventIndex}/{totalEvents}</span>
              </button>
              
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-200"
                  style={{ width: `${totalEvents > 0 ? (currentEventIndex / totalEvents) * 100 : 0}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          // Legacy Controls
          <>
            <button
              onClick={onLegacyPlayPause}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded transition-colors flex items-center space-x-1",
                legacyIsRunning
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-green-50 text-green-600 hover:bg-green-100"
              )}
            >
              {legacyIsRunning ? (
                <>
                  <Pause className="w-3 h-3" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              onClick={onLegacyStepForward}
              disabled={legacyIsRunning}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors flex items-center space-x-1 disabled:opacity-50"
            >
              <StepForward className="w-3 h-3" />
              <span>Step</span>
            </button>

            <button
              onClick={onLegacyReset}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>

            {legacyCurrentExecution && (
              <div className="text-xs text-gray-600 flex items-center space-x-1 ml-2">
                <span>{legacyCurrentExecution.name || legacyCurrentScenario?.name || 'Simulation'}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Right Side - Compact Stats */}
      <div className="flex items-center space-x-3 text-xs text-gray-600">
        {isEventDrivenMode ? (
          <>
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span className="font-mono">{currentTime.toFixed(2)}s</span>
            </div>
            {eventStoreHash && (
              <div className="flex items-center space-x-1" title={`Hash: ${eventStoreHash}`}>
                <Hash className="w-3 h-3" />
                <span className="font-mono">{eventStoreHash.slice(0, 6)}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span className="font-mono">{legacyCurrentTime.toFixed(2)}s</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span>Live</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
