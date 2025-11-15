/**
 * Node Navigation Service
 *
 * Provides centralized navigation capabilities for focusing on specific nodes
 * in the graph visualization. Can be called from anywhere in the app.
 */

import { useSimulationStore } from '@/stores/simulationStore';

interface NodeNavigationOptions {
  nodeId: string;
  highlight?: boolean;
  zoom?: number;
  duration?: number;
}

class NodeNavigationService {
  private reactFlowInstance: any = null;
  private highlightedNodeId: string | null = null;
  private highlightTimeoutId: NodeJS.Timeout | null = null;

  /**
   * Register ReactFlow instance for navigation operations
   */
  setReactFlowInstance(instance: any) {
    this.reactFlowInstance = instance;
    console.log('🧭 NodeNavigationService: ReactFlow instance registered');
  }

  /**
   * Navigate to and focus on a specific node
   */
  async navigateToNode({ nodeId, highlight = false, zoom = 1.5, duration = 800 }: NodeNavigationOptions) {
    if (!this.reactFlowInstance) {
      console.warn('🧭 NodeNavigationService: ReactFlow instance not available');
      return false;
    }

    try {
      console.log('🧭 Navigating to node:', nodeId);

      // Get the node from ReactFlow
      const node = this.reactFlowInstance.getNode(nodeId);
      if (!node) {
        console.warn('🧭 Node not found in ReactFlow:', nodeId);
        return false;
      }

      // Center and zoom to the node with smooth animation
      this.reactFlowInstance.fitView({
        nodes: [{ id: nodeId }],
        duration: duration,
        padding: 0.3, // 30% padding around the node
        minZoom: zoom,
        maxZoom: zoom,
      });

      return true;
    } catch (error) {
      console.error('🧭 Navigation error:', error);
      return false;
    }
  }

  /**
   * Highlight a node temporarily
   */
  private highlightNode(nodeId: string, delay = 0) {
    setTimeout(() => {
      this.highlightedNodeId = nodeId;

      // Add highlight class to the node
      const nodeElement = document.querySelector(`[data-id="${nodeId}"]`);
      if (nodeElement) {
        nodeElement.classList.add('node-highlighted');

        // Remove highlight after 3 seconds
        this.highlightTimeoutId = setTimeout(() => {
          this.clearHighlight();
        }, 3000);
      }
    }, delay);
  }

  /**
   * Clear any active highlight
   */
  private clearHighlight() {
    if (this.highlightedNodeId) {
      const nodeElement = document.querySelector(`[data-id="${this.highlightedNodeId}"]`);
      if (nodeElement) {
        nodeElement.classList.remove('node-highlighted');
      }
      this.highlightedNodeId = null;
    }

    if (this.highlightTimeoutId) {
      clearTimeout(this.highlightTimeoutId);
      this.highlightTimeoutId = null;
    }
  }

  /**
   * Check if a node exists in the current scenario
   */
  nodeExists(nodeId: string): boolean {
    const scenario = useSimulationStore.getState().scenario;
    return scenario?.nodes.some(node => node.nodeId === nodeId) || false;
  }

  /**
   * Get node information
   */
  getNodeInfo(nodeId: string) {
    const scenario = useSimulationStore.getState().scenario;
    return scenario?.nodes.find(node => node.nodeId === nodeId) || null;
  }
}

// Export singleton instance
export const nodeNavigationService = new NodeNavigationService();

// CSS for highlighting nodes (to be added to global styles)
export const nodeHighlightCSS = `
.node-highlighted {
  animation: nodeHighlight 3s ease-in-out;
  box-shadow: 0 0 20px 4px rgba(59, 130, 246, 0.6) !important;
  border: 2px solid #3b82f6 !important;
  z-index: 1000 !important;
}

@keyframes nodeHighlight {
  0%, 100% {
    box-shadow: 0 0 20px 4px rgba(59, 130, 246, 0.6);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 30px 6px rgba(59, 130, 246, 0.8);
    transform: scale(1.05);
  }
}
`;