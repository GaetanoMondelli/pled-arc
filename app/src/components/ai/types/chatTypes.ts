// Chat and AI Assistant type definitions
// Extracted from IntegratedAIAssistant.tsx for better organization

export interface ActionButton {
  text: string;
  action: string;
  variant: 'primary' | 'secondary';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'command' | 'context' | 'analysis' | 'suggestion' | 'system' | 'error' | 'message' | 'thinking' | 'update' | 'scenario_update' | 'validation';
  actionButtons?: ActionButton[];
  metadata?: {
    command?: string;
    context?: string[];
    nodes?: string[];
    patches?: any[];
    validationItems?: string[];
    step?: string;
    runId?: string;
    timestamp?: string;
    documentId?: string;
    suggestions?: any;
    interactiveSuggestions?: any[];
  };
}

export interface Command {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'action' | 'context' | 'analysis';
}

export interface DocumentContext {
  id: string;
  name: string;
  content: string;
  uploadedAt: string;
  type: string;
  extractionMethod: string;
}

export interface IntegratedAIAssistantProps {
  className?: string;
  isEditMode?: boolean;
  scenarioContent?: string;
  onScenarioUpdate?: (newScenario: string) => void;
  loadScenario?: (scenario: any) => Promise<void>;
  documentContext?: DocumentContext;
  referenceDoc?: string;
  enableStreaming?: boolean;
}

// Step icons for progress display
export const stepIcons: Record<string, string> = {
  'context_analysis': '🧠',
  'dsl_parsing': '🔍',
  'scenario_building': '⚙️',
  'validation': '✅',
  'positioning': '📐',
  'reflection': '🎯',
  'response_generation': '📝'
};