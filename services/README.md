# Services Test Suite

Test suite for verifying integration with Docling and Workflow Agent services.

## Services

### 1. Docling Service
- **Purpose**: Serverless PDF/document parsing to JSON
- **URL**: `https://a5fd808de8a8.ngrok-free.app`
- **Function**: Converts documents into structured data

### 2. Workflow Agent
- **Purpose**: AI agent for DSL suggestions
- **URL**: `https://workflow-agent-319413928411.us-central1.run.app/chat`
- **Function**: Analyzes documents and provides workflow/DSL recommendations

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables in `../app/.env.local`:
```bash
DOCLING_SERVICE_URL=https://a5fd808de8a8.ngrok-free.app
DOCLING_API_KEY=your-secure-api-key-here
WORKFLOW_AGENT_URL=https://workflow-agent-319413928411.us-central1.run.app/chat
```

## Running Tests

### Quick Start (Recommended)

Use the convenient test runner script:

```bash
# Test Docling service
./run-test.sh docling

# Test Workflow Agent
./run-test.sh workflow

# Test complete pipeline
./run-test.sh complete

# Run all tests
./run-test.sh all
```

The script will:
- Load environment variables from `../app/.env.local`
- Clean up old test results
- Run the test
- Show a summary of results

### Test Individual Services (Manual)

**Test Docling Service:**
```bash
npm run test:docling
```
Creates:
- `docling-output.json` - Full response
- `test-docling-summary.txt` - ⭐ Human-readable summary

**Test Workflow Agent:**
```bash
npm run test:workflow
```
Creates:
- `workflow-agent-output.json` - Full responses
- `test-workflow-agent-summary.txt` - ⭐ Human-readable summary

**Test Complete Workflow:**
```bash
npm run test:complete
```
Creates:
- `complete-workflow-docling.json` - Parsing result
- `complete-workflow-agent.json` - DSL suggestions
- `complete-workflow-summary.json` - Pipeline summary

### Run All Tests
```bash
npm test
```

## Test Files

- `test-docling.ts` - Docling service integration test
- `test-workflow-agent.ts` - Workflow Agent integration test
- `test-complete-workflow.ts` - End-to-end pipeline test

## Expected Outputs

After running tests, you'll find:

**Human-Readable Summaries** (check these first! ⭐):
- `test-docling-summary.txt` - Docling test summary
- `test-workflow-agent-summary.txt` - Workflow Agent test summary

**Full JSON Responses** (complete API data):
- `docling-output.json` - Parsed document from Docling
- `workflow-agent-output.json` - Agent responses
- `complete-workflow-docling.json` - Docling output from pipeline
- `complete-workflow-agent.json` - Agent output from pipeline
- `complete-workflow-summary.json` - Complete pipeline summary

**Error Files** (if tests fail):
- `test-docling-error.txt` - Docling error details
- `test-workflow-agent-error.txt` - Workflow Agent error details

See `TEST-OUTPUT-GUIDE.md` for detailed explanation of all output files.

## Document Processing Pipeline

```
document.pdf
    ↓
Docling Service (Parse)
    ↓
Structured JSON
    ↓
Workflow Agent (Analyze)
    ↓
DSL Suggestions
```

## Example Usage in App

```typescript
// 1. Parse document
const docResponse = await fetch(process.env.DOCLING_SERVICE_URL + '/parse', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.DOCLING_API_KEY}`
  },
  body: JSON.stringify({ document: base64Doc })
});
const parsed = await docResponse.json();

// 2. Get DSL suggestions
const agentResponse = await fetch(process.env.WORKFLOW_AGENT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: parsed.text,
    scenario: 'contract-analysis',
    history: []
  })
});
const suggestions = await agentResponse.json();
```

## Troubleshooting

**CORS Issues:**
- Docling uses ngrok, add `ngrok-skip-browser-warning` header

**Authentication:**
- Ensure `DOCLING_API_KEY` is set correctly

**Network Issues:**
- Check if services are accessible
- Verify ngrok tunnel is active for Docling
- Confirm Workflow Agent Cloud Run service is deployed

## Notes

- Tests use TypeScript with `tsx` for execution
- All tests are standalone and can run independently
- Output files are saved to the `services/` directory
- Environment variables are read from parent `app/.env.local`
