import React from 'react';
import { cn } from '@/lib/utils';
import { Brain, Library, Group, FileText, Eye, EyeOff } from 'lucide-react';
import IntegratedAIAssistant from '@/components/ai/IntegratedAIAssistant';
import NodeLibraryPanel from '@/components/library/NodeLibraryPanel';
import ImprovedGroupManagementPanel from '@/components/graph/ImprovedGroupManagementPanel';
import { ReferenceDocSection } from '@/components/reference-doc/ReferenceDocSection';
import { useToast } from '@/hooks/use-toast';

interface DocumentContext {
  id: string;
  name: string;
  content: string;
  uploadedAt: string;
  type: string;
  extractionMethod: string;
}

interface SidePanelContainerProps {
  isVisible: boolean;
  panelWidth: number;
  sidePanelMode: 'ai' | 'library' | 'groups' | 'reference';
  isEditMode: boolean;
  scenarioContent: string;
  referenceDoc?: string;
  onSidePanelModeChange: (mode: 'ai' | 'library' | 'groups' | 'reference') => void;
  onToggleVisibility: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onScenarioUpdate: (newScenario: string) => void;
  loadScenario?: (scenario: any) => Promise<void>;
  onReferenceDocUpdate?: (newDoc: string) => void;
  onGenerateReferenceDoc?: () => Promise<string>;
  onUpdateReferenceDoc?: () => Promise<string>;
  onNavigateToNode?: (nodeId: string) => void;
  onNavigateToGroup: (groupTag: string, groupNodes: any[]) => void;
}

/**
 * Resizable side panel container with AI, Library, Groups, and Reference Doc tabs
 */
export function SidePanelContainer({
  isVisible,
  panelWidth,
  sidePanelMode,
  isEditMode,
  scenarioContent,
  referenceDoc,
  onSidePanelModeChange,
  onToggleVisibility,
  onMouseDown,
  onScenarioUpdate,
  loadScenario,
  onReferenceDocUpdate,
  onGenerateReferenceDoc,
  onUpdateReferenceDoc,
  onNavigateToNode,
  onNavigateToGroup,
}: SidePanelContainerProps) {
  const [currentDocumentContext, setCurrentDocumentContext] = React.useState<DocumentContext | undefined>(undefined);
  return (
    <>
      {/* Panel Visibility Toggle Button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={onToggleVisibility}
          className="w-8 h-8 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center justify-center transition-colors"
        >
          {isVisible ? (
            <EyeOff className="h-4 w-4 text-slate-600" />
          ) : (
            <Eye className="h-4 w-4 text-slate-600" />
          )}
        </button>
      </div>

      {/* Resizer */}
      {isVisible && (
        <div
          className="w-1 bg-slate-200 hover:bg-slate-300 cursor-col-resize flex-shrink-0 transition-colors relative group"
          onMouseDown={onMouseDown}
        >
          <div className="absolute inset-0 w-2 -translate-x-0.5 group-hover:bg-slate-400 transition-colors"></div>
        </div>
      )}

      {/* Side Panel */}
      {isVisible && (
        <div
          className="border-l border-slate-200 bg-white flex flex-col min-h-0"
          style={{
            width: `${panelWidth}px`,
            minWidth: `${panelWidth}px`,
            maxWidth: `${panelWidth}px`
          }}
        >
          {/* Panel Header with Toggle Buttons */}
          <div className="border-b border-slate-200 bg-slate-50 flex-shrink-0">
            <div className="flex items-center justify-center p-2">
              <div className="flex bg-white border border-slate-200 rounded-lg shadow-sm">
                <button
                  onClick={() => onSidePanelModeChange('ai')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-l-lg transition-all flex items-center gap-2",
                    sidePanelMode === 'ai'
                      ? "bg-slate-600 text-white"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <Brain className="h-3 w-3" />
                  AI
                </button>
                <button
                  onClick={() => onSidePanelModeChange('library')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-2 border-l border-slate-200",
                    sidePanelMode === 'library'
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <Library className="h-3 w-3" />
                  Library
                </button>
                <button
                  onClick={() => onSidePanelModeChange('groups')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-2 border-l border-slate-200",
                    sidePanelMode === 'groups'
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <Group className="h-3 w-3" />
                  Groups
                </button>
                <button
                  onClick={() => onSidePanelModeChange('reference')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-r-lg transition-all flex items-center gap-2 border-l border-slate-200",
                    sidePanelMode === 'reference'
                      ? "bg-orange-600 text-white"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <FileText className="h-3 w-3" />
                  Reference
                </button>
              </div>
            </div>
          </div>

          {/* Panel Content */}
          <div className="flex-1 min-h-0 flex flex-col">
            {sidePanelMode === 'ai' && (
              <IntegratedAIAssistant
                className="flex-1 min-h-0"
                isEditMode={isEditMode}
                scenarioContent={scenarioContent}
                onScenarioUpdate={onScenarioUpdate}
                loadScenario={loadScenario}
                documentContext={currentDocumentContext}
                referenceDoc={referenceDoc}
              />
            )}

            {sidePanelMode === 'library' && (
              <NodeLibraryPanel
                className="flex-1"
                onNodeDrop={(nodeType, position) => {
                  // TODO: Implement node drop functionality
                  console.log('Node drop:', nodeType, position);
                }}
              />
            )}

            {sidePanelMode === 'groups' && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-3 py-2 border-b border-slate-200 bg-white flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-800 flex items-center gap-2">
                      <Group className="h-4 w-4" />
                      Groups & Tags
                    </h3>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ImprovedGroupManagementPanel
                    className="h-full p-3"
                    onNavigateToGroup={onNavigateToGroup}
                  />
                </div>
              </div>
            )}

            {sidePanelMode === 'reference' && (
              <ReferenceDocSection
                className="flex-1 min-h-0"
                referenceDoc={referenceDoc}
                isEditMode={isEditMode}
                scenarioContent={scenarioContent}
                onReferenceDocUpdate={onReferenceDocUpdate}
                onGenerateDoc={onGenerateReferenceDoc}
                onUpdateDoc={onUpdateReferenceDoc}
                onNavigateToNode={onNavigateToNode}
                onSwitchToAIChat={(documentContext) => {
                  console.log('🤖 Switching to AI chat with document:', documentContext.name);
                  setCurrentDocumentContext(documentContext);
                  onSidePanelModeChange('ai');
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
