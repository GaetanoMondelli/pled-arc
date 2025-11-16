/**
 * Test script for DAO House P&L Verification Workflow
 *
 * This script:
 * 1. Loads the workflow template
 * 2. Fetches events from the execution
 * 3. Simulates the workflow engine processing
 * 4. Shows which nodes get activated
 * 5. Checks if we reach the sink nodes
 */

const fs = require('fs');
const path = require('path');

// Load the workflow template
const templatePath = path.join(__dirname, 'workflows/dao-house-pl-verification.json');
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

console.log('📋 Workflow Template Loaded:', template.name);
console.log('📊 Nodes:', template.nodes.map(n => `${n.id} (${n.type})`).join(', '));
console.log('');

// Mock execution events (you can replace with API call)
const executionId = 'dUJ8IhwEe7Dg9AGbIgeJ8';
const mockEvents = [
  {
    id: 'evt_upload_1763243259333_itsq90ej3',
    type: 'document.uploaded',
    data: {
      documentId: 'doc-1763243258940',
      companyId: 'web3-scion',
      fileName: 'profit (2).pdf',
      documentType: 'profit-loss',
      uploadedAt: '2025-11-15T21:47:39.333Z'
    },
    timestamp: 1763243259333
  },
  {
    id: 'evt_processed_1763243261663_8eapi8aih',
    type: 'document.processed',
    data: {
      documentId: 'doc-1763243258940',
      companyId: 'web3-scion',
      fileName: 'profit (2).pdf',
      formats: {
        pdf: 'profit (2).pdf',
        json: 'profit (2).json',
        text: 'profit (2).txt',
        markdown: 'profit (2).md'
      },
      textContent: `## Scion Web3 Fund Ltd. - Profit & Loss Statement

Reporting Period: Q1 2025

Prepared by: Finance Department

Date: 12/03/2025

Item

Amount (USDC)

Total Revenue

0.32

Operating

Expenses

0.17

Net Profit

0.15

## Notes:

- Increased profitability driven by staking rewards and tokenized inventory refinancing.
- The Board approved profit distribution to shareholders on 12/03/2025.

## Signed:

Michael Burry - Chief Financial Officer`,
      jsonContent: {
        documentType: 'Profit & Loss Statement',
        company: 'web3-scion',
        revenue: 0.32,
        expenses: 0.17,
        netProfit: 0.15
      },
      processedAt: '2025-11-15T21:47:41.663Z'
    },
    timestamp: 1763243261663
  },
  {
    id: 'evt_gemini_test_1',
    type: 'gemini.signature.verified',
    data: {
      documentId: 'doc-1763243258940',
      fileName: 'profit (2).pdf',
      isValid: true,
      reliabilityScore: 87,
      signedBy: 'Michael Burry',
      verifiedAt: '2025-11-15T21:47:42.000Z',
      verificationMethod: 'gemini-vision-pro',
      prompt: 'Verify the signature on this P&L statement for web3-scion',
      confidence: 'high'
    },
    timestamp: 1763243262000
  }
];

// Simple workflow engine simulator
class SimpleWorkflowEngine {
  constructor(template, events) {
    this.template = template;
    this.events = events;
    this.nodeStates = {};
    this.nodeData = {};
    this.steps = 0;
    this.maxSteps = 20;
  }

  log(message, data = null) {
    console.log(`[Step ${this.steps}] ${message}`);
    if (data) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  // Check if a condition matches
  evaluateCondition(condition, data) {
    // Handle both nested paths (data.field) and direct field access
    const value = condition.field.includes('.')
      ? this.getNestedValue(data, condition.field)
      : data[condition.field];

    switch (condition.operator) {
      case 'contains':
        return value && String(value).includes(condition.value);
      case 'equals':
        return value === condition.value;
      case 'greaterThan':
        return value > condition.value;
      default:
        return false;
    }
  }

  // Get nested value from object using dot notation
  getNestedValue(obj, path) {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  // Extract field from event data
  extractField(event, extraction) {
    return this.getNestedValue(event, extraction.path);
  }

  // Apply regex transformation
  applyRegexTransformation(transform, data) {
    const input = data[transform.input];
    if (!input) return null;

    // Convert to string if not already
    const inputStr = typeof input === 'string' ? input : String(input);

    const regex = new RegExp(transform.pattern);
    const match = inputStr.match(regex);

    if (match && match[1]) {
      // Remove commas and parse as float
      return parseFloat(match[1].replace(/,/g, ''));
    }
    return null;
  }

  // Process data filter node
  processDataFilter(node) {
    this.log(`📍 Processing DataFilter: ${node.id}`);

    const matchingEvents = this.events.filter(event => {
      if (event.type !== node.config.eventType) return false;

      return node.config.conditions.every(condition =>
        this.evaluateCondition(condition, event)
      );
    });

    if (matchingEvents.length > 0) {
      this.log(`✅ Filter matched ${matchingEvents.length} events`, {
        eventIds: matchingEvents.map(e => e.id)
      });
      this.nodeStates[node.id] = 'matched';
      this.nodeData[node.id] = matchingEvents;
      return matchingEvents;
    } else {
      this.log(`❌ Filter matched no events`);
      this.nodeStates[node.id] = 'no-match';
      return [];
    }
  }

  // Process process node with dual data sources
  processProcessNode(node) {
    this.log(`📍 Processing ProcessNode: ${node.id} (${node.config.name})`);

    const dataSources = node.config.dataSources || [];
    const collectedData = {};

    // Try to find matching events for each data source
    for (const source of dataSources) {
      this.log(`  🔍 Looking for ${source.eventType} matching by ${source.matchField}`);

      const matchingEvent = this.events.find(event =>
        event.type === source.eventType
      );

      if (matchingEvent) {
        this.log(`  ✅ Found ${source.id}: ${matchingEvent.id}`);
        collectedData[source.id] = matchingEvent;
      } else {
        this.log(`  ❌ No match for ${source.id}`);
      }
    }

    // Check if we have all required data sources
    const hasAllSources = dataSources.every(source => collectedData[source.id]);

    if (!hasAllSources) {
      this.log(`⏳ Waiting for all data sources (have ${Object.keys(collectedData).length}/${dataSources.length})`);
      this.nodeStates[node.id] = 'waiting';
      return null;
    }

    // Check if events match by matchField
    const matchFields = dataSources.map(source => {
      const event = collectedData[source.id];
      return this.getNestedValue(event, `data.${source.matchField}`);
    });

    const allMatch = matchFields.every(field => field === matchFields[0]);

    if (!allMatch) {
      this.log(`❌ Events don't match on matchField`, { matchFields });
      this.nodeStates[node.id] = 'no-match';
      return null;
    }

    this.log(`✅ All data sources matched!`);

    // Extract fields
    const extractedData = {};
    for (const extraction of node.config.extractFields || []) {
      const sourceEvent = collectedData[extraction.source];
      const value = this.extractField(sourceEvent, extraction);
      extractedData[extraction.name] = value;
      this.log(`  📤 Extracted ${extraction.name}: ${JSON.stringify(value)}`);
    }

    // Apply transformations
    for (const transform of node.config.transformations || []) {
      let result;
      if (transform.type === 'regex') {
        result = this.applyRegexTransformation(transform, extractedData);
      } else if (transform.type === 'parseFloat') {
        const input = extractedData[transform.input];
        result = input ? parseFloat(input) : null;
      }
      extractedData[transform.output] = result;
      this.log(`  🔄 Transformed ${transform.name}: ${result}`);
    }

    this.nodeStates[node.id] = 'completed';
    this.nodeData[node.id] = extractedData;
    return extractedData;
  }

  // Process condition node
  processConditionNode(node, inputData) {
    this.log(`📍 Processing Condition: ${node.id}`);

    if (!inputData) {
      this.log(`⏳ No input data available`);
      this.nodeStates[node.id] = 'waiting';
      return null;
    }

    const results = node.config.conditions.map(condition => {
      const matches = this.evaluateCondition(condition, inputData);
      const value = condition.field.includes('.')
        ? this.getNestedValue(inputData, condition.field)
        : inputData[condition.field];
      this.log(`  🔍 ${condition.field} ${condition.operator} ${condition.value}: ${matches ? '✅' : '❌'} (value: ${JSON.stringify(value)})`);
      return matches;
    });

    const logic = node.config.logic || 'AND';
    const passed = logic === 'AND' ? results.every(r => r) : results.some(r => r);

    this.log(passed ? `✅ Condition PASSED` : `❌ Condition FAILED`);
    this.nodeStates[node.id] = passed ? 'true' : 'false';
    return passed;
  }

  // Process calculation node
  processCalculationNode(node, inputData) {
    this.log(`📍 Processing Calculation: ${node.id} (${node.config.name})`);

    if (!inputData) {
      this.log(`⏳ No input data available`);
      this.nodeStates[node.id] = 'waiting';
      return null;
    }

    const calculatedData = { ...inputData };

    for (const calc of node.config.calculations || []) {
      // Simple formula evaluation (just multiplication for now)
      const formula = calc.formula;
      const match = formula.match(/(\w+)\s*\*\s*([\d.]+)/);

      if (match) {
        const [, variable, multiplier] = match;
        const value = inputData[variable];
        const result = value * parseFloat(multiplier);
        calculatedData[calc.name] = result;
        this.log(`  📊 ${calc.name} = ${value} * ${multiplier} = ${result}`);
      }
    }

    this.nodeStates[node.id] = 'completed';
    this.nodeData[node.id] = calculatedData;
    return calculatedData;
  }

  // Process sink node
  processSinkNode(node, inputData) {
    this.log(`📍 Processing Sink: ${node.id} (${node.config.name})`);

    if (!inputData) {
      this.log(`⏳ No input data available`);
      this.nodeStates[node.id] = 'waiting';
      return;
    }

    const outputData = {};
    for (const field of node.config.fields || []) {
      outputData[field] = inputData[field];
    }

    this.log(`✅ SINK REACHED!`, outputData);
    this.nodeStates[node.id] = 'completed';
    this.nodeData[node.id] = outputData;
  }

  // Execute the workflow
  execute() {
    console.log('\n🚀 Starting Workflow Execution');
    console.log('═'.repeat(80));

    while (this.steps < this.maxSteps) {
      this.steps++;
      console.log('\n' + '─'.repeat(80));

      let progressMade = false;

      // Process nodes in order following edges
      for (const node of this.template.nodes) {
        if (this.nodeStates[node.id] === 'completed' ||
            this.nodeStates[node.id] === 'true' ||
            this.nodeStates[node.id] === 'false') {
          continue; // Skip already processed nodes
        }

        switch (node.type) {
          case 'dataFilter': {
            const result = this.processDataFilter(node);
            if (result && result.length > 0) progressMade = true;
            break;
          }

          case 'process': {
            const result = this.processProcessNode(node);
            if (result) {
              progressMade = true;
              // Pass data to next node
              const outgoingEdges = this.template.edges.filter(e => e.source === node.id);
              for (const edge of outgoingEdges) {
                const targetNode = this.template.nodes.find(n => n.id === edge.target);
                if (targetNode) {
                  if (targetNode.type === 'condition') {
                    const conditionResult = this.processConditionNode(targetNode, result);
                    if (conditionResult !== null) progressMade = true;
                  } else if (targetNode.type === 'sink') {
                    this.processSinkNode(targetNode, result);
                    progressMade = true;
                  }
                }
              }
            }
            break;
          }

          case 'condition': {
            // Conditions are processed when they receive data from process nodes
            break;
          }

          case 'sink': {
            // Sinks are processed when they receive data
            break;
          }
        }
      }

      // Check for condition-based routing
      for (const node of this.template.nodes) {
        if (node.type === 'condition' && (this.nodeStates[node.id] === 'true' || this.nodeStates[node.id] === 'false')) {
          const conditionPassed = this.nodeStates[node.id] === 'true';
          const prevNode = this.template.nodes.find(n =>
            this.template.edges.some(e => e.source === n.id && e.target === node.id)
          );

          if (prevNode && this.nodeData[prevNode.id]) {
            const outgoingEdges = this.template.edges.filter(e => e.source === node.id);

            for (const edge of outgoingEdges) {
              const shouldFollow = edge.condition === (conditionPassed ? 'true' : 'false');

              if (shouldFollow) {
                const targetNode = this.template.nodes.find(n => n.id === edge.target);
                if (targetNode && targetNode.type === 'process') {
                  const result = this.processCalculationNode(targetNode, this.nodeData[prevNode.id]);
                  if (result) progressMade = true;
                } else if (targetNode && targetNode.type === 'sink') {
                  this.processSinkNode(targetNode, this.nodeData[prevNode.id]);
                  progressMade = true;
                }
              }
            }
          }
        }
      }

      if (!progressMade) {
        console.log('\n⚠️  No progress made, workflow may be stuck or completed');
        break;
      }
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n\n' + '═'.repeat(80));
    console.log('📊 WORKFLOW EXECUTION SUMMARY');
    console.log('═'.repeat(80));

    console.log('\n🗂️  Node States:');
    for (const node of this.template.nodes) {
      const state = this.nodeStates[node.id] || 'not-processed';
      const emoji = {
        'completed': '✅',
        'matched': '✅',
        'true': '✅',
        'false': '❌',
        'waiting': '⏳',
        'no-match': '❌',
        'not-processed': '⚪'
      }[state] || '❓';

      console.log(`  ${emoji} ${node.id.padEnd(30)} [${node.type.padEnd(12)}] → ${state}`);
    }

    console.log('\n🎯 Sink Nodes:');
    const sinkNodes = this.template.nodes.filter(n => n.type === 'sink');
    const reachedSinks = sinkNodes.filter(n => this.nodeStates[n.id] === 'completed');

    for (const sink of sinkNodes) {
      const reached = this.nodeStates[sink.id] === 'completed';
      console.log(`  ${reached ? '✅' : '❌'} ${sink.config.name}`);
      if (reached && this.nodeData[sink.id]) {
        console.log('     Output:', JSON.stringify(this.nodeData[sink.id], null, 2).split('\n').join('\n     '));
      }
    }

    console.log('\n📈 Statistics:');
    console.log(`  Total Steps: ${this.steps}`);
    console.log(`  Nodes Processed: ${Object.keys(this.nodeStates).length}/${this.template.nodes.length}`);
    console.log(`  Sinks Reached: ${reachedSinks.length}/${sinkNodes.length}`);

    if (reachedSinks.length > 0) {
      console.log('\n🎉 SUCCESS! Workflow completed and reached sink node(s)');
    } else {
      console.log('\n⚠️  INCOMPLETE: Workflow did not reach any sink nodes');
      console.log('\n🔍 Debugging Info:');
      console.log('  Stuck nodes:', Object.entries(this.nodeStates)
        .filter(([_, state]) => state === 'waiting')
        .map(([id, _]) => id).join(', ') || 'none');
    }

    console.log('\n' + '═'.repeat(80));
  }
}

// Run the simulation
const engine = new SimpleWorkflowEngine(template, mockEvents);
engine.execute();
