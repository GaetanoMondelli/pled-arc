const fs = require('fs');

class V3WorkflowEngine {
  constructor(workflowPath, executionData) {
    const workflowFile = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    this.workflow = workflowFile.scenario;
    this.executionEvents = executionData.externalEvents || [];
    this.nodeData = {};
    this.nodeStates = {};
    this.steps = 0;
    this.maxSteps = 50;
    console.log(`\n🎯 V3 Workflow Engine initialized`);
    console.log(`📋 Workflow: ${workflowFile.name} v${workflowFile.version}`);
    console.log(`📊 Execution events: ${this.executionEvents.length}`);
  }

  log(message, data = null) {
    console.log(`[Step ${this.steps}] ${message}`);
    if (data) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  getExecutionEvents(eventType) {
    return this.executionEvents.filter(e => e.type === eventType);
  }

  processDataSource(node) {
    if (node.generation?.type === 'execution-events') {
      const eventType = node.generation.eventType;
      const events = this.getExecutionEvents(eventType);
      this.log(`📥 DataSource "${node.displayName}" reading ${events.length} ${eventType} events`);

      if (events.length === 0) {
        this.nodeStates[node.nodeId] = 'empty';
        return null;
      }

      this.nodeStates[node.nodeId] = 'emitting';
      this.nodeData[node.nodeId] = events;
      return events;
    }

    this.log(`⚠️  DataSource "${node.displayName}" has unsupported generation type`);
    return null;
  }

  processQueue(node) {
    const inputs = node.inputs || [];
    const collectedData = [];

    for (const input of inputs) {
      const sourceNode = this.workflow.nodes.find(n =>
        n.outputs?.some(o => o.destinationNodeId === node.nodeId && o.destinationInputName === input.name)
      );

      if (sourceNode && this.nodeData[sourceNode.nodeId]) {
        const data = this.nodeData[sourceNode.nodeId];
        const items = Array.isArray(data) ? data : [data];
        collectedData.push(...items);
        this.log(`  📥 Queue collected ${items.length} items from ${sourceNode.displayName}`);
      }
    }

    if (collectedData.length === 0) {
      this.nodeStates[node.nodeId] = 'waiting';
      this.log(`⏳ Queue "${node.displayName}" waiting for inputs`);
      return null;
    }

    const trigger = node.aggregation?.trigger;
    if (trigger?.type === 'count' && collectedData.length >= trigger.threshold) {
      this.log(`✅ Queue "${node.displayName}" trigger met: ${collectedData.length} >= ${trigger.threshold}`);
      this.nodeStates[node.nodeId] = 'ready';
      this.nodeData[node.nodeId] = collectedData;
      return collectedData;
    }

    this.nodeStates[node.nodeId] = 'collecting';
    this.log(`⏳ Queue "${node.displayName}" collecting: ${collectedData.length} items`);
    return null;
  }

  processProcessNode(node) {
    const inputs = node.inputs || [];
    let inputData = null;

    if (inputs.length === 0) {
      this.log(`⚠️  ProcessNode "${node.displayName}" has no inputs`);
      return null;
    }

    for (const input of inputs) {
      const sourceNode = this.workflow.nodes.find(n =>
        n.outputs?.some(o => o.destinationNodeId === node.nodeId && o.destinationInputName === input.name)
      );

      if (sourceNode && this.nodeData[sourceNode.nodeId]) {
        inputData = this.nodeData[sourceNode.nodeId];
        break;
      }
    }

    if (!inputData) {
      this.nodeStates[node.nodeId] = 'waiting';
      this.log(`⏳ ProcessNode "${node.displayName}" waiting for input`);
      return null;
    }

    if (node.processing?.formula) {
      try {
        const inputName = inputs[0].name;
        const formula = node.processing.formula;

        this.log(`⚙️  ProcessNode "${node.displayName}" executing formula`);
        const evalFunc = new Function(inputName, `return (${formula})`);
        const result = evalFunc(inputData);

        if (result === null || result === undefined) {
          this.log(`  ❌ Formula returned null/undefined - filtering out`);
          this.nodeStates[node.nodeId] = 'filtered';
          return null;
        }

        this.log(`  ✅ Formula result:`, result);
        this.nodeStates[node.nodeId] = 'completed';
        this.nodeData[node.nodeId] = result;
        return result;
      } catch (error) {
        this.log(`  ❌ Error executing formula: ${error.message}`);
        this.nodeStates[node.nodeId] = 'error';
        return null;
      }
    }

    this.log(`⚠️  ProcessNode "${node.displayName}" has no formula`);
    return null;
  }

  processFSMNode(node) {
    const inputs = node.inputs || [];
    let inputData = null;

    for (const input of inputs) {
      const sourceNode = this.workflow.nodes.find(n =>
        n.outputs?.some(o => o.destinationNodeId === node.nodeId && o.destinationInputName === input.name)
      );

      if (sourceNode && this.nodeData[sourceNode.nodeId]) {
        inputData = this.nodeData[sourceNode.nodeId];
        break;
      }
    }

    if (!inputData) {
      this.nodeStates[node.nodeId] = 'waiting';
      this.log(`⏳ FSM "${node.displayName}" waiting for input`);
      return null;
    }

    const fsm = node.fsm;
    let currentState = fsm.initialState;
    this.log(`🤖 FSM "${node.displayName}" starting in state: ${currentState}`);

    const transition = fsm.transitions.find(t => {
      if (t.from !== currentState) return false;

      if (t.guard) {
        try {
          const inputName = inputs[0].name;
          const evalFunc = new Function(inputName, `return (${t.guard})`);
          const guardResult = evalFunc(inputData);
          this.log(`  🔍 Guard "${t.guard}": ${guardResult ? '✅' : '❌'}`);
          return guardResult;
        } catch (error) {
          this.log(`  ❌ Guard error: ${error.message}`);
          return false;
        }
      }
      return true;
    });

    if (!transition) {
      this.log(`  ❌ No valid transition found`);
      this.nodeStates[node.nodeId] = 'stuck';
      return null;
    }

    currentState = transition.to;
    this.log(`  ➡️  Transition to: ${currentState}`);

    const state = fsm.states.find(s => s.name === currentState);
    if (state?.onEntry) {
      for (const action of state.onEntry) {
        if (action.action === 'emit' && action.formula) {
          try {
            const inputName = inputs[0].name;
            const evalFunc = new Function(inputName, `return (${action.formula})`);
            const emitData = evalFunc(inputData);
            this.log(`  📤 Emitting to "${action.target}":`, emitData);

            this.nodeData[`${node.nodeId}_${action.target}`] = emitData;
            this.nodeStates[node.nodeId] = currentState;
            return { output: action.target, data: emitData };
          } catch (error) {
            this.log(`  ❌ Emit error: ${error.message}`);
          }
        }
      }
    }

    this.nodeStates[node.nodeId] = currentState;
    return null;
  }

  processSink(node) {
    const inputs = node.inputs || [];
    let receivedData = false;

    for (const input of inputs) {
      const sourceNodes = this.workflow.nodes.filter(n =>
        n.outputs?.some(o => o.destinationNodeId === node.nodeId)
      );

      for (const sourceNode of sourceNodes) {
        const nodeDataKey = Object.keys(this.nodeData).find(k =>
          k.startsWith(sourceNode.nodeId)
        );

        if (nodeDataKey && this.nodeData[nodeDataKey]) {
          const data = this.nodeData[nodeDataKey];
          this.log(`✅ Sink "${node.displayName}" received data from ${sourceNode.displayName}`);
          this.log(`  Final data:`, data);
          this.nodeStates[node.nodeId] = 'received';
          receivedData = true;
        }
      }
    }

    if (!receivedData) {
      this.nodeStates[node.nodeId] = 'waiting';
      this.log(`⏳ Sink "${node.displayName}" waiting for data`);
    }

    return receivedData;
  }

  run() {
    console.log(`\n🚀 Starting workflow execution\n`);

    while (this.steps < this.maxSteps) {
      this.steps++;
      let progressMade = false;

      console.log(`\n═══ Step ${this.steps} ═══`);

      for (const node of this.workflow.nodes) {
        if (['completed', 'received', 'error'].includes(this.nodeStates[node.nodeId])) {
          continue;
        }

        switch (node.type) {
          case 'DataSource':
            if (!this.nodeData[node.nodeId]) {
              this.processDataSource(node);
              progressMade = true;
            }
            break;

          case 'Queue':
            if (!this.nodeStates[node.nodeId] || this.nodeStates[node.nodeId] === 'waiting' || this.nodeStates[node.nodeId] === 'collecting') {
              const result = this.processQueue(node);
              if (result) progressMade = true;
            }
            break;

          case 'ProcessNode':
            if (!this.nodeStates[node.nodeId] || this.nodeStates[node.nodeId] === 'waiting') {
              const result = this.processProcessNode(node);
              if (result) progressMade = true;
            }
            break;

          case 'FSMProcessNode':
            if (!this.nodeStates[node.nodeId] || this.nodeStates[node.nodeId] === 'waiting') {
              const result = this.processFSMNode(node);
              if (result) progressMade = true;
            }
            break;

          case 'Sink':
            if (!this.nodeStates[node.nodeId] || this.nodeStates[node.nodeId] === 'waiting') {
              const received = this.processSink(node);
              if (received) progressMade = true;
            }
            break;
        }
      }

      const sinks = this.workflow.nodes.filter(n => n.type === 'Sink');
      const activeSinks = sinks.filter(s => this.nodeStates[s.nodeId] === 'received');

      if (activeSinks.length > 0) {
        console.log(`\n✅ SUCCESS! Reached sink(s): ${activeSinks.map(s => s.displayName).join(', ')}`);
        this.printSummary();
        return true;
      }

      if (!progressMade) {
        console.log(`\n❌ STUCK! No progress made in this step.`);
        this.printSummary();
        return false;
      }
    }

    console.log(`\n⏱️  MAX STEPS REACHED (${this.maxSteps})`);
    this.printSummary();
    return false;
  }

  printSummary() {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║          WORKFLOW SUMMARY              ║`);
    console.log(`╚════════════════════════════════════════╝\n`);

    for (const node of this.workflow.nodes) {
      const state = this.nodeStates[node.nodeId] || 'not-started';
      const stateIcon = {
        'completed': '✅',
        'received': '✅',
        'waiting': '⏳',
        'error': '❌',
        'stuck': '🚫',
        'filtered': '🔽',
        'emitting': '📤',
        'ready': '✅',
        'collecting': '📦',
        'empty': '⚠️',
        'not-started': '⭕',
        'Approved': '✅',
        'Rejected': '❌',
        'Validating': '🔄'
      }[state] || '❓';

      console.log(`${stateIcon} ${node.displayName} (${node.type}): ${state}`);
    }
  }
}

const workflowPath = '/Users/gaetano/dev/archackathon/workflows/dao-house-pl-verification-v3-fixed.json';

const executionData = {
  externalEvents: [
    {
      "id": "evt_processed_1763243261663",
      "type": "document.processed",
      "data": {
        "documentId": "doc-1763243258940",
        "companyId": "web3-scion",
        "fileName": "profit (2).pdf",
        "textContent": "## Scion Web3 Fund Ltd. - Profit & Loss Statement\n\nReporting Period: Q1 2025\n\nTotal Revenue 0.32\nOperating Expenses 0.17\nNet Profit 0.15\n\nSigned: Michael Burry - CFO",
        "processedAt": "2025-11-15T21:47:41.663Z"
      },
      "timestamp": 1763243261663
    },
    {
      "id": "evt_gemini_test_1",
      "type": "gemini.signature.verified",
      "data": {
        "documentId": "doc-1763243258940",
        "fileName": "profit (2).pdf",
        "isValid": true,
        "reliabilityScore": 87,
        "signedBy": "Michael Burry",
        "verifiedAt": "2025-11-15T21:47:42.000Z"
      },
      "timestamp": 1763243262000
    }
  ]
};

const engine = new V3WorkflowEngine(workflowPath, executionData);
engine.run();
