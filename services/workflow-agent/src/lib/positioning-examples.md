# Semantic Positioning Library - Usage Examples

This library provides intelligent node positioning for workflow diagrams with semantic grouping and virtual column/row layouts.

## Key Features

### 1. **Virtual Columns & Rows**
- Similar node types stack vertically in the same column
- Workflow flows horizontally (left-to-right) through columns
- Consistent spacing and alignment

### 2. **Semantic Flow Detection**
- **Extending Flow**: New nodes connected to existing ones → positioned to the right
- **New Complete Flow**: Independent flows → positioned below existing flows
- **Type Grouping**: Multiple DataSources, ProcessNodes, etc. → stacked vertically

### 3. **Smart Spacing**
- Tight spacing for same node types (110px vertical)
- Moderate spacing between different types (40px group spacing)
- Column separation (250px) for flow stages

## Usage Examples

### Basic Usage - New Workflow

```typescript
import { positionAllNodes } from './lib/semantic-positioning';

const nodes = [
  { nodeId: 'ds1', type: 'DataSource', displayName: 'User Events' },
  { nodeId: 'ds2', type: 'DataSource', displayName: 'API Calls' },
  { nodeId: 'proc1', type: 'ProcessNode', displayName: 'Validator' },
  { nodeId: 'sink1', type: 'Sink', displayName: 'Database' }
];

const edges = [
  { from: 'ds1', to: 'proc1' },
  { from: 'ds2', to: 'proc1' },
  { from: 'proc1', to: 'sink1' }
];

const positionedNodes = positionAllNodes(nodes, edges);
```

**Result Layout:**
```
Column 1    Column 2      Column 3
DataSource  ProcessNode   Sink
ds1    →    proc1    →    sink1
ds2    ↗
```

### Extending Existing Workflow

```typescript
import { positionNodes } from './lib/semantic-positioning';

const existingNodes = [
  { nodeId: 'ds1', type: 'DataSource', position: { x: 50, y: 100 } },
  { nodeId: 'proc1', type: 'ProcessNode', position: { x: 300, y: 100 } }
];

const newNodes = [
  { nodeId: 'queue1', type: 'Queue', displayName: 'Buffer' },
  { nodeId: 'sink1', type: 'Sink', displayName: 'Results' }
];

const allEdges = [
  { from: 'ds1', to: 'proc1' },
  { from: 'proc1', to: 'queue1' },  // New connection
  { from: 'queue1', to: 'sink1' }   // New connection
];

const positionedNewNodes = positionNodes(existingNodes, newNodes, allEdges);
```

**Result Layout:**
```
Existing    Extension
ds1 → proc1 → queue1 → sink1
(unchanged)   (new, positioned right)
```

### Multiple Similar Nodes (Vertical Stacking)

```typescript
const nodes = [
  { nodeId: 'ds1', type: 'DataSource', displayName: 'Orders' },
  { nodeId: 'ds2', type: 'DataSource', displayName: 'Inventory' },
  { nodeId: 'ds3', type: 'DataSource', displayName: 'Users' },
  { nodeId: 'ds4', type: 'DataSource', displayName: 'Payments' },
  { nodeId: 'ds5', type: 'DataSource', displayName: 'Analytics' },
  { nodeId: 'proc1', type: 'ProcessNode', displayName: 'Aggregator' },
  { nodeId: 'sink1', type: 'Sink', displayName: 'Data Lake' }
];
```

**Result Layout:**
```
Column 1       Column 2      Column 3
DataSources    ProcessNode   Sink
ds1      ↘
ds2      →     proc1    →    sink1
ds3      ↗
ds4      ↗
ds5      ↗
```

### New Complete Flow Below Existing

```typescript
// Scenario: User creates one complete flow, then asks for another
const existingFlow = [
  { nodeId: 'ds1', type: 'DataSource', position: { x: 50, y: 100 } },
  { nodeId: 'proc1', type: 'ProcessNode', position: { x: 300, y: 100 } },
  { nodeId: 'sink1', type: 'Sink', position: { x: 550, y: 100 } }
];

const newCompleteFlow = [
  { nodeId: 'ds2', type: 'DataSource', displayName: 'New Source' },
  { nodeId: 'queue1', type: 'Queue', displayName: 'Buffer' },
  { nodeId: 'sink2', type: 'Sink', displayName: 'New Sink' }
];

const separateEdges = [
  // No connections between flows
  { from: 'ds2', to: 'queue1' },
  { from: 'queue1', to: 'sink2' }
];

const positioned = positionNodes(existingFlow, newCompleteFlow, separateEdges);
```

**Result Layout:**
```
Flow 1:  ds1 → proc1 → sink1
         (y: 100)

Flow 2:  ds2 → queue1 → sink2
         (y: 350, positioned below)
```

## Custom Configuration

```typescript
import { SemanticPositioner } from './lib/semantic-positioning';

const customConfig = {
  columnWidth: 300,        // Wider columns
  rowHeight: 150,          // More vertical space
  rowGroupSpacing: 80,     // More space between node types
  nodeTypePriority: {      // Custom flow order
    'DataSource': 1,
    'Validator': 2,        // Custom node type
    'ProcessNode': 3,
    'Queue': 4,
    'Sink': 5
  },
  commentOffsetY: 200      // Comments positioned higher
};

const positioner = new SemanticPositioner(customConfig);
const positioned = positioner.positionNewNodes(existing, newNodes, edges);
```

## Integration with Workflow Agents

```typescript
// In your workflow agent
async function calculatePositions(state: WorkflowState) {
  const { positionNodes } = await import('./lib/semantic-positioning');

  const existingNodes = state.currentScenario?.nodes || [];
  const newNodes = state.generatedNodes || [];
  const allEdges = state.generatedScenario?.edges || [];

  // Optimized config for workflow diagrams
  const config = {
    columnWidth: 250,
    rowHeight: 110,
    rowGroupSpacing: 40,
    nodeTypePriority: {
      'DataSource': 1,
      'Queue': 2,
      'ProcessNode': 3,
      'Multiplexer': 4,
      'FSM': 5,
      'Sink': 6,
      'MarkdownComment': 0
    }
  };

  const positioned = positionNodes(existingNodes, newNodes, allEdges, config);

  return {
    ...state,
    generatedScenario: {
      ...state.generatedScenario,
      nodes: [...existingNodes, ...positioned]
    }
  };
}
```

## Benefits

1. **Predictable Layout**: Similar nodes always group together vertically
2. **Flow Clarity**: Horizontal progression shows data flow clearly
3. **Space Efficiency**: Compact layout without overlapping
4. **Extensibility**: New flows stack below, extensions go right
5. **Type Awareness**: Node types determine positioning priority
6. **Reusable**: Shared across all workflow agents