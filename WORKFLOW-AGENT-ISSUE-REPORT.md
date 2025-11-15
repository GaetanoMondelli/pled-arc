# Workflow Agent Issue Report

## Problem Summary
The workflow agent at `https://workflow-agent-319413928411.us-central1.run.app/chat` successfully processes requests and completes all LangGraph steps, but **returns scenarios with 0 nodes**.

## Root Cause
The DSL parsing step (`parseDSLRequest` function) is returning an empty `newNodes` array, causing the scenario builder to create an empty workflow.

## Evidence

### Test Request
```javascript
{
  "message": "Create a simple workflow with a start node, a process node, and an end node",
  "scenario": null,
  "history": []
}
```

### Actual Response
```json
{
  "success": true,
  "operations": [{
    "result": {
      "nodesCreated": 0,
      "connectionsCreated": 0,
      "validationPassed": false
    }
  }],
  "scenario": undefined  // <-- MISSING!
}
```

### Expected Response
```json
{
  "success": true,
  "scenario": {
    "nodes": [
      { "nodeId": "...", "type": "DataSource", ... },
      { "nodeId": "...", "type": "ProcessNode", ... },
      { "nodeId": "...", "type": "Sink", ... }
    ],
    "edges": [...]
  },
  "operations": [{
    "result": {
      "nodesCreated": 3,
      "validationPassed": true
    }
  }]
}
```

## Technical Analysis

### Location of Issue
**File**: `services/workflow-agent/src/chat-workflow-agent.ts`
**Function**: `parseDSLRequest` (lines 179-308)

### The Problem
The function calls the Gemini AI model with a complex prompt (lines 204-281) and expects JSON output with this structure:

```json
{
  "analysis": "What needs to be done",
  "newNodes": [
    {
      "type": "MarkdownComment",
      "name": "...",
      "config": { "content": "..." }
    },
    {
      "type": "DataSource|ProcessNode|FSM|Queue|Sink|Multiplexer",
      "name": "unique name for this node",
      "config": { ... }
    }
  ],
  "connections": [...],
  "totalNodes": number,
  "reasoning": "Why this approach"
}
```

However, the AI model (`gemini-2.0-flash`) is either:
1. Not understanding the complex prompt structure
2. Returning malformed JSON
3. Returning JSON with an empty `newNodes` array

### Code Path
```
/chat endpoint (line 1173)
  ↓
app.invoke() (line 1217)
  ↓
analyzeContext() → parseDSLRequest() → buildScenario() → validateScenario() → reflection() → generateResponse()
  ↓
parseDSLRequest() calls Gemini AI (line 284)
  ↓
AI returns parsedRequest with newNodes=[] (line 289)
  ↓
buildScenario() creates scenario with 0 nodes (lines 430-522)
  ↓
generateResponse() returns scenario: undefined because no nodes (line 820)
```

## Recommended Fixes

### Option 1: Add Better Error Handling and Logging
Add logging before and after the AI call to see what's being returned:

```typescript
// Line 284 - BEFORE
console.log('🔍 [DSL] Sending prompt to AI:', prompt.substring(0, 500));
const result = await model.invoke(prompt);
console.log('🔍 [DSL] AI raw response:', result.content.toString());

const cleanText = result.content.toString()
  .replace(/```json\n?/g, '')
  .replace(/```\n?/g, '')
  .trim();
console.log('🔍 [DSL] Cleaned text:', cleanText);

const parsedRequest = JSON.parse(cleanText);
console.log('🔍 [DSL] Parsed request:', JSON.stringify(parsedRequest, null, 2));

// Validate that newNodes exists and is not empty
if (!parsedRequest.newNodes || parsedRequest.newNodes.length === 0) {
  console.error('❌ [DSL] AI returned empty newNodes array!');
  console.error('   Prompt was:', prompt);
  console.error('   AI response was:', result.content.toString());

  // Fallback: create default nodes based on simple parsing
  parsedRequest.newNodes = createFallbackNodes(state.userMessage);
}
```

### Option 2: Simplify the AI Prompt
The current prompt is ~77 lines with many rules. Try a simpler, more direct prompt:

```typescript
const prompt = `You are a workflow builder. Parse this request and create workflow nodes.

USER: "${state.userMessage}"

Return JSON with this exact structure:
{
  "analysis": "brief analysis",
  "newNodes": [
    {
      "type": "DataSource",
      "name": "Start Node",
      "config": { "description": "..." }
    },
    {
      "type": "ProcessNode",
      "name": "Process",
      "config": { "description": "..." }
    },
    {
      "type": "Sink",
      "name": "End",
      "config": { "description": "..." }
    }
  ],
  "connections": [
    {"from": "Start Node", "to": "Process"},
    {"from": "Process", "to": "End"}
  ]
}

RULES:
- Always include at least 1 MarkdownComment node FIRST
- Use exact types: DataSource, ProcessNode, Sink, FSM, Queue, Multiplexer, MarkdownComment
- Create NEW nodes, don't reference existing ones unless user says "@NodeName"`;
```

### Option 3: Use a More Capable Model
Try using `gemini-1.5-pro` instead of `gemini-2.0-flash` for better complex prompt understanding:

```typescript
// Line 134
model: process.env.AI_MODEL || "gemini-1.5-pro",
```

### Option 4: Add Fallback Node Creation
If AI fails, create basic nodes from simple string parsing:

```typescript
function createFallbackNodes(message: string): any[] {
  const nodes = [{
    type: "MarkdownComment",
    name: "Workflow Description",
    config: {
      content: `## User Request\n\n${message}\n\nAuto-generated basic workflow.`
    }
  }];

  // Simple detection
  if (message.toLowerCase().includes('start')) {
    nodes.push({ type: "DataSource", name: "Start", config: {} });
  }
  if (message.toLowerCase().includes('process')) {
    nodes.push({ type: "ProcessNode", name: "Process", config: {} });
  }
  if (message.toLowerCase().includes('end') || message.toLowerCase().includes('sink')) {
    nodes.push({ type: "Sink", name: "End", config: {} });
  }

  return nodes.length > 1 ? nodes : [
    ...nodes,
    { type: "DataSource", name: "Source", config: {} },
    { type: "Sink", name: "Sink", config: {} }
  ];
}
```

## Immediate Action Items

1. **Enable Debug Logging**: Add console.log statements around line 284-290 to see what the AI is actually returning
2. **Check API Key**: Verify the Gemini API key is valid and has proper quotas
3. **Test Model Directly**: Create a simple test to call Gemini directly with the prompt and see the raw response
4. **Try Different Model**: Switch from `gemini-2.0-flash` to `gemini-1.5-pro` or `gemini-1.5-flash`

## Testing Script

Create `test-dsl-parsing.js`:

```javascript
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
  model: "gemini-2.0-flash",
  temperature: 0.1
});

async function test() {
  const prompt = `Parse: "Create a workflow with start, process, and end nodes"

Return JSON:
{
  "newNodes": [
    {"type": "DataSource", "name": "Start", "config": {}},
    {"type": "ProcessNode", "name": "Process", "config": {}},
    {"type": "Sink", "name": "End", "config": {}}
  ],
  "connections": [{"from": "Start", "to": "Process"}, {"from": "Process", "to": "End"}]
}`;

  const result = await model.invoke(prompt);
  console.log("Raw response:", result.content.toString());

  try {
    const json = JSON.parse(result.content.toString().replace(/```json|```/g, ''));
    console.log("Parsed:", JSON.stringify(json, null, 2));
    console.log("Nodes count:", json.newNodes?.length || 0);
  } catch (e) {
    console.error("Parse error:", e.message);
  }
}

test();
```

## Contact
If you need help implementing these fixes, let me know which approach you'd like to take.

## Related Files
- `/Users/gaetano/dev/archackathon/services/workflow-agent/src/chat-workflow-agent.ts` (main issue)
- `/Users/gaetano/dev/archackathon/app/src/app/api/chat/route.ts` (API wrapper - already updated with better error handling)
