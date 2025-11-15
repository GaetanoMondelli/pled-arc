// AI Assistant constants and configurations
// Extracted from IntegratedAIAssistant.tsx for better organization

import {
  Zap,
  Code2,
  Brain,
  GitBranch,
  Terminal,
  FileText,
  Sparkles
} from "lucide-react";
import { Command } from "../types/chatTypes";

export const SIMULATION_COMMANDS: Command[] = [
  { key: '/analyze', label: 'analyze', description: 'Analyze scenario structure', icon: <Brain className="h-4 w-4" />, category: 'analysis' },
  { key: '/debug', label: 'debug', description: 'Debug current errors', icon: <Terminal className="h-4 w-4" />, category: 'action' },
  { key: '/optimize', label: 'optimize', description: 'Suggest optimizations', icon: <Zap className="h-4 w-4" />, category: 'action' },
  { key: '/explain', label: 'explain', description: 'Explain simulation behavior', icon: <FileText className="h-4 w-4" />, category: 'analysis' },
];

export const EDIT_COMMANDS: Command[] = [
  { key: '/validate', label: 'validate', description: 'Validate JSON structure', icon: <Brain className="h-4 w-4" />, category: 'analysis' },
  { key: '/add-node', label: 'add-node', description: 'Add new node to scenario', icon: <Sparkles className="h-4 w-4" />, category: 'action' },
  { key: '/fix-json', label: 'fix-json', description: 'Fix JSON syntax errors', icon: <Terminal className="h-4 w-4" />, category: 'action' },
  { key: '/generate', label: 'generate', description: 'Generate JSON snippets', icon: <Code2 className="h-4 w-4" />, category: 'action' },
  { key: '/refactor', label: 'refactor', description: 'Refactor JSON structure', icon: <GitBranch className="h-4 w-4" />, category: 'action' },
];

export const SIMULATION_CONTEXTS = [
  { key: '@scenario', label: 'scenario', description: 'Current scenario data' },
  { key: '@errors', label: 'errors', description: 'Current error messages' },
  { key: '@ledger', label: 'ledger', description: 'Global ledger with all tokens' },
  { key: '@state', label: 'state', description: 'Simulation state' },
  { key: '@t', label: 't', description: 'Reference specific time (e.g., @t5s, @t10s)' },
];

export const EDIT_CONTEXTS = [
  { key: '@json', label: 'json', description: 'Current JSON structure' },
  { key: '@schema', label: 'schema', description: 'JSON schema validation' },
  { key: '@nodes', label: 'nodes', description: 'Node definitions' },
  { key: '@connections', label: 'connections', description: 'Node connections' },
  { key: '@variables', label: 'variables', description: 'Scenario variables' },
];

export const TAGS = [
  { key: '#performance', label: 'performance', description: 'Performance analysis' },
  { key: '#security', label: 'security', description: 'Security considerations' },
  { key: '#architecture', label: 'architecture', description: 'Architecture review' },
  { key: '#testing', label: 'testing', description: 'Testing strategies' },
  { key: '#documentation', label: 'documentation', description: 'Documentation needs' },
];

// Helper function to extract nodes from scenario content
export const extractNodesFromScenario = (scenarioContent?: string) => {
  if (!scenarioContent) return [];

  try {
    const scenario = JSON.parse(scenarioContent);
    const nodes: Array<{ key: string; label: string; description: string }> = [];

    // Extract nodes from different possible structures
    if (scenario.nodes && Array.isArray(scenario.nodes)) {
      scenario.nodes.forEach((node: any) => {
        // Handle various node ID and name patterns
        const nodeId = node.nodeId || node.id || node.name;
        const displayName = node.displayName || node.data?.label || node.label || node.name || nodeId;

        if (nodeId || displayName) {
          // Use displayName for the @ reference (like "Source A", "Queue B")
          const referenceKey = displayName || nodeId;
          nodes.push({
            key: `@${referenceKey}`,
            label: referenceKey,
            description: `${node.type || 'Node'}: ${displayName}${nodeId !== displayName ? ` (${nodeId})` : ''}`
          });
        }
      });
    }

    // Extract sources with human-readable names
    if (scenario.sources && Array.isArray(scenario.sources)) {
      scenario.sources.forEach((source: any) => {
        if (source.id || source.name) {
          const sourceId = source.id || source.name;
          const sourceName = source.name || source.label || sourceId;
          nodes.push({
            key: `@${sourceName}`,
            label: sourceName,
            description: `Source: ${sourceName}${source.type ? ` (${source.type})` : ''}`
          });
        }
      });
    }

    // Extract tokens from ledger if available
    if (scenario.ledger && Array.isArray(scenario.ledger)) {
      scenario.ledger.forEach((token: any) => {
        if (token.id || token.name) {
          const tokenId = token.id || token.name;
          const tokenName = token.name || token.label || tokenId;
          nodes.push({
            key: `@${tokenName}`,
            label: tokenName,
            description: `Token: ${tokenName}${token.type ? ` (${token.type})` : ''}`
          });
        }
      });
    }

    // Extract any other named entities
    Object.keys(scenario).forEach(key => {
      if (key !== 'nodes' && key !== 'sources' && key !== 'ledger' && typeof scenario[key] === 'object' && Array.isArray(scenario[key])) {
        scenario[key].forEach((item: any) => {
          if (item.id || item.name) {
            const itemId = item.id || item.name;
            const itemName = item.name || item.label || itemId;
            if (!nodes.find(n => n.label === itemName)) {
              nodes.push({
                key: `@${itemName}`,
                label: itemName,
                description: `${key}: ${itemName}`
              });
            }
          }
        });
      }
    });

    return nodes.sort((a, b) => a.label.localeCompare(b.label));
  } catch (error) {
    console.warn('Error parsing scenario for node extraction:', error);
    return [];
  }
};