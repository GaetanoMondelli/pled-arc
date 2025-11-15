// Node layout and positioning utilities
// Extracted from IntegratedAIAssistant.tsx for better organization

// Layout constants
export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 150;
export const GAP_X = 220;
export const GAP_Y = 170;
export const MARGIN = 50;
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

export type ScenarioNode = {
  nodeId: string;
  displayName?: string;
  type?: string;
  position?: { x: number; y: number };
};

export function rectsOverlap(ax: number, ay: number, bx: number, by: number): boolean {
  return (
    Math.abs(ax - bx) < NODE_WIDTH &&
    Math.abs(ay - by) < NODE_HEIGHT
  );
}

export function isOccupied(nodes: ScenarioNode[], x: number, y: number): boolean {
  return nodes.some(n => n.position && rectsOverlap(n.position.x, n.position.y, x, y));
}

export function clampToCanvas(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, MARGIN), CANVAS_WIDTH - NODE_WIDTH - MARGIN),
    y: Math.min(Math.max(y, MARGIN), CANVAS_HEIGHT - NODE_HEIGHT - MARGIN),
  };
}

export function findFreeSlotNear(nodes: ScenarioNode[], baseX: number, baseY: number): { x: number; y: number } {
  // Spiral search around base (left/right/up/down rows)
  const candidates: Array<{ x: number; y: number }> = [];
  const layers = 6; // up to ~6 layers around
  for (let d = 0; d <= layers; d++) {
    for (let dy = -d; dy <= d; dy++) {
      const y = baseY + dy * GAP_Y;
      const x1 = baseX - d * GAP_X;
      const x2 = baseX + d * GAP_X;
      candidates.push({ x: x1, y });
      candidates.push({ x: x2, y });
    }
  }
  for (const c of candidates) {
    const cc = clampToCanvas(c.x, c.y);
    if (!isOccupied(nodes, cc.x, cc.y)) return cc;
  }
  // Fallback: scan grid from top-left
  for (let gy = MARGIN; gy < CANVAS_HEIGHT - NODE_HEIGHT - MARGIN; gy += GAP_Y) {
    for (let gx = MARGIN; gx < CANVAS_WIDTH - NODE_WIDTH - MARGIN; gx += GAP_X) {
      const cc = clampToCanvas(gx, gy);
      if (!isOccupied(nodes, cc.x, cc.y)) return cc;
    }
  }
  return clampToCanvas(baseX, baseY);
}

export function getBestPositionForNewNode(scenario: any, targetNodeId?: string): { x: number; y: number } {
  const nodes: ScenarioNode[] = Array.isArray(scenario?.nodes) ? scenario.nodes : [];
  if (targetNodeId) {
    const target = nodes.find(n => n.nodeId === targetNodeId);
    if (target?.position) {
      // Prefer left of target; stack vertically if needed
      const baseX = target.position.x - GAP_X;
      const baseY = target.position.y;
      return findFreeSlotNear(nodes, baseX, baseY);
    }
  }
  // Otherwise place in first free grid slot
  return findFreeSlotNear(nodes, MARGIN, MARGIN);
}

export function fixCollisionsInPlace(scenario: any, existingNodeIds: Set<string> = new Set()): void {
  const nodes: ScenarioNode[] = Array.isArray(scenario?.nodes) ? scenario.nodes : [];

  // First, mark all existing nodes as "placed" to preserve their positions
  const placed: Array<{ x: number; y: number }> = [];
  const existingNodes: ScenarioNode[] = [];
  const newNodes: ScenarioNode[] = [];

  nodes.forEach((n) => {
    if (!n.position) n.position = { x: MARGIN, y: MARGIN };

    if (existingNodeIds.has(n.nodeId)) {
      // This is an existing node - preserve its position
      existingNodes.push(n);
      placed.push({ x: n.position.x, y: n.position.y });
    } else {
      // This is a new node - may need repositioning
      newNodes.push(n);
    }
  });

  // Sort new nodes by x then y for stable placement
  newNodes.sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0) || (a.position?.y ?? 0) - (b.position?.y ?? 0));

  // Only reposition new nodes to avoid collisions
  newNodes.forEach((n) => {
    let { x, y } = n.position!;
    let attempts = 0;

    // First, try vertical nudges
    while (placed.some(p => rectsOverlap(p.x, p.y, x, y)) && attempts < 8) {
      y += GAP_Y;
      attempts++;
    }

    // If still colliding, shift to the right and reset vertical position near current row band
    let columnShifts = 0;
    while (placed.some(p => rectsOverlap(p.x, p.y, x, y)) && columnShifts < 6) {
      x += GAP_X;
      // Snap y to nearest grid band
      y = Math.round(y / GAP_Y) * GAP_Y;
      attempts = 0;
      while (placed.some(p => rectsOverlap(p.x, p.y, x, y)) && attempts < 8) {
        y += GAP_Y;
        attempts++;
      }
      columnShifts++;
    }

    const clamped = clampToCanvas(x, y);
    n.position.x = clamped.x;
    n.position.y = clamped.y;
    placed.push({ x: n.position.x, y: n.position.y });
  });
}